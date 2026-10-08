// tailwind.preset.ts — gemasSTUDIO "Punk Skate Lab". Sumber: 06-design/tokens.json
import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        paper: '#EFEDE4',
        'paper-grid': '#DAD6C8',
        surface: '#FFFFFF',
        acid: '#C6F135',
        safety: '#FF5A1F',
        muted: '#55534B',
        'muted-ink': '#CFCCC0',
        'line-ink': '#3A3A3A',
      },
      fontFamily: {
        display: ['"Bowlby One"', 'system-ui', 'sans-serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderWidth: { 3: '3px' },
      borderRadius: { none: '0' },
      boxShadow: {
        hard: '6px 6px 0 #111111',
        'hard-safety': '6px 6px 0 #FF5A1F',
        'hard-sm': '4px 4px 0 #111111',
      },
      backgroundImage: {
        'lab-grid':
          'linear-gradient(#DAD6C8 1px, transparent 1px), linear-gradient(90deg, #DAD6C8 1px, transparent 1px)',
      },
      backgroundSize: { 'lab-grid': '24px 24px' },
      minHeight: { touch: '44px' },
    },
  },
};

export default preset;
