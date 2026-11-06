'use client';
import { useMemo, useState } from 'react';
import { useApi } from '@/lib/api';
import { qs } from '@/lib/format';
import { MOODS } from '@/lib/moods';
import { thumbOf } from '@/lib/tracks';
import { useLibrary } from '@/stores/library';
import { usePlayer } from '@/stores/player';
import { useSettings } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import MediaCard from './MediaCard';
import { ApiSection, Section } from './Section';
import { CardSkeleton, ErrorBox } from './States';

// ✅ Ganti semua endpoint ke /api/spotify/
const CHART = '/api/spotify/chart?region=ID';
const search = (q: string, extra: Record<string, string> = {}) =>
  '/api/spotify/search?' + qs({ q, ...extra });

export default function HomeView() {
  const [mood, setMood] = useState<string | null>(null);
  // ✅ status selalu configured=true, tidak butuh API key
  const status = useApi<{ configured: boolean }>('/api/spotify/status');
  const recents = useLibrary((s) => s.recents);
  const q = useSettings((s) => s.thumbQ);
  const m = MOODS.find((x) => x.id === mood) ?? null;
  const configured = status.data?.configured ?? true;

  // ✅ source sekarang 'spotify' bukan 'youtube'
  const lastArtist = useMemo(() => recents.find((r) => r.source === 'spotify')?.artist, [recents]);

  return (
    <div className="pt-2">
      <div
        role="group"
        aria-label="Pilih mood"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
      >
        {MOODS.map((x) => {
          const on = x.id === mood;
          return (
            <button
              key={x.id}
              onClick={() => setMood(on ? null : x.id)}
              aria-pressed={on}
              className="pill glass text-fg"
            >
              {x.label}
            </button>
          );
        })}
      </div>

      {status.error && (
        <div className="mt-6">
          <ErrorBox message={status.error.message} onRetry={status.retry} />
        </div>
      )}

      {/* ✅ Dihapus: notifikasi API key YouTube */}

      {!configured && !status.error && (
        <Section title="Pilihan Cepat">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </Section>
      )}

      {configured && (
        <ApiSection
          title={m ? `Pilihan Cepat · ${m.label}` : 'Pilihan Cepat'}
          url={m ? search(m.q, { music: '1' }) : CHART}
          from={0}
          to={10}
        />
      )}

      <Section title="Baru Diputar">
        {recents.length === 0 ? (
          <p className="py-6 text-sm text-muted">
            Belum ada lagu yang diputar. Lagu yang kamu dengarkan akan muncul di sini.
          </p>
        ) : (
          recents.slice(0, 12).map((t, i, arr) => (
            <MediaCard
              key={t.id}
              title={t.title}
              subtitle={t.artist}
              thumb={thumbOf(t, q)}
              label={`Putar ${t.title} oleh ${t.artist}`}
              onClick={() => usePlayer.getState().playTracks(arr, i)}
              onMenu={() => useUI.getState().openMenu(t)}
            />
          ))
        )}
      </Section>

      {configured && (
        <>
          <ApiSection
            title="Rekomendasi Untukmu"
            subtitle={lastArtist ? `Karena kamu baru mendengarkan ${lastArtist}` : undefined}
            url={search(lastArtist ? `${lastArtist} lagu` : 'lagu terbaik indonesia', { music: '1' })}
          />
          <ApiSection title="Hits Indonesia" url={CHART} from={10} to={30} />
          <ApiSection title="Pop Indonesia" url={search('lagu pop indonesia', { music: '1' })} />
          <ApiSection title="Rock Indonesia" url={search('lagu rock indonesia', { music: '1' })} />
          <ApiSection title="Indie Indonesia" url={search('lagu indie indonesia', { music: '1' })} />
          <ApiSection title="Musik Nostalgia" url={search('lagu nostalgia indonesia 2000an', { music: '1' })} />

          {m ? (
            <ApiSection
              title={`Berdasarkan Mood · ${m.label}`}
              subtitle="Playlist yang cocok dengan moodmu"
              url={search(m.q, { type: 'playlist' })}
            />
          ) : (
            <Section title="Berdasarkan Mood">
              <p className="py-4 text-sm text-muted">
                Pilih salah satu mood di atas untuk melihat lagu dan playlist yang cocok.
              </p>
            </Section>
          )}

          <ApiSection title="Temukan Artis" url={search('penyanyi indonesia', { type: 'channel' })} />
          <ApiSection
            title="Playlist Pilihan"
            url={search('playlist lagu indonesia terbaik', { type: 'playlist' })}
          />
          <ApiSection title="Hasil Populer" url={CHART} from={30} to={50} />
        </>
      )}
    </div>
  );
}
