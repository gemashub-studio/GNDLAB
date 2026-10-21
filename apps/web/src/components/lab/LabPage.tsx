'use client';

import { BelanjaTab } from './BelanjaTab';
import { GabungTab } from './GabungTab';
import OptionWheel from '@/components/ui/OptionWheel';
import { useMediaQuery } from '@/lib/useMediaQuery';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GEMA_SOURCES, sourceCounts } from '@/lib/gemaSources';
import { StrokeText } from '@/components/ui/StrokeText';
import { LightTunnel } from '@/components/ui/LightTunnel';
import { listEntries, listExperiments, listMedia, listProtocols, type DailyEntry, type Experiment, type MediaItem, type ProtocolVersion, listDrafts, researchStatus } from '@/lib/labStore';
import { AskLabAI } from './AskLabAI';
import { LoginForm } from '@/components/auth/LoginDialog';
import { needsLogin, useAuth } from '@/lib/useAuth';
import { onSyncStatus, requestSync, startAutoSync } from '@/lib/supabaseSync';
import { LabSkeleton } from './LabSkeleton';
import { ProtocolsTab } from './ProtocolsTab';
import { PencatatanTab } from './PencatatanTab';
import { listCatat, type CatatRecord } from '@/lib/pencatatan';
import { listRaw, type RawRecord } from '@/lib/bahanBaku';

// menu Ringkasan, Eksperimen, Library, dan Standar dihapus (DEC-112) — datanya tetap tersimpan & tersinkron
// menu Gabungkan Data ditambahkan (DEC-126); menu tampil sebagai roda pilihan OptionWheel
const TABS = [
  { id: 'bahan', label: 'Pencatatan Data', note: 'Data awal & akhir per nomor, perlakuan, foto, dan kesimpulan.' },
  { id: 'protokol', label: 'Riset Produk', note: 'Resep berversi, laporan harian sampai riset selesai.' },
  { id: 'belanja', label: 'Laporan Belanja', note: 'Nota & foto barang, LPJ siap unduh.' },
  { id: 'gabung', label: 'Gabungkan Data', note: 'Satukan pencatatan, riset, dan laporan belanja dalam satu berkas.' },
] as const;
type TabId = (typeof TABS)[number]['id'];
/** Menu yang perlu mengambil data dulu → pakai skeleton saat pertama dimuat. */
const DATA_TABS = new Set<string>(['bahan', 'protokol', 'belanja']);
const isTab = (s: string | null): s is TabId => TABS.some((t) => t.id === s);

/**
 * Jendela roda menu (DEC-127). Rumus tata letak OptionWheel: pilihan berjarak d dari tengah bergeser tegak R·sin(d·tilt)
 * (R = tinggi baris / tilt) lalu diputar d·tilt dengan titik putar di tepi kiri-tengah. Tepi atas/bawah kotak teks yang
 * diputar = geser + (x·sin θ ± h/2·cos θ) untuk sudut kiri/kanan; ditambah sebaran blur (2 px per langkah, ×2).
 * above/below = jarak tengah → tepi terluar menu yang tampak; full = setengah tinggi roda dalam (cukup untuk ujung mana pun).
 */
export function wheelWindow(w: { fontSize: number; spacing: number; tilt: number; inset: number }, sel: number, widths: readonly number[], rem = 16) {
  const px = w.fontSize * rem;
  const tiltRad = (w.tilt * Math.PI) / 180;
  const R = (px * w.spacing) / tiltRad;
  const h = px;
  const span = (i: number, from: number): [number, number] => {
    const d = i - from;
    const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
    const cy = R * Math.sin(ang);
    const ys = [0, widths[i]!].flatMap((x) => [x * Math.sin(ang) - (h / 2) * Math.cos(ang), x * Math.sin(ang) + (h / 2) * Math.cos(ang)]);
    const blur = Math.abs(d) * 4 + 2;
    return [cy + Math.min(...ys) - blur, cy + Math.max(...ys) + blur];
  };
  const idx = widths.map((_, i) => i);
  const spans = idx.map((i) => span(i, sel));
  const above = Math.max(...spans.map(([t]) => -t));
  const below = Math.max(...spans.map(([, b]) => b));
  const full = Math.max(...[0, widths.length - 1].flatMap((from) => idx.flatMap((i) => span(i, from).map(Math.abs))));
  return { above: Math.ceil(above), below: Math.ceil(below), full: Math.ceil(full), width: Math.ceil(w.inset + Math.max(...widths) + 40) };
}

