'use client';

import { useEffect, useRef, useState } from 'react';
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
import { askConfirm as ask } from './Overlays';

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

type LpjKind = 'pptx' | 'docx' | 'pdf';
const LPJ_KINDS: [LpjKind, string][] = [['pptx', 'PPTX'], ['docx', 'Word'], ['pdf', 'PDF']];

/** Unduh laporan belanja (DEC-078): PPTX diagram cabang, Word bukti alokasi, PDF laporan. */
async function downloadLpj(r: LpjReport, kind: LpjKind) {
  const name = `${r.id}-laporan-belanja.${kind}`;
  if (kind === 'docx') {
    const { buildLpjDocx } = await import('@/lib/belanjaDocx');
    const { DOCX_MIME } = await import('@/lib/officeExport');
    return downloadBlob(new Blob([buildLpjDocx(r) as Uint8Array<ArrayBuffer>], { type: DOCX_MIME }), name);
  }
  const x = await import('@/lib/belanjaExport');
  if (kind === 'pptx') {
    const { buildTreePptx, PPTX_MIME } = await import('@/lib/officeExport');
    return downloadBlob(new Blob([buildTreePptx(x.lpjTreeSlides(r)) as Uint8Array<ArrayBuffer>], { type: PPTX_MIME }), name);
  }
  const { researchPdfBlob } = await import('@/lib/labPdf');
  downloadBlob(await researchPdfBlob(x.lpjReport(r)), name);
}

/** Tombol bermenu (Simpan ▾ / Unduh ▾). */
function MenuButton({ label, items, testId, primary = false }: { label: string; items: { key: string; label: string; note?: string; run: () => void }[]; testId: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" className={primary ? 'btn-primary' : 'btn-ghost'} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid={testId}>
        {label} ▾
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-ink/15 bg-white py-1 shadow-xl" data-testid={`${testId}-menu`}>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className="flex w-full flex-col items-start px-3 py-2.5 text-left text-sm hover:bg-acid/15"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              data-testid={`${testId}-${it.key}`}
            >
              <span className="font-semibold">{it.label}</span>
              {it.note && <span className="text-xs text-muted">{it.note}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
          <p className="text-sm text-muted">Tiap bukti alokasi: nama toko, foto nota, foto barang &amp; nama tiap barang. Unduh sebagai PPTX (diagram nota → barang), Word, atau PDF.</p>
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
                <MenuButton label="Unduh" testId={`lpj-dl-${r.id}`} items={LPJ_KINDS.map(([k, l]) => ({ key: k, label: l, run: () => void downloadLpj(r, k) }))} />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    if (!(await ask({ title: 'Hapus laporan belanja', message: `Hapus laporan belanja ${r.id} beserta foto nota/barangnya? Tidak bisa dibatalkan.` }))) return;
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

function Photos({ photos, onChange, testId, named = false }: { photos: LpjPhoto[]; onChange: (p: LpjPhoto[]) => void; testId: string; named?: boolean }) {
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
          {photos.map((ph, k) => (
            <figure key={ph.id} className={`relative ${named ? 'w-36' : 'w-24'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.dataUrl} alt={ph.label || ph.name} className={`${named ? 'h-28 w-36' : 'h-24 w-24'} rounded-lg border border-ink/20 object-cover`} />
              <button type="button" className="absolute right-1 top-1 rounded-full bg-ink px-1.5 text-[11px] text-paper" onClick={() => onChange(photos.filter((x) => x.id !== ph.id))} aria-label={`Hapus ${ph.name}`}>×</button>
              {named ? (
                <input
                  className="field mt-1 min-h-[36px] w-full bg-white px-2 text-xs font-sans font-normal"
                  placeholder="Nama barang"
                  aria-label={`Nama barang foto ${k + 1}`}
                  value={ph.label ?? ''}
                  onChange={(e) => onChange(photos.map((x) => (x.id === ph.id ? { ...x, label: e.target.value } : x)))}
                  data-testid={`${testId}-name-${k}`}
                />
              ) : (
                <figcaption className="truncate font-mono text-[10px] text-muted">{ph.name}</figcaption>
              )}
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
      <div className="sticky top-[72px] z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-3 border-ink bg-surface p-3">
        <p className="font-mono text-sm">{r.id}{msg && <span className="ml-2 text-muted">· {msg}</span>}</p>
        <div className="flex flex-wrap gap-2">
          <MenuButton
            primary
            label="Simpan"
            testId="lpj-save"
            items={[
              { key: 'only', label: 'Simpan saja', note: 'tanpa unduh', run: () => void save() },
              ...LPJ_KINDS.map(([k, l]) => ({ key: k, label: l, note: `simpan lalu unduh ${l}`, run: () => void save().then(() => downloadLpj(r, k)) })),
            ]}
          />
          <button type="button" className="btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>

      <TextInput label="Nama laporan (opsional)" value={r.purpose} onChange={(v) => set('purpose', v)} placeholder="Belanja R&D Oktober 2026" testId="lpj-purpose" />

      <Section title="Bukti alokasi" aside={<button type="button" className="btn-ghost" onClick={() => set('proofs', [...r.proofs, blankProof()])} data-testid="lpj-proof-add">+ Toko</button>}>
        {r.proofs.map((p, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-ink/20 p-3" data-testid={`lpj-proof-${i}`}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1"><TextInput label={`Nama toko ${i + 1} (judul)`} value={p.title} onChange={(v) => set('proofs', upd(r.proofs, i, { title: v }))} placeholder="mis. Toko Kimia Jaya" testId={`lpj-proof-title-${i}`} /></div>
              {r.proofs.length > 1 && <button type="button" className="btn-ghost" onClick={() => set('proofs', r.proofs.filter((_, k) => k !== i))}>Hapus toko</button>}
            </div>
            <div><p className="label-mono mb-1">Foto nota / bukti bayar</p><Photos photos={p.receipts} onChange={(v) => set('proofs', upd(r.proofs, i, { receipts: v }))} testId={`lpj-nota-${i}`} /></div>
            <div>
              <p className="label-mono mb-1">Foto barang &amp; nama tiap barang</p>
              <Photos named photos={p.goods} onChange={(v) => set('proofs', upd(r.proofs, i, { goods: v }))} testId={`lpj-barang-${i}`} />
            </div>
            <details className="rounded-xl bg-paper p-3" open={!!(p.total || p.description)}>
              <summary className="cursor-pointer text-sm font-semibold">Total &amp; keterangan (opsional)</summary>
              <div className="mt-2 flex flex-col gap-2">
                <div className="w-48"><TextInput label="Total alokasi (Rp)" value={p.total} onChange={(v) => set('proofs', upd(r.proofs, i, { total: v }))} testId={`lpj-proof-total-${i}`} /></div>
                <p className="text-xs italic text-muted">Terbilang: {terbilang(parseRp(p.total))}</p>
                <TextArea label="Keterangan" value={p.description} onChange={(v) => set('proofs', upd(r.proofs, i, { description: v }))} testId={`lpj-proof-desc-${i}`} />
              </div>
            </details>
          </div>
        ))}
      </Section>

      <Money label="Total seluruh alokasi" n={realizationTotal(r)} />
    </div>
  );
}
