'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addCatatProgress, PROGRESS_STAGES, suggestStage, type CatatRecord, type ProgressStage } from '@/lib/pencatatan';
import { photoDataUrl } from '@/lib/photo';
import { Dropdown } from './Dropdown';
import { CameraDialog, canUseWebcam } from './MediaPicker';
import { SuccessAlert } from './Overlays';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Navbar bawah melayang berisi tombol kamera (DEC-086). Foto → kartu melayang dari bawah berisi detail
 * (judul, tanggal via kalender, suhu ruang, catatan, tahap, pilih pencatatan LENGKAP) → Upload ke progres harian.
 */
export function ProgressCamera({ records, onUploaded }: { records: CatatRecord[]; onUploaded: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState(false);
  const [photo, setPhoto] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CatatRecord>();
  const [err, setErr] = useState('');

  const open = () => {
    setErr('');
    // HP (layar sentuh) → kamera bawaan lewat input capture; laptop dengan webcam → kamera di halaman
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    if (!touch && canUseWebcam()) setCam(true);
    else file.current?.click();
  };
  const take = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    const url = await photoDataUrl(f, 1280, 0.82).catch(() => undefined);
    setBusy(false);
    if (!url) return setErr('Foto tidak bisa dibaca. Coba ambil ulang.');
    setPhoto(url);
  };

  return (
    <>
      <nav aria-label="Aksi cepat" className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))]" data-testid="float-nav">
        <div className="pointer-events-auto relative flex h-11 w-[132px] items-end justify-center rounded-2xl border border-acid/40 bg-ink/90 pb-1 shadow-[0_10px_30px_rgba(14,26,31,0.35)] backdrop-blur" data-testid="float-cam-card">
          {/* tombol kamera timbul: di tengah, naik ke atas dan lebih besar dari kartunya */}
          <button
            type="button"
            onClick={open}
            disabled={busy}
            className="cam-raise absolute -top-7 left-1/2 inline-flex h-[60px] w-[60px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-surface bg-gradient-to-b from-[#8ff0de] to-acid text-ink transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid disabled:opacity-60"
            aria-label={busy ? 'Memproses foto…' : err ? 'Ulangi foto progres' : 'Buka kamera untuk foto progres harian'}
            title={err || undefined}
            data-testid="float-cam"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={busy ? 'prog-pulse' : ''}>
              <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
              <circle cx="12" cy="13" r="3.6" />
            </svg>
          </button>
          {err && <span className="absolute -bottom-0.5 right-2 h-2 w-2 rounded-full bg-safety" aria-hidden />}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
          data-testid="float-cam-input"
        />
      </nav>
      {cam && <CameraDialog photoOnly onClose={() => setCam(false)} onFile={(f) => void take(f)} testId="float-camdlg" />}
      {photo && (
        <ProgressSheet
          photo={photo}
          records={records}
          onRetake={() => {
            setPhoto(undefined);
            open();
          }}
          onClose={() => setPhoto(undefined)}
          onSaved={(rec) => {
            setPhoto(undefined);
            setDone(rec);
            onUploaded();
          }}
        />
      )}
      {done && <SuccessAlert testId="progress-done" title="Terunggah !" message={`Foto progres masuk ke ${done.id} (${done.item}). Total ${done.progress?.length ?? 0} foto progres.`} onClose={() => setDone(undefined)} />}
    </>
  );
}

function ProgressSheet({ photo, records, onClose, onRetake, onSaved }: { photo: string; records: CatatRecord[]; onClose: () => void; onRetake: () => void; onSaved: (rec: CatatRecord) => void }) {
  const complete = records.filter((r) => r.finishedAt);
  const [recId, setRecId] = useState(complete.length === 1 ? complete[0]!.id : '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [temp, setTemp] = useState('');
  const [note, setNote] = useState('');
  const rec = complete.find((r) => r.id === recId);
  const [stage, setStage] = useState<ProgressStage>('harian');
  const [stageTouched, setStageTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dateRef = useRef<HTMLInputElement>(null);
  // tahap diusulkan dari jarak hari ke foto progres pertama (bisa diganti)
  useEffect(() => {
    if (!stageTouched) setStage(suggestStage(rec?.progress, date));
  }, [rec, date, stageTouched]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const upload = async () => {
    if (!recId) return setErr('Pilih data pencatatan yang sudah lengkap.');
    if (!date) return setErr('Pilih tanggal dari kalender.');
    if (temp.trim() && !/^-?\d+([.,]\d+)?$/.test(temp.trim())) return setErr('Suhu ruang berupa angka, mis. 28 atau 27,5.');
    setBusy(true);
    setErr('');
    try {
      onSaved(await addCatatProgress(recId, { photo, title, date, temp: temp.trim().replace('.', ','), note, stage }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  const field = 'field min-h-[44px] w-full bg-white text-sm';

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-ink/60 sm:items-end" role="dialog" aria-modal="true" aria-labelledby="progress-sheet-t" data-testid="progress-sheet" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet-up mb-0 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:mb-4 sm:rounded-3xl" data-testid="progress-sheet-card">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-paper-grid" aria-hidden />
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
          <h2 id="progress-sheet-t" className="font-display text-lg font-semibold">Detail foto progres</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper">✕</button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-5">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Foto progres yang baru diambil" className="max-h-56 w-full rounded-2xl bg-ink object-contain" data-testid="progress-photo" />
            <button type="button" onClick={onRetake} disabled={busy} className="absolute bottom-2 right-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow">Ulangi foto</button>
          </div>
          {!complete.length && (
            <p className="rounded-xl bg-safety/60 p-3 text-sm" role="alert">Belum ada data pencatatan yang lengkap (awal & akhir). Lengkapi data akhir dulu, lalu foto progres bisa diunggah.</p>
          )}
          <Dropdown
            label="Pilih data pencatatan (sudah lengkap)"
            required
            testId="progress-rec"
            value={recId}
            onChange={setRecId}
            placeholder="— pilih pencatatan —"
            options={complete.map((r) => ({ value: r.id, label: `${r.item} · ${r.count} item`, note: `${r.id}${r.progress?.length ? ` · ${r.progress.length} foto progres` : ''}` }))}
          />
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Judul</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Hari ke-3 pengeringan" maxLength={120} data-testid="progress-title" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Tanggal</span>
              <input
                ref={dateRef}
                type="date"
                className={`${field} cursor-pointer`}
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
                // tanggal hanya lewat kalender (tidak diketik)
                onKeyDown={(e) => e.key !== 'Tab' && e.preventDefault()}
                onClick={() => dateRef.current?.showPicker?.()}
                required
                data-testid="progress-date"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Suhu ruang (°C)</span>
              <span className="relative">
                <input className={`${field} pr-10`} inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value.replace(/[^\d.,-]/g, ''))} placeholder="mis. 28" data-testid="progress-temp" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">°C</span>
              </span>
            </label>
          </div>
          <Dropdown
            label="Tahap progres"
            testId="progress-stage"
            value={stage}
            onChange={(v) => {
              setStage(v as ProgressStage);
              setStageTouched(true);
            }}
            options={PROGRESS_STAGES.map((s) => ({ value: s.key, label: s.label }))}
          />
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Catatan tambahan</span>
            <textarea className="field min-h-[72px] w-full bg-white text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. warna mulai kecokelatan, bau asam" maxLength={500} data-testid="progress-note" />
          </label>
          {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
          <button type="button" className="btn-primary w-full justify-center" disabled={busy || !complete.length} onClick={() => void upload()} data-testid="progress-upload">
            {busy ? 'Mengunggah…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
