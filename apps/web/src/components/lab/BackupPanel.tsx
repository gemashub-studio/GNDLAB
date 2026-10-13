'use client';

import { useEffect, useState } from 'react';
import { applyRestore, exportLabBackup, previewRestore, type RestorePlan } from '@/lib/labBackup';
import { downloadBlob } from '@/lib/labMedia';
import { Section } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

/** Cadangan lengkap (data + foto/video) & pemulihan tambah-saja. */
export function BackupPanel({ onRestored }: { onRestored: () => Promise<void> }) {
  return (
    <>
      <DriveSync onSynced={onRestored} />
      <FileBackup onRestored={onRestored} />
    </>
  );
}

/** Sinkron Google Drive (DEC-065): satu tombol, dua arah, data di Drive pemilik. */
function DriveSync({ onSynced }: { onSynced: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(false);
  const [last, setLast] = useState('');
  const [step, setStep] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cid, setCid] = useState('');
  useEffect(() => {
    void import('@/lib/gdrive').then((g) => {
      setEnabled(!!g.driveClientId());
      setLast(g.lastSync());
    });
  }, []);
  const sync = async () => {
    setBusy(true);
    setMsg('');
    try {
      const g = await import('@/lib/gdrive');
      const r = await g.syncWithDrive(setStep);
      setLast(r.at);
      setMsg(`Sinkron selesai: ${r.pulled} perubahan diambil dari Drive; ${Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(', ')} tersimpan di Drive (${(r.pushedBytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB).${r.conflicts.length ? ` PERHATIAN: ${r.conflicts.length} catatan berkode sama tapi isinya beda di perangkat lain TIDAK digabung (${r.conflicts.join(', ')}) — catatan di perangkat ini tetap; unduh file cadangan di kedua perangkat untuk dicocokkan.` : ''}`);
      await onSynced();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setStep('');
      setBusy(false);
    }
  };
  return (
    <Section title="Sinkron Google Drive" testId="lab-drive-panel">
      {enabled ? (
        <>
          <p className="text-sm">
            Data lab (eksperimen, riset produk, laporan belanja, foto/video) disimpan sebagai satu file di <strong>Google Drive-mu</strong>. Tekan tombol di laptop &amp; HP —
            data keduanya digabung. Aplikasi hanya bisa membuka file yang ia buat sendiri, bukan isi Drive lainnya.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void sync()} data-testid="lab-drive-sync">{busy ? 'Menyinkron…' : 'Sinkronkan dengan Google Drive'}</button>
            <span className="font-mono text-xs text-muted" data-testid="lab-drive-last">{last ? `Terakhir: ${new Date(last).toLocaleString('id-ID')}` : 'Belum pernah sinkron di perangkat ini'}</span>
          </div>
          {step && <p className="font-mono text-xs" role="status">{step}</p>}
        </>
      ) : (
        <div className="flex flex-col gap-2" data-testid="lab-drive-off">
          <p className="text-sm text-muted">
            Belum diaktifkan. Tempel <strong>Client ID Google</strong> milikmu (dibuat sekali di Google Cloud — lihat panduan &quot;online-gdrive&quot;). Client ID bukan kata sandi; disimpan di browser ini.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field min-w-[260px] flex-1 text-sm" placeholder="123456789-xxxx.apps.googleusercontent.com" value={cid} onChange={(e) => setCid(e.target.value)} data-testid="lab-drive-cid" />
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                void import('@/lib/gdrive').then((g) => {
                  if (!g.validClientId(cid)) return setMsg('Bentuk Client ID tidak dikenali (harus berakhiran .apps.googleusercontent.com).');
                  g.setDriveClientId(cid);
                  setEnabled(true);
                  setMsg('');
                })
              }
              data-testid="lab-drive-cid-save"
            >
              Aktifkan
            </button>
          </div>
        </div>
      )}
      {msg && <p className="font-mono text-xs" role="status" data-testid="lab-drive-msg">{msg}</p>}
    </Section>
  );
}

function FileBackup({ onRestored }: { onRestored: () => Promise<void> }) {
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

  const n = plan && plan.add.experiments.length + plan.add.entries.length + plan.add.protocols.length + plan.add.media.length + plan.add.drafts.length;

  return (
    <Section title="Cadangan & pulihkan" testId="lab-backup-panel">
      <p className="text-sm">
        Data tersimpan di browser perangkat ini. Selain sinkron Google Drive di atas, kamu bisa memindahkan data dengan file cadangan: unduh di satu perangkat, pulihkan di perangkat lain.
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
            Akan ditambahkan: {plan.add.experiments.length} eksperimen, {plan.add.entries.length} catatan harian, {plan.add.protocols.length} versi riset produk, {plan.add.drafts.length} draf, {plan.add.media.length} media.
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
