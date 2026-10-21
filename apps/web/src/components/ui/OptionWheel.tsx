'use client';

/**
 * Roda pilihan React Bits OptionWheel (port TS dari kode owner, DEC-126) — dipakai sebagai menu GnD Lab.
 * Tambahan: `selected` (terkendali dari luar, mis. ?t= di URL / asisten suara) & `itemTestId` untuk uji/asisten.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

export interface OptionWheelProps {
  items?: readonly string[];
  defaultSelected?: number;
  /** Indeks terpilih dari luar; roda berputar ke sana tanpa memanggil onChange. */
  selected?: number;
  onChange?: (index: number, item: string) => void;
  textColor?: string;
  activeColor?: string;
  side?: 'left' | 'right';
  fontSize?: number;
  spacing?: number;
  curve?: number;
  tilt?: number;
  blur?: number;
  fade?: number;
  minOpacity?: number;
  smoothing?: number;
  inset?: number;
  loop?: boolean;
  draggable?: boolean;
  soundUrl?: string;
  soundVolume?: number;
  className?: string;
  label?: string;
  itemTestId?: (index: number) => string;
  'data-testid'?: string;
}

const DEFAULT_ITEMS = ['Ambient', 'House', 'Techno', 'Jazz', 'Lo-Fi', 'Synthwave', 'Trance', 'Funk', 'Disco', 'Hip-Hop', 'Chillwave', 'Drum & Bass'];

