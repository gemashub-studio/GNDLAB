'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area } from 'react-easy-crop';

export interface OcrResult {
  /** Label untuk chip di kolom tanya, mis. "Teks foto (42 kata)". */
  label: string;
  text: string;
}

const ASPECTS: { key: string; label: string; value?: number }[] = [
  { key: 'asli', label: 'Asli' },
  { key: '4:3', label: '4:3', value: 4 / 3 },
  { key: '3:4', label: '3:4', value: 3 / 4 },
  { key: '1:1', label: '1:1', value: 1 },
  { key: '16:9', label: '16:9', value: 16 / 9 },
];

const readFile = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

/** Potong bagian gambar sesuai area (piksel asli) → PNG data URL (resolusi cukup untuk OCR, sisi terpanjang ≤ 2000 px). */
async function cropImage(src: string, area: Area): Promise<string> {
  const img = await loadImg(src);
  const k = Math.min(1, 2000 / Math.max(area.width, area.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(area.width * k));
  c.height = Math.max(1, Math.round(area.height * k));
  c.getContext('2d')!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/**
 * Foto → potong → scan teks (OCR, tesseract.js, bahasa Indonesia + Inggris) → teks hasil bisa dikoreksi →
 * diteruskan ke Tanya Lab AI sebagai bagian prompt (DEC-095). Sumber: galeri/penyimpanan atau kamera saja.
 */
export function PhotoOcrDialog({ onDone, onCancel }: { onDone: (r: OcrResult) => void; onCancel: () => void }) {
  const [src, setSrc] = useState<string>();
  const [natural, setNatural] = useState<number>(4 / 3);
  const [aspectKey, setAspectKey] = useState('asli');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area>();
  const [step, setStep] = useState<'pick' | 'crop' | 'scan' | 'review'>('pick');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    card.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && step !== 'scan' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel, step]);
  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const take = async (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('Pilih file gambar (foto).');
    try {
      const url = await readFile(f);
      const img = await loadImg(url);
      setNatural(img.naturalWidth / Math.max(1, img.naturalHeight));
      setSrc(url);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setStep('crop');
      setErr('');
    } catch {
      setErr('Foto tidak bisa dibaca.');
    }
  };
  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const scan = async () => {
    if (!src || !area) return;
    setStep('scan');
    setProgress(0);
    setStatus('Menyiapkan…');
    try {
      const cropped = await cropImage(src, area);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['ind', 'eng'], 1, {
        logger: (m: { status: string; progress: number }) => {
          setStatus(m.status === 'recognizing text' ? 'Membaca teks…' : 'Memuat pengenal teks…');
          setProgress(Math.round((m.status === 'recognizing text' ? 0.3 + m.progress * 0.7 : m.progress * 0.3) * 100));
        },
      });
      const { data } = await worker.recognize(cropped);
      await worker.terminate();
      if (cancelled.current) return;
      const t = data.text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (!t) {
        setErr('Tidak ada teks terbaca. Coba potong lebih dekat ke tulisan atau pakai foto yang lebih terang.');
        setStep('crop');
        return;
      }
      setText(t);
      setStep('review');
    } catch {
      setErr('Scan teks gagal. Periksa koneksi internet (pengenal teks diunduh saat pertama dipakai) lalu coba lagi.');
      setStep('crop');
    }
  };

  const aspect = ASPECTS.find((a) => a.key === aspectKey)?.value ?? natural;
  const words = text.split(/\s+/).filter(Boolean).length;
  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-ink/70 px-3 py-6 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ocr-t" onClick={(e) => e.target === e.currentTarget && step !== 'scan' && onCancel()} data-testid="ocr-dialog">
      <div ref={card} className="sheet-up flex w-full max-w-lg flex-col gap-4 rounded-3xl bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2 id="ocr-t" className="font-display text-lg font-semibold">
            {step === 'pick' ? 'Scan teks dari foto' : step === 'crop' ? 'Potong bagian yang diperlukan' : step === 'scan' ? 'Membaca teks…' : 'Hasil scan teks'}
          </h2>
          <button type="button" onClick={onCancel} disabled={step === 'scan'} aria-label="Tutup" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper">✕</button>
        </div>

        {step === 'pick' && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink/20 bg-white px-4 py-8 text-center">
            <p className="text-sm text-muted">Ambil foto tulisan (catatan, label, tabel) — teksnya dibaca otomatis lalu dikirim ke Lab AI sebagai pertanyaan.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary !min-h-[40px] text-sm" onClick={() => gallery.current?.click()} data-testid="ocr-gallery">Pilih dari galeri</button>
              <button type="button" className="btn-ghost !min-h-[40px] text-sm" onClick={() => camera.current?.click()} data-testid="ocr-camera">Ambil foto</button>
            </div>
          </div>
        )}
        <input ref={gallery} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} data-testid="ocr-file" />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />

        {step === 'crop' && src && (
          <>
            <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-ink sm:h-80" data-testid="ocr-cropper">
              <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} showGrid />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="label-mono">Bingkai</span>
              {ASPECTS.map((a) => (
                <button key={a.key} type="button" onClick={() => setAspectKey(a.key)} className={`rounded-full border px-2.5 py-1 font-semibold ${aspectKey === a.key ? 'border-ink bg-ink text-paper' : 'border-ink/20 bg-white'}`} aria-pressed={aspectKey === a.key}>
                  {a.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 text-xs">
              <span className="label-mono">Perbesar</span>
              <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#1FA88F]" aria-label="Perbesar foto" />
            </label>
            <p className="text-xs text-muted">Geser foto & atur perbesaran agar hanya bagian bertulisan yang masuk bingkai.</p>
          </>
        )}

        {step === 'scan' && (
          <div className="flex flex-col gap-2 py-4" role="status" aria-live="polite">
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper-grid">
              <div className="h-full rounded-full bg-[#1FA88F] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted">{status} {progress}%</p>
          </div>
        )}

        {step === 'review' && (
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Teks terbaca ({words} kata) — koreksi bila perlu</span>
            <textarea className="field min-h-[160px] w-full bg-white text-sm" value={text} onChange={(e) => setText(e.target.value)} data-testid="ocr-text" />
          </label>
        )}

        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}

        <div className="flex flex-wrap justify-end gap-2">
          {step === 'crop' && (
            <>
              <button type="button" className="btn-ghost" onClick={() => setStep('pick')}>Ganti foto</button>
              <button type="button" className="btn-primary" onClick={() => void scan()} disabled={!area} data-testid="ocr-scan">Scan teks</button>
            </>
          )}
          {step === 'review' && (
            <>
              <button type="button" className="btn-ghost" onClick={() => setStep('crop')}>Potong ulang</button>
              <button type="button" className="btn-primary" onClick={() => onDone({ label: `Teks foto (${text.split(/\s+/).filter(Boolean).length} kata)`, text: text.trim() })} disabled={!text.trim()} data-testid="ocr-use">
                Pakai teks ini
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
