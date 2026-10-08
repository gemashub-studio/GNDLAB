import type { Binding, Confidence } from '@gemas/calc-engine';

const CONF_BG: Record<Confidence, string> = { A: 'bg-acid', B: 'bg-surface', C: 'bg-safety' };
const CONF_TEXT: Record<Confidence, string> = {
  A: 'terukur',
  B: 'data dagang',
  C: 'estimasi',
};

/** Badge keyakinan — huruf selalu tertulis (bukan warna saja, NFR-08). */
export function ConfidenceBadge({ c, tilt = false, withText = false }: { c: Confidence; tilt?: boolean; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`badge-conf ${CONF_BG[c]} ${tilt ? '-rotate-6' : ''}`}
        aria-label={`Keyakinan data ${c}: ${CONF_TEXT[c]}`}
        title={`Keyakinan ${c} — ${CONF_TEXT[c]}`}
      >
        {c}
      </span>
      {withText && <span className="font-mono text-[11px] font-bold uppercase">{CONF_TEXT[c]}</span>}
    </span>
  );
}

const BIND_LABEL: Record<Binding, string> = { VOLUME: 'Volume penuh', WEIGHT: 'Berat penuh', NONE: 'Tidak muat' };

/** Label batas pengikat; stiker miring sesuai mockup (maks satu per kartu). */
export function BindingTag({ b }: { b: Binding }) {
  const cls = b === 'VOLUME' ? 'bg-ink text-acid' : 'bg-safety text-ink';
  return (
    <span
      data-testid="binding"
      data-binding={b}
      className={`inline-flex rotate-[1.5deg] items-center gap-1.5 border-2 border-ink px-2.5 py-1.5 text-[13px] font-extrabold uppercase ${cls}`}
    >
      <span aria-hidden>{b === 'VOLUME' ? '▣' : b === 'WEIGHT' ? '⚖' : '✕'}</span>
      Batas: {BIND_LABEL[b]}
    </span>
  );
}
