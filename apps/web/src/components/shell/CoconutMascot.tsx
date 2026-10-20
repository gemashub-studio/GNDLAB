/**
 * Maskot kelapa tua (DEC-111): bola sabut cokelat dengan mata berkedip & mulut bergerak.
 * Keadaan: idle (senyum), listening (mulut "o", mendengar), thinking (mata melirik, bergoyang), talking (mulut buka-tutup).
 */
export type MascotMood = 'idle' | 'listening' | 'thinking' | 'talking';

export function CoconutMascot({ size = 72, mood = 'idle', className = '' }: { size?: number; mood?: MascotMood; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`coco-mascot coco-${mood} ${className}`} role="img" aria-label="Maskot kelapa" data-mood={mood}>
      <defs>
        <radialGradient id="coco-shell" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#A9713F" />
          <stop offset="55%" stopColor="#7A4A24" />
          <stop offset="100%" stopColor="#4E2C12" />
        </radialGradient>
      </defs>
      <g className="coco-body">
        <ellipse cx="50" cy="94" rx="26" ry="4" fill="#0E1A1F" opacity="0.18" className="coco-shadow" />
        <circle cx="50" cy="52" r="38" fill="url(#coco-shell)" />
        {/* serat sabut */}
        <g stroke="#3B200C" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" fill="none">
          <path d="M22 40 q6 -4 10 -1" />
          <path d="M70 28 q5 2 7 7" />
          <path d="M18 60 q4 3 9 2" />
          <path d="M76 66 q-3 5 -9 6" />
          <path d="M44 18 q5 -2 10 1" />
          <path d="M33 80 q5 3 10 2" />
        </g>
        {/* tiga "mata" khas kelapa di ubun-ubun */}
        <g fill="#3B200C" opacity="0.8">
          <circle cx="43" cy="24" r="2.2" />
          <circle cx="51" cy="21.5" r="2.2" />
          <circle cx="58" cy="25" r="2.2" />
        </g>
        {/* wajah */}
        <g className="coco-eyes">
          <g className="coco-eye">
            <ellipse cx="38" cy="50" rx="7" ry="8" fill="#FFFFFF" />
            <circle className="coco-pupil" cx="39" cy="51" r="3.6" fill="#0E1A1F" />
            <circle cx="40.3" cy="49.5" r="1.1" fill="#FFFFFF" />
          </g>
          <g className="coco-eye">
            <ellipse cx="62" cy="50" rx="7" ry="8" fill="#FFFFFF" />
            <circle className="coco-pupil" cx="63" cy="51" r="3.6" fill="#0E1A1F" />
            <circle cx="64.3" cy="49.5" r="1.1" fill="#FFFFFF" />
          </g>
        </g>
        <ellipse cx="30" cy="62" rx="4.5" ry="2.6" fill="#E98A6B" opacity="0.55" />
        <ellipse cx="70" cy="62" rx="4.5" ry="2.6" fill="#E98A6B" opacity="0.55" />
        <g className="coco-mouth">
          <path className="coco-smile" d="M41 66 q9 9 18 0" stroke="#2A1608" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse className="coco-open" cx="50" cy="68" rx="6" ry="5" fill="#2A1608" />
        </g>
      </g>
    </svg>
  );
}
