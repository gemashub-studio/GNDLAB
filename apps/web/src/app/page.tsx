import type { CalcMode, CalcWarning } from '@gemas/calc-engine';
import { getContainer, getForm } from '@gemas/dataset';
import { datasetOrBundled } from '@/server/datasets';
import Link from 'next/link';
import { benchmarkText } from '@/lib/present';
import { ConfidenceBadge } from '@/components/ui/badges';
import { FillBar } from '@/components/ui/bars';
import { Hint } from '@/components/ui/Hint';
import { WarningList } from '@/components/ui/Warnings';
import { COMMODITY_UI, formLabel } from '@/lib/catalog';
import { fmt, fmtTon } from '@/lib/format';
import { containerFtName } from '@/lib/imperial';
import { encodeState, runContainer, type ContainerState } from '@/lib/scenario';

/** Baris tabel kapasitas (mockup Main "Kapasitas Container"). Bentuk & mode = pilihan tampilan, angka dari engine. */
const ROWS: { commodityId: string; formCode: string; mode: CalcMode }[] = [
  { commodityId: 'kelapa_jambul', formCode: 'bagged', mode: 'PIECE' },
  { commodityId: 'arang_batok_belah2', formCode: 'lumps', mode: 'BULK' },
  { commodityId: 'arang_batok_belah2', formCode: 'halves_loose', mode: 'BULK' },
  { commodityId: 'kopra_asalan', formCode: 'bagged_jute', mode: 'BULK' },
  { commodityId: 'kopra_edible', formCode: 'bagged', mode: 'BULK' },
];
const COLS = ['20GP', '40HC'] as const;

export const dynamic = 'force-dynamic';

