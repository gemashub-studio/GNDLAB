/** Ikon garis tebal dari mockup (stroke 2.4). */
const P = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, 'aria-hidden': true } as const;

export const Icon = {
  home: () => (
    <svg {...P}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  container: () => (
    <svg {...P}>
      <rect x="2" y="7" width="20" height="12" />
      <path d="M6 7v12M10 7v12M14 7v12M18 7v12" />
    </svg>
  ),
  warehouse: () => (
    <svg {...P}>
      <path d="M3 10l9-6 9 6v10H3z" />
      <path d="M8 20v-6h8v6" />
    </svg>
  ),
  convert: () => (
    <svg {...P}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  ),
  data: () => (
    <svg {...P}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  ),
  saved: () => (
    <svg {...P}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  ),
  help: () => (
    <svg {...P}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.5" />
    </svg>
  ),
  process: () => (
    <svg {...P}>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M9 11l6-4M9 13l6 4" />
    </svg>
  ),
  cube: () => (
    <svg {...P}>
      <path d="M12 2l9 5v10l-9 5-9-5V7z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  ),
  scale: () => (
    <svg {...P}>
      <path d="M12 3v18M7 21h10M4 7h16" />
      <path d="M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z" />
    </svg>
  ),
  lab: () => (
    <svg {...P}>
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;