export function LabPage() {
  const [items, setItems] = useState<Experiment[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [protocols, setProtocols] = useState<ProtocolVersion[]>([]);
  const [rawRecs, setRawRecs] = useState<RawRecord[]>([]);
  const [catat, setCatat] = useState<CatatRecord[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [tab, setTab] = useState<TabId>('bahan');
  const wide = useMediaQuery('(min-width: 640px)');
  const tabIdx = TABS.findIndex((t) => t.id === tab);
  const WHEEL = wide ? { fontSize: 3, spacing: 1.4, tilt: 6, inset: 80 } : { fontSize: 2, spacing: 1.4, tilt: 6, inset: 24 };
  const auth = useAuth();
  // semua pendataan butuh login bila Supabase aktif (DEC-087); tanpa Supabase (offline) tetap terbuka
  const locked = needsLogin(auth);
  // lebar asli tiap label (offsetWidth tidak terpengaruh transform) → jendela roda pas; taksiran sebelum terukur
  const [labelW, setLabelW] = useState<number[]>();
  useEffect(() => {
    const measure = () => {
      const els = [...document.querySelectorAll<HTMLElement>('[data-testid="lab-wheel"] .option-wheel__item')];
      if (els.length === TABS.length && els.every((e) => e.offsetWidth)) setLabelW(els.map((e) => e.offsetWidth));
    };
    measure();
    const t = setTimeout(measure, 300);
    document.fonts?.ready.then(measure).catch(() => undefined);
    // ukur ulang bila lebar label berubah (font termuat, ukuran layar berubah)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    document.querySelectorAll('[data-testid="lab-wheel"] .option-wheel__item').forEach((el) => ro?.observe(el));
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [wide, locked]);
  const win = wheelWindow(WHEEL, tabIdx, labelW ?? TABS.map((t) => t.label.length * WHEEL.fontSize * 16 * 0.52));

  // skeleton saat pertama membuka GnD Lab: sampai data perangkat terbaca, dan — bila perangkat masih kosong —
  // sampai sinkron pertama dari database selesai (maks. 10 dtk) (DEC-095)
  const [loaded, setLoaded] = useState(false);
  // pindah menu → layar diarahkan ke menu yang dibuka (bukan saat halaman pertama dimuat)
  const tabsRef = useRef<HTMLElement>(null);
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    const nav = tabsRef.current;
    if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [tab]);
  const [firstSync, setFirstSync] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFirstSync(true), 10_000);
    const off = onSyncStatus((st) => {
      if (st.phase !== 'syncing' && (st.phase !== 'idle' || st.last)) setFirstSync(true);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);
  const showSkel = !loaded || (!!auth.email && !firstSync && !items.length && !catat.length && !protocols.length);
  const refresh = useCallback(async () => {
    try {
      const [x, e, m, p] = await Promise.all([listExperiments(), listEntries(), listMedia(), listProtocols()]);
      setRawRecs(await listRaw().catch(() => []));
      setCatat(await listCatat().catch(() => []));
      // menu GnD Lab berkedip bila ada pencatatan belum lengkap (header membaca ulang)
      window.dispatchEvent(new Event('gemas-catat-changed'));
      setDraftCount((await listDrafts().catch(() => [])).length);
      setItems(x);
      setEntries(e);
      setMedia(m);
      setProtocols(p);
    } catch {
      setItems([]);
    }
    setLoaded(true);
    // data lokal mungkin berubah → kirim ke Supabase sebentar lagi (DEC-085)
    requestSync();
  }, []);
  // sinkron otomatis Supabase selama halaman lab terbuka; muat ulang bila ada data dari perangkat lain
  useEffect(() => startAutoSync(() => void refresh()), [refresh]);
  useEffect(() => {
    void refresh();
    const p = new URLSearchParams(window.location.search);
    const t = p.get('t');
    // tautan lama (?t=ringkasan / eksperimen / library / standar) → Pencatatan Data
    if (isTab(t)) setTab(t);
  }, [refresh]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('t', tab);
    url.searchParams.delete('e');
    window.history.replaceState(null, '', url);
  }, [tab]);

  // Statistik nyata (DEC-071): Bahan baku = catatan menu Bahan Baku; Berjalan = riset produk belum selesai + draf on going.
  const researchKeys = [...new Set(protocols.map((p) => p.key))];
  const running = researchKeys.filter((k) => researchStatus(entries.filter((e) => e.experimentId === k)) !== 'selesai').length + draftCount;
  const counts = sourceCounts();

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="card-ink relative flex flex-col gap-6 overflow-hidden" data-testid="lab-hero">
        <LightTunnel
          className="pointer-events-none !absolute inset-0"
          data-testid="lab-hero-tunnel"
          cableColor="#ffffff"
          pulseColor="#ffffff"
          cableCount={56}
          pulseDensity={0.5}
          flowDirection="inward"
          mouseInteraction
          clickSurge
          tunnelColor="#ffffff"
          tunnelOpacity={0}
          speed={0.1}
          pulseSpeed={2}
          pulseLength={0.28}
          pulseBlend={0.6}
          pulseWidth={1}
          thickness={0.35}
          rimWidth={0.15}
          waviness={0.3}
          sway={0.5}
          bend={0.4}
          glow={1}
          size={1}
          fadeNear={0.5}
          fadeFar={2}
          brightness={1}
          colorVariance
          grain={false}
          mouseStrength={0.1}
          intro
          lightMode={false}
          dpr={1}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(600px_260px_at_90%_0%,rgba(99,230,207,0.22),transparent_70%),linear-gradient(rgba(99,230,207,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(99,230,207,0.07)_1px,transparent_1px)] [background-size:auto,28px_28px,28px_28px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link href="/" className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-ink no-underline hover:text-acid">gemasSTUDIO / R&amp;D</Link>
            <h1 className="max-w-[560px]" data-testid="lab-heading">
              <StrokeText text="GnD Lab" strokeColor="#63E6CF" fillColor="#F3F6F7" strokeWidth={1.4} drawDuration={1.6} fillDelay={0.2} stagger={0.05} ease="power2.out" trigger="loop" fillMode="wipe" fontSize={128} fontWeight={800} letterSpacing={-4} align="left" height="clamp(56px, 14vw, 104px)" />
            </h1>
            <p className="max-w-xl text-[15px] text-muted-ink">
              Buku catatan eksperimen lima jalur produk kelapa. Tiap percobaan tersimpan terpisah, hasil gagal ikut dicatat, dan yang kosong tertulis “belum dicatat”.
            </p>
          </div>
        </div>
        <dl className="relative grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-acid/15 sm:grid-cols-4">
          {[
            ['Pencatatan data', catat.length],
            ['Berjalan', running],
            ['Catatan harian', entries.length],
            ['Sumber diperiksa', `${counts.diperiksa}/${GEMA_SOURCES.length}`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 bg-ink/45 px-4 py-3 backdrop-blur-[1px]">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-ink">{k}</dt>
              <dd className="font-mono text-2xl font-semibold text-paper">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {!auth.ready && auth.configured ? (
        <p className="text-sm text-muted">Memeriksa login…</p>
      ) : locked ? (
        <section className="card flex max-w-xl flex-col gap-2" data-testid="lab-locked">
          <h2 className="font-display text-xl font-semibold">Masuk dulu untuk membuka GnD Lab</h2>
          <LoginForm testId="lab-login" note="Semua pencatatan dan data lab hanya bisa dibuka & diisi setelah login. Masuk dengan username & password — kode verifikasi dikirim ke emailmu." />
        </section>
      ) : (
        <>
      <AskLabAI tab={tab} username={auth.username} />

      {/* menu GnD Lab: roda pilihan React Bits OptionWheel dengan setelan bawaan (DEC-126), tanpa kartu. Jendela roda pas
          setinggi menu yang tampak (atas/bawah menu terpilih) & selebar teks menu → rapat dengan kartu di atas & bawahnya,
          dan gulir di luar teks menu tetap menggulir halaman (DEC-127) */}
      <nav ref={tabsRef} style={{ scrollMarginTop: 80, height: win.above + win.below, maxWidth: '100%', width: win.width }} aria-label="Menu GnD Lab" className="relative -my-3 overflow-hidden transition-[height] duration-300 ease-out" data-testid="lab-menu">
        <div className="absolute inset-x-0 transition-[top] duration-300 ease-out" style={{ top: win.above - win.full, height: win.full * 2 }}>
          <OptionWheel
            items={TABS.map((t) => t.label)}
            selected={tabIdx}
            onChange={(i) => setTab(TABS[i]!.id)}
            itemTestId={(i) => `lab-tab-${TABS[i]!.id}`}
            label="Menu GnD Lab"
            data-testid="lab-wheel"
            textColor="#778598"
            activeColor="#10b97f"
            side="left"
            fontSize={WHEEL.fontSize}
            spacing={WHEEL.spacing}
            curve={1}
            tilt={WHEEL.tilt}
            blur={2}
            fade={0.25}
            smoothing={200}
            inset={WHEEL.inset}
            loop={false}
            draggable
          />
        </div>
      </nav>

      {/* skeleton hanya untuk menu yang mengambil data dulu (DEC-095) */}
      {showSkel && DATA_TABS.has(tab) ? (
        <LabSkeleton kind={tab} />
      ) : (
        <>
      {tab === 'bahan' && <PencatatanTab records={catat} oldRaw={rawRecs} onChanged={refresh} />}
      {tab === 'protokol' && <ProtocolsTab protocols={protocols} entries={entries} media={media} refresh={refresh} />}
      {tab === 'belanja' && <BelanjaTab />}
      {tab === 'gabung' && <GabungTab catat={catat} protocols={protocols} entries={entries} media={media} />}
        </>
      )}

        </>
      )}

      <p className="text-xs text-muted">
        Data tersimpan di perangkat ini dan tersinkron ke database saat online. GnD Lab tidak menyatakan produk aman dikonsumsi atau memenuhi standar.
      </p>
    </div>
  );
}
