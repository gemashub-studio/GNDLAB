'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listLpj, type LpjReport } from '@/lib/belanja';
import { listEntries, listMedia, listProtocols, protocolProductName, type DailyEntry, type MediaItem, type ProtocolVersion } from '@/lib/labStore';
import { downloadBlob } from '@/lib/labMedia';
import { listCatat, type CatatRecord } from '@/lib/pencatatan';
import type { ProgresItem } from '@/lib/progresPerlakuan';
import { Dropdown } from './Dropdown';

type Kind = 'txt' | 'pptx' | 'docx';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'txt', label: 'Simpan TXT (tanpa gambar)' },
  { key: 'pptx', label: 'PPTX' },
  { key: 'docx', label: 'Word' },
];
const ALL = '__semua__';
const NONE = '__tanpa__';

/** Video asli riset → ditanam di PowerPoint (sama seperti laporan riset produk). */
async function videosOf(report: import('@/lib/researchReport').ResearchReport, media: readonly MediaItem[]) {
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

/**
 * Form "Gabungkan data" (DEC-096) di halaman Media dan Data Progres Perlakuan: pilih pencatatan data yang sudah lengkap
 * + riset produk (+ laporan belanja) → unduh TXT (tanpa gambar), PPTX, atau Word. Progres perlakuan ikut semua.
 */
export function GabungDataDialog({ progres, onClose }: { progres: readonly ProgresItem[]; onClose: () => void }) {
  const [catat, setCatat] = useState<CatatRecord[]>();
  const [protocols, setProtocols] = useState<ProtocolVersion[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [lpjs, setLpjs] = useState<LpjReport[]>([]);
  const [recId, setRecId] = useState('');
  const [risetKey, setRisetKey] = useState('');
  const [belanja, setBelanja] = useState(ALL);
  const [busy, setBusy] = useState<Kind | ''>('');
  const [err, setErr] = useState('');
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    card.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    void Promise.all([listCatat(), listProtocols(), listEntries(), listMedia(), listLpj()])
      .then(([c, p, e, m, l]) => {
        setCatat(c.filter((r) => r.finishedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setProtocols(p);
        setEntries(e);
        setMedia(m);
        setLpjs(l);
      })
      .catch(() => setCatat([]));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  // satu pilihan per riset (versi terbaru)
  const risets = [...new Map([...protocols].sort((a, b) => a.version - b.version).map((v) => [v.key, v])).values()];
  const rec = catat?.find((r) => r.id === recId);

  const run = async (kind: Kind) => {
    if (!rec) return setErr('Pilih data pencatatan dulu.');
    if (!risetKey) return setErr('Pilih riset produk dulu.');
    setErr('');
    setBusy(kind);
    try {
      const { buildGabungReport, reportText } = await import('@/lib/gabungData');
      const { buildResearchReport } = await import('@/lib/researchReport');
      const riset = buildResearchReport(risetKey, protocols, entries, media);
      const chosen = belanja === ALL ? lpjs : belanja === NONE ? [] : lpjs.filter((l) => l.id === belanja);
      const report = buildGabungReport({ rec, riset, progres, lpjs: chosen });
      const name = `${rec.id}-${risetKey}-gabungan-data.${kind}`;
      if (kind === 'txt') {
        downloadBlob(new Blob([reportText(report)], { type: 'text/plain;charset=utf-8' }), name);
      } else {
        const o = await import('@/lib/officeExport');
        const { chartPngs } = await import('@/lib/chartPng');
        const charts = await chartPngs(report.blocks.flatMap((b) => b.charts ?? []));
        const bytes = kind === 'docx' ? o.buildDocx(report, charts) : o.buildPptx(report, charts, await videosOf(report, media));
        downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: kind === 'docx' ? o.DOCX_MIME : o.PPTX_MIME }), name);
      }
    } catch (e) {
      setErr(e instanceof Error ? `Gagal menyusun laporan: ${e.message}` : 'Gagal menyusun laporan.');
    } finally {
      setBusy('');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-ink/70 px-3 py-6 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="gabung-t" onClick={(e) => e.target === e.currentTarget && !busy && onClose()} data-testid="gabung-dialog">
      <div ref={card} className="sheet-up flex w-full max-w-lg flex-col gap-4 rounded-3xl bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2 id="gabung-t" className="font-display text-lg font-semibold">Gabungkan data</h2>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Tutup" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" data-testid="gabung-close">✕</button>
        </div>
        <p className="text-sm text-muted">Pencatatan + riset produk + {progres.length} progres perlakuan + laporan belanja (foto nota bercabang ke foto barang) dalam satu berkas.</p>

        {!catat ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {[0, 1].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : (
          <>
            <Dropdown
              label="Pilih data yang tersedia"
              required
              testId="gabung-catat"
              value={recId}
              onChange={setRecId}
              placeholder={catat.length ? '— pilih pencatatan lengkap —' : 'Belum ada pencatatan yang lengkap'}
              options={catat.map((r) => ({ value: r.id, label: `${r.id} · ${r.item}`, note: `${r.count} item · selesai ${r.finishedAt!.slice(0, 10)}` }))}
            />
            <Dropdown
              label="Riset produk"
              required
              testId="gabung-riset"
              value={risetKey}
              onChange={setRisetKey}
              placeholder={risets.length ? '— pilih riset produk —' : 'Belum ada riset produk'}
              options={risets.map((v) => ({ value: v.key, label: `${v.key} · ${v.name}`, note: `${protocolProductName(v)} · v${v.version}` }))}
            />
            <Dropdown
              label="Laporan belanja"
              optional
              testId="gabung-belanja"
              value={belanja}
              onChange={setBelanja}
              options={[
                { value: ALL, label: `Semua laporan belanja (${lpjs.length})` },
                ...lpjs.map((l) => ({ value: l.id, label: l.id, note: `${l.proofs.length} nota` })),
                { value: NONE, label: 'Tanpa laporan belanja' },
              ]}
            />
            {rec && risetKey && (
              <div className="flex flex-col gap-2" data-testid="gabung-options">
                <span className="label-mono">Simpan sebagai</span>
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((k) => (
                    <button key={k.key} type="button" disabled={!!busy} className={k.key === 'pptx' ? 'btn-primary !min-h-[42px]' : 'btn-ghost !min-h-[42px]'} onClick={() => void run(k.key)} data-testid={`gabung-${k.key}`}>
                      {busy === k.key ? 'Menyusun…' : k.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
      </div>
    </div>,
    document.body,
  );
}
