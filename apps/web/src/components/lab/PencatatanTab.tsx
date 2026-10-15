'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RawRecord } from '@/lib/bahanBaku';
import { RAW_ITEMS } from '@/lib/labStore';
import {
  addCatatAwal,
  deleteCatat,
  awalColumns,
  blankRows,
  hasThickness,
  MAX_ROWS,
  missingAkhir,
  missingAwal,
  saveCatatAkhir,
  type AkhirInput,
  TREATMENT_GROUPS,
  treatmentRows,
  treatmentEntries,
  akhirFilled,
  type Treatments,
  type TreatmentEntry,
  type TreatmentKey,
  type CatatRecord,
  type CatatRow,
} from '@/lib/pencatatan';
import { photoDataUrl } from '@/lib/photo';
import { CatatResult, DownloadButtons } from './CatatResult';
import { Dropdown } from './Dropdown';
import { ImagePreview, LoadingOverlay, SuccessAlert, useConfirm } from './Overlays';

/** Loading tampil minimal 4 detik (satu siklus animasi, DEC-079). */
const SAVE_MS = 4000;
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
  const [drafted, setDrafted] = useState<CatatRecord>();
  // revisi data akhir catatan yang sudah lengkap (DEC-083)
  const [revise, setRevise] = useState<CatatRecord>();
  const [revised, setRevised] = useState<CatatRecord>();
  const [ask, dialog] = useConfirm();
  // mode pilih (DEC-076): hanya catatan lengkap (awal & akhir) yang bisa dipilih
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState(0);
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const removePicked = async () => {
    const ids = [...picked];
    if (!ids.length) return;
    if (!(await ask({ title: 'Hapus catatan', message: `Hapus ${ids.length} catatan terpilih?\nData yang sudah dihapus TIDAK dapat dipulihkan.`, okLabel: `Hapus (${ids.length})` }))) return;
    const n = await deleteCatat(ids);
    // langsung hilang dari layar (tidak menunggu muat ulang), lalu muat ulang dari penyimpanan
    setRemoved((cur) => new Set([...cur, ...ids]));
    setPreview((p) => (p && ids.includes(p.id) ? undefined : p));
    setPicked(new Set());
    setSelecting(false);
    await onChanged();
    setDeleted(n);
  };
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const live = records.filter((r) => !removed.has(r.id));
  const pending = live.filter((r) => !r.finishedAt);
  const finished = live.length - pending.length;
  // kartu: yang menunggu data akhir di atas, yang lengkap di bawah (DEC-079)
  const ordered = [...pending, ...live.filter((r) => r.finishedAt)];
  const complete = live.filter((r) => r.finishedAt);

  const saveAwal = async (item: string, rows: CatatRow[]) => {
    setMode('');
    setToast('saving');
    const started = Date.now();
    await addCatatAwal(item, rows);
    await onChanged();
    window.setTimeout(() => setToast(''), Math.max(0, SAVE_MS - (Date.now() - started)));
  };
  const saveAkhir = async (id: string, akhir: AkhirInput[], treatments: Treatments, isRevision = false) => {
    setMode('');
    setRevise(undefined);
    setToast('finishing');
    const started = Date.now();
    const rec = await saveCatatAkhir(id, akhir, treatments);
    await onChanged();
    window.setTimeout(() => {
      setToast('');
      if (isRevision) setRevised(rec);
      else setDone(rec);
    }, Math.max(0, SAVE_MS - (Date.now() - started)));
  };
  // "Simpan dulu": data akhir belum lengkap disimpan sebagai pembaruan terbaru (DEC-082)
  const saveDraft = async (id: string, akhir: AkhirInput[], treatments: Treatments) => {
    setMode('');
    setToast('saving');
    const started = Date.now();
    const rec = await saveCatatAkhir(id, akhir, treatments, false);
    await onChanged();
    window.setTimeout(() => {
      setToast('');
      setDrafted(rec);
    }, Math.max(0, SAVE_MS - (Date.now() - started)));
  };

  return (
    <div className="flex flex-col gap-5" data-testid="catat-tab">
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3" data-testid="catat-stats">
        {[
          ['Catatan data awal', live.length, 'catat-stat-awal'],
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
        <SelectMenu
          selecting={selecting}
          count={picked.size}
          disabled={!complete.length}
          onOne={() => setSelecting(true)}
          onAll={() => {
            setSelecting(true);
            setPicked(new Set(complete.map((r) => r.id)));
          }}
          onDelete={() => void removePicked()}
          onCancel={() => {
            setSelecting(false);
            setPicked(new Set());
          }}
        />
        {!pending.length && <span className="text-xs text-muted" data-testid="catat-akhir-hint">{live.length ? 'Semua catatan awal sudah punya data akhir.' : 'Pencatatan data akhir bisa dibuka setelah ada catatan awal tersimpan.'}</span>}
      </div>

      {ordered.length ? (
        <ul className="flex flex-col gap-3" data-testid="catat-list">
          {ordered.map((r) => {
            const can = selecting && !!r.finishedAt;
            const on = picked.has(r.id);
            const open = () => (can ? toggle(r.id) : selecting ? undefined : setPreview(r));
            return (
            <li key={r.id}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={selecting ? on : undefined}
                onClick={open}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
                className={`card flex cursor-pointer flex-col gap-3 transition sm:flex-row sm:items-center sm:justify-between ${on ? 'border-acid ring-2 ring-acid/50' : 'hover:border-acid'} ${selecting && !r.finishedAt ? 'cursor-not-allowed opacity-50' : ''}`}
                data-testid={`catat-card-${r.id}`}
              >
                {selecting && (
                  <input
                    type="checkbox"
                    className="h-5 w-5 flex-none accent-[#1FA88F]"
                    checked={on}
                    disabled={!r.finishedAt}
                    onChange={() => toggle(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={r.finishedAt ? `Pilih ${r.id}` : `${r.id} belum lengkap — tidak bisa dipilih`}
                    data-testid={`catat-check-${r.id}`}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-mono text-xs text-muted">{r.id} · {r.createdAt.slice(0, 10)}</span>
                  <span className="font-display text-lg font-semibold">{r.item} · {r.count} {r.count === 1 ? 'item' : 'item'}</span>
                  {treatmentRows(r.treatments).length > 0 && <span className="text-xs text-muted">{treatmentRows(r.treatments).map(([t, c, m]) => `${t.replace('Jumlah perlakuan ', '')}: ${c} × ${m}`).join(' · ')}</span>}
                  <span className={`self-start rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${r.finishedAt ? 'bg-acid text-ink' : 'bg-safety text-ink'}`}>
                    {r.finishedAt ? 'Awal & akhir lengkap' : 'Menunggu data akhir'}
                    {!r.finishedAt && r.akhirSavedAt && ` · tersimpan sementara (${akhirFilled(r)}/${r.count})`}
                  </span>
                </div>
                {!selecting && <DownloadButtons rec={r} testId={`catat-dl-${r.id}`} />}
              </div>
            </li>
            );
          })}
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
      {mode === 'akhir' && <AkhirModal pending={pending} onClose={() => setMode('')} onConfirm={(id, a, t) => void saveAkhir(id, a, t)} onDraft={(id, a, t) => void saveDraft(id, a, t)} />}
      {revise && <AkhirModal key={revise.id} pending={[revise]} revision onClose={() => setRevise(undefined)} onConfirm={(id, a, t) => void saveAkhir(id, a, t, true)} onDraft={() => undefined} />}
      {preview && (
        <PageModal title={`Pratinjau ${preview.id}`} onClose={() => setPreview(undefined)} testId="catat-preview" wide>
          <CatatResult rec={preview} />
          <div className="mt-5 border-t border-paper-grid pt-4">
            <p className="label-mono mb-2">Unduh</p>
            <DownloadButtons rec={preview} testId="catat-preview-dl" />
            {preview.finishedAt && (
              <button
                type="button"
                className="btn-acid mt-3"
                onClick={() => {
                  setRevise(preview);
                  setPreview(undefined);
                }}
                data-testid="catat-revise"
              >
                Revisi data akhir
              </button>
            )}
          </div>
        </PageModal>
      )}
      {toast && <LoadingOverlay testId="catat-toast" text={toast === 'saving' ? 'Tunggu ya, data sedang di save.' : 'Menyimpan data akhir…'} />}
      {done && (
        <SuccessAlert testId="catat-done" message="Yes!! akhirnya selesai.., yuk download/simpan hasil data nya." onClose={() => setDone(undefined)}>
          <button type="button" className="rounded-lg bg-[#66cdaa] px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95" onClick={() => window.location.assign(`/lab/hasil?id=${encodeURIComponent(done.id)}`)} data-testid="catat-done-view">Lihat</button>
          <button type="button" className="rounded-lg border border-[#66cdaa] px-4 py-1.5 text-sm font-semibold text-[#3a9e7c]" onClick={() => setDone(undefined)} data-testid="catat-done-later">Nanti</button>
        </SuccessAlert>
      )}
      {drafted && (
        <SuccessAlert testId="catat-drafted" title="Tersimpan !" message={`Data akhir ${drafted.id} disimpan sementara (${akhirFilled(drafted)} dari ${drafted.count} nomor). Lanjutkan kapan saja; unduhan sudah memakai data terbaru.`} onClose={() => setDrafted(undefined)} />
      )}
      {revised && <SuccessAlert testId="catat-revised" title="Tersimpan !" message={`Revisi data akhir ${revised.id} tersimpan. Unduhan sudah memakai data terbaru.`} onClose={() => setRevised(undefined)} />}
      {dialog}
      {deleted > 0 && <SuccessAlert testId="catat-deleted" message={`${deleted} catatan dihapus permanen.`} onClose={() => setDeleted(0)} />}
    </div>
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
  const [zoom, setZoom] = useState(false);
  const pv = zoom && value ? <ImagePreview src={value} alt={label} onClose={() => setZoom(false)} /> : null;
  if (readOnly)
    return value ? (
      <>
        <button type="button" onClick={() => setZoom(true)} aria-label={`Lihat ${label}`} className="rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-12 w-12 rounded-lg object-cover" data-testid={testId} />
        </button>
        {pv}
      </>
    ) : (
      <span className="font-mono text-xs text-muted" data-testid={testId}>tanpa foto</span>
    );
  return (
    <span className="flex items-center gap-1.5">
      {value && (
        <span className="relative">
          <button type="button" onClick={() => setZoom(true)} aria-label={`Lihat ${label}`} className="rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} className="h-12 w-12 rounded-lg object-cover" data-testid={`${testId}-img`} />
          </button>
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
      {pv}
    </span>
  );
}

/** Tombol "Pilih" (DEC-076): Pilih salah satu / Pilih semua; setelah ada pilihan → Hapus (permanen) & Batal. */
function SelectMenu({ selecting, count, disabled, onOne, onAll, onDelete, onCancel }: { selecting: boolean; count: number; disabled: boolean; onOne: () => void; onAll: () => void; onDelete: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  const item = 'flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-acid/15';
  const run = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn-ghost"
        disabled={disabled}
        title={disabled ? 'Belum ada catatan lengkap (awal & akhir)' : ''}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="catat-select"
      >
        Pilih{selecting ? ` (${count})` : ''} ▾
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-ink/15 bg-white py-1 shadow-xl" data-testid="catat-select-menu">
          <button type="button" role="menuitem" className={item} onClick={run(onOne)} data-testid="catat-select-one">Pilih salah satu</button>
          <button type="button" role="menuitem" className={item} onClick={run(onAll)} data-testid="catat-select-all">Pilih semua</button>
          {count > 0 && (
            <button type="button" role="menuitem" className={`${item} text-[#c0392b]`} onClick={run(onDelete)} data-testid="catat-select-delete">
              <span className="font-semibold">Hapus ({count})</span>
              <span className="text-xs text-muted">Jika sudah dihapus, data tidak dapat dipulihkan.</span>
            </button>
          )}
          {selecting && <button type="button" role="menuitem" className={item} onClick={run(onCancel)} data-testid="catat-select-cancel">Batal</button>}
          <p className="border-t border-paper-grid px-3 py-2 text-[11px] text-muted">Hanya catatan berstatus lengkap (awal &amp; akhir) yang bisa dipilih.</p>
        </div>
      )}
    </div>
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
type AkhirVals = Record<number, { beratAkhir: string; tebalAkhir: string; fotoAkhir?: string }>;
/** Isian awal form data akhir = data yang sudah tersimpan (termasuk "Simpan dulu"). */
const valsOf = (rec?: CatatRecord): AkhirVals => Object.fromEntries((rec?.rows ?? []).map((r) => [r.no, { beratAkhir: r.beratAkhir ?? '', tebalAkhir: r.tebalAkhir ?? '', ...(r.fotoAkhir && { fotoAkhir: r.fotoAkhir }) }]));
const trOf = (rec?: CatatRecord): TreatmentState =>
  Object.fromEntries(TREATMENT_GROUPS.map((g) => {
    const e = treatmentEntries(rec?.treatments, g.key);
    return [g.key, e.length ? e.map((x) => ({ ...x })) : [{ count: '', method: '' }]];
  })) as TreatmentState;

function AkhirModal({ pending, onClose, onConfirm, onDraft, revision = false }: { pending: CatatRecord[]; revision?: boolean; onClose: () => void; onConfirm: (id: string, akhir: AkhirInput[], treatments: Treatments) => void; onDraft: (id: string, akhir: AkhirInput[], treatments: Treatments) => void }) {
  const [id, setId] = useState(pending.length === 1 ? pending[0]!.id : '');
  const rec = pending.find((p) => p.id === id);
  const [tr, setTr] = useState<TreatmentState>(() => trOf(rec));
  const [vals, setVals] = useState<AkhirVals>(() => valsOf(rec));
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
    onConfirm(rec.id, akhirOut(), tr);
  };
  const akhirOut = () => merged.map((r) => ({ no: r.no, beratAkhir: r.beratAkhir, tebalAkhir: r.tebalAkhir, ...(r.fotoAkhir && { fotoAkhir: r.fotoAkhir }) }));
  const draft = () => {
    if (!rec) return setErr('Pilih catatan awal dulu.');
    onDraft(rec.id, akhirOut(), tr);
  };
  const ro = 'field min-h-[40px] w-full bg-paper-grid/60 px-2 text-sm text-muted';

  return (
    <PageModal
      title={revision ? `Revisi data akhir · ${pending[0]?.id ?? ''}` : 'Pencatatan data akhir'}
      onClose={onClose}
      testId="catat-akhir-modal"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          {!revision && <button type="button" className="btn-acid" onClick={draft} title="Simpan isian yang sudah ada walau belum lengkap; bisa dilanjutkan nanti" data-testid="catat-akhir-draft">Simpan dulu</button>}
          <button type="button" className="btn-primary" onClick={confirm} data-testid="catat-akhir-confirm">{revision ? 'Simpan revisi' : 'Konfirmasi data akhir'}</button>
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
              const next = pending.find((p) => p.id === v);
              setVals(valsOf(next));
              setTr(trOf(next));
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
            <TreatmentFields value={tr} onChange={setTr} />
          </>
        )}
        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
      </div>
    </PageModal>
  );
}

type TreatmentState = Record<TreatmentKey, TreatmentEntry[]>;

/**
 * Perlakuan (opsional) di form data akhir (DEC-081): tiap jenis berisi kolom "jumlah perlakuan" + dropdown
 * "Perlakuan/metode"; tombol + menambah pasangan kolom baru di bawahnya, ✕ menghapus kolom tambahan.
 */
function TreatmentFields({ value, onChange }: { value: TreatmentState; onChange: (fn: (x: TreatmentState) => TreatmentState) => void }) {
  const edit = (key: TreatmentKey, i: number, patch: Partial<TreatmentEntry>) => onChange((x) => ({ ...x, [key]: x[key].map((e, j) => (j === i ? { ...e, ...patch } : e)) }));
  return (
    <fieldset className="grid grid-cols-1 gap-3 rounded-xl bg-paper p-3 sm:grid-cols-2" data-testid="catat-treatments">
      <legend className="label-mono px-1">Perlakuan (opsional)</legend>
      {TREATMENT_GROUPS.map((g) => (
        <div key={g.key} className="flex flex-col gap-2 rounded-xl bg-white p-3" data-testid={`catat-tr-${g.key}`}>
          <span className="label-mono">{g.title}</span>
          {value[g.key].map((e, i) => (
            <div key={i} className={`flex items-end gap-2 ${i > 0 ? 'border-t border-ink/10 pt-2' : ''}`}>
              <label className="flex w-24 flex-none flex-col gap-1.5">
                <span className="text-xs text-muted">Jumlah</span>
                <input
                  className="field min-h-[44px] bg-white text-sm"
                  inputMode="numeric"
                  value={e.count}
                  onChange={(ev) => edit(g.key, i, { count: ev.target.value.replace(/[^\d]/g, '') })}
                  placeholder="mis. 3"
                  aria-label={`${g.title} ${i + 1}`}
                  data-testid={`catat-tr-count-${g.key}-${i}`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <Dropdown
                  label="Perlakuan/metode"
                  testId={`catat-tr-method-${g.key}-${i}`}
                  value={e.method}
                  onChange={(v) => edit(g.key, i, { method: v })}
                  options={[{ value: '', label: '— pilih —' }, ...g.methods.map((m) => ({ value: m, label: m }))]}
                />
              </div>
              {i > 0 && (
                <button
                  type="button"
                  className="mb-2 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted hover:bg-safety hover:text-ink"
                  onClick={() => onChange((x) => ({ ...x, [g.key]: x[g.key].filter((_, j) => j !== i) }))}
                  aria-label={`Hapus kolom ${g.title} ${i + 1}`}
                  data-testid={`catat-tr-del-${g.key}-${i}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center self-start rounded-full text-2xl font-bold leading-none text-ink hover:bg-acid"
            onClick={() => onChange((x) => ({ ...x, [g.key]: [...x[g.key], { count: '', method: '' }] }))}
            aria-label={`Tambah kolom ${g.title}`}
            title="Tambah kolom"
            data-testid={`catat-tr-add-${g.key}`}
          >
            +
          </button>
        </div>
      ))}
    </fieldset>
  );
}