export default function OptionWheel({
  items = DEFAULT_ITEMS,
  defaultSelected = 3,
  selected,
  onChange,
  textColor = '#a6a6a6',
  activeColor = '#ffffff',
  side = 'left',
  fontSize = 3,
  spacing = 1.4,
  curve = 1,
  tilt = 6,
  blur = 2,
  fade = 0.25,
  minOpacity = 0.05,
  smoothing = 200,
  inset = 80,
  loop = false,
  draggable = true,
  soundUrl = '',
  soundVolume = 0.5,
  className = '',
  label = 'Option wheel',
  itemTestId,
  'data-testid': testId,
}: OptionWheelProps) {
  const start = selected ?? defaultSelected;
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef(start);
  const targetRef = useRef(start);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const selectedRef = useRef(start);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ y: number; start: number; id: number } | null>(null);
  const dragMovedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef('');
  const lastTickRef = useRef(0);
  const silentRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(start);
  const [isDragging, setIsDragging] = useState(false);

  const remPx = typeof window !== 'undefined' ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 16;

  onChangeRef.current = onChange;
  const cfg = { count: items.length, items, rowH: Math.max(fontSize * spacing * remPx, 1), curve, tilt, blur, fade, minOpacity, side, loop, smoothing, draggable, soundUrl, soundVolume };
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  // Satu loop rAF: posisi roda didekatkan ke target (eksponensial, tak bergantung frame rate), lalu tiap pilihan
  // ditata di sepanjang lengkung sesuai jaraknya dari posisi sekarang.
  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const c = cfgRef.current;
    const tau = Math.max(c.smoothing, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);
    const target = targetRef.current;
    let next = posRef.current + (target - posRef.current) * k;
    const settled = Math.abs(target - next) < 0.001;
    if (settled) next = target;
    posRef.current = next;

    const n = c.count;
    const mirror = c.side === 'right' ? -1 : 1;
    const tiltRad = (c.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? c.rowH / tiltRad : 0;
    for (let i = 0; i < n; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      let d = i - next;
      if (c.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const dist = Math.abs(d);
      let x = 0;
      let y = d * c.rowH;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang);
        x = -mirror * R * (1 - Math.cos(ang)) * c.curve;
        rot = (mirror * ang * 180) / Math.PI;
      }
      el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      el.style.opacity = String(Math.max(c.minOpacity, 1 - dist * c.fade));
      el.style.filter = c.blur > 0 ? `blur(${(dist * c.blur).toFixed(2)}px)` : 'none';
      el.style.setProperty('--ow-p', Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
    }
    rafRef.current = settled ? null : requestAnimationFrame(runFrame);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  // bunyi klik opsional saat pilihan berganti (dibatasi agar tidak beruntun; gagal putar diabaikan)
  const playTick = useCallback(() => {
    const { soundUrl: url, soundVolume: vol } = cfgRef.current;
    if (!url) return;
    const now = performance.now();
    if (now - lastTickRef.current < 70) return;
    lastTickRef.current = now;
    if (!audioRef.current || audioUrlRef.current !== url) {
      audioRef.current = new Audio(url);
      audioRef.current.preload = 'auto';
      audioUrlRef.current = url;
    }
    const audio = audioRef.current;
    audio.volume = Math.min(Math.max(vol, 0), 1);
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  }, []);

  const applyTarget = useCallback(
    (value: number, snap: boolean) => {
      const c = cfgRef.current;
      let v = value;
      if (!c.loop) v = Math.min(Math.max(v, 0), Math.max(c.count - 1, 0));
      if (snap) v = Math.round(v);
      targetRef.current = v;
      const idx = ((Math.round(v) % c.count) + c.count) % c.count;
      if (idx !== selectedRef.current) {
        selectedRef.current = idx;
        setSelectedIndex(idx);
        if (!silentRef.current) {
          onChangeRef.current?.(idx, c.items[idx]!);
          playTick();
        }
      }
      startLoop();
    },
    [startLoop, playTick],
  );

  // pilihan dari luar (URL / asisten suara) → putar ke sana tanpa onChange
  useEffect(() => {
    if (selected == null || selected === selectedRef.current) return;
    silentRef.current = true;
    applyTarget(selected, true);
    silentRef.current = false;
  }, [selected, applyTarget]);

  // gulir roda / touchpad — didaftarkan manual agar bisa non-pasif
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const c = cfgRef.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      // di ujung daftar (tanpa loop) gulir ke luar diteruskan ke halaman, bukan ditahan roda (DEC-127)
      if (!c.loop && ((delta < 0 && targetRef.current <= 0) || (delta > 0 && targetRef.current >= c.count - 1))) return;
      e.preventDefault();
      // maks. satu langkah per event: roda mouse bertakik bergeser tepat satu pilihan
      const step = Math.max(-1, Math.min(1, delta / c.rowH));
      applyTarget(targetRef.current + step, false);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => applyTarget(targetRef.current, true), 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [applyTarget]);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!cfgRef.current.draggable) return;
    dragRef.current = { y: e.clientY, start: targetRef.current, id: e.pointerId };
    dragMovedRef.current = false;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!dragMovedRef.current && Math.abs(dy) > 4) {
        dragMovedRef.current = true;
        // tangkap pointer hanya setelah benar-benar diseret, agar klik biasa tetap sampai ke pilihan
        rootRef.current?.setPointerCapture(drag.id);
      }
      if (dragMovedRef.current) applyTarget(drag.start - dy / cfgRef.current.rowH, false);
    },
    [applyTarget],
  );

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    if (dragMovedRef.current) applyTarget(targetRef.current, true);
  }, [applyTarget]);

  const handleItemClick = useCallback(
    (index: number) => {
      if (dragMovedRef.current) return;
      const c = cfgRef.current;
      const cur = targetRef.current;
      let d = index - (((cur % c.count) + c.count) % c.count);
      if (c.loop && c.count > 1) {
        if (d > c.count / 2) d -= c.count;
        else if (d < -c.count / 2) d += c.count;
      }
      applyTarget(cur + d, true);
    },
    [applyTarget],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      let delta: number | null = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
      if (delta == null) return;
      e.preventDefault();
      applyTarget(Math.round(targetRef.current) + delta, true);
    },
    [applyTarget],
  );

  useEffect(() => {
    silentRef.current = true;
    applyTarget(targetRef.current, false);
    silentRef.current = false;
  }, [items, fontSize, spacing, curve, tilt, blur, fade, minOpacity, side, loop, smoothing, applyTarget]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      audioRef.current?.pause();
    },
    [],
  );

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      data-testid={testId}
      className={`option-wheel${side === 'right' ? ' option-wheel--right' : ''}${isDragging ? ' option-wheel--dragging' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--ow-text-color': textColor, '--ow-active-color': activeColor, '--ow-font-size': `${fontSize}rem`, '--ow-inset': `${inset}px` } as CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      {items.map((text, index) => (
        <div
          key={`${text}-${index}`}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          role="option"
          aria-selected={selectedIndex === index}
          data-testid={itemTestId?.(index)}
          className={`option-wheel__item${selectedIndex === index ? ' option-wheel__item--selected' : ''}`}
          onClick={() => handleItemClick(index)}
        >
          {text}
        </div>
      ))}
    </div>
  );
}
