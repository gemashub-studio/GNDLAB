'use client';

import { useEffect, useState } from 'react';
import {
  blankProof,
  deleteLpj,
  fmtRp,
  listLpj,
  newLpj,
  nextLpjId,
  parseRp,
  realizationTotal,
  saveLpj,
  terbilang,
  type LpjPhoto,
  type LpjReport,
} from '@/lib/belanja';
import { downloadBlob } from '@/lib/labMedia';
import { MediaPicker } from './MediaPicker';
import { Section, TextArea, TextInput } from './ui';

/** Foto nota/barang diperkecil (≤ 1400 px, JPEG) supaya tulisan nota tetap terbaca tapi file tidak besar. */
function photoJpeg(file: File): Promise<LpjPhoto | undefined> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, dataUrl: c.toDataURL('image/jpeg', 0.85) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      res(undefined);
    };
    img.src = url;
  });
}

async function downloadDocx(r: LpjReport) {
  const { buildLpjDocx } = await import('@/lib/belanjaDocx');
  const { DOCX_MIME } = await import('@/lib/officeExport');
  downloadBlob(new Blob([buildLpjDocx(r) as Uint8Array<ArrayBuffer>], { type: DOCX_MIME }), `${r.id}-laporan-belanja.docx`);
}

export function BelanjaTab() {
  const [list, setList] = useState<LpjReport[]>([]);
  const [editing, setEditing] = useState<LpjReport>();
  const load = () => void listLpj().then(setList);
  useEffect(load, []);

  if (editing) return <LpjForm key={editing.id} initial={editing} onClose={() => { setEditing(undefined); load(); }} />;

  return (
    <div className="flex flex-col gap-4" data-testid="lpj-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Laporan belanja ({list.length})</h2>
          <p className="text-sm text-muted">Upload bukti tiap alokasi: foto nota/bukti bayar, foto barang, total &amp; keterangan. Unduh sebagai Word.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditing(newLpj(nextLpjId(list.map((x) => x.id))))} data-testid="lpj-new">+ Laporan belanja baru</button>
      </div>
      {list.length ? (
        <ul className="flex flex-col gap-3" data-testid="lpj-list">
          {list.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted">{r.id} · diubah {r.updatedAt.slice(0, 10)}</p>
                <p className="font-semibold">{r.purpose.trim() || 'Bukti alokasi'}</p>
                <p className="text-sm">{r.proofs.length} alokasi · total {fmtRp(realizationTotal(r))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => setEditing(r)} data-testid={`lpj-open-${r.id}`}>Buka</button>
                <button type="button" className="btn-ghost" onClick={() => void downloadDocx(r)} data-testid={`lpj-docx-${r.id}`}>Word</button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (!window.confirm(`Hapus laporan belanja ${r.id} beserta foto nota/barangnya? Tidak bisa dibatalkan.`)) return;
                    void deleteLpj(r.id).then(load);
                  }}
                  data-testid={`lpj-del-${r.id}`}
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Belum ada laporan belanja.</p>
      )}
    </div>
  );
}

function Photos({ photos, onChange, testId }: { photos: LpjPhoto[]; onChange: (p: LpjPhoto[]) => void; testId: string }) {
  return (
    <div className="flex flex-col gap-2">
      <MediaPicker
        compact
        testId={testId}
        onFiles={async (fs) => {
          const out: LpjPhoto[] = [];
          for (const f of fs) if (f.type.startsWith('image/')) {
            const ph = await photoJpeg(f);
            if (ph) out.push(ph);
          }
          onChange([...photos, ...out]);
        }}
      />
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((ph) => (
            <figure key={ph.id} className="relative w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.dataUrl} alt={ph.name} className="h-24 w-24 rounded-lg border border-ink/20 object-cover" />
              <button type="button" className="absolute right-1 top-1 rounded-full bg-ink px-1.5 text-[11px] text-paper" onClick={() => onChange(photos.filter((x) => x.id !== ph.id))} aria-label={`Hapus ${ph.name}`}>×</button>
              <figcaption className="truncate font-mono text-[10px] text-muted">{ph.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

const Money = ({ label, n }: { label: string; n: number }) => (
  <div className="rounded-xl bg-paper p-3">
    <p className="label-mono">{label}</p>
    <p className="font-mono text-xl font-semibold">{fmtRp(n)}</p>
    <p className="text-xs italic text-muted">{terbilang(n)}</p>
  </div>
);

function LpjForm({ initial, onClose }: { initial: LpjReport; onClose: () => void }) {
  const [r, setR] = useState(initial);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof LpjReport>(k: K, v: LpjReport[K]) => setR((x) => ({ ...x, [k]: v }));
  const upd = <T,>(arr: T[], i: number, v: Partial<T>) => arr.map((x, k) => (k === i ? { ...x, ...v } : x));
  const save = async () => {
    await saveLpj(r);
    setMsg(`Tersimpan ${new Date().toLocaleTimeString('id-ID')}`);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="lpj-form">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-3 border-ink bg-surface p-3">
        <p className="font-mono text-sm">{r.id}{msg && <span className="ml-2 text-muted">· {msg}</span>}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void save()} data-testid="lpj-save">Simpan</button>
          <button type="button" className="btn-ghost" onClick={() => void save().then(() => downloadDocx(r))} data-testid="lpj-docx">Simpan &amp; unduh Word</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>

      <TextInput label="Nama laporan (opsional)" value={r.purpose} onChange={(v) => set('purpose', v)} placeholder="Belanja R&D Oktober 2026" testId="lpj-purpose" />

      <Section title="Bukti alokasi" aside={<button type="button" className="btn-ghost" onClick={() => set('proofs', [...r.proofs, blankProof()])} data-testid="lpj-proof-add">+ Alokasi</button>}>
        {r.proofs.map((p, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-ink/20 p-3" data-testid={`lpj-proof-${i}`}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1"><TextInput label={`Alokasi ${i + 1} — judul`} value={p.title} onChange={(v) => set('proofs', upd(r.proofs, i, { title: v }))} testId={`lpj-proof-title-${i}`} /></div>
              <div className="w-40"><TextInput label="Total alokasi (Rp)" value={p.total} onChange={(v) => set('proofs', upd(r.proofs, i, { total: v }))} testId={`lpj-proof-total-${i}`} /></div>
              {r.proofs.length > 1 && <button type="button" className="btn-ghost" onClick={() => set('proofs', r.proofs.filter((_, k) => k !== i))}>Hapus alokasi</button>}
            </div>
            <p className="text-xs italic text-muted">Terbilang: {terbilang(parseRp(p.total))}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="label-mono mb-1">Foto bukti bayar / nota</p><Photos photos={p.receipts} onChange={(v) => set('proofs', upd(r.proofs, i, { receipts: v }))} testId={`lpj-nota-${i}`} /></div>
              <div><p className="label-mono mb-1">Foto barang yang dibeli</p><Photos photos={p.goods} onChange={(v) => set('proofs', upd(r.proofs, i, { goods: v }))} testId={`lpj-barang-${i}`} /></div>
            </div>
            <TextArea label="Keterangan" value={p.description} onChange={(v) => set('proofs', upd(r.proofs, i, { description: v }))} testId={`lpj-proof-desc-${i}`} />
          </div>
        ))}
      </Section>

      <Money label="Total seluruh alokasi" n={realizationTotal(r)} />
    </div>
  );
}
