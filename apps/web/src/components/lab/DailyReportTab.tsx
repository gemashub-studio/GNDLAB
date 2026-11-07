'use client';

/**
 * Daily Report R&D (DEC-144): modal "Pencatatan harian by Drive" — pratinjau di atas, kolom URL, tombol Upload
 * (tanggal otomatis); di bawahnya grid kartu data harian yang tersedia (pratinjau, URL, tanggal) berbayang.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDailyDrive, dailyDate, dailyDriveError, driveEmbedUrl, listDailyDrive, type DailyDriveItem } from '@/lib/dailyDrive';

export function DailyReportTab({ onChanged }: { onChanged: () => Promise<void> | void }) {
  const [items, setItems] = useState<DailyDriveItem[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => setItems(await listDailyDrive().catch(() => [])), []);
  useEffect(() => {
    void load();
  }, [load]);
  const saved = async () => {
    await load();
    await onChanged();
  };

  return (
    <section className="card flex flex-col gap-4" data-testid="daily-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">Pencatatan harian by Drive</h3>
          <p className="text-sm text-muted">Tempel tautan Google Drive laporan hari ini — tanggalnya tercatat otomatis saat Upload.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)} data-testid="daily-open">
          ＋ Pencatatan harian by Drive
        </button>
      </div>
      <DailyGrid items={items} testId="daily-grid" />
      {open && <DailyModal items={items} onClose={() => setOpen(false)} onSaved={saved} />}
    </section>
  );
}

function DailyModal({ items, onClose, onSaved }: { items: DailyDriveItem[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const embed = driveEmbedUrl(url);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    card.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const upload = async () => {
    const bad = dailyDriveError(url);
    if (bad) return setErr(bad);
    setBusy(true);
    try {
      await addDailyDrive(url);
      setUrl('');
      setErr('');
      setUploaded(true);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 px-3 py-10" onClick={(e) => e.target === e.currentTarget && onClose()} data-testid="daily-modal-backdrop">
      <div ref={card} role="dialog" aria-modal="true" aria-label="Pencatatan harian by Drive" className="w-full max-w-4xl rounded-2xl bg-surface shadow-2xl" data-testid="daily-modal">
        <div className="flex items-center justify-between gap-3 border-b border-paper-grid px-5 py-4">
          <h2 className="text-lg">Pencatatan harian by Drive</h2>
          <button type="button" className="font-mono text-sm underline" onClick={onClose} data-testid="daily-modal-close">Tutup</button>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          {/* pratinjau tautan di atas kolom URL */}
          <div className="overflow-hidden rounded-xl border border-ink/10 bg-paper" data-testid="daily-preview">
            {embed ? (
              <iframe src={embed} title="Pratinjau tautan Drive" className="aspect-video w-full bg-white" allow="autoplay" data-testid="daily-preview-frame" />
            ) : (
              <p className="flex aspect-video items-center justify-center px-6 text-center text-sm text-muted">Pratinjau muncul di sini setelah tautan Google Drive ditempel.</p>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">URL Google Drive</span>
            <input
              className="field min-h-[44px] bg-white text-sm"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setErr('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && void upload()}
              placeholder="https://drive.google.com/file/d/…/view"
              data-testid="daily-url"
            />
            <span className="text-xs text-muted">Atur berbagi file ke “Siapa saja yang memiliki link” agar pratinjau tampil untuk anggota lab lain. Tanggal diisi otomatis.</span>
          </label>
          {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
          <button type="button" className="btn-primary self-start" disabled={busy} onClick={() => void upload()} data-testid="daily-upload">
            {busy ? 'Mengunggah…' : 'Upload'}
          </button>
          {(uploaded || items.length > 0) && (
            <div className="flex flex-col gap-2 border-t border-paper-grid pt-4">
              <span className="label-mono">Data harian yang tersedia ({items.length})</span>
              <DailyGrid items={items} testId="daily-modal-grid" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Grid kartu data harian: pratinjau, URL, tanggal; bayangan lembut yang menebal saat disorot. */
function DailyGrid({ items, testId }: { items: DailyDriveItem[]; testId: string }) {
  if (!items.length) return <p className="text-sm italic text-muted" data-testid={`${testId}-empty`}>Belum ada data harian.</p>;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid={testId}>
      {items.map((x) => {
        const embed = driveEmbedUrl(x.url);
        return (
          <li
            key={x.id}
            className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(14,26,31,0.14)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(14,26,31,0.24)]"
            data-testid={`${testId}-card`}
            data-id={x.id}
          >
            {embed ? (
              <iframe src={embed} title={`Pratinjau ${x.id}`} loading="lazy" className="pointer-events-none aspect-video w-full border-b border-ink/10 bg-paper" tabIndex={-1} />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-paper text-xs text-muted">tanpa pratinjau</div>
            )}
            <div className="flex flex-col gap-1.5 p-3">
              <a href={x.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-semibold text-ink underline-offset-2 hover:underline" data-testid={`${testId}-url`}>
                {x.url}
              </a>
              <span className="font-mono text-xs text-muted" data-testid={`${testId}-date`}>{dailyDate(x.createdAt)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
