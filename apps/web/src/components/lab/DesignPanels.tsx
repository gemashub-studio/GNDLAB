'use client';

import { useMemo, useState } from 'react';
import { fmt } from '@/lib/format';
import { lastValuePerRun, summarize, type ExperimentDesign, type ResponseSummary } from '@/lib/labDesign';
import { addEntry, nextEntryId, type DailyEntry, type Experiment } from '@/lib/labStore';
import { Section } from './ui';

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const cellKey = (run: string, r: number) => `${run}|${r}`;

/** Ringkasan desain: faktor, kontrol, ulangan, variabel ukur, unit percobaan. */
export function DesignView({ d }: { d: ExperimentDesign }) {
  return (
    <Section title="Desain eksperimen" testId="lab-design">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="label-mono">Yang diubah (faktor)</dt>
          <dd>{d.factors.map((f) => `${f.name}: ${f.levels.join(' / ')}${f.unit ? ` ${f.unit}` : ''}`).join(' × ')}</dd>
        </div>
        <div><dt className="label-mono">Pembanding</dt><dd>{d.control}</dd></div>
        <div><dt className="label-mono">Ulangan</dt><dd>{d.replicates} per perlakuan · {d.runs.length} unit</dd></div>
        <div><dt className="label-mono">Yang diukur</dt><dd>{d.responses.map((r) => `${r.name}${r.unit ? ` (${r.unit})` : ''}`).join(', ')}</dd></div>
      </dl>
    </Section>
  );
}

/**
 * Lembar data: baris = unit percobaan (urutan kerja), kolom = variabel ukur. Isi yang diukur saja;
 * "Simpan" membuat catatan harian BARU (append-only) — pengukuran ulang (hari 1, 2, 3…) tetap tersimpan semua.
 */
