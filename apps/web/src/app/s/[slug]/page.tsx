import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfidenceBadge } from '@/components/ui/badges';
import { WarningList } from '@/components/ui/Warnings';
import { reportRows } from '@/lib/report';
import { encodeState } from '@/lib/scenario';
import { datasetForVersion } from '@/server/datasets';
import { getScenario, type StoredScenario } from '@/server/scenarios';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Skenario dibagikan' };

const PATH = { CONTAINER: '/muat', WAREHOUSE: '/gudang', CONVERT: '/konversi' } as const;

export default async function Shared({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let s: StoredScenario;
  try {
    s = await getScenario(slug);
  } catch {
    notFound();
  }
  const { ds } = await datasetForVersion(s.datasetVersion);
  const rows = reportRows(ds, s.state, s.output).filter((r) => r.section !== 'Peringatan');
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="tag-mono self-start">DIBAGIKAN · DATASET v{s.datasetVersion}</span>
          <h1 className="text-[36px] sm:text-[48px]">{s.name}</h1>
          <span className="font-mono text-xs">Disimpan {s.createdAt.toLocaleString('id-ID')} · dihitung ulang dengan versi datasetnya sendiri</span>
        </div>
        <Link href={`${PATH[s.state.kind]}?s=${encodeState(s.state)}`} className="btn-primary no-underline">
          Buka di kalkulator
        </Link>
      </header>
      <section className="card flex flex-col gap-2" aria-label="Ringkasan">
        <span className="flex items-center gap-2 font-mono text-xs font-bold">KEYAKINAN DATA <ConfidenceBadge c={s.output.out.confidence} withText /></span>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-paper-grid align-top">
                <th scope="row" className="w-2/5 p-2 text-left font-bold">
                  <span className="block font-mono text-[10px] font-normal text-muted">{r.section.toUpperCase()}</span>
                  {r.label}
                </th>
                <td className="p-2 font-mono">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <WarningList warnings={s.output.out.warnings} />
    </>
  );
}
