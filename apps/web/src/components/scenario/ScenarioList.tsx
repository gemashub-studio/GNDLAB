'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { deleteLocal, listLocal, syncPending, type LocalScenario } from '@/lib/localScenarios';
import { encodeState, type ScenarioState } from '@/lib/scenario';
import { askConfirm as ask } from '@/components/lab/Overlays';

const PATH: Record<ScenarioState['kind'], string> = { CONTAINER: '/muat', WAREHOUSE: '/gudang', CONVERT: '/konversi' };
const KIND: Record<ScenarioState['kind'], string> = { CONTAINER: 'Container', WAREHOUSE: 'Gudang', CONVERT: 'Konversi' };

interface ServerItem {
  id: string;
  name: string;
  shareSlug: string | null;
  createdAt: string;
  datasetVersion: string;
  state?: ScenarioState;
}

export function ScenarioList({ loggedIn, server }: { loggedIn: boolean; server: ServerItem[] }) {
  const [local, setLocal] = useState<LocalScenario[]>();
  const [msg, setMsg] = useState<string>();

  const reload = useCallback(() => listLocal().then(setLocal).catch(() => setLocal([])), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const pending = local?.filter((s) => !s.synced).length ?? 0;
  const serverIds = new Set(server.map((s) => s.id));

  return (
    <div className="flex flex-col gap-6">
      {loggedIn && pending > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <span>{pending} skenario di perangkat belum tersinkron.</span>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const r = await syncPending();
              setMsg(`${r.synced} skenario tersinkron.`);
              location.reload();
            }}
          >
            Sinkronkan
          </button>
        </div>
      )}
      {msg && <p role="status">{msg}</p>}

      {loggedIn && (
        <section aria-labelledby="srv-h" className="card flex flex-col gap-3">
          <h2 id="srv-h" className="text-2xl">Di akunmu</h2>
          {server.length === 0 ? (
            <p className="text-sm">Belum ada. Tekan &quot;Simpan&quot; di kalkulator mana pun.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {server.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 border-2 border-ink p-3">
                  <span className="min-w-0 flex-1 font-bold">{s.name}</span>
                  <span className="font-mono text-xs">v{s.datasetVersion} · {new Date(s.createdAt).toLocaleString('id-ID')}</span>
                  {s.shareSlug && <Link href={`/s/${s.shareSlug}`} className="font-mono text-xs font-bold">Tautan bagikan →</Link>}
                  {s.state && <Link href={`${PATH[s.state.kind]}?s=${encodeState(s.state)}`} className="btn-ghost min-h-0 py-1.5 text-xs no-underline">Buka</Link>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="loc-h" className="card flex flex-col gap-3">
        <h2 id="loc-h" className="text-2xl">Di perangkat ini</h2>
        <p className="text-[13px] text-muted">Tersimpan di browser HP/laptop ini (tetap ada walau offline). Kalau data browser dihapus, daftar ini ikut hilang.</p>
        {local === undefined ? (
          <p className="font-mono text-sm">Memuat…</p>
        ) : local.length === 0 ? (
          <p className="text-sm">Belum ada skenario tersimpan di perangkat ini.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="local-scenarios">
            {local.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-2 border-ink p-3">
                <span className="tag-mono">{KIND[s.state.kind]}</span>
                <span className="min-w-0 flex-1 font-bold">{s.name}</span>
                <span className="font-mono text-xs">
                  v{s.datasetVersion} · {new Date(s.createdAt).toLocaleString('id-ID')} ·{' '}
                  {s.synced || serverIds.has(s.id) ? 'tersinkron' : 'belum sinkron'}
                </span>
                <Link href={`${PATH[s.state.kind]}?s=${encodeState(s.state)}`} className="btn-ghost min-h-0 py-1.5 text-xs no-underline">
                  Buka
                </Link>
                <button
                  type="button"
                  className="font-mono text-xs font-bold underline"
                  aria-label={`Hapus ${s.name} dari perangkat`}
                  onClick={async () => {
                    if (!(await ask({ title: 'Hapus skenario', message: `Hapus "${s.name}" dari perangkat ini?` }))) return;
                    await deleteLocal(s.id);
                    void reload();
                  }}
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