export function DataSheet({ e, entries, onSaved }: { e: Experiment; entries: DailyEntry[]; onSaved: () => Promise<void> }) {
  const d = e.design!;
  const [vals, setVals] = useState<Record<string, string>>({});
  const [at, setAt] = useState(nowLocal);
  const [note, setNote] = useState('');
  const [sortBy, setSortBy] = useState<'order' | 'code'>('order');
  const [msg, setMsg] = useState('');
  const last = useMemo(() => d.responses.map((r) => lastValuePerRun(entries, r)), [d, entries]);
  const runs = [...d.runs].sort((a, b) => (sortBy === 'order' ? a.order - b.order : a.code.localeCompare(b.code, undefined, { numeric: true })));
  const filled = Object.values(vals).filter((v) => v.trim()).length;

  const save = async () => {
    const measurements = d.runs.flatMap((run) =>
      d.responses.flatMap((r, i) => {
        const v = vals[cellKey(run.code, i)]?.trim();
        return v ? [{ name: r.name, value: v, unit: r.unit, at, group: run.code, note: '' }] : [];
      }),
    );
    if (!measurements.length) return setMsg('Belum ada nilai yang diisi.');
    const id = nextEntryId(e.id, entries.map((x) => x.id));
    try {
      await addEntry(
        { id, experimentId: e.id, entryDate: at.slice(0, 10), protocolId: e.methodVersion, plan: '', actual: `Pengukuran lembar data (${measurements.length} nilai)`, materials: [], tools: '', conditions: '', measurements, deviations: '', interpretation: '', nextStep: '', ...(note.trim() && { actual: `Pengukuran lembar data (${measurements.length} nilai). ${note.trim()}` }) },
        [],
      );
      setVals({});
      setNote('');
      setMsg(`Tersimpan sebagai ${id} (${measurements.length} nilai).`);
      await onSaved();
    } catch {
      setMsg('Gagal menyimpan. Coba lagi.');
    }
  };

  return (
    <Section
      title="Lembar data"
      aside={<button type="button" className="font-mono text-xs underline" onClick={() => setSortBy((s) => (s === 'order' ? 'code' : 'order'))}>urut: {sortBy === 'order' ? 'urutan kerja' : 'kode unit'}</button>}
      testId="lab-sheet"
    >
      <p className="text-sm text-muted">Isi angka hasil ukur hari ini. Kosongkan yang tidak diukur. Abu-abu = nilai terakhir yang tersimpan.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Waktu ukur</span>
          <input type="datetime-local" className="field" value={at} onChange={(ev) => setAt(ev.target.value)} data-testid="sheet-at" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Catatan singkat (opsional)</span>
          <input className="field font-sans text-sm font-normal" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="mis. hari ke-2, hujan" />
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border-3 border-ink">
        <table className="w-full min-w-[420px] text-sm" data-testid="sheet-table">
          <thead className="bg-paper">
            <tr className="text-left font-mono text-[10px] uppercase text-muted">
              <th className="p-2">Unit</th>
              <th className="p-2">Perlakuan</th>
              {d.responses.map((r) => <th key={`${r.name}|${r.unit}`} className="p-2">{r.name}{r.unit ? ` (${r.unit})` : ''}</th>)}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.code} className="border-t border-paper-grid">
                <td className="p-2 font-mono font-semibold">{run.code}<span className="block text-[10px] font-normal text-muted">#{run.order}</span></td>
                <td className="p-2 text-xs">{run.label}</td>
                {d.responses.map((r, i) => (
                  <td key={i} className="p-1">
                    <input
                      inputMode="decimal"
                      className="field min-h-[40px] w-full min-w-[5rem] text-sm"
                      value={vals[cellKey(run.code, i)] ?? ''}
                      placeholder={last[i]?.get(run.code)?.value ?? ''}
                      aria-label={`${run.code} ${r.name}`}
                      onChange={(ev) => setVals((v) => ({ ...v, [cellKey(run.code, i)]: ev.target.value }))}
                      data-testid={`cell-${run.code}-${i}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => void save()} data-testid="sheet-save">Simpan pengukuran ({filled})</button>
        {msg && <span className="font-mono text-xs" role="status" data-testid="sheet-msg">{msg}</span>}
      </div>
    </Section>
  );
}

/** Grafik batang rata-rata ± SD per perlakuan (hanya perlakuan yang punya data). */
function Bars({ s }: { s: ResponseSummary }) {
  const rows = s.rows.filter((r) => r.mean !== undefined);
  if (rows.length < 2) return <p className="text-xs italic text-muted">Grafik muncul bila ≥ 2 perlakuan punya data.</p>;
  const hi = Math.max(...rows.map((r) => r.mean! + (r.sd ?? 0)), 0);
  const lo = Math.min(0, ...rows.map((r) => r.mean! - (r.sd ?? 0)));
  const W = 320;
  const H = 140;
  const bw = W / rows.length;
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * (H - 16);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full max-w-md" role="img" aria-label={`Rata-rata ${s.response.name} per perlakuan`}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.3} />
      {rows.map((r, i) => (
        <g key={r.treatment}>
          <rect x={i * bw + bw * 0.2} width={bw * 0.6} y={Math.min(y(r.mean!), y(0))} height={Math.abs(y(0) - y(r.mean!))} fill="#63E6CF" stroke="#0E1A1F" strokeWidth={1} rx={3} />
          {r.sd !== undefined && <line x1={i * bw + bw / 2} x2={i * bw + bw / 2} y1={y(r.mean! - r.sd)} y2={y(r.mean! + r.sd)} stroke="#0E1A1F" strokeWidth={1.5} />}
          <text x={i * bw + bw / 2} y={H + 14} fontSize={10} textAnchor="middle" fontFamily="monospace">{r.treatment}</text>
        </g>
      ))}
    </svg>
  );
}

/** Ringkasan DESKRIPTIF per perlakuan dari nilai terakhir tiap unit — tanpa uji signifikansi. */
export function ResultsSummary({ e, entries }: { e: Experiment; entries: DailyEntry[] }) {
  const sums = useMemo(() => summarize(e.design!, entries), [e, entries]);
  const f = (v?: number) => (v === undefined ? '–' : fmt(v, Math.abs(v) < 10 ? 2 : 1));
  return (
    <Section title="Ringkasan hasil" testId="lab-summary">
      <p className="text-xs text-muted">Statistik deskriptif dari <strong>nilai terakhir tiap unit</strong>. SD memakai n−1. Belum ada uji beda nyata — jangan disimpulkan "berbeda" hanya dari rata-rata.</p>
      {sums.map((s) => (
        <div key={`${s.response.name}|${s.response.unit}`} className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{s.response.name}{s.response.unit ? ` (${s.response.unit})` : ''}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm" data-testid={`sum-${s.response.name}`}>
              <thead><tr className="text-left font-mono text-[10px] uppercase text-muted"><th className="py-1">Perlakuan</th><th>n</th><th className="text-right">Rata-rata</th><th className="text-right">SD</th><th className="text-right">Min</th><th className="text-right">Maks</th><th className="text-right">Belum ada data</th></tr></thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.treatment} className="border-t border-paper-grid">
                    <td className="py-1 pr-2"><span className="font-mono font-semibold">{r.treatment}</span> <span className="text-xs text-muted">{r.label}</span></td>
                    <td className="font-mono">{r.n}</td>
                    <td className="text-right font-mono">{f(r.mean)}</td>
                    <td className="text-right font-mono">{f(r.sd)}</td>
                    <td className="text-right font-mono">{f(r.min)}</td>
                    <td className="text-right font-mono">{f(r.max)}</td>
                    <td className="text-right font-mono">{r.missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Bars s={s} />
        </div>
      ))}
    </Section>
  );
}
