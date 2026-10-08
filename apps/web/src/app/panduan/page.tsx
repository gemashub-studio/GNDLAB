import type { Metadata } from 'next';
import Link from 'next/link';
import { ReopenTour } from '@/components/tour/ReopenTour';
import { GLOSSARY } from '@/lib/glossary';

export const metadata: Metadata = { title: 'Panduan' };

const FLOWS = [
  {
    tag: 'EKSPORTIR',
    q: 'Berapa butir kelapa muat di 40HC?',
    steps: ['Buka Muat Container → mode Panduan.', 'Pilih Kelapa jambul → Dalam karung jaring.', 'Pilih 40HC. Baca angka besar & label Batas.', 'Bandingkan dengan Benchmark pasar di bawahnya.'],
    href: '/muat?wizard=1',
  },
  {
    tag: 'GUDANG',
    q: 'Gudang saya muat berapa ton kopra?',
    steps: ['Buka Gudang → pilih Kopra asalan.', 'Isi jumlah stok & kadar air saat ini.', 'Atur tinggi tumpuk & utilisasi lantai.', 'Isi ukuran zona (opsional) → lihat "Zona terpakai".'],
    href: '/gudang',
  },
  {
    tag: 'ARANG',
    q: 'Belah 2 utuh atau dipecah — beda berapa ton?',
    steps: ['Buka Muat Container → Arang batok.', 'Bandingkan bentuk "Lump / pecah" dengan "Belah 2 utuh".', 'Perhatikan badge C: densitas belah 2 masih estimasi.', 'Uji kotak volume dulu sebelum memesan container.'],
    href: '/muat',
  },
  {
    tag: 'DATA SENDIRI',
    q: 'Saya sudah menimbang sendiri — bagaimana memakainya?',
    steps: ['Di kalkulator, buka "+ Ubah angka".', 'Isi densitas / berat per butir hasil ukur Anda.', 'Hasil diberi tanda override; dataset asli tidak berubah.', 'Simpan skenario agar bisa dibuka lagi.'],
    href: '/muat',
  },
];

const FAQ = [
  ['Kenapa hasilnya rentang, bukan satu angka?', 'Barang alam bervariasi: berat kelapa, ukuran keping, kepadatan tumpukan. Rentang menunjukkan hasil terkecil & terbesar yang masuk akal; angka besar adalah nilai tipikal.'],
  ['Hasil berbeda dengan benchmark pasar — mana yang benar?', 'Benchmark adalah laporan pedagang (bisa beda ukuran butir, karung, atau container). Kalau selisih besar, ukur sendiri lalu pakai "Ubah angka", dan catat realisasi stuffing Anda.'],
  ['Apakah bisa dipakai tanpa internet?', 'Ya. Kalkulator & dataset tersimpan di perangkat setelah dibuka sekali. Skenario yang disimpan offline akan disinkronkan saat online & login.'],
  ['Kenapa gambar susunan tidak persis seperti di container?', 'Gambar adalah representasi grid — perkiraan rapi untuk visual, bukan posisi muat sebenarnya.'],
  ['Kenapa kopra asalan dan kopra edible tidak boleh satu ruang?', 'Bau asap kopra asalan meresap ke kopra edible dan bisa membuat pembeli menolak barang.'],
];

export default function Panduan() {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="tag-mono self-start">LAB MANUAL // v1</span>
          <h1 className="text-[40px] sm:text-[52px]">Panduan</h1>
        </div>
        <ReopenTour />
      </header>

      <section aria-labelledby="flow-h" className="flex flex-col gap-4">
        <h2 id="flow-h" className="text-2xl">Cara pakai — per kebutuhan</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {FLOWS.map((f) => (
            <article key={f.tag} className="card flex flex-col gap-3 p-[18px]">
              <span className="tag-mono self-start">{f.tag}</span>
              <h3 className="text-lg">{f.q}</h3>
              <ol className="flex flex-col gap-1.5">
                {f.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex h-6 w-6 flex-none items-center justify-center bg-ink font-mono text-xs font-bold text-acid">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <Link href={f.href} className="btn-acid mt-auto self-start no-underline">Coba</Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="gl-h" className="card flex flex-col gap-4">
        <h2 id="gl-h" className="text-2xl">Kamus istilah</h2>
        <dl className="grid gap-4 md:grid-cols-2">
          {Object.entries(GLOSSARY).map(([k, g]) => (
            <div key={k} className="border-l-4 border-acid pl-3">
              <dt className="font-mono text-xs font-bold uppercase tracking-[0.08em]">{g.term}</dt>
              <dd className="text-sm font-bold">{g.short}</dd>
              {'long' in g && g.long && <dd className="mt-1 text-[13px] text-muted">{g.long}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="faq-h" className="card flex flex-col gap-3">
        <h2 id="faq-h" className="text-2xl">Pertanyaan umum</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="border-2 border-ink">
            <summary className="cursor-pointer bg-paper p-3 font-bold">{q}</summary>
            <p className="p-3 text-sm">{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