export default async function Home() {
  const ds = await datasetOrBundled();
  const st = (r: (typeof ROWS)[number], containerId: string): ContainerState => ({ kind: 'CONTAINER', ...r, containerId });

  const table = ROWS.map((r) => {
    const cells = COLS.map((k) => ({ k, out: runContainer(ds, st(r, k)) }));
    return { ...r, cells };
  });

  // Peringatan unik dari semua baris → panel "Warning!" (bukan teks ketikan).
  const seen = new Set<string>();
  const warnings: CalcWarning[] = [];
  for (const row of table) for (const c of row.cells) for (const w of c.out.warnings) {
    if (w.code === 'WEIGHT_LIMITED' || seen.has(w.code)) continue;
    seen.add(w.code);
    warnings.push(w);
  }

  // Contoh rencana (mockup "NEXT DROP"): kopra edible per karung di 40HC.
  const plan: ContainerState = { kind: 'CONTAINER', commodityId: 'kopra_edible', formCode: 'bagged', containerId: '40HC', mode: 'PACKAGE' };
  const planOut = runContainer(ds, plan);
  const planForm = getForm(ds, 'kopra_edible', 'bagged');
  const net = planForm.packaging[0]!.netKg.typ;
  const payload40HC = getContainer(ds, '40HC').payloadKg;

  const fmtCell = (mode: CalcMode, o: (typeof table)[number]['cells'][number]['out']) =>
    mode === 'PIECE' ? `${fmt(o.result.typ.pieces ?? 0)} btr` : fmtTon(o.result.typ.massKg);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="flex flex-col gap-2.5">
          <span className="tag-mono self-start">DATASET v{ds.version} // ENGINE V1</span>
          <h1 className="text-[40px] sm:text-[52px]">
            Ringkasan
            <br />
            Kapasitas
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/gudang" className="btn-ghost no-underline">
            Hitung gudang
          </Link>
          <Link href="/muat?wizard=1" className="btn-primary no-underline shadow-[5px_5px_0_#0E1A1F]" data-testid="cta-plan">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Rencana muat
          </Link>
        </div>
      </header>

      {/* Mulai cepat — orientasi tugas untuk pengguna baru */}
      <section aria-label="Mulai cepat" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: '/proses', n: '01', t: 'Kelapa masuk, jadi apa aja?', d: 'Dari kupas sabut sampai kopra & arang — lengkap rak jemur & dipisah per asal kelapa.' },
          { href: '/muat?wizard=1', n: '02', t: 'Muat berapa di container?', d: 'Tinggal pilih barang, bentuk, dan container — langsung ketemu jawabannya.' },
          { href: '/gudang', n: '03', t: 'Gudangnya cukup nggak?', d: 'Isi jumlah stok & tinggi tumpukan, keluar luas lantai yang dibutuhkan.' },
          { href: '/konversi', n: '04', t: 'Butir ↔ kg ↔ karung?', d: 'Ubah satuan bolak-balik, lengkap dengan rentangnya.' },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="card group flex flex-col gap-2 p-[18px] no-underline hover:bg-acid">
            <span className="font-mono text-xs font-bold">{x.n}</span>
            <span className="text-lg font-extrabold uppercase leading-tight">{x.t}</span>
            <span className="text-[13px]">{x.d}</span>
            <span className="mt-auto font-mono text-xs font-bold group-hover:underline">YUK MULAI →</span>
          </Link>
        ))}
      </section>

      {/* Kartu per komoditas (mockup stok → di sini kapasitas 20GP karena modul stok bukan scope v1) */}
      <section aria-label="Kapasitas per komoditas" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {ds.commodities.map((c) => {
          const row = table.find((r) => r.commodityId === c.id)!;
          const o20 = row.cells[0]!.out;
          const piece = row.mode === 'PIECE';
          const ui = COMMODITY_UI[c.id]!;
          return (
            <article key={c.id} className="card flex flex-col gap-3.5 p-[18px]">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-extrabold uppercase tracking-[0.03em]">{ui.short}</span>
                <ConfidenceBadge c={o20.confidence} tilt />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[40px] leading-none">
                  {piece ? fmt(o20.result.typ.pieces ?? 0) : fmt(o20.result.typ.massKg / 1000, 1)}
                </span>
                <span className="font-mono text-sm font-semibold">{piece ? ui.pieceUnit.toUpperCase() : 'TON'} / 20 FT</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">BENTUK</span>
                  <span className="font-bold">{formLabel(c.id, row.formCode)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">BATAS</span>
                  <span className="font-bold">{o20.binding === 'VOLUME' ? 'Volume' : 'Berat'}</span>
                </div>
              </div>
              <div className="border-t-2 border-dashed border-ink pt-2.5 text-xs">{ui.blurb}</div>
            </article>
          );
        })}
      </section>

      <div className="flex flex-wrap items-stretch gap-6">
        <section aria-labelledby="cap-h" className="card flex min-w-0 flex-[3_1_520px] flex-col gap-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="cap-h" className="text-2xl">
              Kapasitas Container
            </h2>
            <span className="font-mono text-xs font-semibold">ENGINE V1 · NILAI TIPIKAL</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm" data-testid="capacity-table">
              <thead>
                <tr className="bg-ink text-left font-mono text-[11px] tracking-[0.08em] text-paper">
                  <th scope="col" className="p-2.5 font-bold">KOMODITAS</th>
                  {COLS.map((k) => (
                    <th key={k} scope="col" className="p-2.5 font-bold">{containerFtName(k).toUpperCase()}</th>
                  ))}
                  <th scope="col" className="p-2.5 font-bold">BATAS</th>
                  <th scope="col" className="p-2.5 font-bold">DATA</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={`${r.commodityId}.${r.formCode}`} className="border-b-2 border-ink">
                    <th scope="row" className="p-2.5 text-left font-bold">
                      {COMMODITY_UI[r.commodityId]!.short}
                      <span className="block text-xs font-normal">{formLabel(r.commodityId, r.formCode)}</span>
                    </th>
                    {r.cells.map((c) => (
                      <td key={c.k} className="p-2.5 font-mono font-semibold">
                        <Link href={`/muat?s=${encodeState(st(r, c.k))}`} className="underline-offset-2 hover:text-safety">
                          {fmtCell(r.mode, c.out)}
                        </Link>
                      </td>
                    ))}
                    <td className="p-2.5 text-[13px]">
                      {r.cells.map((c) => `${c.out.binding === 'VOLUME' ? 'Volume' : 'Berat'} @${containerFtName(c.k)}`).join(' · ')}
                    </td>
                    <td className="p-2.5">
                      <ConfidenceBadge c={r.cells[0]!.out.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="flex items-center gap-2 font-mono text-[11px]">
            A = TERUKUR · B = DATA DAGANG · C = ESTIMASI → SAMPLING DULU <Hint k="confidence" />
          </span>
        </section>

        <div className="flex min-w-0 flex-[2_1_320px] flex-col">
          <WarningList warnings={warnings} />
        </div>
      </div>

      <section aria-labelledby="plan-h" className="flex flex-col gap-3.5 border-3 border-ink bg-acid p-[22px] shadow-hard sm:max-w-xl">
        <span className="tag-mono self-start">CONTOH RENCANA</span>
        <h2 id="plan-h" className="text-[26px] leading-none">
          1 × 40 ft HC
          <br />
          Kopra Edible
        </h2>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-[54px] leading-none">{fmt(planOut.result.typ.packs ?? 0)}</span>
          <span className="font-mono font-bold">
            KARUNG × {fmt(net)} KG = {fmtTon(planOut.result.typ.massKg).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <FillBar label="VOLUME" fraction={planOut.result.typ.volumeFill} tone="ink" />
          <FillBar label={`BERAT / ${fmt(payload40HC)} KG`} fraction={planOut.result.typ.weightFill} tone="safety" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="-rotate-[1.5deg] bg-ink px-2.5 py-1.5 text-[13px] font-extrabold uppercase text-paper">
            Batas pengikat: {planOut.binding === 'VOLUME' ? 'Volume' : 'Berat'}
          </span>
          <Link href={`/muat?s=${encodeState(plan)}`} className="font-mono text-xs font-bold uppercase">
            Buka di kalkulator →
          </Link>
        </div>
        {planOut.result.typ.packs !== undefined && (
          <span className="font-mono text-[11px]">
            Benchmark:{' '}
            {planForm.benchmarks
              .filter((b) => b.containerId === '40HC')
              .map((b) => benchmarkText(b, 'kopra_edible'))
              .join(' · ') || '–'}
          </span>
        )}
      </section>
    </>
  );
}
