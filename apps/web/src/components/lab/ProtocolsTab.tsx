'use client';

import { useEffect, useMemo, useState } from 'react';
import { downloadBlob, fmtBytes, makeThumb } from '@/lib/labMedia';
import {
  addProtocolVersion,
  deleteDraft,
  deleteResearch,
  listDrafts,
  saveDraft,
  LAB_PRODUCTS,
  nextProtocolKey,
  productFromRaw,
  jalurFromRaw,
  findSlot,
  VARIANT_MAX,
  variantLabel,
  type RawMaterial,
  coconutFilled,
  type CoconutRow,
  protocolProductName,
  resolveProduct,
  nextProtocolVersion,
  researchDates,
  researchStatus,
  toolList,
  type DailyEntry,
  type Experiment,
  type LabProductId,
  type MediaItem,
  type NewMedia,
  type ProtocolDraft,
  type ProtocolIngredient,
  type ProtocolStep,
  type ProtocolTool,
  type ProtocolVersion,
} from '@/lib/labStore';
import { DailyLog } from './DailyLog';
import { MediaPicker } from './MediaPicker';
import { ProductMark, Section, TextInput } from './ui';
import { askConfirm as ask } from './Overlays';

type ExportKind = 'pdf' | 'docx' | 'pptx' | 'html';

/** Unduh laporan SATU hari riset (DEC-072) dalam PDF / Word / PowerPoint — isi & grafik sama seperti laporan gabungan. */
async function downloadDaily(kind: ExportKind, key: string, entryId: string, protocols: ProtocolVersion[], entries: DailyEntry[], media: MediaItem[]) {
  const { buildDailyResearchReport } = await import('@/lib/researchReport');
  const report = buildDailyResearchReport(key, protocols, entries, media, entryId);
  const name = `${entryId}-laporan-harian.${kind}`;
  if (kind === 'html') return downloadHtml(report, media, name);
  if (kind === 'pdf') {
    const { researchPdfBlob } = await import('@/lib/labPdf');
    downloadBlob(await researchPdfBlob(report), name);
  } else {
    const o = await import('@/lib/officeExport');
    const { chartPngs } = await import('@/lib/chartPng');
    const charts = await chartPngs(report.blocks.flatMap((b) => b.charts ?? []));
    const bytes = kind === 'docx' ? o.buildDocx(report, charts) : o.buildPptx(report, charts, await reportVideos(report, media));
    downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: kind === 'docx' ? o.DOCX_MIME : o.PPTX_MIME }), name);
  }
}
const KIND_LABEL: Record<ExportKind, string> = { pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', html: 'HTML + video' };
const KINDS: ExportKind[] = ['pdf', 'docx', 'pptx', 'html'];

/** Video asli dari media laporan → ditanam di PowerPoint (DEC-073). */
async function reportVideos(report: import('@/lib/researchReport').ResearchReport, media: MediaItem[]) {
  const ids = new Set(report.blocks.flatMap((b) => b.images.filter((i) => i.video && i.mediaId).map((i) => i.mediaId!)));
  const out = new Map<string, import('@/lib/officeExport').VideoFile>();
  for (const m of media) {
    if (!ids.has(m.id)) continue;
    const mime = m.type.split(';')[0]!;
    const ext = mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4';
    out.set(m.id, { bytes: new Uint8Array(await m.blob.arrayBuffer()), ext, mime: ext === 'mp4' ? 'video/mp4' : mime });
  }
  return out;
}

/** Laporan HTML (DEC-073): video bisa diputar langsung; satu file mandiri. */
async function downloadHtml(report: import('@/lib/researchReport').ResearchReport, media: MediaItem[], name: string) {
  const { buildReportHtml } = await import('@/lib/reportHtml');
  const { html } = await buildReportHtml(report, media);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
}

/** Unduh laporan riset untuk versi tertentu (default terbaru) dalam PDF / Word / PowerPoint. */
async function downloadResearch(kind: ExportKind, key: string, versionId: string | undefined, protocols: ProtocolVersion[], entries: DailyEntry[], media: MediaItem[]) {
  const { buildResearchReport } = await import('@/lib/researchReport');
  const report = buildResearchReport(key, protocols, entries, media, undefined, versionId);
  const v = versionId ? `-${versionId.slice(key.length + 1)}` : '';
  const name = `${key}${v}-riset-produk.${kind}`;
  if (kind === 'html') return downloadHtml(report, media, name);
  if (kind === 'pdf') {
    const { researchPdfBlob } = await import('@/lib/labPdf');
    downloadBlob(await researchPdfBlob(report), name);
  } else {
    const o = await import('@/lib/officeExport');
    const { chartPngs } = await import('@/lib/chartPng');
    const charts = await chartPngs(report.blocks.flatMap((b) => b.charts ?? []));
    const bytes = kind === 'docx' ? o.buildDocx(report, charts) : o.buildPptx(report, charts, await reportVideos(report, media));
    downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: kind === 'docx' ? o.DOCX_MIME : o.PPTX_MIME }), name);
  }
}

