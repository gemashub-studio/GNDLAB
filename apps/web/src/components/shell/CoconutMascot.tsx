/**
 * Maskot kelapa KORA (DEC-111 → DEC-134 → DEC-136 → DEC-137): animated WebP dari owner (public/assets/mascot/kelapa-kora.webp,
 * 288 frame / 14,4 s: melambai dgn papan selancar → kickflip skateboard KORA, loop). Gerakan HANYA dari WebP itu —
 * animasi CSS dimatikan atas permintaan owner (DEC-137); keadaan `listening` cukup diberi cahaya mint (globals.css).
 * Bila pengguna memilih "kurangi gerakan", <picture> memakai frame diam (kelapa-kora-diam.webp).
 */
export type MascotMood = 'idle' | 'listening' | 'thinking' | 'talking';

/** Rasio lebar : tinggi animasi setelah dipangkas ke tepi isi gabungan semua frame + 4 px (192 × 240). */
export const MASCOT_RATIO = 192 / 240;
export const MASCOT_SRC = '/assets/mascot/kelapa-kora.webp';
export const MASCOT_STILL_SRC = '/assets/mascot/kelapa-kora-diam.webp';

export function CoconutMascot({ size = 72, mood = 'idle', className = '' }: { size?: number; mood?: MascotMood; className?: string }) {
  return (
    <span className={`coco-surf coco-surf--${mood} inline-block ${className}`} style={{ width: Math.round(size * MASCOT_RATIO), height: size }} role="img" aria-label="Maskot kelapa KORA" data-mood={mood}>
      <picture className="block h-full w-full">
        <source srcSet={MASCOT_STILL_SRC} media="(prefers-reduced-motion: reduce)" />
        {/* animated WebP: pakai <img> biasa, JANGAN next/image (optimasi membuang animasi) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MASCOT_SRC} alt="" width={Math.round(size * MASCOT_RATIO)} height={size} loading="lazy" decoding="async" draggable={false} className="block h-full w-full select-none object-contain" />
      </picture>
    </span>
  );
}
