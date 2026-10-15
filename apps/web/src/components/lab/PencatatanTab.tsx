'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RawRecord } from '@/lib/bahanBaku';
import { RAW_ITEMS } from '@/lib/labStore';
import {
  addCatatAwal,
  awalColumns,
  blankRows,
  hasThickness,
  MAX_ROWS,
  missingAkhir,
  missingAwal,
  saveCatatAkhir,
  type AkhirInput,
  type CatatRecord,
  type CatatRow,
} from '@/lib/pencatatan';
import { photoDataUrl } from '@/lib/photo';
import { CatatResult, DownloadButtons } from './CatatResult';
import { Dropdown } from './Dropdown';

const SAVE_MS = 1600;
const field = 'field min-h-[40px] w-full bg-white px-2 text-sm';

/**
 * PENCATATAN DATA (DEC-074): kartu statistik, catatan awal (N nomor), catatan akhir berdampingan dengan awal,
 * kartu hasil (unduh PDF/Word/PPTX + pratinjau), dan halaman hasil /lab/hasil.
 */
export function PencatatanTab({ records, oldRaw, onChanged }: { records: CatatRecord[]; oldRaw: RawRecord[]; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<'' | 'awal' | 'akhir'>('');
  const [preview, setPreview] = useState<CatatRecord>();
  const [toast, setToast] = useState<'' | 'saving' | 'finishing'>('');
  const [done, setDone] = useState<CatatRecord>();
  const pending = records.filter((r) => !r.finishedAt);
  const finished = records.length - pending.length;

  const saveAwal = async (item: string, rows: CatatRow[]) => {
    setMode('');
    setToast('saving');
    const started = Date.now();
    await addCatatAwal(item, rows);
    await onChanged();
    window.setTimeout(() => setToast(''), Math.max(0, SAVE_MS - (Date.now() - started)));
  };
  const saveAkhir = async (id: string, akhir: AkhirInput[]) => {
    setMode('');
    setToast('finishing');
    const started = Date.now();
    const rec = await saveCatatAkhir(id, akhir);
    await onChanged();
    window.setTimeout(() => {
      setToast('');
      setDone(rec);
    }, Math.max(0, SAVE_MS - (Date.now() - started)));
  };

  return (
    <div className="flex flex-col gap-5" data-testid="catat-tab">
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3" data-testid="catat-stats">
        {[
          ['Catatan data awal', records.length, 'catat-stat-awal'],
          ['Catatan data akhir', finished, 'catat-stat-akhir'],
          ['Menunggu data akhir', pending.length, 'catat-stat-pending'],
        ].map(([k, v, id]) => (
          <div key={id as string} className="card flex flex-col gap-1" data-testid={id as string}>
            <dt className="label-mono">{k}</dt>
            <dd className="font-mono text-3xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => setMode('awal')} data-testid="catat-new">+ Buat catatan baru</button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!pending.length}
          title={pending.length ? '' : 'Buat & simpan catatan awal dulu'}
          onClick={() => setMode('akhir')}
          data-testid="catat-akhir"
        >
          Buat pencatatan data akhir
        </button>
        {!pending.length && <span className="text-xs text-muted" data-testid="catat-akhir-hint">{records.length ? 'Semua catatan awal sudah punya data akhir.' : 'Pencatatan data akhir bisa dibuka setelah ada catatan awal tersimpan.'}</span>}
      </div>

      {records.length ? (
        <ul className="flex flex-col gap-3" data-testid="catat-list">
          {records.map((r) => (
            <li key={r.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreview(r)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setPreview(r))}
                className="card flex cursor-pointer flex-col gap-3 transition hover:border-acid sm:flex-row sm:items-center sm:justify-between"
                data-testid={`catat-card-${r.id}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-xs text-muted">{r.id} · {r.createdAt.slice(0, 10)}</span>
                  <span className="font-display text-lg font-semibold">{r.item} · {r.count} {r.count === 1 ? 'item' : 'item'}</span>
                  <span className={`self-start rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${r.finishedAt ? 'bg-acid text-ink' : 'bg-safety text-ink'}`}>
                    {r.finishedAt ? 'Awal & akhir lengkap' : 'Menunggu data akhir'}
                  </span>
                </div>
                <DownloadButtons rec={r} testId={`catat-dl-${r.id}`} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-muted">Belum ada pencatatan. Mulai dengan “+ Buat catatan baru”.</p>
      )}

      {oldRaw.length > 0 && (
        <details className="rounded-xl bg-paper p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Catatan bahan baku lama ({oldRaw.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {oldRaw.map((r) => <li key={r.id} className="font-mono text-xs">{r.id} · {r.item} · {r.name} · berat utuh {r.wholeWeight || '–'} g</li>)}
          </ul>
        </details>
      )}

      {mode === 'awal' && <AwalModal onClose={() => setMode('')} onConfirm={(item, rows) => void saveAwal(item, rows)} />}
      {mode === 'akhir' && <AkhirModal pending={pending} onClose={() => setMode('')} onConfirm={(id, a) => void saveAkhir(id, a)} />}
      {preview && (
        <PageModal title={`Pratinjau ${preview.id}`} onClose={() => setPreview(undefined)} testId="catat-preview" wide>
          <CatatResult rec={preview} />
          <div className="mt-5 border-t border-paper-grid pt-4">
            <p className="label-mono mb-2">Unduh</p>
            <DownloadButtons rec={preview} testId="catat-preview-dl" />
          </div>
        </PageModal>
      )}
      {toast && (
        <Floating testId="catat-toast" column>
          <FileLoader />
          <span className="text-sm font-semibold">{toast === 'saving' ? 'Tunggu ya, data sedang di save.' : 'Menyimpan data akhir…'}</span>
        </Floating>
      )}
      {done && (
        <Floating testId="catat-done" interactive>
          <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-acid text-lg">✓</span>
          <span className="flex flex-1 flex-col gap-2">
            <span className="text-sm font-semibold">Yes!! akhirnya selesai.., yuk download/simpan hasil data nya.</span>
            <span className="flex gap-2">
              <button type="button" className="btn-primary min-h-[40px] px-4" onClick={() => window.location.assign(`/lab/hasil?id=${encodeURIComponent(done.id)}`)} data-testid="catat-done-view">Lihat</button>
              <button type="button" className="btn-ghost min-h-[40px] px-4" onClick={() => setDone(undefined)} data-testid="catat-done-later">Nanti</button>
            </span>
          </span>
        </Floating>
      )}
    </div>
  );
}

/** Animasi loading "file terbang" (DEC-075, CSS di globals.css). */
export function FileLoader() {
  return (
    <div className="loader-con" aria-hidden data-testid="file-loader">
      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="pfile" style={{ ['--i' as string]: i }} />)}
    </div>
  );
}

function Floating({ children, testId, interactive = false, column = false }: { children: ReactNode; testId: string; interactive?: boolean; column?: boolean }) {
  return createPortal(
    <div className={`fixed inset-x-0 top-20 z-[60] flex justify-center px-4 ${interactive ? '' : 'pointer-events-none'}`} role="status" aria-live="polite" data-testid={testId}>
      <div className={`flex w-full max-w-md items-center gap-3 rounded-2xl border border-acid/40 bg-white px-4 py-3 text-ink shadow-2xl ${column ? 'flex-col text-center' : ''}`}>{children}</div>
    </div>,
    document.body,
  );
}

/** Modal di dalam alur halaman (tanpa kunci gulir): tampil penuh, halaman tetap bisa digulir (DEC-071). */
function PageModal({ title, onClose, children, footer, testId, wide = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; testId: string; wide?: boolean }) {
  const [top, setTop] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => setTop(window.scrollY + 80), []);
  useEffect(() => {
    card.current?.querySelector<HTMLElement>('input,[role=combobox],button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="fixed inset-0 z-[45] bg-ink/50" onClick={onClose} aria-hidden />
      <div className="absolute inset-x-0 z-50 flex justify-center px-3 pb-10 sm:px-4" style={{ top }}>
        <div ref={card} role="dialog" aria-modal="true" aria-label={title} className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} rounded-2xl bg-surface shadow-2xl`} data-testid={testId}>
          <div className="flex items-center justify-between gap-3 border-b border-paper-grid px-5 py-4">
            <h2 className="text-lg">{title}</h2>
            <button type="button" className="font-mono text-sm underline" onClick={onClose} data-testid={`${testId}-close`}>Tutup</button>
          </div>
          <div className="px-4 py-4 sm:px-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-paper-grid px-5 py-3">{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Form catatan awal: item + jumlah → baris bernomor sebanyak jumlah. */
function AwalModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (item: string, rows: CatatRow[]) => void }) {
  const [item, setItem] = useState<string>(RAW_ITEMS[0]);
  const [countText, setCountText] = useState('');
  const [rows, setRows] = useState<CatatRow[]>([]);
  const [err, setErr] = useState('');
  const cols = awalColumns(item);

  const setCount = (t: string) => {
    setCountText(t);
    setErr('');
    const n = Math.min(MAX_ROWS, Math.max(0, parseInt(t, 10) || 0));
    // nilai yang sudah diketik dipertahankan saat jumlah diubah
    setRows((cur) => blankRows(n).map((r, i) => cur[i] ?? r));
  };
  const setCell = (i: number, k: keyof CatatRow, v: string | undefined) => {
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    setErr('');
  };
  const confirm = () => {
    if (!rows.length) return setErr('Isi jumlah total item dulu (minimal 1).');
    const miss = missingAwal(item, rows);
    if (miss.length) return setErr(`Masih kosong (${hasThickness(item) ? 'berat awal / tebal daging' : 'berat awal'}) di nomor: ${miss.slice(0, 12).join(', ')}${miss.length > 12 ? `, … (${miss.length} nomor)` : ''}.`);
    const keep = new Set(cols.map(([k]) => k as string));
    onConfirm(item, rows.map((r) => ({ no: r.no, beratAwal: r.beratAwal.trim(), volAir: keep.has('volAir') ? r.volAir.trim() : '', beratAir: keep.has('beratAir') ? r.beratAir.trim() : '', tebalAwal: keep.has('tebalAwal') ? r.tebalAwal.trim() : '', ...(r.fotoAwal && { fotoAwal: r.fotoAwal }) })));
  };

  return (
    <PageModal
      title="Buat catatan awal"
      onClose={onClose}
      testId="catat-awal-modal"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          <button type="button" className="btn-primary" onClick={confirm} data-testid="catat-awal-confirm">Konfirmasi</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Dropdown label="Item / barang" required testId="catat-item" value={item} onChange={setItem} options={RAW_ITEMS.map((i) => ({ value: i, label: i }))} />
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jumlah total item <span className="text-safety" aria-hidden>*</span></span>
            <input className="field min-h-[44px] bg-white text-sm" inputMode="numeric" value={countText} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} placeholder="mis. 50" data-testid="catat-count" />
            <span className="text-xs text-muted">Maks. {MAX_ROWS}. Kolom isian muncul sebanyak jumlah ini.</span>
          </label>
        </div>
        {rows.length > 0 && (
          <RowsGrid
            head={['Foto', ...cols.map(([, l]) => l)]}
            rows={rows}
            render={(r, i) => [
              <RowPhoto key="foto" value={r.fotoAwal} label={`Foto awal nomor ${r.no}`} onChange={(v) => setCell(i, 'fotoAwal', v)} testId={`catat-awal-foto-${r.no}`} />,
              ...cols.map(([k, l]) => <input key={k} aria-label={`${l} nomor ${r.no}`} className={field} inputMode="decimal" value={r[k]} onChange={(e) => setCell(i, k, e.target.value)} data-testid={`catat-awal-${k}-${r.no}`} />),
            ]}
          />
        )}
        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
      </div>
    </PageModal>
  );
}

/**
 * Foto per nomor (DEC-075): tombol pilih/ambil foto (di HP membuka kamera atau galeri), pratinjau kecil, hapus.
 * `readOnly` = hanya menampilkan (foto data awal di form data akhir).
 */
function RowPhoto({ value, onChange, label, testId, readOnly = false }: { value?: string; onChange?: (v: string | undefined) => void; label: string; testId: string; readOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  if (readOnly)
    return value ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt={label} className="h-12 w-12 rounded-lg object-cover" data-testid={testId} />
    ) : (
      <span className="font-mono text-xs text-muted" data-testid={testId}>tanpa foto</span>
    );
  return (
    <span className="flex items-center gap-1.5">
      {value && (
        <span className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-12 w-12 rounded-lg object-cover" data-testid={`${testId}-img`} />
          <button type="button" aria-label={`Hapus ${label}`} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-ink text-[11px] leading-none text-paper" onClick={() => onChange?.(undefined)}>×</button>
        </span>
      )}
      <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-xl border border-ink/20 bg-white px-2.5 text-xs font-semibold hover:border-acid" aria-label={label}>
        {busy ? '…' : value ? 'Ganti' : '+ Foto'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            onChange?.(await photoDataUrl(f));
            setBusy(false);
          }}
          data-testid={testId}
        />
      </label>
    </span>
  );
}

/** Tabel isian: desktop = baris dengan kolom; HP = kartu per nomor (2 kolom). */
function RowsGrid({ head, rows, render }: { head: string[]; rows: CatatRow[]; render: (r: CatatRow, i: number) => ReactNode[] }) {
  return (
    <div className="flex flex-col gap-2" data-testid="catat-rows">
      <div className="hidden gap-2 px-2 font-mono text-[10px] uppercase text-muted sm:grid" style={{ gridTemplateColumns: `3rem repeat(${head.length}, minmax(0,1fr))` }}>
        <span>No</span>
        {head.map((h) => <span key={h}>{h}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={r.no} className="grid grid-cols-2 items-center gap-2 rounded-xl bg-paper p-2 sm:[grid-template-columns:var(--cols)]" style={{ ['--cols' as string]: `3rem repeat(${head.length}, minmax(0,1fr))` }}>
          <span className="col-span-2 font-mono text-sm font-semibold sm:col-span-1">#{r.no}</span>
          {render(r, i).map((node, j) => (
            <label key={j} className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase text-muted sm:hidden">{head[j]}</span>
              {node}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Form data akhir: pilih catatan awal (bila >1), lalu isi akhir di samping nilai awal. */
function AkhirModal({ pending, onClose, onConfirm }: { pending: CatatRecord[]; onClose: () => void; onConfirm: (id: string, akhir: AkhirInput[]) => void }) {
  const [id, setId] = useState(pending.length === 1 ? pending[0]!.id : '');
  const rec = pending.find((p) => p.id === id);
  const [vals, setVals] = useState<Record<number, { beratAkhir: string; tebalAkhir: string; fotoAkhir?: string }>>({});
  const [err, setErr] = useState('');
  const coco = rec ? hasThickness(rec.item) : false;
  const merged = rec ? rec.rows.map((r) => ({ ...r, beratAkhir: vals[r.no]?.beratAkhir ?? '', tebalAkhir: vals[r.no]?.tebalAkhir ?? '', ...(vals[r.no]?.fotoAkhir && { fotoAkhir: vals[r.no]!.fotoAkhir }) })) : [];
  const set = (no: number, k: 'beratAkhir' | 'tebalAkhir' | 'fotoAkhir', v: string | undefined) => {
    // pertahankan isian lain di nomor yang sama (termasuk foto) saat satu kolom diubah
    setVals((x) => ({ ...x, [no]: { beratAkhir: '', tebalAkhir: '', ...x[no], [k]: v } }));
    setErr('');
  };
  const confirm = () => {
    if (!rec) return setErr('Pilih catatan awal dulu.');
    const miss = missingAkhir(rec.item, merged);
    if (miss.length) return setErr(`Data akhir masih kosong di nomor: ${miss.slice(0, 12).join(', ')}${miss.length > 12 ? `, … (${miss.length} nomor)` : ''}.`);
    onConfirm(rec.id, merged.map((r) => ({ no: r.no, beratAkhir: r.beratAkhir, tebalAkhir: r.tebalAkhir, ...(r.fotoAkhir && { fotoAkhir: r.fotoAkhir }) })));
  };
  const ro = 'field min-h-[40px] w-full bg-paper-grid/60 px-2 text-sm text-muted';

  return (
    <PageModal
      title="Pencatatan data akhir"
      onClose={onClose}
      testId="catat-akhir-modal"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          <button type="button" className="btn-primary" onClick={confirm} data-testid="catat-akhir-confirm">Konfirmasi data akhir</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {pending.length > 1 && (
          <Dropdown
            label="Pilih catatan awal yang tersedia"
            required
            testId="catat-pick"
            value={id}
            onChange={(v) => {
              setId(v);
              setVals({});
            }}
            placeholder="— pilih catatan awal —"
            options={pending.map((p) => ({ value: p.id, label: `${p.item} · ${p.count} item`, note: `${p.id} · ${p.createdAt.slice(0, 10)}` }))}
          />
        )}
        {rec && (
          <>
            <p className="text-sm text-muted" data-testid="catat-akhir-info">
              {rec.id} · {rec.item} · {rec.count} item. Kolom kiri = data awal (tidak bisa diubah), kolom kanan = data akhir (isi semua).
            </p>
            <RowsGrid
              head={['Foto awal', 'Berat awal (g)', 'Berat akhir (g)', ...(coco ? ['Tebal awal (mm)', 'Tebal akhir (mm)'] : []), 'Foto akhir']}
              rows={merged}
              render={(r) => [
                <RowPhoto key="fa" value={r.fotoAwal} label={`Foto awal nomor ${r.no}`} readOnly testId={`catat-akhir-fotoawal-${r.no}`} />,
                <input key="ba" className={ro} value={r.beratAwal} readOnly tabIndex={-1} aria-label={`Berat awal nomor ${r.no}`} />,
                <input key="bk" className={field} inputMode="decimal" value={r.beratAkhir} onChange={(e) => set(r.no, 'beratAkhir', e.target.value)} aria-label={`Berat akhir nomor ${r.no}`} data-testid={`catat-akhir-berat-${r.no}`} />,
                ...(coco
                  ? [
                      <input key="ta" className={ro} value={r.tebalAwal} readOnly tabIndex={-1} aria-label={`Tebal awal nomor ${r.no}`} />,
                      <input key="tk" className={field} inputMode="decimal" value={r.tebalAkhir} onChange={(e) => set(r.no, 'tebalAkhir', e.target.value)} aria-label={`Tebal akhir nomor ${r.no}`} data-testid={`catat-akhir-tebal-${r.no}`} />,
                    ]
                  : []),
                <RowPhoto key="fk" value={r.fotoAkhir} label={`Foto akhir nomor ${r.no}`} onChange={(v) => set(r.no, 'fotoAkhir', v)} testId={`catat-akhir-foto-${r.no}`} />,
              ]}
            />
          </>
        )}
        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
      </div>
    </PageModal>
  );
}
