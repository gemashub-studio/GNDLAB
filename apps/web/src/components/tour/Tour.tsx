'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const KEY = 'gemas.tour.v1';
export const TOUR_EVENT = 'gemas:tour';

const STEPS = [
  {
    tag: 'SELAMAT DATANG',
    title: 'Halo! Nggak perlu kira-kira lagi',
    body: 'gemasSTUDIO bantu hitung berapa kelapa, arang, atau kopra yang muat di container & gudang — plus alur prosesnya dari kelapa masuk sampai jadi kopra & arang.',
  },
  {
    tag: 'CARA PAKAI',
    title: 'Pilih-pilih, hasil langsung keluar',
    body: 'Pilih barang, bentuk, dan container. Hasilnya langsung muncul — nggak perlu pencet tombol hitung. Bingung? Pakai mode Panduan.',
  },
  {
    tag: 'BACA HASIL',
    title: 'Lihat angka yang paling besar',
    body: 'Itu jawaban utamanya. Label "Batas" kasih tahu apa yang habis duluan: ruangnya atau beratnya. Pita hitam = paling sedikit sampai paling banyak.',
  },
  {
    tag: 'A · B · C',
    title: 'Huruf A, B, C itu apa?',
    body: 'A = sudah diukur, B = dari pedagang, C = masih kira-kira. Ketemu C? Timbang/ukur sendiri lalu isi di "Ubah angka". Nemu istilah aneh? Pencet tombol "?".',
  },
  {
    tag: 'OFFLINE',
    title: 'Sinyal hilang? Tetap jalan',
    body: 'Kalkulator tetap bisa dipakai tanpa internet di HP gudang. Hitungan bisa disimpan di HP dan dikirim ke akun nanti.',
  },
];

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
}
function write() {
  try {
    localStorage.setItem(KEY, 'done');
  } catch {
    /* penyimpanan diblokir — tur muncul lagi lain kali, tidak apa-apa */
  }
}

export function Tour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // E2E & pengguna yang sudah selesai tidak melihat tur otomatis.
    if (!read() && !navigator.webdriver) setOpen(true);
    const reopen = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, reopen);
    return () => window.removeEventListener(TOUR_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    write();
    setOpen(false);
  };

  if (!open) return null;
  const s = STEPS[i]!;
  const last = i === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 sm:items-center" onClick={close}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 border-3 border-ink bg-surface p-[22px] shadow-hard outline-none"
      >
        <div className="flex items-center justify-between">
          <span className="tag-mono -rotate-1">{s.tag}</span>
          <span className="font-mono text-xs font-bold">
            {i + 1}/{STEPS.length}
          </span>
        </div>
        <h2 id="tour-title" className="text-3xl">
          {s.title}
        </h2>
        <p className="text-[15px] leading-relaxed">{s.body}</p>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, j) => (
            <span key={j} className={`h-2 flex-1 border-2 border-ink ${j <= i ? 'bg-acid' : 'bg-surface'}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={close} className="font-mono text-xs font-bold uppercase underline">
            Lewati aja
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" className="btn-ghost" onClick={() => setI(i - 1)}>
                Kembali
              </button>
            )}
            {last ? (
              <Link href="/muat?wizard=1" className="btn-primary no-underline" onClick={close}>
                Yuk coba
              </Link>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setI(i + 1)}>
                Lanjut
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
