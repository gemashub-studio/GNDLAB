import type { Metadata } from 'next';
import Link from 'next/link';
import { ReopenTour } from '@/components/tour/ReopenTour';
import { GLOSSARY } from '@/lib/glossary';

export const metadata: Metadata = { title: 'Panduan' };

const FLOWS = [
  {
    tag: 'PROSES',
    q: 'Kelapa datang 7.000 butir — jadinya berapa kopra & arang?',
    steps: ['Buka Alur Proses.', 'Isi jumlah kelapa dari dataran rendah & dataran tinggi (dipisah ya).', 'Klik tiap tahap: kupas → belah → jemur → cungkil.', 'Di "Produk jadi", lihat kopra, arang, karung, sampai container-nya.'],
    href: '/proses',
  },
  {
    tag: 'RAK JEMUR',
    q: 'Rak jemur saya cukup nggak? Lebih cepat pakai apa?',
    steps: ['Buka Alur Proses → tahap Jemur di rak.', 'Isi luas 1 susun rak, jumlah susun, dan jumlah rak yang ada.', 'Pilih cara jemur: matahari, greenhouse, atau oven.', 'Lihat tabel "Bandingkan 3 cara jemur" di bawahnya.'],
    href: '/proses',
  },
  {
    tag: 'EKSPOR',
    q: 'Berapa butir kelapa muat di container 40 ft HC?',
    steps: ['Buka Muat Container → mode Panduan.', 'Pilih Kelapa jambul → Dalam karung jaring.', 'Pilih 40 ft HC. Lihat angka paling besar & label Batas.', 'Bandingkan dengan pembanding pasar di bawahnya.'],
    href: '/muat?wizard=1',
  },
  {
    tag: 'GUDANG',
    q: 'Gudang saya muat berapa ton kopra?',
    steps: ['Buka Gudang → pilih Kopra asalan.', 'Isi jumlah stok & kadar air sekarang.', 'Atur tinggi tumpukan & lantai yang terpakai.', 'Isi ukuran zona (boleh dilewati) → lihat "Zona terpakai".'],
    href: '/gudang',
  },
  {
    tag: 'ARANG',
    q: 'Arang belah 2 vs dipecah — beda berapa ton?',
    steps: ['Buka Muat Container → Arang batok.', 'Bandingkan "Lump / pecah" dengan "Belah 2 utuh".', 'Lihat huruf C: angka belah 2 masih kira-kira.', 'Coba isi ember/kotak lalu timbang dulu sebelum pesan container.'],
    href: '/muat',
  },
  {
    tag: 'DATA SENDIRI',
    q: 'Saya sudah nimbang sendiri — gimana makainya?',
    steps: ['Di kalkulator, buka "+ Ubah angka".', 'Isi kepadatan / berat per butir hasil ukurmu.', 'Hasilnya dapat tanda CUSTOM; data asli nggak ikut berubah.', 'Simpan biar bisa dibuka lagi kapan-kapan.'],
    href: '/muat',
  },
];

const FAQ = [
  ['Kenapa hasilnya rentang, bukan satu angka?', 'Kelapa kan nggak ada yang persis sama — beratnya, ukurannya, kepadatan tumpukannya. Rentang itu hasil paling sedikit sampai paling banyak; angka besar itu yang paling sering terjadi.'],
  ['Hasilnya beda sama pembanding pasar — mana yang bener?', 'Pembanding pasar itu laporan pedagang (bisa beda ukuran butir, karung, atau jenis container). Kalau bedanya jauh, ukur sendiri lalu pakai "Ubah angka", dan catat hasil muat pertamamu.'],
  ['Kenapa kelapa dataran tinggi dipisah?', 'Buahnya cenderung lebih kecil & ringan, jadi kopra per butirnya beda. Dipisah biar hitungan & mutunya bisa dibandingkan.'],
  ['Data dataran tinggi kok masih C?', 'Datanya baru dari satu penelitian kecil. Timbang 30 butir per kiriman, nanti angkanya bisa disesuaikan.'],
  ['Bisa dipakai tanpa internet?', 'Bisa. Setelah sekali dibuka, kalkulatornya tersimpan di HP. Hitungan yang disimpan waktu offline bakal dikirim ke akun begitu ada sinyal & kamu sudah login.'],
  ['Kenapa gambar susunannya nggak persis kayak di container?', 'Gambarnya perkiraan yang dirapikan supaya gampang dibaca — bukan posisi barang yang sebenarnya.'],
  ['Kenapa kopra asalan & kopra edible nggak boleh satu ruangan?', 'Bau asap kopra asalan bisa nempel ke kopra edible — pembeli bisa nolak barangnya.'],
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
        <h2 id="flow-h" className="text-2xl">Mau ngapain hari ini?</h2>
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
        <h2 id="gl-h" className="text-2xl">Kamus istilah (versi santai)</h2>
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
        <h2 id="faq-h" className="text-2xl">Yang sering ditanya</h2>
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
