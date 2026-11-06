'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react';
import { NAV, isActive } from './Sidebar';

/**
 * Dock Liquid Glass melayang (3 item, di tengah).
 *
 * Gesture (Pointer Events, tanpa library):
 *  - Geser horizontal di dock: lensa kaca mengikuti jari (Beranda → Cari → Pustaka).
 *  - touch-action: pan-y → scroll vertikal halaman tetap milik browser; dock hanya mengambil gerak horizontal
 *    setelah melewati ambang, sehingga ketukan biasa dan carousel lagu (area lain) tidak terganggu.
 */

const ITEMS = NAV.map(({ href, label, Icon }) => ({ href: href as string, label, Icon }));
const N = ITEMS.length;
const SLOP = 8; // ambang px sebelum gesture dianggap geser

/* Gaya dock Liquid Glass (disatukan di file ini agar komponen mandiri). */
const DOCK_CSS = `
  /* Dock Liquid Glass: kapsul transparan, blur halus, tepi tipis, kilau & pantulan cahaya. */
  .dock {
    --dock-fill-a: 255 255 255 / 0.16;
    --dock-fill-b: 255 255 255 / 0.04;
    --dock-edge: 255 255 255 / 0.28;
    position: relative;
    isolation: isolate;
    touch-action: pan-y; /* scroll vertikal tetap normal; geser horizontal diurus JS */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    background: linear-gradient(135deg, rgb(var(--dock-fill-a)), rgb(var(--dock-fill-b)) 48%, rgb(var(--dock-fill-a)));
    border: 1px solid rgb(var(--dock-edge));
    box-shadow:
      inset 0 1px 1px rgb(255 255 255 / 0.45),
      inset 0 -1px 1px rgb(255 255 255 / 0.12),
      inset 0 0 18px rgb(255 255 255 / 0.06),
      0 14px 34px -10px rgb(0 0 0 / 0.6),
      0 2px 8px rgb(0 0 0 / 0.25);
  }
  .dock::before { /* kilau permukaan atas */
    content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
    background: radial-gradient(120% 90% at 18% -10%, rgb(255 255 255 / 0.32), transparent 52%),
                radial-gradient(90% 70% at 92% 120%, rgb(var(--accent) / 0.16), transparent 60%);
  }
  .dock::after { /* garis pantulan tipis */
    content: ''; position: absolute; left: 12%; right: 12%; top: 3px; height: 1px; z-index: -1; pointer-events: none;
    background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.7), transparent);
  }
  @supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
    .dock {
      -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 8px)) saturate(calc(var(--glass-sat) + 30%));
      backdrop-filter: blur(calc(var(--glass-blur) + 8px)) saturate(calc(var(--glass-sat) + 30%));
    }
  }
  @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
    .dock { background: rgb(var(--surface) / 0.94); }
  }
  html[data-glass='off'] .dock { background: rgb(var(--surface) / 0.96); }
  html[data-theme='light'] .dock {
    --dock-fill-a: 255 255 255 / 0.62;
    --dock-fill-b: 255 255 255 / 0.3;
    --dock-edge: 255 255 255 / 0.9;
    box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.95), inset 0 -1px 1px rgb(255 255 255 / 0.4), 0 14px 34px -12px rgb(30 40 80 / 0.4), 0 2px 8px rgb(30 40 80 / 0.12);
  }
  .dock-item { -webkit-tap-highlight-color: transparent; transition: color .25s ease, transform .15s ease; }
  .dock-icon { transition: transform .35s cubic-bezier(.34, 1.56, .64, 1); }

  /* Lensa kaca di bawah ikon aktif; bergeser seperti tetesan cairan. */
  .dock-lens {
    --dx: 0px; --s: 1;
    position: absolute; inset: 0 auto 0 0; width: 33.3334%; z-index: 0; pointer-events: none;
    transform: translate3d(calc(var(--i) * 100% + var(--dx)), 0, 0) scale(var(--s));
    transition: transform .45s cubic-bezier(.34, 1.4, .64, 1), opacity .2s ease;
    will-change: transform;
  }
  .dock-lens[data-hidden] { opacity: 0; }
  .dock-lens > span {
    position: absolute; inset: 0; border-radius: 9999px;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.26), rgb(255 255 255 / 0.05) 60%), rgb(var(--accent) / 0.2);
    border: 1px solid rgb(var(--accent) / 0.5);
    box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.55), inset 0 -6px 12px -6px rgb(var(--accent) / 0.45), 0 4px 18px -4px rgb(var(--accent) / 0.55);
    transition: transform .25s cubic-bezier(.34, 1.56, .64, 1);
  }
  .dock[data-dragging] .dock-lens { transition: none; }
  .dock[data-dragging] .dock-lens > span { transform: scale(1.1, 1.06); }

`;