const blankIng = (): ProtocolIngredient => ({ name: '', amount: '', unit: '' });
const blankStep = (): ProtocolStep => ({ text: '', duration: '', conditions: '' });
const STATUS_TEXT = { 'belum-mulai': 'belum ada laporan', berjalan: 'berjalan', selesai: 'SELESAI' } as const;

/**
 * RISET PRODUK (DEC-052; dulu "Protokol"): resep & proses buatan pengguna, berversi, dengan foto/video
 * per bahan & per langkah, daftar alat, laporan harian sampai selesai, dan laporan gabungan PDF/DOCX/PPTX.
 * Aplikasi TIDAK mengisi angka resep. Versi tersimpan tidak bisa diubah; perubahan = versi baru.
 */
export function ProtocolsTab({ protocols, entries, media, refresh, incomingRaw, onRawUsed }: {
  protocols: ProtocolVersion[];
  entries: DailyEntry[];
  media: MediaItem[];
  refresh: () => Promise<void>;
  /** Bahan baku yang baru dikonfirmasi di menu Bahan Baku → buka Resep baru terisi (DEC-068). */
  incomingRaw?: RawMaterial;
  onRawUsed?: () => void;
}) {
  const [editing, setEditing] = useState<{ base?: ProtocolVersion; product: string; productText?: string; draft?: ProtocolDraft; raw?: RawMaterial; nonce: number } | undefined>();
  useEffect(() => {
    if (!incomingRaw) return;
    const slot = findSlot(incomingRaw.variant, protocols);
    const raw = { ...incomingRaw, refKeys: slot?.research ? [slot.research.key] : [] };
    // Varian terpilih = jalur produk Resep baru (mis. "Cuka3"); data bahan baku ikut masuk.
    setEditing({ product: productFromRaw(raw), raw, nonce: Date.now(), productText: jalurFromRaw(raw) });
    onRawUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingRaw, onRawUsed]);
  const [openKey, setOpenKey] = useState<string>();
  const [drafts, setDrafts] = useState<ProtocolDraft[]>([]);
  const [ongoing, setOngoing] = useState(false);
  const loadDrafts = () => listDrafts().then(setDrafts).catch(() => setDrafts([]));
  useEffect(() => {
    void loadDrafts();
  }, []);
  const keys = [...new Set(protocols.map((p) => p.key))];
  const [verSel, setVerSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  if (openKey && !editing) {
    return <ResearchDetail rkey={openKey} protocols={protocols} entries={entries} media={media} refresh={refresh} onBack={() => setOpenKey(undefined)} onNewVersion={(base) => setEditing({ base, product: base.product, nonce: Date.now() })} />;
  }

  return (
    <div className="flex flex-col gap-5" data-testid="lab-protocols">
      <div className="card flex flex-col gap-3">
        <p className="text-sm">
          <strong>Riset produk</strong> = resep & proses <strong>buatanmu sendiri</strong>: komposisi bahan (bisa dengan foto/video), alat, dan urutan langkah (bisa dengan foto/video).
          Tiap perubahan menjadi <strong>versi baru</strong>; versi lama tetap utuh. Catat laporan harian sampai riset selesai, lalu unduh laporan gabungan (PDF, Word, PowerPoint). Aplikasi tidak mengisi angka resep.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <button type="button" className="btn-primary" onClick={() => setEditing({ product: 'KE', nonce: Date.now() })} data-testid="proto-new">+ Resep baru</button>
          <button type="button" className="btn-ghost" aria-expanded={ongoing} onClick={() => setOngoing((o) => !o)} data-testid="proto-ongoing">
            On going proses ({drafts.length})
          </button>
        </div>
      </div>

      {ongoing && (
        <Section title="On going proses" testId="ongoing-list">
          <p className="text-xs text-muted">Resep yang belum ditekan Selesai. Setelah Selesai, resep pindah ke Hasil riset.</p>
          {drafts.length === 0 && <p className="text-sm text-muted">Tidak ada proses yang sedang berjalan.</p>}
          <ul className="flex flex-col gap-2">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border-3 border-ink p-3">
                <span className="rounded-full bg-safety px-2.5 py-0.5 font-mono text-[11px] font-semibold">DRAF</span>
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{d.name || '(tanpa nama)'}</span>
                  <span className="font-mono text-[11px] text-muted">{protocolProductName(d)} · disimpan {d.updatedAt.slice(0, 16).replace('T', ' ')}</span>
                </span>
                <button type="button" className="btn-primary" onClick={() => { setOngoing(false); setEditing({ product: d.product, draft: d, nonce: Date.now(), ...(d.baseId && { base: protocols.find((p) => p.id === d.baseId) }) }); }} data-testid={`draft-open-${d.id}`}>Lanjutkan</button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    if (!(await ask({ title: 'Hapus draf', message: `Hapus draf "${d.name || '(tanpa nama)'}" beserta foto/video yang belum disimpan? Tidak bisa dibatalkan.` }))) return;
                    void deleteDraft(d.id).then(loadDrafts);
                  }}
                  data-testid={`draft-del-${d.id}`}
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {editing && (
        <ProtocolForm
          key={editing.draft?.id ?? `new-${editing.nonce}`}
          protocols={protocols}
          media={media}
          base={editing.base}
          draft={editing.draft}
          onDraftSaved={loadDrafts}
          initialProduct={editing.product}
          {...(editing.raw && { initialRaw: editing.raw })}
          {...(editing.productText && { initialProductText: editing.productText })}
          entries={entries}
          onCancel={() => setEditing(undefined)}
          onSaved={async (key) => {
            setEditing(undefined);
            await loadDrafts();
            await refresh();
            setOpenKey((k) => (k ? key : k));
          }}
        />
      )}

      <h2 className="text-xl">Hasil riset ({keys.length})</h2>
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
                    <span className="font-mono text-xs text-muted">{k} · {protocolProductName(latest)} · {versions.length} versi · {STATUS_TEXT[st]}</span>
                    <span className="font-display text-lg font-semibold">{latest.name}</span>
                  </div>
                  <button type="button" className="btn-primary" onClick={() => setOpenKey(k)} data-testid={`proto-open-${k}`}>Buka riset</button>
                  <button type="button" className="btn-ghost" onClick={() => setEditing({ base: latest, product: latest.product, nonce: Date.now() })} data-testid={`proto-newver-${k}`}>Buat versi baru</button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={async () => {
                      const ok = await ask({
                        title: `Hapus hasil riset ${k}`,
                        message: `Hapus hasil riset ${k} "${latest.name}" beserta SEMUA versi, laporan harian, dan foto/videonya? Tidak bisa dibatalkan — sebaiknya unduh cadangan dulu (tab Ringkasan).`,
                        requireText: k,
                      });
                      if (!ok) return;
                      void deleteResearch(k)
                        .then(async (n) => {
                          await refresh();
                          await ask({ title: 'Terhapus', message: `Terhapus: ${n.versions} versi, ${n.entries} laporan harian, ${n.media} foto/video.`, okLabel: 'OK', cancelLabel: null, danger: false });
                        })
                        .catch((e: Error) => void ask({ title: 'Gagal menghapus', message: e.message, okLabel: 'OK', cancelLabel: null, danger: false }));
                    }}
                    data-testid={`proto-del-${k}`}
                  >
                    Hapus
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper p-2" data-testid={`hr-dl-${k}`}>
                  <label className="flex items-center gap-2 text-xs">
                    <span className="label-mono">Unduh versi</span>
                    <select className="field min-h-[40px] text-sm" value={verSel[k] ?? latest.id} onChange={(e) => setVerSel((x) => ({ ...x, [k]: e.target.value }))} data-testid={`hr-ver-${k}`}>
                      {versions.map((v) => <option key={v.id} value={v.id}>Versi {v.version} · {v.createdAt.slice(0, 10)}</option>)}
                    </select>
                  </label>
                  {KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      disabled={!!busy}
                      className="btn-ghost min-h-[40px] px-3"
                      onClick={() => {
                        setBusy(`${k}-${kind}`);
                        void downloadResearch(kind, k, verSel[k] ?? latest.id, protocols, entries, media).finally(() => setBusy(''));
                      }}
                      data-testid={`hr-${kind}-${k}`}
                    >
                      {busy === `${k}-${kind}` ? '…' : KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !editing && <p className="text-sm text-muted">Belum ada hasil riset. Resep masuk ke sini setelah kamu menekan Selesai.</p>
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
      {v.raw && (
        <div data-testid="rp-raw">
          <span className="label-mono">Bahan baku</span>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {([
              ['Item', v.raw.item],
              ['Barang', v.raw.name],
              ['Perlakuan air', v.raw.waterVariant ? variantLabel(v.raw.waterVariant) : ''],
              ['Perlakuan daging', v.raw.meatVariant ? variantLabel(v.raw.meatVariant) : ''],
              ['Berat utuh (g)', v.raw.wholeWeight],
              ['Air (mL)', v.raw.water],
              ['Tebal daging (mm)', v.raw.meatThickness],
            ] as [string, string][]).map(([k, val]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] uppercase text-muted">{k}</dt>
                <dd>{val.trim() || <span className="italic text-muted">belum dicatat</span>}</dd>
              </div>
            ))}
          </dl>
          {v.raw.variant && <p className="mt-1 text-sm"><span className="font-mono text-[10px] uppercase text-muted">Jalur produk dari varian: </span>{variantLabel(v.raw.variant)}</p>}
        </div>
      )}
      {v.coconuts?.length ? (
        <div data-testid="rp-coco">
          <span className="label-mono">Penghitungan bahan baku kelapa</span>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase text-muted">
                  <th className="py-1 pr-2">Bahan</th>
                  {COCO_NUM.map(([k, l]) => <th key={k} className="pr-2">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {v.coconuts.map((c, n) => (
                  <tr key={n} className="border-t border-paper-grid align-top">
                    <td className="py-1.5 pr-2">{c.name}<Thumbs ids={c.mediaIds} media={media} /></td>
                    {COCO_NUM.map(([k]) => <td key={k} className="pr-2 font-mono">{(c[k] as string) || '–'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {v.coconuts.map((c, n) => (
              <div key={n} className="rounded-lg bg-paper p-2 text-sm">
                <dt className="font-semibold">{c.name}</dt>
                {COCO_TEXT.map(([k, l]) => <dd key={k}><span className="font-mono text-[10px] uppercase text-muted">{l}: </span>{(c[k] as string) || <span className="italic text-muted">belum dicatat</span>}</dd>)}
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <div>
        <span className="label-mono">Urutan hari</span>
        {v.steps.length ? (
          <ol className="mt-1 flex flex-col gap-2">
            {v.steps.map((s, n) => (
              <li key={n}>
                <span className="mr-2 rounded-full bg-acid px-2 py-0.5 font-mono text-[11px] font-semibold">Hari ke-{n + 1}</span>
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
  const start = latest.startDate ?? versions[versions.length - 1]!.startDate;
  const dates = researchDates(start, days);
  // Laporan harian memakai komponen catatan harian (append-only); "eksperimen" semu = kunci riset.
  const pseudo: Experiment = {
    id: rkey, product: latest.product as LabProductId, title: latest.name, startedAt: versions[versions.length - 1]!.createdAt.slice(0, 10), question: '', objective: '', methodVersion: latest.id,
    processConditions: '', resultSummary: '', conclusion: '', status: st === 'selesai' ? 'selesai' : 'berjalan', nextSteps: [], createdAt: versions[versions.length - 1]!.createdAt,
  };

  const exportAs = async (kind: ExportKind) => {
    setBusy(kind);
    try {
      await downloadResearch(kind, rkey, undefined, protocols, entries, media);
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
        <dl className="grid gap-2 font-mono text-xs text-muted-ink sm:grid-cols-3" data-testid="rp-dates">
          <div><dt className="uppercase tracking-[0.12em]">Tanggal mulai</dt><dd className="text-paper">{dates.start ?? 'belum dicatat'}</dd></div>
          <div><dt className="uppercase tracking-[0.12em]">Tanggal selesai (otomatis)</dt><dd className="text-paper" data-testid="rp-end">{dates.end ? `${dates.end}${dates.days ? ` · ${dates.days} hari` : ''}` : 'belum selesai'}</dd></div>
          <div><dt className="uppercase tracking-[0.12em]">Pembuat & asisten</dt><dd className="text-paper">{[latest.author || 'belum dicatat', ...(latest.assistants ?? [])].join(', ')}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k} type="button" disabled={!!busy} className="btn border-acid/40 bg-transparent text-acid hover:bg-acid hover:text-ink" onClick={() => void exportAs(k)} data-testid={`rp-${k}`}>
              {busy === k ? 'Menyiapkan…' : `Laporan ${k === 'pdf' ? 'PDF' : k === 'docx' ? 'Word (.docx)' : 'PowerPoint (.pptx)'}`}
            </button>
          ))}
        </div>
      </header>

      <Section title={`Resep versi ${latest.version}`} aside={<button type="button" className="btn-ghost" onClick={() => onNewVersion(latest)} data-testid="rp-newver">Buat versi baru</button>} testId="rp-latest">
        <VersionView v={latest} media={media} />
      </Section>

      <DailyLog e={pseudo} entries={days} media={media.filter((m) => m.experimentId === rkey && m.entryId.startsWith(`${rkey}-H`))} protocols={protocols} onSaved={refresh} finishable title="Laporan harian" downloads={(x, k) => downloadDaily(k, rkey, x.id, protocols, entries, media)} {...(start && { startDate: start })} dayPlan={(n) => (latest.steps[n - 1] ? `Hari ke-${n}: ${latest.steps[n - 1]!.text}` : '')} />

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

const COCO_NUM: [keyof CoconutRow, string][] = [
  ['wholeStart', 'Berat utuh awal (g)'],
  ['wholeEnd', 'Berat utuh akhir (g)'],
  ['waterWeight', 'Berat air (g)'],
  ['waterVolume', 'Volume air (mL)'],
  ['meatStart', 'Tebal daging awal (mm)'],
  ['meatEnd', 'Tebal daging akhir (mm)'],
];
const COCO_TEXT: [keyof CoconutRow, string][] = [
  ['waterProcess', 'Proses air'],
  ['waterResult', 'Hasil proses air'],
  ['meatProcess', 'Proses daging'],
  ['meatResult', 'Hasil proses daging'],
];

/**
 * Kolom bahan baku di atas Resep baru (DEC-068): Berat utuh & Air, lalu Tebal daging (+ knowledge Kopra 1–5)
 * bila tebal daging dipilih; perlakuan air → knowledge Cuka 1–5 & Bioleather 1–5.
 */
function RawFieldset({ raw, setRaw, protocols, entries }: { raw: RawMaterial; setRaw: (r: RawMaterial | undefined) => void; protocols: ProtocolVersion[]; entries: DailyEntry[] }) {
  const set = <K extends keyof RawMaterial>(k: K, v: RawMaterial[K]) => setRaw({ ...raw, [k]: v });
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border-3 border-acid bg-paper p-3" data-testid="proto-raw">
      <legend className="label-mono px-1">Bahan baku — {raw.item}: {raw.name}{raw.waterVariant && ` · perlakuan air ${variantLabel(raw.waterVariant)}`}{raw.meatVariant && ` · perlakuan daging ${variantLabel(raw.meatVariant)}`}</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Berat utuh (g)</span>
          <input className="field min-h-[44px] text-sm" inputMode="decimal" value={raw.wholeWeight} onChange={(e) => set('wholeWeight', e.target.value)} data-testid="proto-raw-whole" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Air (mL)</span>
          <input className="field min-h-[44px] text-sm" inputMode="decimal" value={raw.water} onChange={(e) => set('water', e.target.value)} data-testid="proto-raw-water" />
        </label>
      </div>
      {(
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Tebal daging (mm)</span>
          <input className="field min-h-[44px] text-sm" inputMode="decimal" value={raw.meatThickness} onChange={(e) => set('meatThickness', e.target.value)} data-testid="proto-raw-meat" />
        </label>
      )}
      {raw.variant && (
        <p className="text-sm" data-testid="proto-raw-variant">
          <span className="font-mono text-[10px] uppercase text-muted">Varian: </span>
          {variantLabel(raw.variant)} <span className="text-xs text-muted">(= jalur produk resep ini)</span>
        </p>
      )}
      <button type="button" className="self-start font-mono text-xs underline" onClick={() => setRaw(undefined)} data-testid="proto-raw-remove">Lepas bahan baku dari resep ini</button>
    </fieldset>
  );
}

function FilePick({ list, onChange, testId }: { list: Pending[]; onChange: (l: Pending[]) => void; testId: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <MediaPicker compact testId={testId} onFiles={(fs) => onChange([...list, ...fs.map((file) => ({ file, caption: '' }))])} />
        {list.length > 0 && <span className="font-mono text-[11px] text-muted">{list.length} berkas dipilih</span>}
      </div>
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

function ProtocolForm({ protocols, entries, media, base, draft, onDraftSaved, initialProduct, initialRaw, initialProductText, onCancel, onSaved }: {
  protocols: ProtocolVersion[];
  entries: DailyEntry[];
  initialRaw?: RawMaterial;
  /** Jalur produk awal berupa teks (mis. varian "Cuka3" dari menu Bahan Baku). */
  initialProductText?: string;
  media: MediaItem[];
  base?: ProtocolVersion;
  draft?: ProtocolDraft;
  onDraftSaved: () => Promise<void>;
  initialProduct: string;
  onCancel: () => void;
  onSaved: (key: string) => Promise<void>;
}) {
  const fromDraft = (rows: NewMedia[][]): Pending[][] => rows.map((r) => r.map((m) => ({ file: new File([m.blob], m.name, { type: m.type }), caption: m.caption })));
  const [draftId] = useState(draft?.id ?? `D-${Date.now().toString(36)}`);
  // Jalur produk diisi bebas (DEC-063): nama preset → kode preset; nama lain → kode 2 huruf otomatis.
  const src = draft ?? base;
  const [productText, setProductText] = useState(src ? protocolProductName(src) : initialProductText ?? protocolProductName({ product: initialProduct }));
  const { product, productName } = base ? { product: base.product, ...(base.productName && { productName: base.productName }) } : resolveProduct(productText);
  const [name, setName] = useState(draft?.name ?? base?.name ?? '');
  const [author, setAuthor] = useState(draft?.author ?? base?.author ?? '');
  const [assistants, setAssistants] = useState(draft?.assistants ?? (base?.assistants ?? []).join(', '));
  const [startDate, setStartDate] = useState(draft?.startDate ?? base?.startDate ?? new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(draft?.reason ?? (base ? '' : 'versi awal'));
  const [ings, setIngs] = useState<ProtocolIngredient[]>(draft?.ingredients ?? (base ? base.ingredients.map((i) => ({ ...i })) : [blankIng()]));
  const [steps, setSteps] = useState<ProtocolStep[]>(draft?.steps ?? (base ? base.steps.map((s) => ({ ...s })) : [blankStep()]));
  const [tools, setTools] = useState<ProtocolTool[]>(draft?.tools ?? (base && toolList(base).length ? toolList(base).map((t) => ({ ...t })) : [{ name: '' }]));
  const [toolFiles, setToolFiles] = useState<Pending[][]>(() => (draft ? fromDraft(draft.pending.tools) : base && toolList(base).length ? toolList(base).map(() => []) : [[]]));
  const [ingFiles, setIngFiles] = useState<Pending[][]>(() => (draft ? fromDraft(draft.pending.ingredients) : base ? base.ingredients.map(() => []) : [[]]));
  const [coco] = useState<CoconutRow[]>(draft?.coconuts ?? (base?.coconuts?.length ? base.coconuts.map(({ mediaIds: _m, ...c }) => ({ ...c })) : []));
  const [cocoFiles] = useState<Pending[][]>(() => (draft?.pending.coconuts ? fromDraft(draft.pending.coconuts) : (draft?.coconuts ?? base?.coconuts ?? []).map(() => [])));
  const [stepFiles, setStepFiles] = useState<Pending[][]>(() => (draft ? fromDraft(draft.pending.steps) : base ? base.steps.map(() => []) : [[]]));
  const [raw, setRaw] = useState<RawMaterial | undefined>(draft?.raw ?? (base?.raw ? { ...base.raw } : initialRaw));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const key = base?.key ?? nextProtocolKey(product, protocols);
  const { id, version } = nextProtocolVersion(key, protocols);

  /** "Simpan" = draf, bisa dibuka & diubah lagi besok (On going proses). */
  const keepDraft = async () => {
    setBusy(true);
    try {
      const pend = async (rows: Pending[][]) => {
        const out: NewMedia[][] = [];
        for (const r of rows) out.push(await toMedia(r));
        return out;
      };
      await saveDraft({
        id: draftId, ...(base && { baseId: base.id }), ...(draft && { createdAt: draft.createdAt }),
        product, ...(productName && { productName }), name, author, assistants, startDate, reason, ingredients: ings, tools, steps, coconuts: coco, ...(raw && { raw }),
        pending: { ingredients: await pend(ingFiles), tools: await pend(toolFiles), steps: await pend(stepFiles), coconuts: await pend(cocoFiles) },
      });
      await onDraftSaved();
      setMsg(`Tersimpan ${new Date().toLocaleTimeString('id-ID')}. Buka lagi kapan saja lewat "On going proses"; tekan Selesai bila resep sudah final.`);
    } catch {
      setMsg('Gagal menyimpan draf (penyimpanan penuh?).');
    } finally {
      setBusy(false);
    }
  };

  /** "Selesai" = jadi versi resmi (tidak bisa diubah); draf dihapus. */
  const save = async () => {
    if (!name.trim()) return setMsg('Beri nama resep/proses.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return setMsg('Isi tanggal mulai.');
    if (base && !reason.trim()) return setMsg('Tulis alasan perubahan untuk versi baru.');
    setBusy(true);
    try {
      const keepI = ings.map((x, i) => ({ x, f: ingFiles[i] ?? [] })).filter(({ x }) => x.name.trim());
      const keepS = steps.map((x, i) => ({ x, f: stepFiles[i] ?? [] })).filter(({ x }) => x.text.trim());
      const iMedia: NewMedia[][] = [];
      for (const k of keepI) iMedia.push(await toMedia(k.f));
      const sMedia: NewMedia[][] = [];
      for (const k of keepS) sMedia.push(await toMedia(k.f));
      const keepK = coco.map((x, i) => ({ x, f: cocoFiles[i] ?? [] })).filter(({ x, f }) => coconutFilled(x) || f.length);
      const kMedia: NewMedia[][] = [];
      for (const k of keepK) kMedia.push(await toMedia(k.f));
      const keepT = tools.map((x, i) => ({ x, f: toolFiles[i] ?? [] })).filter(({ x }) => x.name.trim());
      const tMedia: NewMedia[][] = [];
      for (const k of keepT) tMedia.push(await toMedia(k.f));
      await addProtocolVersion(
        {
          id, key, version, product, ...(productName && { productName }), name: name.trim(), author: author.trim(), reason: reason.trim(), startDate,
          assistants: assistants.split(',').map((a) => a.trim()).filter(Boolean),
          ingredients: keepI.map(({ x }) => x),
          steps: keepS.map(({ x }) => x),
          tools: keepT.map(({ x }) => ({ ...x, name: x.name.trim() })),
          ...(keepK.length && { coconuts: keepK.map(({ x }) => x) }),
          ...(raw && { raw }),
        },
        { ingredients: iMedia, steps: sMedia, tools: tMedia, coconuts: kMedia, draftId },
      );
      await onSaved(key);
    } catch {
      setMsg('Gagal menyimpan (ID versi sudah ada atau penyimpanan penuh).');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title={`${draft ? 'Lanjutkan draf — ' : ''}${base ? `Versi baru dari ${base.id}` : 'Resep/proses baru'}`}
      aside={<span className="tag-mono" title="Kode ini dipakai saat kamu menekan Selesai" data-testid="proto-id">{id}</span>}
      testId="proto-form"
    >
      {raw && <RawFieldset raw={raw} setRaw={setRaw} protocols={protocols} entries={entries} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Jalur produk</span>
          <input className="field" list="proto-product-list" value={productText} disabled={!!base} onChange={(e) => setProductText(e.target.value)} placeholder="pilih atau ketik, mis. Minyak Kelapa" data-testid="proto-product" />
          <datalist id="proto-product-list">
            {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.name} />)}
            {(['Cuka', 'Bioleather', 'Kopra'] as const).flatMap((l) => Array.from({ length: VARIANT_MAX }, (_, i) => <option key={`${l}${i + 1}`} value={`${l}${i + 1}`} />))}
          </datalist>
          <span className="text-xs text-muted" data-testid="proto-product-code">Kode jalur: {product}{productName ? ' (isian manual)' : ''}</span>
        </label>
        <TextInput label="Nama resep/proses" value={name} onChange={setName} placeholder="mis. Kopra oven bertahap" testId="proto-name" />
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Tanggal mulai</span>
          <input type="date" className="field" value={startDate} disabled={!!base?.startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="proto-start" />
          <span className="text-xs text-muted">Tanggal selesai terisi otomatis dari laporan penutup.</span>
        </label>
        <TextInput label="Pembuat" value={author} onChange={setAuthor} placeholder="nama kamu" testId="proto-author" />
        <TextInput label="Asisten (pisahkan dengan koma)" value={assistants} onChange={setAssistants} placeholder="mis. Rina, Budi" testId="proto-assistants" />
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

      {/* Penghitungan per butir (DEC-064) diganti menu Bahan Baku (DEC-068); data lama tetap ikut tersimpan. */}

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
        <legend className="label-mono mb-2">Urutan hari — kegiatan tiap hari, lanjut ke hari berikutnya</legend>
        {steps.map((st, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border-3 border-ink p-2">
            <div className="grid gap-2 sm:grid-cols-[5.5rem_1fr_8rem_12rem_auto] sm:items-center">
              <span className="rounded-full bg-acid px-2 py-1 text-center font-mono text-[11px] font-semibold" data-testid={`proto-day-${i}`}>Hari ke-{i + 1}</span>
              <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Kegiatan hari ini" value={st.text} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} data-testid={`proto-step-${i}`} />
              <input className="field min-h-[44px] text-sm" placeholder="Lama / jam" value={st.duration} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} />
              <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Kondisi (suhu, dll.)" value={st.conditions} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, conditions: e.target.value } : x)))} />
              <button type="button" aria-label="Hapus hari" className="font-mono text-xs underline" onClick={() => { setSteps(steps.length > 1 ? steps.filter((_, j) => j !== i) : [blankStep()]); setStepFiles(stepFiles.length > 1 ? stepFiles.filter((_, j) => j !== i) : [[]]); }}>×</button>
            </div>
            <Thumbs ids={st.mediaIds} media={media} />
            <FilePick list={stepFiles[i] ?? []} onChange={(l) => setStepFiles(stepFiles.map((x, j) => (j === i ? l : x)))} testId={`proto-step-files-${i}`} />
          </div>
        ))}
        <button type="button" className="btn-ghost self-start" onClick={() => { setSteps([...steps, blankStep()]); setStepFiles([...stepFiles, []]); }} data-testid="proto-day-add">+ Hari ke-{steps.length + 1}</button>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void keepDraft()} data-testid="proto-save">{busy ? 'Menyimpan…' : 'Simpan'}</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()} data-testid="proto-finish">Selesai</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Tutup</button>
        <span className="w-full text-xs text-muted">Simpan = bisa dilanjutkan besok · Selesai = jadi versi {version} resmi, tidak bisa diubah lagi.</span>
        {msg && <span className="font-mono text-xs" role="status">{msg}</span>}
      </div>
    </Section>
  );
}
