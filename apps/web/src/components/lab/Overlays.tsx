'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';

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
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex justify-end px-4 sm:px-6" role="alertdialog" aria-labelledby={`${testId}-t`} aria-describedby={`${testId}-m`} data-testid={testId}>
      <div className="alert-slide-in pointer-events-auto flex w-full max-w-96 overflow-hidden rounded-xl bg-white shadow-lg sm:w-3/4" data-testid={`${testId}-card`}>
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

export interface ConfirmOptions {
  title?: string;
  message: string;
  /** Label tombol setuju (default "Hapus"). */
  okLabel?: string;
  /** null = hanya tombol OK (pemberitahuan). */
  cancelLabel?: string | null;
  danger?: boolean;
  /** Wajib ketik teks ini (tidak peka huruf besar/kecil) sebelum tombol setuju aktif. */
  requireText?: string;
}

/**
 * Dialog konfirmasi DI HALAMAN (DEC-083) — pengganti window.confirm/prompt/alert yang diblokir di sebagian
 * browser (webview, aplikasi terpasang dari tautan): di sana confirm() langsung bernilai false sehingga hapus tidak jalan.
 */
function ConfirmDialog({ title = 'Konfirmasi', message, okLabel = 'Hapus', cancelLabel = 'Batal', danger = true, requireText, onDone }: ConfirmOptions & { onDone: (ok: boolean) => void }) {
  const [typed, setTyped] = useState('');
  const first = useRef<HTMLElement | null>(null);
  const ready = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDone(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDone]);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-t" aria-describedby="confirm-dialog-m" data-testid="confirm-dialog">
      <form
        className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-5 text-ink shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onDone(true);
        }}
      >
        <p id="confirm-dialog-t" className="font-display text-lg font-semibold">{title}</p>
        <p id="confirm-dialog-m" className="whitespace-pre-line text-sm text-zinc-600">{message}</p>
        {requireText && (
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Ketik {requireText} untuk melanjutkan</span>
            <input ref={(el) => { first.current = el; }} className="field min-h-[44px] bg-white text-sm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-testid="confirm-input" />
          </label>
        )}
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          {cancelLabel !== null && (
            <button type="button" className="btn-ghost" onClick={() => onDone(false)} ref={(el) => { if (!requireText) first.current = el; }} data-testid="confirm-cancel">{cancelLabel}</button>
          )}
          <button
            type="submit"
            disabled={!ready}
            className={danger ? 'inline-flex min-h-[44px] items-center rounded-xl bg-[#c0392b] px-4 text-sm font-semibold text-white disabled:opacity-40' : 'btn-primary'}
            ref={(el) => { if (!requireText && cancelLabel === null) first.current = el; }}
            data-testid="confirm-ok"
          >
            {okLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** `const [ask, dialog] = useConfirm()` → `if (await ask({...})) …`; render `{dialog}` di komponen. */
export function useConfirm() {
  const [req, setReq] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const ask = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setReq({ opts, resolve })), []);
  const done = useCallback(
    (ok: boolean) => {
      req?.resolve(ok);
      setReq(null);
    },
    [req],
  );
  const dialog = req ? <ConfirmDialog key={req.opts.message} {...req.opts} onDone={done} /> : null;
  return [ask, dialog] as const;
}

/** Versi fungsi (tanpa perlu merender apa pun di komponen): `if (await askConfirm({...})) …` (DEC-083). */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (ok: boolean) => {
      resolve(ok);
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      });
    };
    root.render(<ConfirmDialog {...opts} onDone={done} />);
  });
}
