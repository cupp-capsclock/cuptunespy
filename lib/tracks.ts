/**
 * lib/tracks.ts
 * Versi Spotify — artwork dari spotmp3, bukan dari ytimg.com
 */

import type { SearchItem, Track } from './types';

export type ThumbQ = 'low' | 'high';

export function toTrack(it: SearchItem): Track {
  return {
    id: `sp:${it.id}`,
    source: 'spotify',
    videoId: it.id, // dipakai oleh PlayerEngine untuk streaming (tetap diperlukan)
    title: it.title,
    artist: it.subtitle,
    durationSec: it.durationSec,
    // simpan artwork Spotify langsung di album field sementara
    album: (it as SearchItem & { sourceUrl?: string }).sourceUrl,
  };
}

export function thumbOf(t: Track, _q: ThumbQ = 'low'): string | undefined {
  // Spotify: artwork disimpan di coverUrl (field tambahan) atau diambil dari SearchItem
  if (t.coverUrl) return t.coverUrl;
  // Fallback: tidak ada thumbnail YouTube lagi
  return undefined;
}

export type SortKey = 'date' | 'title' | 'artist';

export function sortTracks(list: Track[], by: SortKey): Track[] {
  const c = [...list];
  if (by === 'title') c.sort((a, b) => a.title.localeCompare(b.title, 'id'));
  else if (by === 'artist') c.sort((a, b) => a.artist.localeCompare(b.artist, 'id'));
  else c.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  return c;
}

export function shuffled<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