const reducedMotion = () => {
  const m = document.documentElement.dataset.motion;
  return m === 'off' || (m !== 'on' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const capture = (el: HTMLElement, id: number) => {
  try {
    el.setPointerCapture(id);
  } catch {
    /* pointer sudah tidak aktif */
  }
};

export default function BottomNav() {
  const path = usePathname();
  const router = useRouter();

  const routeIdx = NAV.findIndex((n) => isActive(path, n.href));
  const active = routeIdx; // -1 = halaman di luar dock (mis. Pengaturan)
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? active;

  const dockRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const suppress = useRef(false); // abaikan klik yang menyusul setelah geser
  const g = useRef({ id: -1, x: 0, y: 0, engaged: false, w: 1, t: 0, lx: 0, lt: 0, v: 0 });

  const endSuppress = () => setTimeout(() => (suppress.current = false), 60);

  const goTo = (i: number) => {
    const href = ITEMS[i].href;
    if (!isActive(path, href)) router.push(href);
    if (typeof navigator.vibrate === 'function') navigator.vibrate(8);
  };

  const setDx = (px: number) => lensRef.current?.style.setProperty('--dx', `${px}px`);
  const resetDrag = () => {
    dockRef.current?.removeAttribute('data-dragging');
    setDx(0);
    setPreview(null);
  };

  /* ───────── Gesture dock ───────── */
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (active < 0) return;
    const w = (navRef.current?.getBoundingClientRect().width ?? 0) / N;
    Object.assign(g.current, { id: e.pointerId, x: e.clientX, y: e.clientY, engaged: false, w: w || 1, lx: e.clientX, lt: e.timeStamp, v: 0 });
  };

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.engaged) {
      if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) return void (s.id = -1); // gerak vertikal: serahkan ke scroll halaman
      if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      s.engaged = true;
      capture(e.currentTarget, e.pointerId);
      dockRef.current?.setAttribute('data-dragging', '');
    }
    const dt = e.timeStamp - s.lt;
    if (dt > 0) s.v = (e.clientX - s.lx) / dt; // px/ms
    s.lx = e.clientX;
    s.lt = e.timeStamp;

    let eff = dx - Math.sign(dx) * SLOP;
    const lo = -active * s.w;
    const hi = (N - 1 - active) * s.w;
    if (eff < lo) eff = lo + (eff - lo) * 0.25; // karet di ujung dock
    if (eff > hi) eff = hi + (eff - hi) * 0.25;
    if (!reducedMotion()) setDx(eff);
    const p = clamp(Math.round(active + eff / s.w), 0, N - 1);
    setPreview((cur) => (cur === p ? cur : p));
  };

  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    s.id = -1;
    if (!s.engaged) return;
    s.engaged = false;
    suppress.current = true;
    endSuppress();
    const raw = (e.clientX - s.x - Math.sign(e.clientX - s.x) * SLOP) / s.w;
    const flick = Math.abs(s.v) > 0.5 && Math.abs(raw) > 0.15;
    const steps = Math.abs(raw) >= 0.35 ? Math.sign(raw) * Math.max(1, Math.round(Math.abs(raw))) : flick ? Math.sign(s.v) : 0;
    const target = clamp(active + steps, 0, N - 1);
    resetDrag();
    if (target !== active) goTo(target);
  };

  const onCancel = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== g.current.id) return;
    g.current.id = -1;
    g.current.engaged = false;
    resetDrag();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 flex justify-center md:hidden">
      <style dangerouslySetInnerHTML={{ __html: DOCK_CSS }} />

      <div
        ref={dockRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (suppress.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="dock pointer-events-auto flex h-16 w-[19.5rem] max-w-[calc(100vw-1.5rem)] items-center rounded-full p-1.5"
      >
        <nav aria-label="Navigasi utama" ref={navRef} className="relative h-full min-w-0 flex-1">
          <div ref={lensRef} aria-hidden="true" className="dock-lens" data-hidden={active < 0 || undefined} style={{ '--i': Math.max(active, 0) } as CSSProperties}>
            <span />
          </div>
          <ul className="relative grid h-full grid-cols-3">
            {ITEMS.map(({ href, label, Icon }, i) => {
              const on = shown === i;
              const cls = `dock-item press relative flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium leading-none ${on ? 'text-accent' : 'text-muted'}`;
              const inner = (
                <>
                  <Icon size={22} aria-hidden="true" className={`dock-icon ${on ? 'scale-110' : ''}`} />
                  <span className="max-w-full truncate">{label}</span>
                </>
              );
              return (
                <li key={label} className="min-w-0">
                  <Link href={href} draggable={false} aria-current={active === i ? 'page' : undefined} className={cls}>
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
