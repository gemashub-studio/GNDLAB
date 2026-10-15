'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Animasi loading "file terbang" (DEC-075, CSS di globals.css). */
export function FileLoader() {
  return (
    <div className="loader-con" aria-hidden data-testid="file-loader">
      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="pfile" style={{ ['--i' as string]: i }} />)}
    </div>
  );
}

/** Loading di TENGAH layar, latar belakang digelapkan, kartu transparan (DEC-076). */
export function LoadingOverlay({ text, testId }: { text: string; testId: string }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 px-6" role="status" aria-live="polite" data-testid={testId}>
      <div className="flex w-full max-w-sm flex-col items-center gap-2 bg-transparent text-center">
        <FileLoader />
        <span className="text-base font-semibold text-paper">{text}</span>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Alert sukses (DEC-076) mengikuti contoh UI owner: kartu putih, tepi kiri bergelombang hijau (#66cdaa),
 * judul "Success !", pesan, tombol centang (menutup). `children` = aksi tambahan (mis. tombol Lihat).
 */
export function SuccessAlert({ title = 'Success !', message, onClose, children, testId }: { title?: string; message: string; onClose: () => void; children?: ReactNode; testId: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-x-0 top-24 z-[70] flex justify-center px-4" role="alertdialog" aria-labelledby={`${testId}-t`} aria-describedby={`${testId}-m`} data-testid={testId}>
      <div className="flex w-full max-w-96 overflow-hidden rounded-xl bg-white shadow-lg sm:w-3/4">
        <svg width="16" className="flex-none self-stretch" viewBox="0 0 16 96" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path
            d="M 8 0 Q 4 4.8, 8 9.6 T 8 19.2 Q 4 24, 8 28.8 T 8 38.4 Q 4 43.2, 8 48 T 8 57.6 Q 4 62.4, 8 67.2 T 8 76.8 Q 4 81.6, 8 86.4 T 8 96 L 0 96 L 0 0 Z"
            fill="#66cdaa"
            stroke="#66cdaa"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div className="mx-2.5 min-w-0 flex-1 overflow-hidden py-2">
          <p id={`${testId}-t`} className="mr-3 mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-bold leading-8 text-[#66cdaa]">{title}</p>
          <p id={`${testId}-m`} className="leading-5 text-zinc-500">{message}</p>
          {children && <div className="mt-2 flex flex-wrap gap-2 pb-1">{children}</div>}
        </div>
        <button ref={btn} type="button" className="w-16 flex-none cursor-pointer focus:outline-none focus-visible:bg-[#66cdaa]/10" onClick={onClose} aria-label="Tutup" data-testid={`${testId}-close`}>
          <svg className="mx-auto h-7 w-7" fill="none" stroke="mediumseagreen" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Pratinjau gambar layar penuh (DEC-076): klik gambar → tampil besar, tombol ✕ / Esc / klik latar menutup. */
export function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/85 p-4" role="dialog" aria-modal="true" aria-label={alt} onClick={(e) => e.target === e.currentTarget && onClose()} data-testid="img-preview">
      <button
        ref={btn}
        type="button"
        onClick={onClose}
        aria-label="Tutup pratinjau"
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-lg hover:bg-acid"
        data-testid="img-preview-close"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" />
      <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-paper">{alt}</p>
    </div>,
    document.body,
  );
}
