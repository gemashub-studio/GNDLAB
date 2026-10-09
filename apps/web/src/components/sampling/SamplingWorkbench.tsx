'use client';

import type { DatasetSI, FormSI } from '@gemas/dataset';
import { CALIBRATION_MIN_SAMPLES, type Confidence } from '@gemas/calc-engine';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { NumberField } from '@/components/ui/fields';
import { COMMODITY_UI, CONTAINER_UI, formLabel, paramLabel, SAMPLING_PRIORITY } from '@/lib/catalog';
import { fmt, fmtMeasure } from '@/lib/format';
import { realizationReport } from '@/lib/realization';
import {
  checkAgainstDataset,
  displayUnit,
  METHOD_LABEL,
  METHODS,
  parseSamplingCsv,
  SAMPLING_COLUMNS,
  type MeasurementInput,
} from '@/lib/sampling';
import { useDataset } from '@/lib/useDataset';
import type { ParamStats } from '@/server/calibration';

type Role = 'viewer' | 'editor' | 'data_admin';
type Method = (typeof METHODS)[number];
interface Preset {
  key: string;
  method: Method;
  n: number;
}
interface SaveResult {
  inserted: number;
  proposals: { id: string; key: string; sampleN: number; created: boolean }[];
}


function splitKey(k: string) {
  const [commodityId, formCode, key] = k.split('|') as [string, string, string];
  return { commodityId, formCode, key };
}
const keyLabel = (k: string) => {
  const { commodityId, formCode, key } = splitKey(k);
  return `${COMMODITY_UI[commodityId]?.short ?? commodityId} · ${formLabel(commodityId, formCode)} · ${paramLabel(key)}`;
};

