'use client';

import { useMemo, useState } from 'react';
import {
  filterExperiments,
  LAB_PRODUCTS,
  LAB_STATUS,
  updateExperiment,
  type DailyEntry,
  type Experiment,
  type ExperimentEditable,
  type LabProductId,
  type LabStatus,
  type MediaItem,
  type ProtocolVersion,
} from '@/lib/labStore';
import { downloadBlob } from '@/lib/labMedia';
import { DailyLog } from './DailyLog';
import { DataSheet, DesignView, ResultsSummary } from './DesignPanels';
import { NewExperimentWizard } from './NewExperimentWizard';
import { Field, ProductMark, productName, Section, StatusPill, TextArea, TextInput } from './ui';


export function ExperimentsTab({
  items,
  entries,
  media,
  protocols,
  product,
  setProduct,
  openId,
  setOpenId,
  refresh,
}: {
  items: Experiment[];
  entries: DailyEntry[];
  media: MediaItem[];
  protocols: ProtocolVersion[];
  product: LabProductId | 'all';
  setProduct: (p: LabProductId | 'all') => void;
  openId: string | undefined;
  setOpenId: (id: string | undefined) => void;
  refresh: () => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<LabStatus | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const shown = useMemo(() => filterExperiments(items, { q, product, status }), [items, q, product, status]);
  const open = items.find((e) => e.id === openId);

  if (open)
    return (
      <ExperimentDetail
        e={open}
        entries={entries.filter((x) => x.experimentId === open.id)}
        media={media.filter((m) => m.experimentId === open.id)}
        protocols={protocols}
        onBack={() => setOpenId(undefined)}
        refresh={refresh}
      />
    );

  return (
    <div className="flex flex-col gap-5" data-testid="lab-experiments">
      <div className="card flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Cari</span>
            <input type="search" className="field font-sans font-normal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, judul, bahan, kondisi, hasil…" data-testid="lab-search" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jalur</span>
            <select className="field" value={product} onChange={(e) => setProduct(e.target.value as LabProductId | 'all')} data-testid="lab-filter-product">
              <option value="all">Semua jalur</option>
              {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Status</span>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value as LabStatus | 'all')} data-testid="lab-filter-status">
              <option value="all">Semua status</option>
              {LAB_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted" data-testid="lab-count">{shown.length} dari {items.length} eksperimen</span>
          <button type="button" className="btn-primary" aria-expanded={creating} onClick={() => setCreating((c) => !c)} data-testid="lab-new">
            {creating ? 'Tutup formulir' : '+ Eksperimen baru'}
          </button>
        </div>
      </div>

      {creating && (
        <NewExperimentWizard
          items={items}
          protocols={protocols}
          initialProduct={product === 'all' ? 'KE' : product}
          onSaved={async (id) => {
            await refresh();
            setCreating(false);
            setOpenId(id);
          }}
        />
      )}

      {shown.length ? (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="lab-list">
          {shown.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setOpenId(e.id)} className="card flex h-full w-full flex-col gap-2 text-left transition hover:-translate-y-0.5" data-testid={`lab-item-${e.id}`}>
                <span className="flex items-center gap-3">
                  <ProductMark id={e.product} />
                  <span className="flex flex-1 flex-col">
                    <span className="font-mono text-xs">{e.id}</span>
                    <span className="font-mono text-[11px] text-muted">mulai {e.startedAt}</span>
                  </span>
                  <StatusPill status={e.status} />
                </span>
                <span className="font-display text-lg font-semibold">{e.title}</span>
                <span className="line-clamp-2 text-sm text-muted">{e.objective || e.question || 'Tujuan belum dicatat'}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{items.length ? 'Tidak ada eksperimen yang cocok dengan pencarian/saringan.' : 'Belum ada eksperimen. Tekan "+ Eksperimen baru".'}</p>
      )}
    </div>
  );
}

function ExperimentDetail({
  e,
  entries,
  media,
  protocols,
  onBack,
  refresh,
}: {
  e: Experiment;
  entries: DailyEntry[];
  media: MediaItem[];
  protocols: ProtocolVersion[];
  onBack: () => void;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ExperimentEditable>(e);
  const [step, setStep] = useState('');
  const [msg, setMsg] = useState('');
  const set = (k: keyof ExperimentEditable) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async (patch: Partial<ExperimentEditable>, note: string) => {
    try {
      await updateExperiment(e.id, patch);
      await refresh();
      setMsg(note);
    } catch {
      setMsg('Gagal menyimpan. Coba lagi.');
    }
  };

  const addStep = () => {
    const action = step.trim();
    if (!action) return;
    const nextSteps = [...e.nextSteps, { id: `S${Date.now().toString(36)}`, action, done: false }];
    setStep('');
    void save({ nextSteps }, 'Langkah berikutnya ditambahkan.');
  };
  const toggleStep = (sid: string) => void save({ nextSteps: e.nextSteps.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) }, 'Langkah diperbarui.');

  return (
    <div className="flex flex-col gap-5" data-testid="lab-detail">
      <button type="button" className="self-start font-mono text-xs font-semibold text-muted hover:text-ink" onClick={onBack} data-testid="lab-back">← Semua eksperimen</button>

      <header className="card-ink flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ProductMark id={e.product} active />
          <span className="font-mono text-sm text-acid" data-testid="lab-detail-id">{e.id}</span>
          <StatusPill status={e.status} />
          <span className="font-mono text-xs text-muted-ink">{productName(e.product)} · mulai {e.startedAt}</span>
        </div>
        <h2 className="text-3xl text-paper">{e.title}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn border-acid/40 bg-transparent text-acid hover:bg-acid hover:text-ink"
            onClick={async () => {
              const { compilePdfBlob } = await import('@/lib/labPdf');
              downloadBlob(await compilePdfBlob(e, entries, protocols, media), `${e.id}-kompilasi.pdf`);
            }}
            data-testid="lab-compile-pdf"
          >
            Laporan lengkap (PDF)
          </button>
        </div>
        {e.history?.length ? <span className="font-mono text-[11px] text-muted-ink">{e.history.length} versi lama tersimpan · terakhir diubah {e.updatedAt?.slice(0, 16).replace('T', ' ')}</span> : null}
      </header>

      {msg && <p className="font-mono text-xs" role="status" data-testid="lab-detail-msg">{msg}</p>}

      {e.design && <DesignView d={e.design} />}
      {e.design && <DataSheet e={e} entries={entries} onSaved={refresh} />}
      {e.design && <ResultsSummary e={e} entries={entries} />}
      <DailyLog e={e} entries={entries} media={media} protocols={protocols} onSaved={refresh} />

      {editing ? (
        <Section title="Lengkapi catatan" testId="lab-edit">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><TextInput label="Judul" value={draft.title} onChange={set('title')} /></div>
            <TextArea label="Pertanyaan" value={draft.question} onChange={set('question')} />
            <TextArea label="Tujuan" value={draft.objective} onChange={set('objective')} />
            <div className="sm:col-span-2"><TextArea label="Dugaan (hipotesis)" value={draft.hypothesis ?? ''} onChange={set('hypothesis')} /></div>
            <TextInput label="Versi metode / SOP" value={draft.methodVersion} onChange={set('methodVersion')} />
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Status</span>
              <select className="field" value={draft.status} onChange={(ev) => set('status')(ev.target.value)} data-testid="lab-edit-status">
                {LAB_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2"><TextArea label="Kondisi proses" value={draft.processConditions} onChange={set('processConditions')} /></div>
            <TextArea label="Hasil — apa yang terjadi (termasuk yang tak sesuai harapan)" value={draft.resultSummary} onChange={set('resultSummary')} testId="lab-edit-result" />
            <TextArea label="Kesimpulan sementara — apa yang didukung data, apa yang belum diketahui" value={draft.conclusion} onChange={set('conclusion')} testId="lab-edit-conclusion" />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              data-testid="lab-edit-save"
              onClick={() => {
                const { nextSteps: _keep, ...patch } = draft;
                void save(patch, 'Tersimpan. Versi sebelumnya tetap ada di riwayat.').then(() => setEditing(false));
              }}
            >
              Simpan perubahan
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setDraft(e); setEditing(false); }}>Batal</button>
          </div>
        </Section>
      ) : (
        <Section title="Catatan eksperimen" aside={<button type="button" className="btn-ghost" onClick={() => { setDraft(e); setEditing(true); }} data-testid="lab-edit-open">Lengkapi / ubah</button>}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field k="Pertanyaan" v={e.question} />
            <Field k="Dugaan (hipotesis)" v={e.hypothesis ?? ''} />
            <Field k="Tujuan" v={e.objective} />
            <Field k="Versi metode" v={e.methodVersion} />
            <Field k="Kondisi proses" v={e.processConditions} />
            <Field k="Hasil" v={e.resultSummary} />
            <Field k="Kesimpulan sementara" v={e.conclusion} />
          </dl>
        </Section>
      )}

      <Section title="Langkah berikutnya" testId="lab-steps">
        {e.nextSteps.length ? (
          <ul className="flex flex-col gap-2">
            {e.nextSteps.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border-3 border-ink px-3 py-2.5">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={s.done} onChange={() => toggleStep(s.id)} />
                  <span className={s.done ? 'text-muted line-through' : ''}>{s.action}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Belum ada. Satu langkah atau pertanyaan lanjutan sudah cukup.</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field flex-1 font-sans font-normal" value={step} onChange={(ev) => setStep(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && addStep()} placeholder="mis. Ulangi dengan suhu 70 °C, 3 ulangan" data-testid="lab-step-input" />
          <button type="button" className="btn-ghost" onClick={addStep} data-testid="lab-step-add">Tambah</button>
        </div>
      </Section>

    </div>
  );
}
