/** Ikon kelapa sementara dari mockup (logo resmi belum ada — RSK-10). */
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="23" r="16" fill="#63E6CF" stroke="#F3F6F7" strokeWidth="2.5" />
      <path d="M14 18l5 5M19 18l-5 5M25 18l5 5M30 18l-5 5" stroke="#0E1A1F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M15 30c4 3 10 3 14 0" stroke="#0E1A1F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 7l2-5 2 5" stroke="#F5A524" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = 'text-[22px]' }: { className?: string }) {
  return (
    <span className={`font-display leading-none tracking-[0.01em] ${className}`}>
      gemas<span className="text-acid">STUDIO</span>
    </span>
  );
}
