'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addEntry,
  dayNumber,
  nextEntryId,
  NOT_RECORDED,
  type DailyEntry,
  type Experiment,
  type MaterialLine,
  type Measurement,
  type MediaItem,
  type ProtocolVersion,
} from '@/lib/labStore';
import { downloadBlob, fmtBytes, makeThumb } from '@/lib/labMedia';
import { MediaPicker } from './MediaPicker';
import { Section, TextArea, TextInput } from './ui';

const today = () => new Date().toISOString().slice(0, 10);
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const blankMaterial = (): MaterialLine => ({ name: '', batch: '', amount: '', unit: '' });
const blankMeasure = (): Measurement => ({ name: '', value: '', unit: '', at: nowLocal(), group: '', note: '' });
const blankForm = () => ({
  entryDate: today(),
  protocolId: '',
  plan: '',
  actual: '',
  materials: [blankMaterial()],
  tools: '',
  conditions: '',
  measurements: [blankMeasure()],
  deviations: '',
  interpretation: '',
  nextStep: '',
  correctsEntryId: '',
});

interface PendingFile {
  file: File;
  caption: string;
}

/** Catatan harian append-only + lampiran foto/video + PDF harian. */
export function DailyLog({
  e,
  entries,
  media,
  protocols,
  onSaved,
  finishable = false,
  title = 'Catatan harian',
  startDate,
  dayPlan,
  downloads,
}: {
  e: Experiment;
  entries: DailyEntry[];
  media: MediaItem[];
  protocols: ProtocolVersion[];
  onSaved: () => Promise<void>;
  /** Riset produk: boleh menandai laporan penutup (riset selesai). */
  finishable?: boolean;
  title?: string;
  /** Riset produk: tanggal mulai (untuk label Hari ke-N). */
  startDate?: string;
  /** Rencana hari ke-N dari resep (diisikan otomatis, tetap bisa diubah). */
  dayPlan?: (day: number) => string;
  /** Riset produk: unduh laporan satu hari dalam PDF / Word / PowerPoint (DEC-072). */
  downloads?: (entry: DailyEntry, kind: 'pdf' | 'docx' | 'pptx') => Promise<void>;
}) {
  const [finish, setFinish] = useState(false);
  const lastAuto = useRef('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = protocols.filter((p) => p.product === e.product);
  const id = nextEntryId(e.id, entries.map((x) => x.id));
  // Rencana otomatis = kegiatan Hari ke-N dari resep; ikut tanggal selama belum diketik sendiri.
  useEffect(() => {
    if (!open || !dayPlan) return;
    const n = dayNumber(startDate, form.entryDate);
    const auto = n ? dayPlan(n) : '';
    setForm((f) => ((f.plan === '' || f.plan === lastAuto.current) && f.plan !== auto ? { ...f, plan: auto } : f));
    lastAuto.current = auto;
  }, [open, form.entryDate, startDate, dayPlan]);
  /** Ganti tanggal catatan; waktu ukur yang masih bertanggal lama ikut pindah ke tanggal baru (jam tetap). */
  const setDate = (d: string) =>
    setForm((f) => ({
      ...f,
      entryDate: d,
      measurements: /^\d{4}-\d{2}-\d{2}$/.test(d) ? f.measurements.map((m) => (m.at.slice(0, 10) === f.entryDate ? { ...m, at: `${d}${m.at.slice(10)}` } : m)) : f.measurements,
    }));
  const set = (k: 'entryDate' | 'protocolId' | 'plan' | 'actual' | 'tools' | 'conditions' | 'deviations' | 'interpretation' | 'nextStep' | 'correctsEntryId') => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.entryDate)) return setMsg('Isi tanggal catatan dulu.');
    const materials = form.materials.filter((m) => m.name.trim() || m.amount.trim());
    const measurements = form.measurements.filter((m) => m.name.trim() || m.value.trim());
    if (measurements.some((m) => !m.name.trim() || !m.value.trim())) return setMsg('Tiap hasil ukur perlu nama variabel dan nilai.');
    setBusy(true);
    try {
      const prepared = [];
      for (const f of files) prepared.push({ name: f.file.name, type: f.file.type || 'application/octet-stream', size: f.file.size, caption: f.caption.trim(), thumb: await makeThumb(f.file), blob: f.file as Blob });
      await addEntry(
        {
          id,
          experimentId: e.id,
          entryDate: form.entryDate,
          protocolId: form.protocolId,
          plan: form.plan.trim(),
          actual: form.actual.trim(),
          materials,
          tools: form.tools.trim(),
          conditions: form.conditions.trim(),
          measurements,
          deviations: form.deviations.trim(),
          interpretation: form.interpretation.trim(),
          nextStep: form.nextStep.trim(),
          ...(form.correctsEntryId && { correctsEntryId: form.correctsEntryId }),
          ...(finishable && finish && { finished: true }),
        },
        prepared,
      );
      setForm(blankForm());
      setFiles([]);
      setFinish(false);
      setOpen(false);
      setMsg(`Tersimpan: ${id}. Catatan harian tidak bisa diubah; koreksi = catatan baru.`);
      await onSaved();
    } catch {
      setMsg('Gagal menyimpan (ruang penyimpanan penuh atau ID bentrok). Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  /** Lanjut ke hari berikutnya (DEC-072): tanggal +1 hari; rencana = kegiatan resep hari itu, atau "langkah berikutnya" hari sebelumnya. */
  const continueFrom = (prev: DailyEntry) => {
    const d = new Date(`${prev.entryDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const next = d.toISOString().slice(0, 10);
    const n = dayNumber(startDate, next);
    const auto = n && dayPlan ? dayPlan(n) : '';
    lastAuto.current = auto;
    const f0 = blankForm();
    setForm({ ...f0, entryDate: next, protocolId: prev.protocolId, plan: auto || prev.nextStep, measurements: f0.measurements.map((m) => ({ ...m, at: `${next}${m.at.slice(10)}` })) });
    setFiles([]);
    setFinish(false);
    setOpen(true);
    setMsg('');
    window.setTimeout(() => document.querySelector('[data-testid=day-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const lastEntry = [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt.localeCompare(b.createdAt)).pop();
  const closed = entries.some((x) => x.finished);

  const pdfDaily = async (entry: DailyEntry) => {
    const { dailyPdfBlob } = await import('@/lib/labPdf');
    downloadBlob(await dailyPdfBlob(e, entry, protocols, media), `${entry.id}-harian.pdf`);
  };

  return (
    <Section
      title={`${title} (${entries.length})`}
      aside={
        <button type="button" className="btn-primary" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="day-new">
          {open ? 'Tutup' : '+ Catatan hari ini'}
        </button>
      }
      testId="lab-daily"
    >
      <p className="text-sm text-muted">Tiap catatan adalah rekaman baru; catatan lama tidak bisa diubah atau dihapus. Salah tulis? Buat catatan koreksi.</p>
      {msg && <p className="font-mono text-xs" role="status" data-testid="day-msg">{msg}</p>}

      {open && (
        <div className="flex flex-col gap-4 rounded-2xl bg-paper p-4" data-testid="day-form">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag-mono" data-testid="day-id">{id}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Tanggal catatan</span>
              <input type="date" className="field" value={form.entryDate} onChange={(ev) => setDate(ev.target.value)} data-testid="day-date" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Riset produk (resep) yang dipakai</span>
              <select className="field" value={form.protocolId} onChange={(ev) => set('protocolId')(ev.target.value)} data-testid="day-protocol">
                <option value="">— tanpa riset produk —</option>
                {mine.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
              </select>
            </label>
            <TextArea label="Rencana hari ini (pengguna)" value={form.plan} onChange={set('plan')} testId="day-plan" />
            <TextArea label="Realisasi — yang benar-benar dilakukan" value={form.actual} onChange={set('actual')} testId="day-actual" />
          </div>

          <Rows
            title="Bahan & batch"
            items={form.materials}
            onChange={(materials) => setForm((f) => ({ ...f, materials }))}
            blank={blankMaterial}
            cols={[
              { k: 'name', label: 'Bahan', ph: 'mis. daging kelapa' },
              { k: 'batch', label: 'Batch/lot', ph: 'mis. DT-261010-001' },
              { k: 'amount', label: 'Jumlah', ph: 'persis seperti ditimbang' },
              { k: 'unit', label: 'Satuan', ph: 'kg, g, L…' },
            ]}
            testId="day-mat"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Alat" value={form.tools} onChange={set('tools')} placeholder="mis. oven listrik, timbangan 0,1 g" testId="day-tools" />
            <TextInput label="Kondisi yang dicatat" value={form.conditions} onChange={set('conditions')} placeholder="hanya yang benar-benar diukur" testId="day-conditions" />
          </div>

          <Rows
            title="Hasil ukur (data mentah)"
            items={form.measurements}
            onChange={(measurements) => setForm((f) => ({ ...f, measurements }))}
            blank={blankMeasure}
            cols={[
              { k: 'name', label: 'Variabel', ph: 'mis. kadar air' },
              { k: 'value', label: 'Nilai', ph: 'mis. 6,2' },
              { k: 'unit', label: 'Satuan', ph: '%' },
              { k: 'at', label: 'Waktu', type: 'datetime-local' },
              { k: 'group', label: 'Ulangan/kelompok', ph: 'U1 / kontrol' },
              { k: 'note', label: 'Catatan', ph: '' },
            ]}
            testId="day-meas"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextArea label="Penyimpangan / kegagalan" value={form.deviations} onChange={set('deviations')} testId="day-deviation" />
            <TextArea label="Interpretasi sementara (pengguna)" value={form.interpretation} onChange={set('interpretation')} testId="day-interp" />
            <TextInput label="Langkah berikutnya" value={form.nextStep} onChange={set('nextStep')} testId="day-next" />
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Mengoreksi catatan (opsional)</span>
              <select className="field" value={form.correctsEntryId} onChange={(ev) => set('correctsEntryId')(ev.target.value)}>
                <option value="">— bukan koreksi —</option>
                {entries.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.entryDate}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label-mono">Foto / video</span>
            <MediaPicker testId="day-files" onFiles={(fs) => setFiles((cur) => [...cur, ...fs.map((file) => ({ file, caption: '' }))])} />
            {files.map((f, i) => (
              <div key={`${f.file.name}-${i}`} className="flex flex-col gap-2 rounded-xl border-3 border-ink bg-surface p-2 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.file.name} · {fmtBytes(f.file.size)}</span>
                <input className="field min-h-[44px] flex-1 font-sans text-sm font-normal" placeholder="Keterangan foto/video" value={f.caption} onChange={(ev) => setFiles((cur) => cur.map((x, j) => (j === i ? { ...x, caption: ev.target.value } : x)))} />
                <button type="button" className="font-mono text-xs underline" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>batal</button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {finishable && (
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-4 w-4" checked={finish} onChange={(ev) => setFinish(ev.target.checked)} data-testid="day-finish" />
                Laporan penutup — tandai riset SELESAI
              </label>
            )}
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()} data-testid="day-save">{busy ? 'Menyimpan…' : 'Simpan catatan'}</button>
            <span className="text-xs text-muted">Setelah disimpan, catatan ini tidak bisa diubah.</span>
          </div>
        </div>
      )}

      {entries.length ? (
        <ol className="flex flex-col gap-3" data-testid="day-list">
          {[...entries].reverse().map((x) => (
            <EntryCard
              key={x.id}
              x={x}
              day={dayNumber(startDate, x.entryDate)}
              media={media.filter((m) => m.entryId === x.id)}
              protocols={protocols}
              onPdf={() => void pdfDaily(x)}
              {...(downloads && { downloads: (k: 'pdf' | 'docx' | 'pptx') => downloads(x, k) })}
              {...(finishable && !closed && lastEntry?.id === x.id && { onContinue: () => continueFrom(x), nextDay: (dayNumber(startDate, x.entryDate) ?? 0) + 1 })}
            />
          ))}
        </ol>
      ) : (
        !open && <p className="text-sm text-muted">Belum ada catatan harian.</p>
      )}
    </Section>
  );
}

function Rows<T extends object>({
  title,
  items,
  onChange,
  blank,
  cols,
  testId,
}: {
  title: string;
  items: T[];
  onChange: (v: T[]) => void;
  blank: () => T;
  cols: { k: keyof T & string; label: string; ph?: string; type?: string }[];
  testId: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" data-testid={testId}>
      <legend className="label-mono mb-2">{title}</legend>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-xl border-3 border-ink bg-surface p-2 sm:grid-cols-2 lg:grid-cols-6">
          {cols.map((c) => (
            <label key={c.k} className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{c.label}</span>
              <input
                type={c.type ?? 'text'}
                className="field min-h-[44px] font-sans text-sm font-normal"
                value={String(it[c.k] ?? '')}
                placeholder={c.ph}
                onChange={(ev) => onChange(items.map((row, j) => (j === i ? { ...row, [c.k]: ev.target.value } : row)))}
                data-testid={`${testId}-${c.k}-${i}`}
              />
            </label>
          ))}
          {items.length > 1 && (
            <button type="button" className="self-end justify-self-start font-mono text-xs underline" onClick={() => onChange(items.filter((_, j) => j !== i))}>hapus baris</button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost self-start" onClick={() => onChange([...items, blank()])} data-testid={`${testId}-add`}>+ Baris</button>
    </fieldset>
  );
}

function EntryCard({ x, day, media, protocols, onPdf, downloads, onContinue, nextDay }: {
  x: DailyEntry;
  day?: number;
  media: MediaItem[];
  protocols: ProtocolVersion[];
  onPdf: () => void;
  downloads?: (kind: 'pdf' | 'docx' | 'pptx') => Promise<void>;
  onContinue?: () => void;
  nextDay?: number;
}) {
  const [busy, setBusy] = useState('');
  const urls = useMemo(() => media.map((m) => URL.createObjectURL(m.blob)), [media]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const p = protocols.find((q) => q.id === x.protocolId);
  const part = (label: string, v: string) => (
    <div className="flex flex-col gap-0.5">
      <span className="label-mono">{label}</span>
      <span className={`whitespace-pre-wrap text-sm ${v ? '' : 'italic text-muted'}`}>{v || NOT_RECORDED}</span>
    </div>
  );

  return (
    <li className="flex flex-col gap-3 rounded-2xl border-3 border-ink bg-surface p-4" data-testid={`day-${x.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold">{x.id}</span>
        {day && <span className="rounded-full bg-acid px-2.5 py-0.5 font-mono text-[11px] font-semibold" data-testid={`day-num-${x.id}`}>Hari ke-{day}</span>}
        <span className="font-mono text-xs text-muted">{x.entryDate}</span>
        {p && <span className="rounded-full bg-paper px-2.5 py-0.5 font-mono text-[11px]">{p.id} · {p.name}</span>}
        {x.correctsEntryId && <span className="rounded-full bg-safety px-2.5 py-0.5 font-mono text-[11px]">koreksi {x.correctsEntryId}</span>}
        {x.finished && <span className="rounded-full bg-ink px-2.5 py-0.5 font-mono text-[11px] text-acid">SELESAI</span>}
        {downloads ? (
          <span className="ml-auto flex flex-wrap gap-1.5" data-testid={`day-dl-${x.id}`}>
            {(['pdf', 'docx', 'pptx'] as const).map((k) => (
              <button
                key={k}
                type="button"
                disabled={!!busy}
                className="btn-ghost min-h-[40px] px-3"
                onClick={() => {
                  setBusy(k);
                  void downloads(k).finally(() => setBusy(''));
                }}
                data-testid={`day-${k}-${x.id}`}
              >
                {busy === k ? '…' : k === 'pdf' ? 'PDF' : k === 'docx' ? 'Word' : 'PowerPoint'}
              </button>
            ))}
          </span>
        ) : (
          <button type="button" className="btn-ghost ml-auto min-h-[40px] px-3" onClick={onPdf} data-testid={`day-pdf-${x.id}`}>PDF harian</button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {part('Rencana', x.plan)}
        {part('Realisasi', x.actual)}
      </div>
      {x.materials.length > 0 && (
        <div className="overflow-x-auto">
          <span className="label-mono">Bahan & batch</span>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {x.materials.map((m, i) => (
                <tr key={i} className="border-t border-paper-grid">
                  <td className="py-1 pr-3">{m.name}</td>
                  <td className="py-1 pr-3 font-mono text-xs">{m.batch}</td>
                  <td className="py-1 pr-1 text-right font-mono">{m.amount}</td>
                  <td className="py-1 font-mono text-xs">{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {x.measurements.length > 0 && (
        <div className="overflow-x-auto">
          <span className="label-mono">Hasil ukur (mentah)</span>
          <table className="mt-1 w-full min-w-[480px] text-sm" data-testid={`day-meas-table-${x.id}`}>
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase text-muted">
                <th className="py-1">Waktu</th><th>Variabel</th><th className="pr-3 text-right">Nilai</th><th>Satuan</th><th>Kelompok</th><th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {x.measurements.map((m, i) => (
                <tr key={i} className="border-t border-paper-grid">
                  <td className="py-1 pr-2 font-mono text-xs">{m.at.replace('T', ' ')}</td>
                  <td className="pr-2">{m.name}</td>
                  <td className="pr-3 text-right font-mono">{m.value}</td>
                  <td className="pr-2 font-mono text-xs">{m.unit}</td>
                  <td className="pr-2 font-mono text-xs">{m.group}</td>
                  <td className="text-xs">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {part('Penyimpangan', x.deviations)}
        {part('Interpretasi sementara', x.interpretation)}
        {part('Langkah berikutnya', x.nextStep)}
      </div>
      {media.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid={`day-media-${x.id}`}>
          {media.map((m, i) => (
            <li key={m.id} className="flex flex-col gap-1">
              <a href={urls[i]} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border-3 border-ink bg-paper">
                {m.thumb ? <img src={m.thumb} alt={m.caption || m.name} className="aspect-video w-full object-cover" /> : <span className="flex aspect-video items-center justify-center font-mono text-xs">{m.type.startsWith('video/') ? 'VIDEO' : 'BERKAS'}</span>}
              </a>
              <span className="truncate font-mono text-[10px]">{m.type.startsWith('video/') ? '▶ ' : ''}{m.name} · {fmtBytes(m.size)}</span>
              <span className="text-xs">{m.caption || <em className="text-muted">tanpa keterangan</em>}</span>
            </li>
          ))}
        </ul>
      )}
      {onContinue && (
        <button type="button" className="btn-primary self-start" onClick={onContinue} data-testid={`day-continue-${x.id}`}>
          Lanjut ke {nextDay && nextDay > 1 ? `Hari ke-${nextDay}` : 'hari berikutnya'} →
        </button>
      )}
    </li>
  );
}
