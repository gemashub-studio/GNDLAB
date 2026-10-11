'use client';

import { GEMA_DOSSIERS, GEMA_SOURCES, sourceCounts } from '@/lib/gemaSources';
import { LAB_PRODUCTS, openNextSteps, type Experiment, type LabProductId } from '@/lib/labStore';
import { ProductMark, Section, SourcePill, StatusPill } from './ui';

export function LabOverview({ items, onOpen, onProduct }: { items: Experiment[]; onOpen: (id: string) => void; onProduct: (p: LabProductId) => void }) {
  const active = items.filter((e) => e.status === 'berjalan' || e.status === 'rencana').slice(0, 5);
  const recent = items.slice(0, 5);
  const steps = openNextSteps(items).slice(0, 6);
  const counts = sourceCounts();

  return (
    <div className="flex flex-col gap-5" data-testid="lab-overview">
      <section aria-label="Lima jalur R&D" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="lab-products">
        {LAB_PRODUCTS.map((p) => {
          const list = items.filter((e) => e.product === p.id);
          const running = list.filter((e) => e.status === 'berjalan').length;
          const srcs = GEMA_DOSSIERS[p.id].standards.length;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onProduct(p.id)}
              data-testid={`lab-product-${p.id}`}
              className="card group flex min-h-[176px] flex-col items-start gap-3 text-left transition hover:-translate-y-0.5 hover:shadow-hard-safety"
            >
              <span className="flex w-full items-center justify-between">
                <ProductMark id={p.id} />
                <span className="font-mono text-[11px] text-muted">{srcs} sumber</span>
              </span>
              <span className="font-display text-xl font-semibold leading-tight">{p.name}</span>
              <span className="mt-auto flex w-full flex-col gap-1 font-mono text-xs">
                <span>{list.length ? `${list.length} eksperimen${running ? ` · ${running} berjalan` : ''}` : 'belum ada eksperimen'}</span>
                {list[0] && <span className="text-muted">terakhir {list[0].id}</span>}
              </span>
            </button>
          );
        })}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Aktif & terbaru" aside={<span className="font-mono text-xs text-muted">{active.length} aktif</span>} testId="lab-recent">
          {recent.length ? (
            <ul className="flex flex-col divide-y divide-paper-grid">
              {(active.length ? active : recent).map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpen(e.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:text-muted">
                    <ProductMark id={e.product} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-mono text-xs text-muted">{e.id} · mulai {e.startedAt}</span>
                      <span className="truncate font-semibold">{e.title}</span>
                    </span>
                    <StatusPill status={e.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Belum ada eksperimen. Pilih satu jalur di atas, lalu buat eksperimen pertama.</p>
          )}
        </Section>

        <Section title="Langkah berikutnya" aside={<span className="font-mono text-xs text-muted">{steps.length} terbuka</span>} testId="lab-next">
          {steps.length ? (
            <ul className="flex flex-col gap-2">
              {steps.map(({ experiment, step }) => (
                <li key={`${experiment.id}-${step.id}`}>
                  <button type="button" onClick={() => onOpen(experiment.id)} className="flex w-full items-start gap-3 rounded-xl border-3 border-ink px-3 py-2.5 text-left hover:bg-paper">
                    <span aria-hidden className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-safety" />
                    <span className="flex flex-col">
                      <span>{step.action}</span>
                      <span className="font-mono text-[11px] text-muted">{experiment.id}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Belum ada langkah berikutnya. Tambahkan dari halaman detail eksperimen.</p>
          )}
        </Section>
      </div>

      <Section title="Status riset & sumber" aside={<span className="font-mono text-xs text-muted">{GEMA_SOURCES.length} sumber</span>} testId="lab-research">
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          <span className="flex items-center gap-2"><SourcePill status="diperiksa" /> {counts.diperiksa}</span>
          <span className="flex items-center gap-2"><SourcePill status="dilaporkan" /> {counts.dilaporkan}</span>
          <span className="flex items-center gap-2"><SourcePill status="belum-diperiksa" /> {counts['belum-diperiksa']}</span>
        </div>
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {LAB_PRODUCTS.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 rounded-xl bg-paper p-3">
              <span className="font-mono text-[11px] font-semibold">{p.id} · {p.name}</span>
              <span className="text-sm">{GEMA_DOSSIERS[p.id].evidence}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Status sumber = identitas & status standar saja. Isi teknis SNI belum dibaca dari naskah resmi. Bukan bukti produk memenuhi standar atau aman dikonsumsi.</p>
      </Section>
    </div>
  );
}
