import type { Unit } from '@gemas/calc-engine';
import { confidenceProfile, rawDataset } from '@gemas/dataset';
import { datasetOrBundled } from '@/server/datasets';
import type { Metadata } from 'next';
import { ConfidenceBadge } from '@/components/ui/badges';
import { Hint } from '@/components/ui/Hint';
import { COMMODITY_UI, formLabel } from '@/lib/catalog';
import { fmt, UNIT_TEXT } from '@/lib/format';

export const metadata: Metadata = { title: 'Data & Sumber' };

/** Tampilkan nilai SI dalam satuan gudang (ADR-004: konversi hanya di presentasi). */
function display(unit: Unit, v: number): string {
  switch (unit) {
    case 'm':
      return `${fmt(v * 100, v * 100 < 10 ? 2 : 1)}`;
    case 'kg':
      return v < 1 ? fmt(v * 1000, 0) : fmt(v, 1);
    case 'm3':
      return fmt(v * 1e6, 0);
    default:
      return fmt(v, v < 1 ? 3 : v < 10 ? 2 : 0);
  }
}
function unitLabel(unit: Unit, v: number): string {
  if (unit === 'm') return 'cm';
  if (unit === 'kg') return v < 1 ? 'g' : 'kg';
  if (unit === 'm3') return 'cm³';
  return UNIT_TEXT[unit];
}

export const dynamic = 'force-dynamic';

export default async function DataPage() {
  const ds = await datasetOrBundled();
  const p = confidenceProfile(rawDataset);
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="tag-mono self-start">DATASET v{ds.version} · DISUSUN {ds.compiled}</span>
          <h1 className="text-[40px] sm:text-[52px]">Data &amp;<br />Sumber</h1>
        </div>
        <div className="card flex items-center gap-4 p-4 font-mono text-sm font-bold">
          <span>{p.A + p.B + p.C} parameter</span>
          <span className="flex items-center gap-1"><ConfidenceBadge c="A" /> {p.A}</span>
          <span className="flex items-center gap-1"><ConfidenceBadge c="B" /> {p.B}</span>
          <span className="flex items-center gap-1"><ConfidenceBadge c="C" /> {p.C}</span>
          <Hint k="confidence" />
        </div>
      </header>

      <p className="max-w-3xl text-[15px]">
        Semua angka default berasal dari dataset riset terkunci versi {ds.version}. Parameter <b>C</b> adalah estimasi
        engineering — ukur sendiri di gudangmu, lalu pakai &quot;Ubah angka&quot; di kalkulator. Fitur sampling & kalibrasi
        resmi hadir di fase M4.
      </p>

      <section aria-labelledby="cont-h" className="card flex flex-col gap-3">
        <h2 id="cont-h" className="text-2xl">Container</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-ink text-left font-mono text-[11px] tracking-[0.08em] text-paper">
                <th className="p-2.5">KODE</th><th className="p-2.5">DIMENSI DALAM (cm)</th><th className="p-2.5">VOLUME</th><th className="p-2.5">PAYLOAD</th><th className="p-2.5">DATA</th>
              </tr>
            </thead>
            <tbody>
              {ds.containers.map((c) => (
                <tr key={c.id} className="border-b-2 border-ink">
                  <th scope="row" className="p-2.5 text-left">{c.id}<span className="block text-xs font-normal">{c.name}</span></th>
                  <td className="p-2.5 font-mono">{fmt(c.L * 100, 1)} × {fmt(c.W * 100, 1)} × {fmt(c.H * 100, 1)}</td>
                  <td className="p-2.5 font-mono">{fmt(c.volumeM3 ?? 0, 1)} m³</td>
                  <td className="p-2.5 font-mono">{fmt(c.payloadKg)} kg</td>
                  <td className="p-2.5"><ConfidenceBadge c={c.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {ds.commodities.map((c) => (
        <section key={c.id} aria-labelledby={`h-${c.id}`} className="card flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={`h-${c.id}`} className="text-2xl">{COMMODITY_UI[c.id]?.short ?? c.nameId}</h2>
            <span className="text-sm">{c.nameId}{c.nameEn ? ` — ${c.nameEn}` : ''}</span>
          </div>
          {c.forms.map((f) => (
            <details key={f.code} className="border-2 border-ink" open={f.code === c.forms[0]!.code}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 bg-paper p-2.5 font-bold uppercase">
                {formLabel(c.id, f.code)}
                <span className="font-mono text-xs font-normal normal-case">
                  ρ {fmt(f.params.bulk_density!.typ)} kg/m³ · {Object.keys(f.params).length} parameter · {f.benchmarks.length} benchmark
                </span>
                <ConfidenceBadge c={f.params.bulk_density!.confidence} />
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left font-mono text-[11px] tracking-[0.08em]">
                      <th className="p-2">PARAMETER</th><th className="p-2">TIPIKAL</th><th className="p-2">MIN–MAKS</th><th className="p-2">SATUAN</th><th className="p-2">DATA</th><th className="p-2">CATATAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(f.params).map((prm) => (
                      <tr key={prm.key} className="border-t border-paper-grid align-top">
                        <td className="p-2 font-mono text-xs font-bold">{prm.key}</td>
                        <td className="p-2 font-mono">{display(prm.unit, prm.typ)}</td>
                        <td className="p-2 font-mono">{display(prm.unit, prm.min)}–{display(prm.unit, prm.max)}</td>
                        <td className="p-2 font-mono text-xs">{unitLabel(prm.unit, prm.typ)}</td>
                        <td className="p-2"><ConfidenceBadge c={prm.confidence} /></td>
                        <td className="p-2 text-xs">{prm.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </section>
      ))}

      <section aria-labelledby="src-h" className="card flex flex-col gap-3">
        <h2 id="src-h" className="text-2xl">Sumber ({ds.sources.length})</h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {ds.sources.map((s) => (
            <li key={s.id} className="flex gap-2 border-2 border-ink p-2 text-sm">
              <span className="font-mono font-bold">{s.id}</span>
              <ConfidenceBadge c={s.grade} />
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words hover:text-safety">{s.title}</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
