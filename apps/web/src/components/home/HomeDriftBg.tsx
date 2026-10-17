'use client';

import { DriftWall, type DriftItem } from '@/components/ui/DriftWall';

/** Foto Unsplash (lisensi Unsplash, bebas dipakai) bertema kelapa, briket/arang, cuka/fermentasi, dan bio leather (DEC-092). */
const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=480&h=320&q=60&fm=jpg&fit=crop`;
const ITEMS: DriftItem[] = [
  { image: u('1560769680-ba2f3767c785'), title: 'Kelapa dibelah' },
  { image: u('1720676634387-60dd843e8758'), title: 'Arang' },
  { image: u('1583396216852-1e1d61137170'), title: 'Fermentasi cuka' },
  { image: u('1571829604981-ea159f94e5ad'), title: 'Bio leather' },
  { image: u('1553787434-dd9eb4ea4d0b'), title: 'Sabut kelapa' },
  { image: u('1781292428336-1be78d2867e0'), title: 'Briket arang' },
  { image: u('1679897611642-46b1607a136b'), title: 'Cuka & kultur fermentasi' },
  { image: u('1716295177956-420a647c83ac'), title: 'Tekstur bio leather' },
  { image: u('1646230153819-2f1a3651a6d4'), title: 'Daging kelapa' },
  { image: u('1502030818212-8601501607a6'), title: 'Bara arang' },
  { image: u('1573812914274-226dc19fbe17'), title: 'Lembaran selulosa fermentasi' },
  { image: u('1643171785612-163ed13cf1b4'), title: 'Kelapa tua' },
  { image: u('1759455024821-609e6218797c'), title: 'Arang membara' },
  { image: u('1778882996716-72c204e3e14b'), title: 'Bio leather cokelat' },
  { image: u('1692954795485-cb37ceb56091'), title: 'Tumpukan kelapa' },
  { image: u('1583907659441-addbe699e921'), title: 'Cuka' },
  { image: u('1693660032785-37ee8487cafe'), title: 'Kelapa utuh' },
];

/**
 * Latar animasi hero Ringkasan: penuh lebar layar, di belakang judul, dan menjulur ke bawah sehingga
 * kartu "Mulai cepat" menutupi setengah bagian bawahnya (kartu tampak mengambang di depan animasi).
 */
export function HomeDriftBg({ page = false }: { page?: boolean }) {
  // page = latar yang sama untuk halaman lain (DEC-096): penempatan sama (penuh lebar, di belakang judul), tinggi tetap
  // karena tinggi judul tiap halaman berbeda, dan memudar ke warna latar di bagian bawah agar kartu tampak mengambang.
  return (
    <div
      aria-hidden
      className={`pointer-events-auto absolute -top-8 left-1/2 -z-10 w-screen -translate-x-1/2 lg:-top-10 ${page ? 'h-[340px] sm:h-[400px]' : 'bottom-[-150px]'}`}
      data-testid={page ? 'page-drift' : 'home-drift'}
    >
      <DriftWall
        items={ITEMS}
        columns={6}
        tileWidth={200}
        tileHeight={132}
        gap={18}
        tilt={16}
        turn={-14}
        perspective={1200}
        depth={120}
        speed={42}
        direction="up"
        variance={0.45}
        parallax={0.6}
        lift={64}
        fade={0.6}
        dim={1}
        overlayColor="#0E1A1F"
        radius={14}
        roll={0}
        pauseOnHover={false}
        grayscale={false}
        label="Latar: kelapa, briket, cuka, dan bio leather"
      />
      {/* bayangan hitam halus di sekeliling dinding gambar (vignette) agar foto tampak jelas & menonjol */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_70%_75%_at_60%_45%,transparent_45%,rgba(14,26,31,0.28)_80%,rgba(14,26,31,0.45)_100%)]" />
      {/* lapisan terang di belakang teks judul agar tetap mudah dibaca */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F3F6F7]/80 via-[#F3F6F7]/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#F3F6F7] to-transparent" />
      {page && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F3F6F7] to-transparent" />}
    </div>
  );
}
