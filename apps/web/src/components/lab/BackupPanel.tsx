'use client';

import { useState } from 'react';
import { applyRestore, exportLabBackup, previewRestore, type RestorePlan } from '@/lib/labBackup';
import { downloadBlob } from '@/lib/labMedia';
import { Section } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

/** Cadangan lengkap (data + foto/video) & pemulihan tambah-saja. */
export function BackupPanel({ onRestored }: { onRestored: () => Promise<void> }) {
  const [msg, setMsg] = useState('');
  const [plan, setPlan] = useState<RestorePlan>();
  const [busy, setBusy] = useState(false);

  const backup = async () => {
    setBusy(true);
    try {
      const { json, counts } = await exportLabBackup();
      downloadBlob(new Blob([json], { type: 'application/json' }), `gema-rnd-cadangan-${today()}.json`);
      setMsg(`Cadangan dibuat: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}. Simpan file ini di tempat lain (flashdisk/drive).`);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (f: File | undefined) => {
    setPlan(undefined);
    if (!f) return;
    try {
      setPlan(await previewRestore(await f.text()));
      setMsg('');
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const restore = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await applyRestore(plan);
      setMsg(`Dipulihkan. ${plan.skipped.length ? `${plan.skipped.length} catatan dilewati karena sudah ada (tidak ditimpa).` : ''}`);
      setPlan(undefined);
      await onRestored();
    } catch {
      setMsg('Pemulihan gagal; tidak ada data yang berubah.');
    } finally {
      setBusy(false);
    }
  };

  const n = plan && plan.add.experiments.length + plan.add.entries.length + plan.add.protocols.length + plan.add.media.length;

  return (
    <Section title="Cadangan & pulihkan" testId="lab-backup-panel">
      <p className="text-sm">
        Data tersimpan <strong>hanya di browser perangkat ini</strong>. Laptop dan HP punya catatan terpisah — belum ada sinkronisasi.
        Pindahkan data dengan file cadangan: unduh di satu perangkat, pulihkan di perangkat lain.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void backup()} data-testid="lab-backup">Unduh cadangan lengkap</button>
        <label className="btn-ghost cursor-pointer">
          Pilih file cadangan…
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} data-testid="lab-restore-file" />
        </label>
      </div>
      {plan && (
        <div className="flex flex-col gap-2 rounded-xl bg-paper p-3 text-sm" data-testid="lab-restore-plan">
          <span>
            Akan ditambahkan: {plan.add.experiments.length} eksperimen, {plan.add.entries.length} catatan harian, {plan.add.protocols.length} versi riset produk, {plan.add.media.length} media.
          </span>
          {plan.skipped.length > 0 && <span className="text-muted">Dilewati (sudah ada, tidak ditimpa): {plan.skipped.map((s) => s.id).join(', ')}</span>}
          <button type="button" className="btn-primary self-start" disabled={busy || !n} onClick={() => void restore()} data-testid="lab-restore-apply">
            {n ? 'Pulihkan sekarang' : 'Tidak ada yang baru'}
          </button>
        </div>
      )}
      {msg && <p className="font-mono text-xs" role="status" data-testid="lab-backup-msg">{msg}</p>}
    </Section>
  );
}
