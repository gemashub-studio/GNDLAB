'use client';

import { GEMA_DOSSIERS, SOURCE_CATEGORIES, sourceById, type SourceCategory } from '@/lib/gemaSources';
import { LAB_PRODUCTS, type LabProductId } from '@/lib/labStore';
import { ProductMark, SourcePill } from './ui';

/** Temuan standar per jalur produk — ringkasan dari architecture/07-rnd/research/standar-produk/. */
export function StandardsTab({ product, setProduct }: { product: LabProductId; setProduct: (p: LabProductId) => void }) {
  const d = GEMA_DOSSIERS[product];
  const name = LAB_PRODUCTS.find((p) => p.id === product)!.name;

  return (
    <div className="flex flex-col gap-5" data-testid="lab-standards">
      <div role="tablist" aria-label="Jalur produk" className="flex flex-wrap gap-2">
        {LAB_PRODUCTS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === product} onClick={() => setProduct(p.id)} className="chip min-h-[44px]" aria-pressed={p.id === product} data-testid={`std-tab-${p.id}`}>
            {p.name}
          </button>
        ))}
      </div>

      <article className="card flex flex-col gap-5" data-testid="std-detail">
        <header className="flex items-center gap-3">
          <ProductMark id={product} active />
          <div className="flex flex-col">
            <h2 className="text-2xl">{name}</h2>
            <span className="font-mono text-xs text-muted">Label bukti: {d.evidence}</span>
          </div>
        </header>

        {(Object.keys(SOURCE_CATEGORIES) as SourceCategory[]).map((cat) => {
          const ids = d.standards.filter((id) => sourceById(id)?.category === cat);
          if (!ids.length) return null;
          return (
            <section key={cat} className="flex flex-col gap-2" data-testid={`std-cat-${cat}`}>
              <h3 className="label-mono">{SOURCE_CATEGORIES[cat]}</h3>
              <ul className="flex flex-col gap-2">
                {ids.map((id) => {
                  const s = sourceById(id)!;
                  return (
                    <li key={id} className="flex flex-col gap-1 rounded-xl bg-paper p-3">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{id}</span>
                        <SourcePill status={s.status} />
                        <span className="font-mono text-[11px] text-muted">{s.org} · {s.year}</span>
                      </span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 hover:underline">{s.title}</a>
                      <span className="text-sm"><span className="label-mono">Mengatur: </span>{s.regulates}</span>
                      <span className="text-sm text-muted">{s.limits}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <section className="flex flex-col gap-1.5 rounded-xl border-3 border-safety p-4">
          <h3 className="label-mono">Belum boleh disimpulkan</h3>
          <p>{d.notYet}</p>
        </section>

        <section className="flex flex-col gap-1.5">
          <h3 className="label-mono">Pertanyaan terbuka untuk owner</h3>
          <ul className="list-disc pl-5">
            {d.questions.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </section>

        <p className="font-mono text-[11px] text-muted">Dossier lengkap: {d.dossier}</p>
      </article>
    </div>
  );
}
