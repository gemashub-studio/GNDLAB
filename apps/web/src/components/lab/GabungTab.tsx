'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { listLpj, type LpjReport } from '@/lib/belanja';
import { protocolProductName, type DailyEntry, type MediaItem, type ProtocolVersion } from '@/lib/labStore';
import { downloadBlob } from '@/lib/labMedia';
import type { CatatRecord } from '@/lib/pencatatan';
import { Dropdown } from './Dropdown';
import { reportVideos } from './ProtocolsTab';

type Kind = 'pptx' | 'docx' | 'pdf' | 'txt';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'pptx', label: 'PPTX' },
  { key: 'docx', label: 'Word' },
  { key: 'pdf', label: 'PDF' },
  { key: 'txt', label: 'TXT' },
];
const ALL = '__semua__';
const NONE = '';
export const GABUNG_WAIT = 'Tunggu ya data sedang di gabungkan';

type Phase = { k: 'form' } | { k: 'loading' } | { k: 'done'; files: Record<Kind, { blob: Blob; name: string }> };

/**
 * Halaman "Gabungkan Data" (DEC-126): form modal 3 dropdown (pencatatan, riset produk, laporan belanja) → Konfirmasi →
 * modal spinner "Tunggu ya data sedang di gabungkan" → tombol unduh PPTX, Word, PDF, TXT. Minimal satu data dipilih.
 */
export function GabungTab({ catat, protocols, entries, media }: { catat: readonly CatatRecord[]; protocols: readonly ProtocolVersion[]; entries: readonly DailyEntry[]; media: readonly MediaItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card flex flex-col gap-3" data-testid="gabung-page">
      <h2 className="font-display text-xl font-semibold">Gabungkan Data</h2>
      <p className="max-w-2xl text-sm text-muted">
        Satukan data pencatatan, riset produk, dan laporan belanja (foto nota bercabang ke foto barang) dalam satu berkas — PowerPoint, Word, PDF, atau TXT tanpa gambar. Isi = catatan pengguna; bukan klaim produk aman/memenuhi standar.
      </p>
      <button type="button" className="btn-primary self-start" onClick={() => setOpen(true)} data-testid="gabung-open">
        Gabungkan data
      </button>
      {open && <GabungDialog catat={catat} protocols={protocols} entries={entries} media={media} onClose={() => setOpen(false)} />}
    </section>
  );
}

