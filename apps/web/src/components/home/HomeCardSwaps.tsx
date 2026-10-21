'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Confidence } from '@gemas/calc-engine';
import { ConfidenceBadge } from '@/components/ui/badges';
import CardSwap, { Card } from '@/components/ui/CardSwap';

export interface QuickItem {
  href: string;
  n: string;
  t: string;
  d: string;
}
export interface CommodityItem {
  id: string;
  short: string;
  confidence: Confidence;
  value: string;
  unit: string;
  form: string;
  batas: string;
  blurb: string;
}

const BASE = { depth: 80, skewAmount: 5, visibleCards: 4, delay: 4200, cardRadius: 18, speed: 1, bounce: 0.35, parallax: 0.4, hoverSpread: 0.12, dim: 0.45, theme: 'light' as const };
/** HP/tablet: kartu sedang di tengah. Desktop (≥1024 px): kartu lebih besar, rata tepi kiri & kanan (DEC-121). */
const MOBILE = { ...BASE, width: 380, height: 236, cardDistance: 46, verticalDistance: 54 };
const DESKTOP = { ...BASE, width: 500, height: 312, cardDistance: 58, verticalDistance: 62 };

function useDesktop() {
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desk;
}

/**
 * Ringkasan (DEC-120): pengganti dua grid kartu — tumpukan kartu bergeser (React Bits CardSwap).
 * Kanan: 4 kartu "Mulai cepat" (kartu depan diklik → buka halaman). Kiri: 4 kartu kapasitas per komoditas, tumpukannya
 * dicerminkan (kartu belakang bergeser ke kiri). Isi kartu = teks yang sama seperti grid sebelumnya.
 */
export function HomeCardSwaps({ quick, commodities }: { quick: QuickItem[]; commodities: CommodityItem[] }) {
  const desk = useDesktop();
  const SWAP = desk ? DESKTOP : MOBILE;
  return (
    <div className="relative z-10 grid gap-4 lg:grid-cols-2" data-testid="home-swaps">
      {/* sisi kiri: komoditas, tumpukan dicerminkan */}
      <section aria-label="Kapasitas per komoditas" className="order-2 h-[340px] sm:h-[400px] lg:order-1 lg:-ml-11 lg:h-[520px]">
        <CardSwap {...SWAP} mirror align={desk ? 'start' : 'center'} label="Kapasitas per komoditas" data-testid="home-swap-komoditas">
          {commodities.map((c) => (
            <Card key={c.id} data-testid={`home-kom-${c.id}`}>
              <article className="flex h-full flex-col gap-2.5 p-[18px] text-ink">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-extrabold uppercase tracking-[0.03em]">{c.short}</span>
                  <ConfidenceBadge c={c.confidence} tilt />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[38px] leading-none lg:text-[46px]">{c.value}</span>
                  <span className="font-mono text-sm font-semibold">{c.unit}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted">BENTUK</span>
                    <span className="font-bold">{c.form}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted">BATAS</span>
                    <span className="font-bold">{c.batas}</span>
                  </div>
                </div>
                <p className="mt-auto border-t-2 border-dashed border-ink pt-2 text-xs leading-snug">{c.blurb}</p>
              </article>
            </Card>
          ))}
        </CardSwap>
      </section>
      {/* sisi kanan: mulai cepat */}
      <section aria-label="Mulai cepat" className="order-1 h-[340px] sm:h-[400px] lg:order-2 lg:-mr-11 lg:h-[520px]">
        <CardSwap {...SWAP} align={desk ? 'end' : 'center'} label="Mulai cepat" data-testid="home-swap-mulai">
          {quick.map((x) => (
            <Card key={x.href} data-testid={`home-quick-${x.n}`}>
              <Link href={x.href} className="group flex h-full flex-col gap-2 p-[18px] text-ink no-underline hover:bg-acid/40" draggable={false}>
                <span className="font-mono text-xs font-bold">{x.n}</span>
                <span className="text-xl font-extrabold uppercase leading-tight lg:text-2xl">{x.t}</span>
                <span className="text-[13px]">{x.d}</span>
                <span className="mt-auto font-mono text-xs font-bold group-hover:underline">YUK MULAI →</span>
              </Link>
            </Card>
          ))}
        </CardSwap>
      </section>
    </div>
  );
}
