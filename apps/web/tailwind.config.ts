import type { Config } from 'tailwindcss';
// Preset desain dipakai APA ADANYA dari architecture/06-design (sumber kebenaran visual).
import preset from '../../architecture/06-design/tailwind.preset';

const config: Config = {
  presets: [preset as Config],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Font dimuat lokal oleh next/font (offline/PWA) — nama keluarga dari variabel CSS,
      // urutan fallback sama dengan preset.
      fontFamily: {
        display: ['var(--font-display)', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Archivo', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
};

export default config;
