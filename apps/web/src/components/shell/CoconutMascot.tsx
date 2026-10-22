/**
 * Maskot kelapa (DEC-111 → DEC-133): gambar kelapa peselancar dari owner (public/assets/mascot/coco-surf.webp) dengan
 * animasi CSS per keadaan — idle (melayang & bergoyang pelan), listening (berdenyut + cahaya mint), thinking (miring
 * menoleh), talking (memantul cepat). Animasi mati bila pengguna memilih "kurangi gerakan".
 */
export type MascotMood = 'idle' | 'listening' | 'thinking' | 'talking';

/** Rasio lebar : tinggi gambar setelah dipangkas (300 × 315). */
export const MASCOT_RATIO = 300 / 315;
export const MASCOT_SRC = '/assets/mascot/coco-surf.webp';

export function CoconutMascot({ size = 72, mood = 'idle', className = '' }: { size?: number; mood?: MascotMood; className?: string }) {
  return (
    <span className={`coco-surf coco-surf--${mood} inline-block ${className}`} style={{ width: Math.round(size * MASCOT_RATIO), height: size }} role="img" aria-label="Maskot kelapa" data-mood={mood}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MASCOT_SRC} alt="" width={Math.round(size * MASCOT_RATIO)} height={size} draggable={false} className="block h-full w-full select-none object-contain" />
    </span>
  );
}
