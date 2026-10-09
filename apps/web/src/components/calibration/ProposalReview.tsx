'use client';

import type { Confidence } from '@gemas/calc-engine';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfidenceBadge } from '@/components/ui/badges';
import { COMMODITY_UI, formLabel, paramLabel } from '@/lib/catalog';
import { fmt, fmtMeasure } from '@/lib/format';
import { displayUnit } from '@/lib/sampling';

interface Proposal {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  commodityId: string;
  formCode: string;
  key: string;
  unit: string;
  forVersion: string;
  current: { min: number; typ: number; max: number; confidence: string };
  proposed: { min: number; typ: number; max: number };
  sampleN: number;
  createdAt: string;
  reviewedBy: string | null;
  resultingVersion: string | null;
}

const STATUS: Record<Proposal['status'], string> = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };

function Card({ p, isAdmin, onDone }: { p: Proposal; isAdmin: boolean; onDone: (msg: string) => void }) {
  const [confirm, setConfirm] = useState<'approve' | 'reject'>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const du = displayUnit(p.unit, p.current.typ);
  const f = (v: number) => fmtMeasure(du.fromSi(v));
  const change = (p.proposed.typ - p.current.typ) / p.current.typ;
  const label = `${COMMODITY_UI[p.commodityId]?.short ?? p.commodityId} · ${formLabel(p.commodityId, p.formCode)} · ${paramLabel(p.key)}`;

  const act = async (action: 'approve' | 'reject') => {
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch(`/api/v1/proposals/${p.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? `Gagal (${res.status})`);
      onDone(action === 'approve' ? `Disetujui — dataset v${json.version} terbit & aktif.` : 'Usulan ditolak. Angka dataset tidak berubah.');
    } catch (e) {
      setErr((e as Error).message);
      setConfirm(undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card flex flex-col gap-4" data-testid="proposal" data-status={p.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="tag-mono">{STATUS[p.status]}</span>
        <span className="num text-xs">
          untuk v{p.forVersion} · n = {p.sampleN} · {new Date(p.createdAt).toLocaleString('id-ID')}
        </span>
      </div>
      <h3 className="text-xl">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-2 border-ink p-3">
          <span className="label-mono flex items-center gap-2">
            Sekarang <ConfidenceBadge c={p.current.confidence as Confidence} />
          </span>
          <p className="num text-lg font-bold">
            {f(p.current.min)} / {f(p.current.typ)} / {f(p.current.max)} {du.label}
          </p>
        </div>
        <div className="border-2 border-ink bg-acid p-3">
          <span className="label-mono flex items-center gap-2">
            Usulan (P5 / median / P95) <ConfidenceBadge c="A" />
          </span>
          <p className="num text-lg font-bold" data-testid="proposed">
            {f(p.proposed.min)} / {f(p.proposed.typ)} / {f(p.proposed.max)} {du.label}
          </p>
        </div>
      </div>
      <p className="num text-sm">
        Angka biasa berubah {change > 0 ? '+' : ''}
        {fmt(change * 100, 1)}%.
        {p.status === 'APPROVED' && p.resultingVersion && ` Terbit di v${p.resultingVersion}.`}
        {p.reviewedBy && ` Direview oleh ${p.reviewedBy}.`}
      </p>
      {err && (
        <p role="alert" className="font-bold">
          <span className="bg-safety px-1">{err}</span>
        </p>
      )}
      {p.status === 'PENDING' &&
        (isAdmin ? (
          confirm ? (
            <div className="flex flex-wrap items-center gap-3 border-3 border-ink bg-paper p-3">
              <span className="font-bold">
                {confirm === 'approve' ? 'Terbitkan versi dataset baru dengan angka ini?' : 'Tolak usulan ini?'}
              </span>
              <button type="button" className={confirm === 'approve' ? 'btn-primary' : 'btn-ghost'} disabled={busy} onClick={() => void act(confirm)} data-testid="confirm">
                {busy ? 'Memproses…' : 'Ya, lanjut'}
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setConfirm(undefined)}>
                Batal
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => setConfirm('approve')} data-testid="approve">
                Setujui
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirm('reject')} data-testid="reject">
                Tolak
              </button>
            </div>
          )
        ) : (
          <p className="text-sm text-muted">Hanya admin data yang bisa menyetujui atau menolak.</p>
        ))}
    </article>
  );
}

export function ProposalReview({ proposals, isAdmin }: { proposals: Proposal[]; isAdmin: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string>();
  const pending = proposals.filter((p) => p.status === 'PENDING');
  const done = proposals.filter((p) => p.status !== 'PENDING');
  const onDone = (m: string) => {
    setMsg(m);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-8">
      {msg && (
        <p role="status" className="card bg-acid font-bold" data-testid="review-msg">
          {msg}
        </p>
      )}
      <section aria-labelledby="pend-h" className="flex flex-col gap-4">
        <h2 id="pend-h" className="text-2xl">
          Menunggu review ({pending.length})
        </h2>
        {pending.length === 0 ? <p className="text-sm">Belum ada usulan. Usulan muncul otomatis setelah satu angka punya ≥ 10 sampel.</p> : pending.map((p) => <Card key={p.id} p={p} isAdmin={isAdmin} onDone={onDone} />)}
      </section>
      {done.length > 0 && (
        <section aria-labelledby="done-h" className="flex flex-col gap-4">
          <h2 id="done-h" className="text-2xl">
            Riwayat
          </h2>
          {done.map((p) => (
            <Card key={p.id} p={p} isAdmin={false} onDone={onDone} />
          ))}
        </section>
      )}
    </div>
  );
}