/** "2026-10-15T09:00" (zona lokal perangkat) → ISO dengan offset, mis. "+07:00". */
function toIsoWithOffset(local: string): string {
  const d = new Date(local);
  const off = -d.getTimezoneOffset();
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const sign = off >= 0 ? '+' : '-';
  return `${local.length === 16 ? `${local}:00` : local}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

async function postRows(rows: MeasurementInput[]): Promise<SaveResult> {
  const res = await fetch('/api/v1/measurements', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(json?.error?.details)
      ? (json.error.details as { index?: number; reason?: string; message?: string }[])
          .slice(0, 5)
          .map((d) => (d.index !== undefined ? `baris ${d.index + 1}: ${d.reason}` : d.message))
          .join('; ')
      : '';
    throw new Error(`${json?.error?.message ?? `Gagal (${res.status})`}${details ? ` — ${details}` : ''}`);
  }
  return json as SaveResult;
}

function Select({ label, value, onChange, children, testId }: { label: ReactNode; value: string; onChange: (v: string) => void; children: ReactNode; testId?: string }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="label-mono">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="field text-base" data-testid={testId}>
        {children}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = 'text', testId }: { label: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; testId?: string }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="label-mono">
        {label}
      </label>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="field text-base" data-testid={testId} />
    </div>
  );
}

const formsOf = (ds: DatasetSI, commodityId: string) => ds.commodities.find((c) => c.id === commodityId)?.forms ?? [];

/* ------------------------------------------------------------------ prioritas */

function Priority({ ds, stats, onPick, canWrite }: { ds: DatasetSI; stats: ParamStats[]; onPick: (p: Preset) => void; canWrite: boolean }) {
  return (
    <section aria-labelledby="prio-h" className="flex flex-col gap-3">
      <h2 id="prio-h" className="text-2xl">Ukur ini dulu</h2>
      <p className="text-sm text-muted">Tiga angka ini paling berisiko salah (masih estimasi). Cukup {CALIBRATION_MIN_SAMPLES} sampel per angka, sistem langsung bikin usulan koreksi.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {SAMPLING_PRIORITY.map((pr) => {
          const { commodityId, formCode, key } = splitKey(pr.key);
          const p = formsOf(ds, commodityId).find((f) => f.code === formCode)?.params[key];
          const st = stats.find((s) => s.key === pr.key);
          const n = st?.stats.n ?? 0;
          if (!p) return null;
          const du = displayUnit(p.unit, p.typ);
          return (
            <article key={pr.key} className="card flex flex-col gap-3" data-testid={`prio-${pr.asm}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="tag-mono">{pr.asm}</span>
                <ConfidenceBadge c={p.confidence as Confidence} withText />
              </div>
              <h3 className="text-lg">{keyLabel(pr.key)}</h3>
              <p className="num text-sm">
                Sekarang {fmtMeasure(du.fromSi(p.min))}–{fmtMeasure(du.fromSi(p.max))} {du.label} (biasanya {fmtMeasure(du.fromSi(p.typ))})
              </p>
              <p className="text-[13px]">{pr.how}</p>
              <div className="flex flex-col gap-1">
                <div className="bar relative" role="progressbar" aria-valuemin={0} aria-valuemax={CALIBRATION_MIN_SAMPLES} aria-valuenow={Math.min(n, CALIBRATION_MIN_SAMPLES)} aria-label="Sampel terkumpul">
                  <div className="h-full bg-acid" style={{ width: `${Math.min(1, n / CALIBRATION_MIN_SAMPLES) * 100}%` }} />
                </div>
                <span className="num text-xs font-bold">
                  {n}/{CALIBRATION_MIN_SAMPLES} sampel{st?.pendingProposalId ? ' · usulan menunggu review' : ''}
                </span>
              </div>
              {canWrite && (
                <button type="button" className="btn-ghost mt-auto" onClick={() => onPick({ key: pr.key, method: pr.method as Method, n: Date.now() })}>
                  Catat sampel ini
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ form cepat */

function SampleForm({ ds, preset, onSaved }: { ds: DatasetSI; preset?: Preset; onSaved: (r: SaveResult) => void }) {
  const [commodityId, setCommodity] = useState(ds.commodities[0]!.id);
  const [formCode, setForm] = useState(ds.commodities[0]!.forms[0]!.code);
  const [key, setKey] = useState('bulk_density');
  const [value, setValue] = useState<number>();
  const [method, setMethod] = useState<Method>('timbang');
  const [lotRef, setLot] = useState('');
  const [location, setLocation] = useState('');
  const [measuredAt, setMeasuredAt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  useEffect(() => setMeasuredAt(nowLocal()), []);
  useEffect(() => {
    if (!preset) return;
    const k = splitKey(preset.key);
    setCommodity(k.commodityId);
    setForm(k.formCode);
    setKey(k.key);
    setMethod(preset.method);
    setValue(undefined);
  }, [preset]);

  const forms = formsOf(ds, commodityId);
  const form: FormSI | undefined = forms.find((f) => f.code === formCode);
  const params = form ? Object.entries(form.params).sort(([a], [b]) => (a === 'bulk_density' ? -1 : b === 'bulk_density' ? 1 : a.localeCompare(b))) : [];
  const p = form?.params[key];
  const du = p ? displayUnit(p.unit, p.typ) : undefined;
  const outside = p && du && value !== undefined && (du.toSi(value) < p.min || du.toSi(value) > p.max);

  const pickCommodity = (c: string) => {
    setCommodity(c);
    const f = formsOf(ds, c)[0]!;
    setForm(f.code);
    setKey(f.params.bulk_density ? 'bulk_density' : Object.keys(f.params)[0]!);
  };
  const pickForm = (fc: string) => {
    setForm(fc);
    const f = forms.find((x) => x.code === fc)!;
    if (!f.params[key]) setKey(f.params.bulk_density ? 'bulk_density' : Object.keys(f.params)[0]!);
  };

  const submit = async () => {
    if (!p || !du || value === undefined) return setErr('Isi nilai hasil ukur dulu');
    const row: MeasurementInput = {
      measuredAt: toIsoWithOffset(measuredAt),
      commodityId,
      formCode,
      key,
      value: du.toSi(value),
      unit: p.unit as MeasurementInput['unit'],
      method,
      ...(lotRef.trim() && { lotRef: lotRef.trim() }),
      ...(location.trim() && { location: location.trim() }),
      ...(note.trim() && { note: note.trim() }),
    };
    const bad = checkAgainstDataset(ds, row);
    if (bad) return setErr(bad);
    setBusy(true);
    setErr(undefined);
    try {
      onSaved(await postRows([row]));
      setValue(undefined);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Komoditas" value={commodityId} onChange={pickCommodity} testId="s-commodity">
          {ds.commodities.map((c) => (
            <option key={c.id} value={c.id}>
              {COMMODITY_UI[c.id]?.short ?? c.nameId}
            </option>
          ))}
        </Select>
        <Select label="Bentuk" value={formCode} onChange={pickForm} testId="s-form">
          {forms.map((f) => (
            <option key={f.code} value={f.code}>
              {formLabel(commodityId, f.code)}
            </option>
          ))}
        </Select>
        <Select label="Yang diukur" value={key} onChange={setKey} testId="s-param">
          {params.map(([k, v]) => (
            <option key={k} value={k}>
              {paramLabel(k)} ({v.confidence})
            </option>
          ))}
        </Select>
      </div>

      {p && du && (
        <p className="num flex flex-wrap items-center gap-2 text-sm">
          <ConfidenceBadge c={p.confidence as Confidence} />
          Angka sekarang: {fmtMeasure(du.fromSi(p.min))}–{fmtMeasure(du.fromSi(p.max))} {du.label}, biasanya {fmtMeasure(du.fromSi(p.typ))} {du.label}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Hasil ukur"
          value={value}
          onValue={setValue}
          unit={du?.label}
          min={0}
          testId="s-value"
          hint={outside ? 'Di luar rentang dataset sekarang. Bisa saja memang begitu, tapi cek lagi satuannya ya.' : 'Satu angka per sampel. Ulangi ukur untuk sampel berikutnya.'}
        />
        <Select label="Cara ukur" value={method} onChange={(v) => setMethod(v as Method)} testId="s-method">
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Lot / kiriman" value={lotRef} onChange={setLot} placeholder="LOT-001" testId="s-lot" />
        <TextField label="Lokasi" value={location} onChange={setLocation} placeholder="Gudang Depok" />
        <TextField label="Waktu ukur" type="datetime-local" value={measuredAt} onChange={setMeasuredAt} />
      </div>
      <TextField label="Catatan (opsional)" value={note} onChange={setNote} placeholder="mis. karung agak basah habis hujan" />
      {err && (
        <p role="alert" className="font-bold">
          <span className="bg-safety px-1">{err}</span>
        </p>
      )}
      <button type="submit" className="btn-primary self-start" disabled={busy || value === undefined} data-testid="s-submit">
        {busy ? 'Menyimpan…' : 'Simpan sampel'}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ impor CSV */

function CsvImport({ ds, onSaved }: { ds: DatasetSI; onSaved: (r: SaveResult) => void }) {
  const [text, setText] = useState('');
  const [name, setName] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const parsed = useMemo(() => (text.trim() ? parseSamplingCsv(text, ds) : undefined), [text, ds]);
  const ok = parsed && !parsed.fatal && parsed.errors.length === 0 && parsed.rows.length > 0;

  const template = () => {
    const blob = new Blob([`${SAMPLING_COLUMNS.join(',')}\n`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'template_sampling.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const submit = async () => {
    if (!parsed || !ok) return;
    setBusy(true);
    setErr(undefined);
    try {
      const rows: MeasurementInput[] = parsed.rows.map(({ line: _l, officer, note, ...r }) => {
        const n = [officer && `petugas: ${officer}`, note].filter(Boolean).join(' · ');
        return { ...r, ...(n && { note: n.slice(0, 500) }) };
      });
      onSaved(await postRows(rows));
      setText('');
      setName(undefined);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Kolomnya harus persis seperti template (urutannya juga). Pemisah koma, atau titik koma kalau desimalnya pakai koma (Excel Indonesia). Semua baris harus benar dulu baru bisa dikirim — biar nggak ada data setengah masuk.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-ghost" onClick={template}>
          Unduh template
        </button>
        <label className="btn-acid cursor-pointer">
          Pilih file CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            data-testid="csv-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setName(f.name);
              setText(await f.text());
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {name && <p className="num text-xs">File: {name}</p>}
      {parsed?.fatal && (
        <p role="alert" className="font-bold">
          <span className="bg-safety px-1">{parsed.fatal}</span>
        </p>
      )}
      {parsed && !parsed.fatal && (
        <div className="flex flex-col gap-2" data-testid="csv-summary">
          <p className="font-bold">
            {parsed.rows.length} baris siap · {parsed.errors.length} baris salah
          </p>
          {parsed.errors.length > 0 && (
            <ul className="flex max-h-48 flex-col gap-1 overflow-auto border-2 border-ink bg-paper p-3 text-sm">
              {parsed.errors.map((e) => (
                <li key={`${e.line}-${e.reason}`}>
                  <span className="num font-bold">Baris {e.line}:</span> {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {err && (
        <p role="alert" className="font-bold">
          <span className="bg-safety px-1">{err}</span>
        </p>
      )}
      <button type="button" className="btn-primary self-start" disabled={!ok || busy} onClick={() => void submit()} data-testid="csv-submit">
        {busy ? 'Mengirim…' : `Kirim ${parsed?.rows.length ?? 0} sampel`}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ realisasi muat */

function Realization({ ds, canWrite, onSaved }: { ds: DatasetSI; canWrite: boolean; onSaved: (r: SaveResult) => void }) {
  const options = ds.commodities.flatMap((c) => c.forms.filter((f) => f.params.bulk_density).map((f) => ({ c: c.id, f })));
  const [sel, setSel] = useState('kelapa_jambul|bagged');
  const [containerId, setContainer] = useState(ds.containers[0]!.id);
  const [pieces, setPieces] = useState<number>();
  const [massKg, setMass] = useState<number>();
  const [full, setFull] = useState(true);
  const [lotRef, setLot] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [commodityId, formCode] = sel.split('|') as [string, string];
  const form = options.find((o) => o.c === commodityId && o.f.code === formCode)?.f;
  const byPiece = !!form?.unitMassKey;
  const unit = COMMODITY_UI[commodityId]?.pieceUnit ?? 'butir';

  const report = useMemo(() => {
    if (!(pieces && pieces > 0) && !(massKg && massKg > 0)) return undefined;
    try {
      return realizationReport(ds, { commodityId, formCode, containerId, fullByVolume: full, ...(byPiece && pieces ? { actualPieces: pieces } : {}), ...(massKg ? { actualMassKg: massKg } : {}) });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [ds, commodityId, formCode, containerId, pieces, massKg, full, byPiece]);

  const save = async () => {
    if (!report || 'error' in report || report.impliedDensity === undefined) return;
    setBusy(true);
    setErr(undefined);
    const what = report.basis === 'pieces' ? `${fmt(report.actual)} ${unit}` : `${fmt(report.actual)} kg`;
    try {
      onSaved(
        await postRows([
          {
            measuredAt: toIsoWithOffset(nowLocal()),
            commodityId,
            formCode,
            key: 'bulk_density',
            value: report.impliedDensity,
            unit: 'kg_m3',
            method: 'realisasi_stuffing',
            ...(lotRef.trim() && { lotRef: lotRef.trim() }),
            note: `Realisasi ${containerId}: ${what} vs prediksi ${fmt(report.predicted)} (selisih ${fmt(report.gap * 100, 1)}%)`,
          },
        ]),
      );
      setPieces(undefined);
      setMass(undefined);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">Habis stuffing, masukkan berapa yang benar-benar masuk. Kita bandingkan dengan hitungan kalkulator (target selisih ≤ 10%), dan kalau container-nya penuh, densitas aslinya bisa jadi sampel kalibrasi.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Muatan" value={sel} onChange={setSel} testId="r-form">
          {options.map((o) => (
            <option key={`${o.c}|${o.f.code}`} value={`${o.c}|${o.f.code}`}>
              {COMMODITY_UI[o.c]?.short ?? o.c} · {formLabel(o.c, o.f.code)}
            </option>
          ))}
        </Select>
        <Select label="Container" value={containerId} onChange={setContainer} testId="r-container">
          {ds.containers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} — {CONTAINER_UI[c.id] ?? c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {byPiece && <NumberField label={`Jumlah ${unit} masuk`} value={pieces} onValue={setPieces} integer min={1} unit={unit} testId="r-pieces" />}
        <NumberField label="Berat bersih muatan" value={massKg} onValue={setMass} min={1} unit="kg" testId="r-mass" hint={byPiece ? 'Opsional — dari timbangan. Kalau kosong, dihitung dari butir × berat rata-rata.' : 'Dari timbangan (tanpa berat container).'} />
        <TextField label="Lot / no. container" value={lotRef} onChange={setLot} placeholder="TGHU1234567" />
      </div>
      <label className="flex min-h-touch items-center gap-3 font-bold">
        <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} className="h-6 w-6 accent-ink" data-testid="r-full" />
        Container penuh sampai pintu (nggak ada ruang sisa)
      </label>

      {report && 'error' in report && (
        <p role="alert" className="font-bold">
          <span className="bg-safety px-1">{report.error}</span>
        </p>
      )}
      {report && !('error' in report) && (
        <div className="card-ink flex flex-col gap-3" data-testid="r-result">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className="label-mono text-acid">Prediksi</span>
              <p className="num text-2xl font-bold">
                {fmt(report.predicted)} {report.basis === 'pieces' ? unit : 'kg'}
              </p>
            </div>
            <div>
              <span className="label-mono text-acid">Aktual</span>
              <p className="num text-2xl font-bold">
                {fmt(report.actual)} {report.basis === 'pieces' ? unit : 'kg'}
              </p>
            </div>
            <div>
              <span className="label-mono text-acid">Selisih</span>
              <p className="num text-2xl font-bold" data-testid="r-gap" data-within={report.withinTarget}>
                {report.gap > 0 ? '+' : ''}
                {fmt(report.gap * 100, 1)}%
              </p>
              <span className={`inline-block border-2 border-paper px-2 py-0.5 text-xs font-extrabold uppercase ${report.withinTarget ? 'bg-acid text-ink' : 'bg-safety text-ink'}`}>
                {report.withinTarget ? 'Masuk target ≤ 10%' : 'Di luar target 10%'}
              </span>
            </div>
          </div>
          {report.impliedDensity !== undefined ? (
            <p className="num text-sm">
              Densitas asli muatan ≈ <strong>{fmt(report.impliedDensity)} kg/m³</strong> (dataset: {fmt(report.currentDensity.min)}–{fmt(report.currentDensity.max)}, biasanya {fmt(report.currentDensity.typ)}).
              {report.massFromPieces && ' Berat dihitung dari jumlah × berat rata-rata.'}
            </p>
          ) : (
            <p className="text-sm">{report.densityBlocked}</p>
          )}
          {canWrite && report.impliedDensity !== undefined && (
            <button type="button" className="btn-acid self-start" disabled={busy} onClick={() => void save()} data-testid="r-save">
              {busy ? 'Menyimpan…' : 'Simpan jadi sampel densitas'}
            </button>
          )}
        </div>
      )}
      {err && (
        <p role="alert" className="font-bold">
          <span className="bg-safety px-1">{err}</span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ statistik */

function StatsTable({ stats, ds }: { stats: ParamStats[]; ds: DatasetSI }) {
  if (!stats.length) return <p className="text-sm">Belum ada sampel. Mulai dari kartu &quot;Ukur ini dulu&quot; di atas.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm" data-testid="stats-table">
        <thead>
          <tr className="border-b-3 border-ink text-left">
            <th className="label-mono py-2 pr-3">Angka</th>
            <th className="label-mono py-2 pr-3">n</th>
            <th className="label-mono py-2 pr-3">Rata-rata ± SD</th>
            <th className="label-mono py-2 pr-3">Min–maks</th>
            <th className="label-mono py-2 pr-3">P5 / median / P95</th>
            <th className="label-mono py-2 pr-3">Dataset sekarang</th>
            <th className="label-mono py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const du = displayUnit(s.unit, s.current.typ);
            const f = (v: number) => fmtMeasure(du.fromSi(v));
            const known = formsOf(ds, s.commodityId).some((x) => x.code === s.formCode);
            return (
              <tr key={s.key} className="border-b-2 border-ink/20 align-top" data-key={s.key}>
                <td className="py-2 pr-3 font-bold">{known ? keyLabel(s.key) : s.key}</td>
                <td className="num py-2 pr-3 font-bold">{s.stats.n}</td>
                <td className="num py-2 pr-3">
                  {f(s.stats.mean)} ± {f(s.stats.sd)} {du.label}
                </td>
                <td className="num py-2 pr-3">
                  {f(s.stats.min)}–{f(s.stats.max)}
                </td>
                <td className="num py-2 pr-3">
                  {f(s.stats.p5)} / {f(s.stats.median)} / {f(s.stats.p95)}
                </td>
                <td className="num py-2 pr-3">
                  {f(s.current.min)} / {f(s.current.typ)} / {f(s.current.max)} <ConfidenceBadge c={s.current.confidence as Confidence} />
                </td>
                <td className="py-2">
                  {s.pendingProposalId ? (
                    <Link href="/kalibrasi" className="font-bold">
                      Usulan menunggu →
                    </Link>
                  ) : s.needed > 0 ? (
                    <span>kurang {s.needed} sampel</span>
                  ) : (
                    <span>cukup</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ halaman */

const TABS = [
  { id: 'form', label: 'Catat sampel' },
  { id: 'csv', label: 'Impor CSV' },
  { id: 'real', label: 'Realisasi muat' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function SamplingWorkbench({ role, stats, dbOk }: { role: Role | null; stats: ParamStats[]; dbOk: boolean }) {
  const ds = useDataset();
  const router = useRouter();
  const canWrite = role === 'editor' || role === 'data_admin';
  const [tab, setTab] = useState<Tab>('form');
  const [preset, setPreset] = useState<Preset>();
  const [flash, setFlash] = useState<SaveResult>();

  const onSaved = (r: SaveResult) => {
    setFlash(r);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      {!dbOk && (
        <p role="alert" className="card border-safety font-bold">
          Server data lagi nggak bisa dihubungi. Statistik belum bisa dimuat dan sampel belum bisa disimpan.
        </p>
      )}
      <Priority
        ds={ds}
        stats={stats}
        canWrite={canWrite}
        onPick={(p) => {
          setPreset(p);
          setTab(p.method === 'realisasi_stuffing' ? 'real' : 'form');
          document.getElementById('input-h')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {flash && (
        <div role="status" className="card flex flex-col gap-2 bg-acid" data-testid="flash">
          <p className="font-bold">{flash.inserted} sampel tersimpan.</p>
          {flash.proposals.map((p) => (
            <p key={p.id}>
              {p.created ? 'Usulan kalibrasi baru' : 'Usulan kalibrasi diperbarui'} untuk <strong>{keyLabel(p.key)}</strong> (n = {p.sampleN}).{' '}
              <Link href="/kalibrasi" className="font-bold">
                Lihat usulan →
              </Link>
            </p>
          ))}
        </div>
      )}

      <section aria-labelledby="input-h" className="card flex flex-col gap-5">
        <h2 id="input-h" className="text-2xl">
          Masukkan hasil ukur
        </h2>
        {!role ? (
          <p>
            <Link href="/masuk?callbackUrl=/sampling" className="btn-acid no-underline">
              Masuk dulu untuk mencatat
            </Link>
          </p>
        ) : !canWrite ? (
          <p className="text-sm">Akunmu masih peran <strong>viewer</strong> — bisa lihat statistik, tapi untuk mencatat sampel minta peran editor ke admin data.</p>
        ) : (
          <>
            <div role="tablist" aria-label="Cara input" className="grid grid-cols-3 gap-2.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  aria-pressed={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className="chip justify-center"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === 'form' && <SampleForm ds={ds} preset={preset} onSaved={onSaved} />}
              {tab === 'csv' && <CsvImport ds={ds} onSaved={onSaved} />}
              {tab === 'real' && <Realization ds={ds} canWrite={canWrite} onSaved={onSaved} />}
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="stats-h" className="card flex flex-col gap-4">
        <h2 id="stats-h" className="text-2xl">
          Statistik sampel
        </h2>
        <p className="text-[13px] text-muted">Usulan koreksi = P5 / median / P95 dari semua sampel, dibuat otomatis begitu n ≥ {CALIBRATION_MIN_SAMPLES}. Angka resmi baru berubah setelah admin data menyetujui.</p>
        <StatsTable stats={stats} ds={ds} />
      </section>
    </div>
  );
}
