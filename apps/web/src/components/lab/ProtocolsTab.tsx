'use client';

import { useEffect, useMemo, useState } from 'react';
import { downloadBlob, fmtBytes, makeThumb } from '@/lib/labMedia';
import {
  addProtocolVersion,
  LAB_PRODUCTS,
  nextProtocolKey,
  nextProtocolVersion,
  researchStatus,
  toolList,
  type DailyEntry,
  type Experiment,
  type LabProductId,
  type MediaItem,
  type NewMedia,
  type ProtocolIngredient,
  type ProtocolStep,
  type ProtocolTool,
  type ProtocolVersion,
} from '@/lib/labStore';
import { DailyLog } from './DailyLog';
import { ProductMark, Section, TextInput } from './ui';

const blankIng = (): ProtocolIngredient => ({ name: '', amount: '', unit: '' });
const blankStep = (): ProtocolStep => ({ text: '', duration: '', conditions: '' });
const STATUS_TEXT = { 'belum-mulai': 'belum ada laporan', berjalan: 'berjalan', selesai: 'SELESAI' } as const;

/**
 * RISET PRODUK (DEC-052; dulu "Protokol"): resep & proses buatan pengguna, berversi, dengan foto/video
 * per bahan & per langkah, daftar alat, laporan harian sampai selesai, dan laporan gabungan PDF/DOCX/PPTX.
 * Aplikasi TIDAK mengisi angka resep. Versi tersimpan tidak bisa diubah; perubahan = versi baru.
 */
