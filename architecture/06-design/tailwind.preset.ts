// tailwind.preset.ts — gemasSTUDIO "Lab Futuristik" (ADR-011, menggantikan Punk Skate Lab).
// Nama token sengaja dipertahankan (ink, paper, acid, safety, …) agar semua halaman ikut berganti
// tanpa menulis ulang kelas. Sumber nilai: 06-design/tokens.json
import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ink: '#0E1A1F', // slate gelap: teks, garis, sidebar
        paper: '#F3F6F7', // latar halaman putih-dingin
        'paper-grid': '#E2E8EA',
        surface: '#FFFFFF',
        acid: '#63E6CF', // aksen utama mint (air kelapa / bio)
        safety: '#F5A524', // aksen kedua amber: tombol utama, peringatan
        muted: '#5B6B72',
        'muted-ink': '#A9B8BE',
        'line-ink': '#2A3A41',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderWidth: { 3: '1px' }, // garis rambut; nama "3" dipertahankan
      borderRadius: { none: '0' },
      boxShadow: {
        hard: '0 1px 2px rgba(14,26,31,0.06), 0 10px 30px -12px rgba(14,26,31,0.18)',
        'hard-safety': '0 0 0 1px rgba(99,230,207,0.35), 0 12px 32px -12px rgba(99,230,207,0.45)',
        'hard-sm': '0 1px 2px rgba(14,26,31,0.08), 0 4px 12px -6px rgba(14,26,31,0.2)',
      },
      backgroundImage: {
        'lab-grid':
          'linear-gradient(#E2E8EA 1px, transparent 1px), linear-gradient(90deg, #E2E8EA 1px, transparent 1px)',
      },
      backgroundSize: { 'lab-grid': '32px 32px' },
      minHeight: { touch: '44px' },
    },
  },
};

export default preset;
