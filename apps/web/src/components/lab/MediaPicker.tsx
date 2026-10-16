'use client';

import { useEffect, useRef, useState } from 'react';

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/**
 * Format rekaman: MP4 (H.264) didahulukan bila browser bisa (Chrome/Edge baru, Safari) — diputar di mana saja,
 * termasuk PowerPoint & WhatsApp (DEC-073); WebM sebagai cadangan.
 */
function recorderType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}

/** Webcam di dalam halaman hanya tersedia di konteks aman (https / localhost). */
export const canUseWebcam = () => typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

/**
 * Pemilih foto/video (DEC-055): Galeri (berkas), Foto & Video lewat kamera bawaan HP (atribut `capture`
 * — tetap jalan walau dibuka lewat http di jaringan lokal), dan Kamera di halaman (webcam laptop/HP,
 * butuh https/localhost) untuk ambil foto & rekam video.
 */
export function MediaPicker({ onFiles, testId, compact = false }: { onFiles: (files: File[]) => void; testId: string; compact?: boolean }) {
  const [cam, setCam] = useState(false);
  const [webcam, setWebcam] = useState(false);
  useEffect(() => setWebcam(canUseWebcam()), []);
  const btn = `inline-flex cursor-pointer items-center gap-1 rounded-full border-3 border-ink bg-surface ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} font-semibold hover:bg-acid`;
  const take = (list: FileList | null) => list && list.length && onFiles(Array.from(list));
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={`${testId}-picker`}>
      <label className={btn}>
        Galeri
        <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = ''; }} data-testid={testId} />
      </label>
      <label className={btn} title="Buka kamera HP untuk foto">
        Foto
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = ''; }} data-testid={`${testId}-photo`} />
      </label>
      <label className={btn} title="Buka kamera HP untuk merekam video">
        Video
        <input type="file" accept="video/*" capture="environment" className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = ''; }} data-testid={`${testId}-video`} />
      </label>
      {webcam && (
        <button type="button" className={btn} onClick={() => setCam(true)} data-testid={`${testId}-cam`}>Kamera</button>
      )}
      {cam && <CameraDialog onClose={() => setCam(false)} onFile={(f) => onFiles([f])} testId={`${testId}-camdlg`} />}
    </div>
  );
}

/** `photoOnly` (kamera progres, DEC-086): tanpa rekam video/mikrofon, tertutup otomatis setelah satu foto. */
export function CameraDialog({ onClose, onFile, testId, photoOnly = false }: { onClose: () => void; onFile: (f: File) => void; testId: string; photoOnly?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [recording, setRecording] = useState(false);
  const [err, setErr] = useState('');
  const [taken, setTaken] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        stream.current?.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: !photoOnly }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        setErr('');
      } catch {
        setErr('Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau pakai tombol Foto/Video.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [facing]);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      onFile(new File([b], `foto-${stamp()}.jpg`, { type: 'image/jpeg' }));
      setTaken((n) => n + 1);
      if (photoOnly) onClose();
    }, 'image/jpeg', 0.9);
  };

  const toggleRec = () => {
    if (recording) {
      rec.current?.stop();
      return;
    }
    const type = recorderType();
    if (!stream.current || !type) return setErr('Browser ini belum mendukung rekam video di halaman — pakai tombol Video.');
    chunks.current = [];
    const r = new MediaRecorder(stream.current, { mimeType: type });
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const base = type.split(';')[0]!;
      onFile(new File(chunks.current, `video-${stamp()}.${base.includes('mp4') ? 'mp4' : 'webm'}`, { type: base }));
      setTaken((n) => n + 1);
      setRecording(false);
    };
    r.start(500);
    rec.current = r;
    setRecording(true);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Kamera" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" data-testid={testId}>
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-surface p-4">
        <div className="relative overflow-hidden rounded-xl bg-ink">
          <video ref={video} muted playsInline className="aspect-video w-full object-cover" />
          {recording && <span className="absolute left-3 top-3 rounded-full bg-safety px-2.5 py-0.5 font-mono text-[11px] font-semibold">● MEREKAM</span>}
        </div>
        {err && <p className="text-xs"><span className="bg-safety px-1">{err}</span></p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={recording} onClick={snap} data-testid={`${testId}-snap`}>Ambil foto</button>
          {!photoOnly && <button type="button" className="btn-ghost" onClick={toggleRec} data-testid={`${testId}-rec`}>{recording ? 'Berhenti rekam' : 'Rekam video'}</button>}
          <button type="button" className="btn-ghost" disabled={recording} onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>Ganti kamera</button>
          <button type="button" className="btn-ghost ml-auto" disabled={recording} onClick={onClose} data-testid={`${testId}-close`}>Selesai{taken ? ` (${taken})` : ''}</button>
        </div>
      </div>
    </div>
  );
}
