'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AngkutTab } from './AngkutTab';
import { ArangTab } from './ArangTab';
import { BelahTab } from './BelahTab';
import { BriketTab } from './BriketTab';
import { KemasTab } from './KemasTab';
import { KeringTab } from './KeringTab';
import { TerimaTab } from './TerimaTab';
import { TurunanTab } from './TurunanTab';
import { useChain } from './shared';

const STEPS = [
  { id: 'angkut', label: 'Angkut', blurb: 'Truk & container (ft): butir per rit, pembatas ruang/berat, jumlah rit.' },
  { id: 'terima', label: 'Terima & lot', blurb: 'Kode lot DR/DT dari ketinggian kebun, register, gudang per asal.' },
  { id: 'belah', label: 'Belah & sortir', blurb: 'Bersihkan jambul, belah, sortir kondisi, tampung & dinginkan air kelapa.' },
  { id: 'kering', label: 'Pengeringan', blurb: 'Desainer greenhouse & oven (rak, tray, muatan aktual, kipas), log sulfur manual, jemur.' },
  { id: 'kemas', label: 'Congkel & kemas', blurb: 'QC & grade kopra, kalkulator kemas gudang/truk/container.' },
  { id: 'arang', label: 'Arang', blurb: 'Batok per asal: drum/kolam, fase asap, ayak rotari 2×, hammer mill, kemas.' },
  { id: 'briket', label: 'Briket', blurb: 'Campuran DT:DR dari hasil lab, bahan baku per asal, bentuk, kemas.' },
  { id: 'turunan', label: 'Cuka & bioleather', blurb: 'Cuka air kelapa; bioleather + cocopeat/cocofiber/bahan lain.' },
] as const;
type StepId = (typeof STEPS)[number]['id'];
const isStep = (s: string | null): s is StepId => STEPS.some((x) => x.id === s);

export function ChainPage() {
  const c = useChain();
  const [step, setStep] = useState<StepId>('angkut');
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t');
    if (isStep(t)) setStep(t);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('t', step);
    window.history.replaceState(null, '', url);
  }, [step]);

  const i = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[i]!;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">← gemasSTUDIO / RINGKASAN</Link>
          <h1 className="text-[40px] sm:text-[52px]">Rantai<br />Produksi</h1>
          <p className="max-w-xl text-[15px]">
            Dari kelapa jambul datang sampai kopra, arang, briket, cuka & bioleather — kalkulator, SOP, dan alat untuk tiap proses. Asal DR/DT tercatat dari awal sampai karung.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="tag-mono -rotate-[1.5deg]">EXP-RANTAI // DATA RANTAI v{c.version}</span>
          <button type="button" className="btn-ghost" aria-expanded={guide} onClick={() => setGuide((g) => !g)} data-testid="chain-guide-toggle">
            {guide ? 'Tutup panduan' : 'Cara pakai ?'}
          </button>
        </div>
      </header>

      {guide && (
        <section aria-label="Cara pakai" className="card-ink flex flex-col gap-3" data-testid="chain-guide">
          <span className="tag-mono self-start">PANDUAN SINGKAT</span>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px]">
            <li><strong>Ikuti tahap 01 → 08</strong> sesuai alur barang. Tiap tahap: isi angka, lihat hasil, baca SOP & alat di bawahnya.</li>
            <li><strong>Catat lot di tahap 02</strong>: ketinggian kebun menentukan kelas DR (≤500 mdpl) atau DT (&gt;500 mdpl). Kode lot dipakai sampai karung arang & briket.</li>
            <li><strong>Kotak kosong</strong> = data yang belum ada di riset (mis. ukuran kolam, hasil lab). Isi dari ukuranmu sendiri.</li>
            <li><strong>Huruf A/B/C</strong> menunjukkan keyakinan sumber. C = praktik/SOP internal — validasi dengan uji batch.</li>
          </ol>
        </section>
      )}

      <nav aria-label="Tahap rantai" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8" role="tablist">
        {STEPS.map((s, n) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={step === s.id}
            onClick={() => setStep(s.id)}
            data-testid={`ctab-${s.id}`}
            className={`flex min-h-[56px] flex-col items-start justify-center border-3 border-ink px-2 text-left ${step === s.id ? 'bg-ink text-acid shadow-[4px_4px_0_#F5A524]' : 'bg-surface'}`}
          >
            <span className="font-mono text-[11px] font-bold">{String(n + 1).padStart(2, '0')}</span>
            <span className="text-xs font-extrabold uppercase leading-tight">{s.label}</span>
          </button>
        ))}
      </nav>
      <p className="font-mono text-xs" data-testid="chain-blurb">{current.label.toUpperCase()} — {current.blurb}</p>

      <div role="tabpanel" aria-label={current.label}>
        {step === 'angkut' && <AngkutTab />}
        {step === 'terima' && <TerimaTab />}
        {step === 'belah' && <BelahTab />}
        {step === 'kering' && <KeringTab />}
        {step === 'kemas' && <KemasTab />}
        {step === 'arang' && <ArangTab />}
        {step === 'briket' && <BriketTab />}
        {step === 'turunan' && <TurunanTab />}
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t-3 border-ink pt-3">
        <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => setStep(STEPS[i - 1]!.id)}>← {i > 0 ? STEPS[i - 1]!.label : 'Kembali'}</button>
        {i < STEPS.length - 1 && (
          <button type="button" className="btn-primary" onClick={() => setStep(STEPS[i + 1]!.id)} data-testid="chain-next">
            Lanjut: {STEPS[i + 1]!.label} →
          </button>
        )}
      </div>

      <p className="font-mono text-[11px] text-muted">
        Dataset rantai v{c.version} (disusun {c.compiled}) dari SOP KORA, Ikatrinasari 2026, Hapag-Lloyd/Maersk, CDB India, FAO, ICC, vendor truk & kemasan, MDPI 2025. Laporan riset:
        architecture/00-research/chain_research.md.
      </p>
    </div>
  );
}
