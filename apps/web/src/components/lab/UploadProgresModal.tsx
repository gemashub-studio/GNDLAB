'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { photoDataUrl } from '@/lib/photo';
import { addProgres, localDateTime, PROGRES_CATEGORIES, progresError, TREATMENT_OPTIONS, type ProgresCategory } from '@/lib/progresPerlakuan';
import { syncNow } from '@/lib/supabaseSync';
import { Dropdown } from './Dropdown';
import { askConfirm, ImagePreview, LoadingOverlay } from './Overlays';

const MIN_SPIN_MS = 4000;

/**
 * Modal "Upload Progres Perlakuan" (DEC-095): foto (galeri/kamera, klik = pratinjau), nama perlakuan, kategori,
 * jumlah produksi/item, tanggal & jam otomatis → Upload (spinner) → halaman Media dan Data Progres Perlakuan.
 * Dipakai tombol "Upload Progres" di Pencatatan Data dan ikon kamera melayang.
 */
export function UploadProgresModal({ onClose, initialPhoto }: { onClose: () => void; initialPhoto?: string }) {
  const [photo, setPhoto] = useState<string | undefined>(initialPhoto);
  const [treatment, setTreatment] = useState('');
  const [category, setCategory] = useState<ProgresCategory | ''>('');
  const [qty, setQty] = useState('');
  const [at, setAt] = useState(localDateTime());
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [err, setErr] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const dirty = !!(photo && photo !== initialPhoto) || !!treatment || !!category || !!qty;

  const close = async () => {
    if (busy) return;
    if (dirty && !(await askConfirm({ title: 'Tutup form?', message: 'Isian upload progres yang belum disimpan akan hilang.', okLabel: 'Tutup', danger: false }))) return;
    onClose();
  };
  useEffect(() => {
    // layar langsung diarahkan ke modal yang dibuka
    card.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !zoom && void close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, dirty, busy]);

  const take = async (f?: File | null) => {
    if (!f) return;
    setReading(true);
    const url = await photoDataUrl(f, 1280, 0.82, true).catch(() => undefined);
    setReading(false);
    if (!url) return setErr('Foto tidak bisa dibaca. Coba foto lain.');
    setErr('');
    setPhoto(url);
  };

  const upload = async () => {
    const bad = progresError({ photo, treatment, category, qty, at });
    if (bad) return setErr(bad);
    setBusy(true);
    setErr('');
    const started = Date.now();
    try {
      const item = await addProgres({ photo: photo!, treatment, category: category as ProgresCategory, qty, at });
      // kirim ke Supabase bila sudah login (maks. ±10 dtk; bila gagal, tersinkron otomatis nanti)
      await Promise.race([syncNow().catch(() => undefined), new Promise((r) => setTimeout(r, 10_000))]);
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - started))));
      window.location.assign(`/lab/progres?baru=${encodeURIComponent(item.id)}`);
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const opt = TREATMENT_OPTIONS.find((o) => o.value === treatment);
  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-ink/60 px-3 py-6 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-progres-t"
      onClick={(e) => e.target === e.currentTarget && void close()}
      data-testid="upload-progres"
    >
      <div ref={card} className="sheet-up flex w-full max-w-md flex-col gap-4 rounded-3xl bg-surface p-5 shadow-2xl" data-testid="upload-progres-card">
        <div className="flex items-center justify-between gap-2">
          <h2 id="upload-progres-t" className="font-display text-xl font-semibold">Upload Progres Perlakuan</h2>
          <button type="button" onClick={() => void close()} disabled={busy} aria-label="Tutup" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" data-testid="upload-progres-close">✕</button>
        </div>

        {/* kartu upload foto */}
        {photo ? (
          <div className="flex items-center gap-3 rounded-2xl border border-paper-grid bg-white p-3">
            <button type="button" onClick={() => setZoom(true)} className="flex-none rounded-xl" aria-label="Lihat pratinjau foto" data-testid="upload-progres-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Foto progres yang dipilih" className="h-28 w-[84px] rounded-xl object-cover" />
            </button>
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Klik foto untuk melihat pratinjau.</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={() => gallery.current?.click()}>Ganti dari galeri</button>
                <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={() => camera.current?.click()}>Foto ulang</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink/20 bg-white px-4 py-6 text-center" data-testid="upload-progres-drop">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-[#1FA88F]">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="2" />
              <path d="m21 16-5-5-9 9" />
            </svg>
            <p className="text-sm text-muted">{reading ? 'Memproses foto…' : 'Upload foto progres perlakuan'}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary !min-h-[40px] text-sm" onClick={() => gallery.current?.click()} disabled={reading} data-testid="upload-progres-gallery">Pilih dari galeri</button>
              <button type="button" className="btn-ghost !min-h-[40px] text-sm" onClick={() => camera.current?.click()} disabled={reading}>Ambil foto</button>
            </div>
          </div>
        )}
        <input ref={gallery} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} data-testid="upload-progres-file" />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />

        <Dropdown
          label="Nama Perlakuan"
          required
          testId="upload-progres-treatment"
          value={treatment}
          onChange={setTreatment}
          placeholder="— pilih perlakuan —"
          options={TREATMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label, note: `${o.group}${o.note ? ` · ${o.note}` : ''}` }))}
        />
        {opt?.note && <p className="-mt-2 text-xs text-muted" data-testid="upload-progres-note">{opt.group}: {opt.note}</p>}
        <Dropdown
          label="Kategori"
          required
          testId="upload-progres-category"
          value={category}
          onChange={(v) => setCategory(v as ProgresCategory)}
          placeholder="— pilih kategori —"
          options={PROGRES_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
        />
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Jumlah produksi / item <span className="text-safety" aria-hidden>*</span></span>
          <input className="field min-h-[44px] bg-white text-sm" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} placeholder="mis. 25" data-testid="upload-progres-qty" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Tanggal & jam (otomatis)</span>
          <input type="datetime-local" className="field min-h-[44px] bg-white text-sm" value={at} onChange={(e) => setAt(e.target.value)} data-testid="upload-progres-at" />
        </label>
        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
        <button type="button" className="btn-primary w-full justify-center" onClick={() => void upload()} disabled={busy || reading} data-testid="upload-progres-submit">
          Upload
        </button>
      </div>
      {zoom && photo && <ImagePreview src={photo} alt="Pratinjau foto progres" onClose={() => setZoom(false)} />}
      {busy && <LoadingOverlay testId="upload-progres-loading" text="Tunggu ya, media sedang di upload." />}
    </div>,
    document.body,
  );
}
