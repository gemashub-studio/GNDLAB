/**
 * Maskot kelapa KORA (DEC-111 → DEC-133 → DEC-134): kelapa peselancar melambai dari owner (public/assets/mascot/kelapa-kora.webp) dengan
 * animasi CSS per keadaan — idle (melayang & bergoyang pelan), listening (berdenyut + cahaya mint), thinking (miring
 * menoleh), talking (memantul cepat). Animasi mati bila pengguna memilih "kurangi gerakan".
 */
export type MascotMood = 'idle' | 'listening' | 'thinking' | 'talking';

/** Rasio lebar : tinggi gambar setelah dipangkas ke tepi isi + 4 px (346 × 375). */
export const MASCOT_RATIO = 346 / 375;
export const MASCOT_SRC = '/assets/mascot/kelapa-kora.webp';

export function CoconutMascot({ size = 72, mood = 'idle', className = '' }: { size?: number; mood?: MascotMood; className?: string }) {
  return (
    <span className={`coco-surf coco-surf--${mood} inline-block ${className}`} style={{ width: Math.round(size * MASCOT_RATIO), height: size }} role="img" aria-label="Maskot kelapa KORA" data-mood={mood}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MASCOT_SRC} alt="" width={Math.round(size * MASCOT_RATIO)} height={size} loading="lazy" decoding="async" draggable={false} className="block h-full w-full select-none object-contain" />
    </span>
  );
}
