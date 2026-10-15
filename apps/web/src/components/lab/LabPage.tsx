'use client';

import { BelanjaTab } from './BelanjaTab';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GEMA_SOURCES, sourceCounts } from '@/lib/gemaSources';
import { StrokeText } from '@/components/ui/StrokeText';
import { LightTunnel } from '@/components/ui/LightTunnel';
import { listEntries, listExperiments, listMedia, listProtocols, type DailyEntry, type Experiment, type LabProductId, type MediaItem, type ProtocolVersion, listDrafts, researchStatus } from '@/lib/labStore';
import { BackupPanel } from './BackupPanel';
import { ExperimentsTab } from './ExperimentsTab';
import { LabOverview } from './LabOverview';
import { LibraryTab } from './LibraryTab';
import { ProtocolsTab } from './ProtocolsTab';
import { PencatatanTab } from './PencatatanTab';
import { listCatat, type CatatRecord } from '@/lib/pencatatan';
import { listRaw, type RawRecord } from '@/lib/bahanBaku';
import { StandardsTab } from './StandardsTab';

const TABS = [
  { id: 'ringkasan', label: 'Ringkasan' },
  { id: 'bahan', label: 'Pencatatan Data' },
  { id: 'protokol', label: 'Riset Produk' },
  { id: 'eksperimen', label: 'Eksperimen' },
  { id: 'belanja', label: 'Laporan Belanja' },
  { id: 'library', label: 'Library' },
  { id: 'standar', label: 'Standar' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const isTab = (s: string | null): s is TabId => TABS.some((t) => t.id === s);

export function LabPage() {
  const [items, setItems] = useState<Experiment[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [protocols, setProtocols] = useState<ProtocolVersion[]>([]);
  const [rawRecs, setRawRecs] = useState<RawRecord[]>([]);
  const [catat, setCatat] = useState<CatatRecord[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [tab, setTab] = useState<TabId>('ringkasan');
  const [product, setProduct] = useState<LabProductId | 'all'>('all');
  const [stdProduct, setStdProduct] = useState<LabProductId>('KE');
  const [openId, setOpenId] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const [x, e, m, p] = await Promise.all([listExperiments(), listEntries(), listMedia(), listProtocols()]);
      setRawRecs(await listRaw().catch(() => []));
      setCatat(await listCatat().catch(() => []));
      setDraftCount((await listDrafts().catch(() => [])).length);
      setItems(x);
      setEntries(e);
      setMedia(m);
      setProtocols(p);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const p = new URLSearchParams(window.location.search);
    const t = p.get('t');
    if (isTab(t)) setTab(t);
    const e = p.get('e');
    if (e) {
      setTab('eksperimen');
      setOpenId(e);
    }
  }, [refresh]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('t', tab);
    if (tab === 'eksperimen' && openId) url.searchParams.set('e', openId);
    else url.searchParams.delete('e');
    window.history.replaceState(null, '', url);
  }, [tab, openId]);

  const openExperiment = (id: string) => {
    setOpenId(id);
    setTab('eksperimen');
  };
  // Statistik nyata (DEC-071): Bahan baku = catatan menu Bahan Baku; Berjalan = riset produk belum selesai + draf on going.
  const researchKeys = [...new Set(protocols.map((p) => p.key))];
  const running = researchKeys.filter((k) => researchStatus(entries.filter((e) => e.experimentId === k)) !== 'selesai').length + draftCount;
  const counts = sourceCounts();

  return (
    <div className="flex flex-col gap-6">
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

      <nav role="tablist" aria-label="Bagian lab" className="flex gap-1 overflow-x-auto rounded-2xl border-3 border-ink bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id !== 'eksperimen') setOpenId(undefined);
            }}
            className={`min-h-touch flex-1 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${tab === t.id ? 'bg-ink text-acid' : 'text-muted hover:text-ink'}`}
            data-testid={`lab-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'ringkasan' && (
        <LabOverview
          items={items}
          onOpen={openExperiment}
          onProduct={(p) => {
            setProduct(p);
            setOpenId(undefined);
            setTab('eksperimen');
          }}
        />
      )}
      {tab === 'ringkasan' && <BackupPanel onRestored={refresh} />}
      {tab === 'eksperimen' && (
        <ExperimentsTab items={items} entries={entries} media={media} protocols={protocols} product={product} setProduct={setProduct} openId={openId} setOpenId={setOpenId} refresh={refresh} />
      )}
      {tab === 'bahan' && <PencatatanTab records={catat} oldRaw={rawRecs} onChanged={refresh} />}
      {tab === 'protokol' && <ProtocolsTab protocols={protocols} entries={entries} media={media} refresh={refresh} />}
      {tab === 'belanja' && <BelanjaTab />}
      {tab === 'library' && <LibraryTab />}
      {tab === 'standar' && <StandardsTab product={stdProduct} setProduct={setStdProduct} />}

      <p className="text-xs text-muted">
        Data eksperimen tersimpan di perangkat ini (offline). Rutin unduh cadangan. GnD Lab tidak menyatakan produk aman dikonsumsi atau memenuhi standar.
      </p>
    </div>
  );
}
