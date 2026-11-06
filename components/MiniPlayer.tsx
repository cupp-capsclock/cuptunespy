'use client';
import { SkipBack, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/stores/player';
import { useSlot } from '@/stores/slot';
import Artwork from './Artwork';
import { PlayPauseButton, ProgressLine, VolumeControl } from './PlayerControls';

export default function MiniPlayer() {
  const track = usePlayer((s) => s.queue[s.index]);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const setExpanded = usePlayer((s) => s.setExpanded);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const slotRef = useCallback((el: HTMLElement | null) => useSlot.getState().set('mini', el), []);

  const y0 = useRef<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const trackId = track?.id;
  useEffect(() => setHidden(false), [trackId]);
  useEffect(() => {
    if (status === 'loading') setHidden(false);
  }, [status]);

  if (!track) return null;
  const sub = status === 'error' && error ? error : status === 'loading' ? 'Memuat…' : track.artist;

  return (
    <>
      <div
        aria-hidden={hidden || undefined}
        className={`fixed inset-x-3 mx-auto max-w-md md:max-w-none bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] z-40 transition-[transform,opacity] duration-300 ease-out md:bottom-4 md:left-[15.5rem] md:right-4 ${hidden ? 'pointer-events-none translate-y-[calc(100%+6rem)] opacity-0 md:pointer-events-auto md:translate-y-0 md:opacity-100' : ''}`}
      >
        <div
          onTouchStart={(e) => (y0.current = e.touches[0].clientY)}
          onTouchEnd={(e) => {
            if (y0.current !== null) {
              const dy = e.changedTouches[0].clientY - y0.current;
              if (dy < -40) setExpanded(true);
              else if (dy > 40) setHidden(true);
            }
            y0.current = null;
          }}
          className="relative flex h-14 items-center gap-1 glass-strong rounded-full pr-2 pl-1 shadow-[0_8px_30px_-6px_rgb(var(--cover)/0.45)]"
        >
          <ProgressLine />
          <button onClick={() => setExpanded(true)} aria-label={`Buka pemutar: ${track.title}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 text-left">
            {/* ✅ Ganti 'youtube' -> 'spotify' */}
            {track.source === 'spotify' ? (
              <span ref={slotRef} className="block h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface">
                <Artwork track={track} size={40} />
              </span>
            ) : (
              <Artwork track={track} size={40} />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{track.title}</span>
              <span className={`block truncate text-xs ${status === 'error' ? 'text-red-400' : 'text-muted'}`}>{sub}</span>
            </span>
          </button>
          <button onClick={() => prev()} aria-label="Lagu sebelumnya" className="press hidden h-10 w-10 items-center justify-center rounded-full md:flex">
            <SkipBack size={20} fill="currentColor" aria-hidden="true" />
          </button>
          <PlayPauseButton size="sm" />
          <button onClick={() => next()} aria-label="Lagu berikutnya" className="press flex h-10 w-10 items-center justify-center rounded-full">
            <SkipForward size={20} fill="currentColor" aria-hidden="true" />
          </button>
          <VolumeControl className="ml-2 hidden w-36 lg:flex" />
        </div>
      </div>
    </>
  );
}
