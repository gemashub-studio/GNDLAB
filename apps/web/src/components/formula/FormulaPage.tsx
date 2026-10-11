'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArangFormula } from './ArangFormula';
import { BioleatherFormula } from './BioleatherFormula';
import { BriketFormula } from './BriketFormula';
import { CukaFormula } from './CukaFormula';
import { KopraFormula } from './KopraFormula';
import { useFormula } from './shared';

const PRODUCTS = [
  { id: 'kopra', label: 'Kopra', code: 'KE/KA', blurb: 'Desain uji, rendemen, pengeringan, log perlakuan sulfur, grade.' },
  { id: 'arang', label: 'Arang', code: 'AR', blurb: 'Rencana bakar, rendemen aktual, fraksi ayak, standar.' },
  { id: 'shisha', label: 'Briket shisha', code: 'BS', blurb: 'Kubus — perekat, adonan, cetak, oven, uji mutu.' },
  { id: 'bbq', label: 'Briket BBQ', code: 'BB', blurb: 'Pillow 5×10 cm — abu putih, waktu bakar 2–3 jam.' },
  { id: 'custom', label: 'Briket custom', code: 'BC', blurb: 'Bentuk & spesifikasi sesuai pesanan pembeli.' },
  { id: 'cuka', label: 'Cuka air kelapa', code: 'CK', blurb: 'Gula must, ragi, starter, titrasi, botol.' },
  { id: 'bioleather', label: 'Bioleather', code: 'BL', blurb: 'Media, kultur, pemurnian NaOH, plastisasi, QC.' },
] as const;
type ProductId = (typeof PRODUCTS)[number]['id'];

const isProduct = (s: string | null): s is ProductId => PRODUCTS.some((p) => p.id === s);

export function FormulaPage() {
  const f = useFormula();
  const [product, setProduct] = useState<ProductId>('kopra');
  const [guide, setGuide] = useState(false);

  // Tab tersimpan di URL (?p=) — bisa dibagikan & bertahan saat muat ulang.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('p');
    if (isProduct(p)) setProduct(p);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('p', product);
    window.history.replaceState(null, '', url);
  }, [product]);

  const current = PRODUCTS.find((p) => p.id === product)!;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/" className="font-mono text-xs font-bold no-underline">← gemasSTUDIO / RINGKASAN</Link>
          <h1 className="text-[40px] sm:text-[52px]">Formula<br />R&amp;D</h1>
          <p className="max-w-xl text-[15px]">
            Hitung resep & kebutuhan bahan tiap produk: kopra, arang, briket, cuka, bioleather. Angkanya dari SOP KORA + jurnal, lengkap dengan sumber & tingkat keyakinan.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="tag-mono -rotate-[1.5deg]">EXP-FORMULA // DATA FORMULA v{f.version}</span>
          <button type="button" className="btn-ghost" aria-expanded={guide} onClick={() => setGuide((g) => !g)} data-testid="formula-guide-toggle">
            {guide ? 'Tutup panduan' : 'Cara pakai ?'}
          </button>
        </div>
      </header>

      {guide && (
        <section aria-label="Cara pakai" className="card-ink flex flex-col gap-3" data-testid="formula-guide">
          <span className="tag-mono self-start">PANDUAN SINGKAT</span>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px]">
            <li><strong>Pilih produk</strong> di tab atas. Kode di pojok (mis. CK) sama dengan kode batch R&amp;D.</li>
            <li><strong>Isi angka yang kamu punya</strong> — berat bahan, hasil ukur °Brix/KA. Kotak kosong pakai angka dataset (lihat petunjuk kecil di bawah kotak).</li>
            <li><strong>Ikuti tahap 01 → 02 → …</strong> dengan tombol &quot;Lanjut&quot;. Tiap tahap kasih takaran, suhu, waktu, dan titik kritis.</li>
            <li><strong>Lihat huruf A/B/C</strong>: C artinya masih kira-kira — catat hasil ukurmu di Ceklis R&amp;D supaya resepnya makin pas.</li>
            <li>Kotak <span className="bg-acid px-1 font-bold text-ink">TEMUAN</span> menandai rumus lama di dokumen yang terbukti salah dan sudah dikoreksi di sini.</li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <Link href="/produksi" className="btn-acid no-underline">Rencana per shift →</Link>
            <Link href="/ceklis" className="btn-ghost no-underline">Ceklis R&amp;D / QC / produk →</Link>
          </div>
        </section>
      )}

      <nav aria-label="Produk" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7" role="tablist">
        {PRODUCTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={product === p.id}
            onClick={() => setProduct(p.id)}
            data-testid={`ftab-${p.id}`}
            className={`flex min-h-[56px] flex-col items-start justify-center border-3 border-ink px-2 text-left ${product === p.id ? 'bg-ink text-acid shadow-[4px_4px_0_#F5A524]' : 'bg-surface'}`}
          >
            <span className="font-mono text-[11px] font-bold">{p.code}</span>
            <span className="text-xs font-extrabold uppercase leading-tight">{p.label}</span>
          </button>
        ))}
      </nav>
      <p className="font-mono text-xs" data-testid="formula-blurb">{current.label.toUpperCase()} — {current.blurb}</p>

      <div role="tabpanel" aria-label={current.label}>
        {product === 'kopra' && <KopraFormula />}
        {product === 'arang' && <ArangFormula />}
        {(product === 'shisha' || product === 'bbq' || product === 'custom') && <BriketFormula key={product} variantId={product} />}
        {product === 'cuka' && <CukaFormula />}
        {product === 'bioleather' && <BioleatherFormula />}
      </div>

      <p className="font-mono text-[11px] text-muted">
        Dataset formula v{f.version} (disusun {f.compiled}) dari SOP KORA Rev 03, Modul QC, Rencana & Tracker R&amp;D Ronde 1, ditambah FAO, ICC, Codex, IPB, jurnal.
        Laporan riset & temuan: architecture/00-research/kora_research.md.
      </p>
    </div>
  );
}
