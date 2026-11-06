/**
 * lib/server/spotify.ts
 * Scraper spotmp3.net — pengganti youtube.ts
 * Tidak butuh API key, semua data dari spotmp3.net
 */

import type { ErrorCode, SearchItem, SearchResponse } from '@/lib/types';

const BASE_URL = 'https://spotmp3.net';
const API_SEARCH = `${BASE_URL}/api/v1/search`;
const TIMEOUT_MS = 25_000;
const MIN = 60_000;

// ---- Error class (sama seperti ApiError di youtube.ts agar guard.ts tetap kompatibel) ----
export class ApiError extends Error {
  constructor(public code: ErrorCode, public status: number, message: string) {
    super(message);
  }
}

// ---- Simple in-memory cache ----
const cache = new Map<string, { exp: number; data: unknown }>();
const MAX_CACHE = 300;

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data as T;
  return null;
}
function cacheSet(key: string, data: unknown, ttlMs: number) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(key, { exp: Date.now() + ttlMs, data });
}

// ---- Cookie jar otomatis ----
const cookieJar = new Map<string, string>();
let warmed = false;

function parseCookies(res: Response) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return;
  for (const line of raw.split(',')) {
    const pair = line.split(';')[0].trim();
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value) cookieJar.set(name, value);
    }
  }
}

function cookieHeader(): string {
  const entries = [...cookieJar.entries()];
  return entries.map(([k, v]) => `${k}=${v}`).join('; ');
}

function baseHeaders(): HeadersInit {
  const h: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL,
  };
  const ck = cookieHeader();
  if (ck) h['Cookie'] = ck;
  return h;
}

async function warmCookies() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(BASE_URL, { headers: baseHeaders(), signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    parseCookies(res);
  } catch {
    // lanjut tanpa cookie
  }
  warmed = true;
}

// ---- Tipe raw dari spotmp3 ----
interface RawItem {
  id?: string;
  type?: string;
  title?: string;
  subtitle?: string;
  cover?: string;
  thumbnail?: string;
  url?: string;
  duration_ms?: number;
  total_tracks?: number;
  album?: string;
}
interface RawSection {
  type?: string;
  items?: RawItem[];
  next_offset?: number;
  total?: number;
}
interface RawResponse {
  sections?: RawSection[];
  items?: RawItem[];
  type?: string;
}

// ---- Mapping hasil spotmp3 -> SearchItem ----
const SECTION_ORDER = ['track', 'artist', 'album', 'playlist', 'podcast', 'episode'];

function formatDuration(ms: number): number {
  return Math.round(ms / 1000);
}

function mapItem(item: RawItem, fallbackType?: string): SearchItem {
  const type = (item.type || fallbackType || 'track').toLowerCase();
  const artist = item.subtitle
    ? item.subtitle.split(/[·•]\s*/)[0].trim()
    : 'Artis tidak diketahui';

  return {
    kind: type === 'track' ? 'video' : type === 'artist' ? 'channel' : 'playlist',
    id: item.id ?? '',
    title: item.title ?? 'Tanpa judul',
    subtitle: artist,
    thumb: item.cover || item.thumbnail || '',
    durationSec: item.duration_ms ? formatDuration(item.duration_ms) : undefined,
    // field tambahan Spotify
    sourceUrl: item.url || (item.id && type === 'track' ? `https://open.spotify.com/track/${item.id}` : ''),
    spotifyType: type,
  };
}

// ---- Core fetch ----
async function spotifyFetch(q: string, offset = 0, ttlMs = 10 * MIN): Promise<RawResponse> {
  if (!warmed) await warmCookies();

  const ck = `${q}::${offset}`;
  const hit = cacheGet<RawResponse>(ck);
  if (hit) return hit;

  const params = new URLSearchParams({ q });
  if (offset > 0) params.set('offset', String(offset));
  const url = `${API_SEARCH}?${params}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { headers: baseHeaders(), signal: ctrl.signal, cache: 'no-store' });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === 'AbortError') throw new ApiError('TIMEOUT', 504, 'Spotmp3 terlalu lama merespons. Coba lagi.');
    throw new ApiError('UPSTREAM', 502, 'Tidak dapat menghubungi spotmp3.net.');
  } finally {
    clearTimeout(timer);
  }

  parseCookies(res);

  if (res.status === 429) {
    warmed = false;
    throw new ApiError('RATE_LIMIT', 429, 'Terlalu banyak permintaan ke spotmp3. Coba lagi nanti.');
  }
  if (res.status === 403) {
    warmed = false;
    throw new ApiError('UPSTREAM', 503, 'Akses ke spotmp3 diblokir sementara. Coba lagi nanti.');
  }
  if (!res.ok) throw new ApiError('UPSTREAM', 502, `Spotmp3 mengembalikan HTTP ${res.status}.`);

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    warmed = false;
    throw new ApiError('UPSTREAM', 503, 'Spotmp3 mengembalikan halaman HTML. Coba lagi nanti.');
  }

  let body: RawResponse;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('BAD_RESPONSE', 502, 'Respons dari spotmp3 tidak valid.');
  }

  cacheSet(ck, body, ttlMs);
  return body;
}

// ---- Flatten sections -> SearchItem[] ----
async function fetchAll(q: string, limit = 40): Promise<SearchItem[]> {
  const data = await spotifyFetch(q);
  const sections = (data.sections ?? []).slice().sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a.type ?? '');
    const ib = SECTION_ORDER.indexOf(b.type ?? '');
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const out: SearchItem[] = [];
  for (const sec of sections) {
    if (out.length >= limit) break;
    for (const item of sec.items ?? []) {
      if (!item.id) continue;
      out.push(mapItem(item, sec.type));
      if (out.length >= limit) break;
    }
  }

  // Fallback: top-level items
  if (out.length === 0 && data.items) {
    for (const item of data.items) {
      if (!item.id) continue;
      out.push(mapItem(item, item.type || 'track'));
      if (out.length >= limit) break;
    }
  }

  return out;
}

// ---- Public endpoints (kompatibel dengan kontrak yang dipakai SearchView & HomeView) ----

/**
 * Cari lagu/artis/playlist.
 * type: 'video' (lagu) | 'channel' (artis) | 'playlist'
 */
export async function search(q: string, type: 'video' | 'channel' | 'playlist'): Promise<SearchResponse> {
  const all = await fetchAll(q, 40);

  // Filter berdasarkan type
  const kindMap: Record<string, string> = { video: 'track', channel: 'artist', playlist: 'playlist' };
  const target = kindMap[type];
  const filtered = all.filter((it) => (it as SearchItem & { spotifyType?: string }).spotifyType === target || (type === 'video' && it.kind === 'video'));

  // Kalau filter kosong (sering terjadi untuk 'channel'/'playlist' di query umum), pakai semua
  const items = filtered.length > 0 ? filtered : all.filter((it) => it.kind === (type === 'video' ? 'video' : type === 'channel' ? 'channel' : 'playlist'));

  return { items: items.length > 0 ? items : all.slice(0, 20) };
}

/**
 * Chart / trending — simulasikan dengan query populer karena spotmp3 tidak punya endpoint chart.
 */
export async function chart(region: string): Promise<SearchResponse> {
  const qMap: Record<string, string> = {
    ID: 'lagu hits indonesia terbaru',
    US: 'top hits usa',
    GB: 'top hits uk',
    AU: 'top hits australia',
  };
  const q = qMap[region] ?? qMap['ID'];
  const items = await fetchAll(q, 50);
  return { items: items.filter((it) => it.kind === 'video') };
}

export const isConfigured = () => true; // tidak butuh API key
