import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'R&D Lab' };

export default function Lab() {
  return (
    <>
      <header className="flex flex-col gap-2.5">
        <span className="tag-mono self-start">FASE M5</span>
        <h1 className="text-[40px] sm:text-[52px]">R&amp;D<br />Lab</h1>
      </header>
      <section className="card-ink flex max-w-2xl flex-col gap-3">
        <h2 className="text-2xl text-acid">Parameter menyusul</h2>
        <p>
          Buku catatan lab digital untuk Kopra Edible, Kopra Asalan, Bioleather, dan Cuka Kelapa — batch, tahap proses,
          form parameter dinamis, dan perbandingan batch — dibangun di fase M5.
        </p>
        <p className="text-muted-ink">
          Yang dibutuhkan dari owner: isi daftar parameter per produk dan konfirmasi tahap proses bioleather & cuka kelapa.
        </p>
      </section>
    </>
  );
}