export function ProtocolsTab({ protocols, entries, media, refresh }: { protocols: ProtocolVersion[]; entries: DailyEntry[]; media: MediaItem[]; refresh: () => Promise<void> }) {
  const [product, setProduct] = useState<LabProductId | 'all'>('all');
  const [editing, setEditing] = useState<{ base?: ProtocolVersion; product: LabProductId } | undefined>();
  const [openKey, setOpenKey] = useState<string>();
  const keys = [...new Set(protocols.filter((p) => product === 'all' || p.product === product).map((p) => p.key))];

  if (openKey && !editing) {
    return <ResearchDetail rkey={openKey} protocols={protocols} entries={entries} media={media} refresh={refresh} onBack={() => setOpenKey(undefined)} onNewVersion={(base) => setEditing({ base, product: base.product })} />;
  }

  return (
    <div className="flex flex-col gap-5" data-testid="lab-protocols">
      <div className="card flex flex-col gap-3">
        <p className="text-sm">
          <strong>Riset produk</strong> = resep & proses <strong>buatanmu sendiri</strong>: komposisi bahan (bisa dengan foto/video), alat, dan urutan langkah (bisa dengan foto/video).
          Tiap perubahan menjadi <strong>versi baru</strong>; versi lama tetap utuh. Catat laporan harian sampai riset selesai, lalu unduh laporan gabungan (PDF, Word, PowerPoint). Aplikasi tidak mengisi angka resep.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jalur</span>
            <select className="field" value={product} onChange={(e) => setProduct(e.target.value as LabProductId | 'all')} data-testid="proto-filter">
              <option value="all">Semua jalur</option>
              {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn-primary" onClick={() => setEditing({ product: product === 'all' ? 'KE' : product })} data-testid="proto-new">+ Resep baru</button>
        </div>
      </div>

      {editing && (
        <ProtocolForm
          protocols={protocols}
          media={media}
          base={editing.base}
          initialProduct={editing.product}
          onCancel={() => setEditing(undefined)}
          onSaved={async (key) => {
            setEditing(undefined);
            await refresh();
            setOpenKey((k) => (k ? key : k));
          }}
        />
      )}

      {keys.length ? (
        <ul className="flex flex-col gap-3" data-testid="proto-list">
          {keys.map((k) => {
            const versions = protocols.filter((p) => p.key === k).sort((a, b) => b.version - a.version);
            const latest = versions[0]!;
            const st = researchStatus(entries.filter((e) => e.experimentId === k));
            return (
              <li key={k} className="card flex flex-col gap-3" data-testid={`proto-${k}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <ProductMark id={latest.product} />
                  <div className="flex flex-1 flex-col">
                    <span className="font-mono text-xs text-muted">{k} · {versions.length} versi · {STATUS_TEXT[st]}</span>
                    <span className="font-display text-lg font-semibold">{latest.name}</span>
                  </div>
                  <button type="button" className="btn-primary" onClick={() => setOpenKey(k)} data-testid={`proto-open-${k}`}>Buka riset</button>
                  <button type="button" className="btn-ghost" onClick={() => setEditing({ base: latest, product: latest.product })} data-testid={`proto-newver-${k}`}>Buat versi baru</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !editing && <p className="text-sm text-muted">Belum ada riset produk tersimpan.</p>
      )}
    </div>
  );
}

function Thumbs({ ids, media }: { ids?: string[]; media: MediaItem[] }) {
  const list = (ids ?? []).map((id) => media.find((m) => m.id === id)).filter((m): m is MediaItem => !!m);
  const urls = useMemo(() => list.map((m) => URL.createObjectURL(m.blob)), [list.map((m) => m.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!list.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {list.map((m, i) => (
        <a key={m.id} href={urls[i]} target="_blank" rel="noopener noreferrer" title={m.caption || m.name} className="block h-14 w-20 overflow-hidden rounded-lg border-3 border-ink bg-paper">
          {m.thumb ? <img src={m.thumb} alt={m.caption || m.name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-mono text-[10px]">{m.type.startsWith('video/') ? 'VIDEO' : 'BERKAS'}</span>}
        </a>
      ))}
    </span>
  );
}

function VersionView({ v, media }: { v: ProtocolVersion; media: MediaItem[] }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <span className="label-mono">Komposisi bahan</span>
        {v.ingredients.length ? (
          <table className="mt-1 w-full">
            <tbody>
              {v.ingredients.map((i, n) => (
                <tr key={n} className="border-t border-paper-grid align-top">
                  <td className="py-1.5 pr-3">{i.name}<Thumbs ids={i.mediaIds} media={media} /></td>
                  <td className="py-1.5 pr-1 text-right font-mono">{i.amount}</td>
                  <td className="py-1.5 font-mono text-xs">{i.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="italic text-muted">belum dicatat</p>}
      </div>
      <div>
        <span className="label-mono">Alat yang digunakan</span>
        {toolList(v).length ? (
          <table className="mt-1 w-full">
            <tbody>
              {toolList(v).map((t, n) => (
                <tr key={n} className="border-t border-paper-grid align-top">
                  <td className="py-1.5 pr-3">{t.name}<Thumbs ids={t.mediaIds} media={media} /></td>
                  <td className="py-1.5 pr-1 text-right font-mono">{t.amount}</td>
                  <td className="py-1.5 font-mono text-xs">{t.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="italic text-muted">belum dicatat</p>}
      </div>
      <div>
        <span className="label-mono">Urutan langkah</span>
        {v.steps.length ? (
          <ol className="mt-1 flex list-decimal flex-col gap-2 pl-5">
            {v.steps.map((s, n) => (
              <li key={n}>
                {s.text}{s.duration && <span className="font-mono text-xs"> · {s.duration}</span>}{s.conditions && <span className="text-muted"> · {s.conditions}</span>}
                <Thumbs ids={s.mediaIds} media={media} />
              </li>
            ))}
          </ol>
        ) : <p className="italic text-muted">belum dicatat</p>}
      </div>
    </div>
  );
}

function ResearchDetail({ rkey, protocols, entries, media, refresh, onBack, onNewVersion }: {
  rkey: string;
  protocols: ProtocolVersion[];
  entries: DailyEntry[];
  media: MediaItem[];
  refresh: () => Promise<void>;
  onBack: () => void;
  onNewVersion: (base: ProtocolVersion) => void;
}) {
  const versions = protocols.filter((p) => p.key === rkey).sort((a, b) => b.version - a.version);
  const latest = versions[0];
  const days = entries.filter((e) => e.experimentId === rkey);
  const [busy, setBusy] = useState('');
  if (!latest) return null;
  const st = researchStatus(days);
  // Laporan harian memakai komponen catatan harian (append-only); "eksperimen" semu = kunci riset.
  const pseudo: Experiment = {
    id: rkey, product: latest.product, title: latest.name, startedAt: versions[versions.length - 1]!.createdAt.slice(0, 10), question: '', objective: '', methodVersion: latest.id,
    processConditions: '', resultSummary: '', conclusion: '', status: st === 'selesai' ? 'selesai' : 'berjalan', nextSteps: [], createdAt: versions[versions.length - 1]!.createdAt,
  };

  const exportAs = async (kind: 'pdf' | 'docx' | 'pptx') => {
    setBusy(kind);
    try {
      const { buildResearchReport } = await import('@/lib/researchReport');
      const report = buildResearchReport(rkey, protocols, entries, media);
      if (kind === 'pdf') {
        const { researchPdfBlob } = await import('@/lib/labPdf');
        downloadBlob(await researchPdfBlob(report), `${rkey}-riset-produk.pdf`);
      } else {
        const o = await import('@/lib/officeExport');
        const bytes = kind === 'docx' ? o.buildDocx(report) : o.buildPptx(report);
        downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: kind === 'docx' ? o.DOCX_MIME : o.PPTX_MIME }), `${rkey}-riset-produk.${kind}`);
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="rp-detail">
      <button type="button" className="self-start font-mono text-xs font-semibold text-muted hover:text-ink" onClick={onBack} data-testid="rp-back">← Semua riset produk</button>
      <header className="card-ink flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ProductMark id={latest.product} active />
          <span className="font-mono text-sm text-acid">{rkey}</span>
          <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] ${st === 'selesai' ? 'bg-acid text-ink' : 'bg-paper text-ink'}`} data-testid="rp-status">{STATUS_TEXT[st]}</span>
          <span className="font-mono text-xs text-muted-ink">{versions.length} versi · {days.length} laporan harian</span>
        </div>
        <h2 className="text-3xl text-paper">{latest.name}</h2>
        <div className="flex flex-wrap gap-2">
          {(['pdf', 'docx', 'pptx'] as const).map((k) => (
            <button key={k} type="button" disabled={!!busy} className="btn border-acid/40 bg-transparent text-acid hover:bg-acid hover:text-ink" onClick={() => void exportAs(k)} data-testid={`rp-${k}`}>
              {busy === k ? 'Menyiapkan…' : `Laporan ${k === 'pdf' ? 'PDF' : k === 'docx' ? 'Word (.docx)' : 'PowerPoint (.pptx)'}`}
            </button>
          ))}
        </div>
      </header>

      <Section title={`Resep versi ${latest.version}`} aside={<button type="button" className="btn-ghost" onClick={() => onNewVersion(latest)} data-testid="rp-newver">Buat versi baru</button>} testId="rp-latest">
        <VersionView v={latest} media={media} />
      </Section>

      <DailyLog e={pseudo} entries={days} media={media.filter((m) => m.experimentId === rkey && m.entryId.startsWith(`${rkey}-H`))} protocols={protocols} onSaved={refresh} finishable title="Laporan harian" />

      {versions.length > 1 && (
        <Section title="Riwayat versi" testId="rp-history">
          {versions.slice(1).map((v) => (
            <details key={v.id} className="rounded-xl bg-paper p-3">
              <summary className="cursor-pointer font-mono text-xs"><strong>{v.id}</strong> · {v.createdAt.slice(0, 10)} · oleh {v.author || 'pengguna'} · {v.reason || 'tanpa alasan'}</summary>
              <div className="mt-3"><VersionView v={v} media={media} /></div>
            </details>
          ))}
        </Section>
      )}
    </div>
  );
}

interface Pending {
  file: File;
  caption: string;
}

function FilePick({ list, onChange, testId }: { list: Pending[]; onChange: (l: Pending[]) => void; testId: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted">
        <span className="rounded-full border-3 border-ink bg-surface px-2.5 py-1 text-ink">+ Foto/video</span>
        <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => onChange([...list, ...Array.from(e.target.files ?? []).map((file) => ({ file, caption: '' }))])} data-testid={testId} />
        {list.length ? `${list.length} berkas dipilih` : ''}
      </label>
      {list.map((p, i) => (
        <div key={`${p.file.name}-${i}`} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono">{p.file.name} · {fmtBytes(p.file.size)}</span>
          <input className="field min-h-[36px] flex-1 font-sans text-xs font-normal" placeholder="Keterangan" value={p.caption} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
          <button type="button" className="underline" onClick={() => onChange(list.filter((_, j) => j !== i))}>batal</button>
        </div>
      ))}
    </div>
  );
}

const toMedia = async (list: Pending[]): Promise<NewMedia[]> => {
  const out: NewMedia[] = [];
  for (const p of list) out.push({ name: p.file.name, type: p.file.type || 'application/octet-stream', size: p.file.size, caption: p.caption.trim(), thumb: await makeThumb(p.file), blob: p.file });
  return out;
};

function ProtocolForm({ protocols, media, base, initialProduct, onCancel, onSaved }: {
  protocols: ProtocolVersion[];
  media: MediaItem[];
  base?: ProtocolVersion;
  initialProduct: LabProductId;
  onCancel: () => void;
  onSaved: (key: string) => Promise<void>;
}) {
  const [product, setProduct] = useState<LabProductId>(base?.product ?? initialProduct);
  const [name, setName] = useState(base?.name ?? '');
  const [author, setAuthor] = useState(base?.author ?? '');
  const [reason, setReason] = useState(base ? '' : 'versi awal');
  const [ings, setIngs] = useState<ProtocolIngredient[]>(base ? base.ingredients.map((i) => ({ ...i })) : [blankIng()]);
  const [steps, setSteps] = useState<ProtocolStep[]>(base ? base.steps.map((s) => ({ ...s })) : [blankStep()]);
  const [tools, setTools] = useState<ProtocolTool[]>(base && toolList(base).length ? toolList(base).map((t) => ({ ...t })) : [{ name: '' }]);
  const [toolFiles, setToolFiles] = useState<Pending[][]>(() => (base && toolList(base).length ? toolList(base).map(() => []) : [[]]));
  const [ingFiles, setIngFiles] = useState<Pending[][]>(() => (base ? base.ingredients.map(() => []) : [[]]));
  const [stepFiles, setStepFiles] = useState<Pending[][]>(() => (base ? base.steps.map(() => []) : [[]]));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const key = base?.key ?? nextProtocolKey(product, protocols);
  const { id, version } = nextProtocolVersion(key, protocols);

  const save = async () => {
    if (!name.trim()) return setMsg('Beri nama resep/proses.');
    if (base && !reason.trim()) return setMsg('Tulis alasan perubahan untuk versi baru.');
    setBusy(true);
    try {
      const keepI = ings.map((x, i) => ({ x, f: ingFiles[i] ?? [] })).filter(({ x }) => x.name.trim());
      const keepS = steps.map((x, i) => ({ x, f: stepFiles[i] ?? [] })).filter(({ x }) => x.text.trim());
      const iMedia: NewMedia[][] = [];
      for (const k of keepI) iMedia.push(await toMedia(k.f));
      const sMedia: NewMedia[][] = [];
      for (const k of keepS) sMedia.push(await toMedia(k.f));
      const keepT = tools.map((x, i) => ({ x, f: toolFiles[i] ?? [] })).filter(({ x }) => x.name.trim());
      const tMedia: NewMedia[][] = [];
      for (const k of keepT) tMedia.push(await toMedia(k.f));
      await addProtocolVersion(
        {
          id, key, version, product, name: name.trim(), author: author.trim(), reason: reason.trim(),
          ingredients: keepI.map(({ x }) => x),
          steps: keepS.map(({ x }) => x),
          tools: keepT.map(({ x }) => ({ ...x, name: x.name.trim() })),
        },
        { ingredients: iMedia, steps: sMedia, tools: tMedia },
      );
      await onSaved(key);
    } catch {
      setMsg('Gagal menyimpan (ID versi sudah ada atau penyimpanan penuh).');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={base ? `Versi baru dari ${base.id}` : 'Resep/proses baru'} aside={<span className="tag-mono" data-testid="proto-id">{id}</span>} testId="proto-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Jalur produk</span>
          <select className="field" value={product} disabled={!!base} onChange={(e) => setProduct(e.target.value as LabProductId)} data-testid="proto-product">
            {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <TextInput label="Nama resep/proses" value={name} onChange={setName} placeholder="mis. Kopra oven bertahap" testId="proto-name" />
        <TextInput label="Dibuat/diubah oleh" value={author} onChange={setAuthor} placeholder="nama kamu" testId="proto-author" />
        <TextInput label={base ? 'Alasan perubahan (wajib)' : 'Catatan versi'} value={reason} onChange={setReason} testId="proto-reason" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label-mono mb-2">Komposisi bahan — jumlah persis seperti kamu tentukan</legend>
        {ings.map((it, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border-3 border-ink p-2">
            <div className="grid grid-cols-[1fr_6rem_5rem_auto] items-center gap-2">
              <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Bahan" value={it.name} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} data-testid={`proto-ing-name-${i}`} />
              <input className="field min-h-[44px] text-sm" placeholder="Jumlah" value={it.amount} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} data-testid={`proto-ing-amount-${i}`} />
              <input className="field min-h-[44px] text-sm" placeholder="Satuan" value={it.unit} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} data-testid={`proto-ing-unit-${i}`} />
              <button type="button" aria-label="Hapus bahan" className="font-mono text-xs underline" onClick={() => { setIngs(ings.length > 1 ? ings.filter((_, j) => j !== i) : [blankIng()]); setIngFiles(ingFiles.length > 1 ? ingFiles.filter((_, j) => j !== i) : [[]]); }}>×</button>
            </div>
            <Thumbs ids={it.mediaIds} media={media} />
            <FilePick list={ingFiles[i] ?? []} onChange={(l) => setIngFiles(ingFiles.map((x, j) => (j === i ? l : x)))} testId={`proto-ing-files-${i}`} />
          </div>
        ))}
        <button type="button" className="btn-ghost self-start" onClick={() => { setIngs([...ings, blankIng()]); setIngFiles([...ingFiles, []]); }}>+ Bahan</button>
      </fieldset>

      <fieldset className="flex flex-col gap-2" data-testid="proto-tools">
        <legend className="label-mono mb-2">Alat yang digunakan — sama seperti bahan: nama, jumlah, satuan, foto/video</legend>
        {tools.map((t, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border-3 border-ink p-2">
            <div className="grid grid-cols-[1fr_6rem_5rem_auto] items-center gap-2">
              <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Alat" value={t.name} onChange={(e) => setTools(tools.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} data-testid={`proto-tool-name-${i}`} />
              <input className="field min-h-[44px] text-sm" placeholder="Jumlah" value={t.amount ?? ''} onChange={(e) => setTools(tools.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} data-testid={`proto-tool-amount-${i}`} />
              <input className="field min-h-[44px] text-sm" placeholder="Satuan" value={t.unit ?? ''} onChange={(e) => setTools(tools.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} data-testid={`proto-tool-unit-${i}`} />
              <button type="button" aria-label="Hapus alat" className="font-mono text-xs underline" onClick={() => { setTools(tools.length > 1 ? tools.filter((_, j) => j !== i) : [{ name: '' }]); setToolFiles(toolFiles.length > 1 ? toolFiles.filter((_, j) => j !== i) : [[]]); }}>×</button>
            </div>
            <Thumbs ids={t.mediaIds} media={media} />
            <FilePick list={toolFiles[i] ?? []} onChange={(l) => setToolFiles(toolFiles.map((x, j) => (j === i ? l : x)))} testId={`proto-tool-files-${i}`} />
          </div>
        ))}
        <button type="button" className="btn-ghost self-start" onClick={() => { setTools([...tools, { name: '' }]); setToolFiles([...toolFiles, []]); }} data-testid="proto-tool-add">+ Alat</button>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label-mono mb-2">Urutan langkah</legend>
        {steps.map((st, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border-3 border-ink p-2">
            <div className="grid gap-2 sm:grid-cols-[2rem_1fr_8rem_12rem_auto] sm:items-center">
              <span className="font-mono text-xs">{i + 1}.</span>
              <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Langkah" value={st.text} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} data-testid={`proto-step-${i}`} />
              <input className="field min-h-[44px] text-sm" placeholder="Waktu" value={st.duration} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} />
              <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Kondisi (suhu, dll.)" value={st.conditions} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, conditions: e.target.value } : x)))} />
              <button type="button" aria-label="Hapus langkah" className="font-mono text-xs underline" onClick={() => { setSteps(steps.length > 1 ? steps.filter((_, j) => j !== i) : [blankStep()]); setStepFiles(stepFiles.length > 1 ? stepFiles.filter((_, j) => j !== i) : [[]]); }}>×</button>
            </div>
            <Thumbs ids={st.mediaIds} media={media} />
            <FilePick list={stepFiles[i] ?? []} onChange={(l) => setStepFiles(stepFiles.map((x, j) => (j === i ? l : x)))} testId={`proto-step-files-${i}`} />
          </div>
        ))}
        <button type="button" className="btn-ghost self-start" onClick={() => { setSteps([...steps, blankStep()]); setStepFiles([...stepFiles, []]); }}>+ Langkah</button>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()} data-testid="proto-save">{busy ? 'Menyimpan…' : `Simpan versi ${version}`}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Batal</button>
        {msg && <span className="font-mono text-xs" role="status">{msg}</span>}
      </div>
    </Section>
  );
}
