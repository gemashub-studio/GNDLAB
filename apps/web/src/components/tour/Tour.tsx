'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const KEY = 'gemas.tour.v1';
export const TOUR_EVENT = 'gemas:tour';

const STEPS = [
  {
    tag: 'SELAMAT DATANG',
    title: 'Hitung muat tanpa kira-kira',
    body: 'gemasSTUDIO menghitung berapa kelapa, arang, atau kopra yang muat di container dan gudang Anda — lengkap dengan rentang dan tingkat keyakinan datanya.',
  },
  {
    tag: 'LANGKAH 1–3',
    title: 'Pilih barang, bentuk, container',
    body: 'Di "Muat Container", ikuti 3 langkah bernomor. Hasil langsung muncul — tidak perlu tekan tombol hitung.',
  },
  {
    tag: 'BACA HASIL',
    title: 'Angka besar + batas pengikat',
    body: 'Angka besar = jawaban utama. Label "Batas" menunjukkan apa yang habis duluan: RUANG atau BERAT. Pita hitam = rentang min–maks.',
  },
  {
    tag: 'A · B · C',
    title: 'Huruf keyakinan data',
    body: 'A terukur, B data dagang, C estimasi. Kalau C, ukur sendiri di gudang lalu masukkan lewat "Ubah angka". Tombol "?" di mana-mana menjelaskan istilah.',
  },
  {
    tag: 'OFFLINE',
    title: 'Tetap jalan tanpa sinyal',
    body: 'Kalkulator bekerja tanpa internet di HP gudang. Skenario bisa disimpan di perangkat dan disinkronkan nanti.',
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
            Lewati tur
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" className="btn-ghost" onClick={() => setI(i - 1)}>
                Kembali
              </button>
            )}
            {last ? (
              <Link href="/muat?wizard=1" className="btn-primary no-underline" onClick={close}>
                Coba sekarang
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
