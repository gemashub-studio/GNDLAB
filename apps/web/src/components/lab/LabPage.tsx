'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  addExperiment,
  LAB_PRODUCTS,
  LAB_STATUS,
  labBackupJson,
  listExperiments,
  nextExperimentId,
  NOT_RECORDED,
  type Experiment,
  type LabProductId,
  type LabStatus,
} from '@/lib/labStore';

const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ title: '', startedAt: today(), question: '', objective: '', methodVersion: '', processConditions: '', status: 'rencana' as LabStatus });
const statusLabel = (s: LabStatus) => LAB_STATUS.find((x) => x.id === s)!.label;
const orEmpty = (s: string) => s.trim() || NOT_RECORDED;

export function LabPage() {
  const [items, setItems] = useState<Experiment[]>([]);
  const [product, setProduct] = useState<LabProductId>('KE');
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState('');

  const refresh = () => listExperiments().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    void refresh();
  }, []);

  const id = useMemo(() => nextExperimentId(product, form.startedAt, items.map((e) => e.id)), [product, form.startedAt, items]);
  const mine = items.filter((e) => e.product === product);
  const productName = LAB_PRODUCTS.find((p) => p.id === product)!.name;
  const set = (k: keyof ReturnType<typeof blank>) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!id || !form.title.trim()) {
      setMsg('Isi judul dan tanggal mulai dulu.');
      return;
    }
    try {
      await addExperiment({
        id,
        product,
        title: form.title.trim(),
        startedAt: form.startedAt,
        question: form.question.trim(),
        objective: form.objective.trim(),
        methodVersion: form.methodVersion.trim(),
        processConditions: form.processConditions.trim(),
        resultSummary: '',
        conclusion: '',
        status: form.status,
      });
      setMsg(`Tersimpan: ${id}`);
      setForm(blank());
    } catch {
      setMsg('Gagal menyimpan (ID sudah dipakai?). Coba lagi.');
    }
    void refresh();
  };

  const backup = () => {
    const url = URL.createObjectURL(new Blob([labBackupJson(items)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `gema-rnd-cadangan-${today()}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">← gemasSTUDIO / RINGKASAN</Link>
          <h1 className="text-[40px] sm:text-[52px]">GEMA<br />RnD Lab</h1>
          <p className="max-w-xl text-[15px]">
            Buku catatan eksperimen untuk lima jalur produk. Tiap percobaan disimpan terpisah — hasil gagal juga dicatat. Yang belum diisi tertulis
            “{NOT_RECORDED}”.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="tag-mono -rotate-[1.5deg]">EXP-LAB // {items.length} EKSPERIMEN</span>
          {items.length > 0 && <button type="button" className="btn-ghost" onClick={backup} data-testid="lab-backup">Unduh cadangan (JSON)</button>}
        </div>
      </header>

      <section aria-label="Lima jalur R&D" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="lab-products">
        {LAB_PRODUCTS.map((p) => {
          const list = items.filter((e) => e.product === p.id);
          const active = p.id === product;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => setProduct(p.id)}
              data-testid={`lab-product-${p.id}`}
              className={`flex min-h-[120px] flex-col items-start gap-2 border-3 border-ink p-4 text-left shadow-hard ${active ? 'bg-acid' : 'bg-paper'}`}
            >
              <span className="font-mono text-xs font-bold">{p.id}</span>
              <span className="font-display text-xl leading-tight">{p.name}</span>
              <span className="mt-auto font-mono text-xs">
                {list.length ? `${list.length} eksperimen · terakhir ${list[0]!.id}` : 'belum ada eksperimen'}
              </span>
            </button>
          );
        })}
      </section>

      <section className="card flex flex-col gap-3" aria-label="Eksperimen baru">
        <h2 className="text-2xl">Eksperimen baru — {productName}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Judul percobaan" value={form.title} onChange={set('title')} placeholder="mis. Uji suhu oven 60 vs 80 °C" testId="lab-title" />
          <label className="flex flex-col gap-1">
            <span className="label-mono">Tanggal mulai</span>
            <input type="date" className="field" value={form.startedAt} onChange={(e) => set('startedAt')(e.target.value)} data-testid="lab-date" />
          </label>
          <TextArea label="Pertanyaan — apa yang mau diketahui?" value={form.question} onChange={set('question')} testId="lab-question" />
          <TextArea label="Tujuan — hasil apa yang dicari?" value={form.objective} onChange={set('objective')} testId="lab-objective" />
          <TextInput label="Versi metode / SOP" value={form.methodVersion} onChange={set('methodVersion')} placeholder="mis. SOP-KE v1" testId="lab-method" />
          <label className="flex flex-col gap-1">
            <span className="label-mono">Status</span>
            <select className="field" value={form.status} onChange={(e) => set('status')(e.target.value)} data-testid="lab-status">
              {LAB_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <TextArea label="Kondisi proses yang diukur/dicatat" value={form.processConditions} onChange={set('processConditions')} placeholder="mis. suhu, lama, kadar air — hanya yang benar-benar diukur" testId="lab-conditions" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="tag-mono" data-testid="lab-id">{id ?? 'ID: isi tanggal'}</span>
          <button type="button" className="btn-primary" onClick={() => void save()} data-testid="lab-save">Simpan eksperimen</button>
          {msg && <span className="font-mono text-xs" role="status" data-testid="lab-msg">{msg}</span>}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label={`Daftar eksperimen ${productName}`}>
        <h2 className="text-2xl">Eksperimen {productName} ({mine.length})</h2>
        {mine.length ? (
          <ul className="flex flex-col gap-3" data-testid="lab-list">
            {mine.map((e) => (
              <li key={e.id} className="card flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="font-mono">{e.id}</strong>
                  <span className="border-3 border-ink px-2 py-0.5 font-mono text-xs font-bold">{statusLabel(e.status).toUpperCase()}</span>
                  <span className="font-mono text-xs text-muted">mulai {e.startedAt}</span>
                </div>
                <h3 className="text-lg">{e.title}</h3>
                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                  <Row k="Pertanyaan" v={e.question} />
                  <Row k="Tujuan" v={e.objective} />
                  <Row k="Metode" v={e.methodVersion} />
                  <Row k="Kondisi" v={e.processConditions} />
                  <Row k="Hasil" v={e.resultSummary} />
                  <Row k="Kesimpulan" v={e.conclusion} />
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Belum ada eksperimen {productName}. Data tersimpan di perangkat ini (offline) — rutin unduh cadangan.</p>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="label-mono">{k}</dt>
      <dd className={v.trim() ? '' : 'italic text-muted'}>{orEmpty(v)}</dd>
    </>
  );
}

function TextInput({ label, value, onChange, placeholder, testId }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      <input className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, testId }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-mono">{label}</span>
      <textarea className="field min-h-[80px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} />
    </label>
  );
}