function GabungDialog({ catat, protocols, entries, media, onClose }: { catat: readonly CatatRecord[]; protocols: readonly ProtocolVersion[]; entries: readonly DailyEntry[]; media: readonly MediaItem[]; onClose: () => void }) {
  const [lpjs, setLpjs] = useState<LpjReport[]>();
  const [recId, setRecId] = useState(NONE);
  const [risetKey, setRisetKey] = useState(NONE);
  const [belanja, setBelanja] = useState(NONE);
  const [phase, setPhase] = useState<Phase>({ k: 'form' });
  const [err, setErr] = useState('');
  const busy = phase.k === 'loading';

  useEffect(() => {
    void listLpj().then(setLpjs, () => setLpjs([]));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  // satu pilihan per riset (versi terbaru)
  const risets = [...new Map([...protocols].sort((a, b) => a.version - b.version).map((v) => [v.key, v])).values()];
  const recs = [...catat].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const chosenLpjs = !lpjs ? [] : belanja === ALL ? lpjs : lpjs.filter((l) => l.id === belanja);
  const any = !!recId || !!risetKey || chosenLpjs.length > 0;

  const confirm = async () => {
    if (!any) return setErr('Pilih minimal satu data untuk digabungkan.');
    setErr('');
    setPhase({ k: 'loading' });
    try {
      const [{ buildGabungReport, reportText }, { buildResearchReport }, o, { chartPngs }, { researchPdfBlob }] = await Promise.all([
        import('@/lib/gabungData'),
        import('@/lib/researchReport'),
        import('@/lib/officeExport'),
        import('@/lib/chartPng'),
        import('@/lib/labPdf'),
      ]);
      const rec = catat.find((r) => r.id === recId);
      const riset = risetKey ? buildResearchReport(risetKey, protocols, entries, media, undefined, undefined, catat) : undefined;
      const report = buildGabungReport({ rec, riset, lpjs: chosenLpjs });
      const charts = await chartPngs(report.blocks.flatMap((b) => b.charts ?? []));
      const base = `${[rec?.id, risetKey].filter(Boolean).join('-') || report.cover.code}-gabungan-data`;
      const pptx = o.buildPptx(report, charts, await reportVideos(report, [...media]));
      const docx = o.buildDocx(report, charts);
      const pdf = await researchPdfBlob(report);
      setPhase({
        k: 'done',
        files: {
          pptx: { blob: new Blob([pptx as Uint8Array<ArrayBuffer>], { type: o.PPTX_MIME }), name: `${base}.pptx` },
          docx: { blob: new Blob([docx as Uint8Array<ArrayBuffer>], { type: o.DOCX_MIME }), name: `${base}.docx` },
          pdf: { blob: pdf, name: `${base}.pdf` },
          txt: { blob: new Blob([reportText(report)], { type: 'text/plain;charset=utf-8' }), name: `${base}.txt` },
        },
      });
    } catch (e) {
      setErr(e instanceof Error ? `Gagal menggabungkan data: ${e.message}` : 'Gagal menggabungkan data.');
      setPhase({ k: 'form' });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-ink/70 px-3 py-6 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="gabung-t" onClick={(e) => e.target === e.currentTarget && !busy && onClose()} data-testid="gabung-dialog">
      {phase.k === 'loading' ? (
        <div className="sheet-up flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-surface p-8 text-center shadow-2xl" role="status" aria-live="polite" data-testid="gabung-loading">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-ink/15 border-t-acid" aria-hidden />
          <p className="font-display text-lg font-semibold">{GABUNG_WAIT}</p>
        </div>
      ) : (
        <div className="sheet-up flex w-full max-w-lg flex-col gap-4 rounded-3xl bg-surface p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <h2 id="gabung-t" className="font-display text-lg font-semibold">{phase.k === 'done' ? 'Data berhasil digabungkan' : 'Gabungkan data'}</h2>
            <button type="button" onClick={onClose} aria-label="Tutup" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" data-testid="gabung-close">
              ✕
            </button>
          </div>
          {phase.k === 'done' ? (
            <div className="flex flex-col gap-3" data-testid="gabung-done">
              <p className="text-sm text-muted">Pilih format unduhan:</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {KINDS.map((k) => (
                  <button key={k.key} type="button" className={k.key === 'pptx' ? 'btn-primary !min-h-[44px]' : 'btn-ghost !min-h-[44px]'} onClick={() => downloadBlob(phase.files[k.key].blob, phase.files[k.key].name)} data-testid={`gabung-${k.key}`}>
                    {k.label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-ghost self-start !min-h-[40px] text-sm" onClick={() => setPhase({ k: 'form' })} data-testid="gabung-again">
                Gabungkan data lain
              </button>
            </div>
          ) : !lpjs ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <Dropdown
                label="Pilih data pencatatan yang tersedia"
                optional
                testId="gabung-catat"
                value={recId}
                onChange={setRecId}
                placeholder={recs.length ? '— pilih pencatatan —' : 'Belum ada data pencatatan'}
                options={[{ value: NONE, label: 'Tidak disertakan' }, ...recs.map((r) => ({ value: r.id, label: `${r.id} · ${r.item}`, note: `${r.count} item · ${r.finishedAt ? `selesai ${r.finishedAt.slice(0, 10)}` : 'data akhir belum lengkap'}` }))]}
              />
              <Dropdown
                label="Data riset produk yang tersedia"
                optional
                testId="gabung-riset"
                value={risetKey}
                onChange={setRisetKey}
                placeholder={risets.length ? '— pilih riset produk —' : 'Belum ada riset produk'}
                options={[{ value: NONE, label: 'Tidak disertakan' }, ...risets.map((v) => ({ value: v.key, label: `${v.key} · ${v.name}`, note: `${protocolProductName(v)} · v${v.version}` }))]}
              />
              <Dropdown
                label="Laporan belanja yang tersedia"
                optional
                testId="gabung-belanja"
                value={belanja}
                onChange={setBelanja}
                placeholder={lpjs.length ? '— pilih laporan belanja —' : 'Belum ada laporan belanja'}
                options={[{ value: NONE, label: 'Tidak disertakan' }, ...(lpjs.length > 1 ? [{ value: ALL, label: `Semua laporan belanja (${lpjs.length})` }] : []), ...lpjs.map((l) => ({ value: l.id, label: l.id, note: `${l.purpose || 'laporan belanja'} · ${l.proofs.length} nota` }))]}
              />
              <button type="button" className="btn-primary" disabled={!any} onClick={() => void confirm()} data-testid="gabung-confirm">
                Konfirmasi
              </button>
            </>
          )}
          {err && (
            <p className="text-sm" role="alert">
              <span className="bg-safety px-1">{err}</span>
            </p>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
