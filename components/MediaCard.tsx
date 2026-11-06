'use client';
import { MoreVertical, Music2, Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Props {
  title: string;
  subtitle: string;
  thumb?: string;
  round?: boolean;
  onClick?: () => void;
  href?: string;
  onMenu?: () => void;
  label: string;
}

export default function MediaCard({ title, subtitle, thumb, round, onClick, href, onMenu, label }: Props) {
  const [bad, setBad] = useState(false);
  const art = (
    <span className={`relative block aspect-square w-full overflow-hidden bg-surface2 ring-1 ring-white/10 ${round ? 'rounded-full' : 'rounded-2xl'}`}>
      {thumb && !bad ? (
        <img src={thumb} alt={`Sampul ${title}`} loading="lazy" decoding="async" onError={() => setBad(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted">
          <Music2 size={32} aria-hidden="true" />
        </span>
      )}
      {!round && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />}
      {onClick && (
        <span className="pointer-events-none absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_6px_16px_-4px_rgb(var(--accent)/0.8),inset_0_1px_0_rgb(255_255_255/0.4)]">
          <Play size={16} fill="currentColor" aria-hidden="true" />
        </span>
      )}
    </span>
  );
  const text = (
    <span className={`mt-2 block ${round ? 'text-center' : ''}`}>
      <span className="line-clamp-2 block text-sm font-medium leading-snug">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>
    </span>
  );
  const cls = 'press block w-full rounded-2xl text-left';
  return (
    <div className="relative w-36 shrink-0 snap-start sm:w-40">
      {href ? (
        <Link href={href} aria-label={label} className={cls}>
          {art}
          {text}
        </Link>
      ) : (
        <button onClick={onClick} aria-label={label} className={cls}>
          {art}
          {text}
        </button>
      )}
      {onMenu && (
        <button onClick={onMenu} aria-label={`Menu untuk ${title}`} className="press glass absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full !bg-black/35 text-white">
          <MoreVertical size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
