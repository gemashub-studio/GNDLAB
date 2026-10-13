'use client';

import { useEffect, useRef, useState } from 'react';
import { blankRaw, knowledgeFor, knowledgeLines, RAW_ITEMS, researchStatus, type DailyEntry, type ProtocolVersion, type RawMaterial } from '@/lib/labStore';
import { Section } from './ui';

/**
 * Menu Bahan Baku (DEC-068): form dalam modal — item/barang, nama barang, berat utuh, air, perlakuan, tebal.
 * Konfirmasi → pindah ke Riset Produk & membuka Resep baru yang sudah terisi bahan baku ini.
 * "Knowledge" = riset produk milik pengguna sendiri (maks. 5 terbaru per jalur), bukan angka buatan.
 */
export function BahanBakuTab({ protocols, entries, onConfirm }: { protocols: ProtocolVersion[]; entries: DailyEntry[]; onConfirm: (r: RawMaterial) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Bahan baku" testId="raw-tab" aside={<button type="button" className="btn-primary" onClick={() => setOpen(true)} data-testid="raw-new">+ Bahan baku</button>}>
      <p className="text-sm text-muted">
        Catat bahan baku (item, berat utuh, air, perlakuan, tebal), lalu tekan <strong>Konfirmasi</strong>: kamu langsung dibawa ke <strong>Riset Produk</strong> dengan resep baru
        yang sudah berisi data bahan baku ini. Perlakuan air menampilkan riset Cuka &amp; Bioleather-mu sebagai rujukan; tebal daging menampilkan riset Kopra.
      </p>
      {open && <RawModal protocols={protocols} entries={entries} onClose={() => setOpen(false)} onConfirm={(r) => { setOpen(false); onConfirm(r); }} />}
    </Section>
  );
}

const field = 'field min-h-[44px] text-sm';

function RawModal({ protocols, entries, onClose, onConfirm }: { protocols: ProtocolVersion[]; entries: DailyEntry[]; onClose: () => void; onConfirm: (r: RawMaterial) => void }) {
  const [r, setR] = useState<RawMaterial>(blankRaw());
  const [err, setErr] = useState('');
  const first = useRef<HTMLSelectElement>(null);
  const set = <K extends keyof RawMaterial>(k: K, v: RawMaterial[K]) => setR((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    first.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const confirm = () => {
    if (!r.name.trim()) return setErr('Isi nama barang dulu.');
    onConfirm({ ...r, name: r.name.trim() });
  };
  const lines = knowledgeLines(r);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Form bahan baku" data-testid="raw-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-paper-grid px-5 py-4">
          <h2 className="text-lg">Bahan baku</h2>
          <button type="button" className="font-mono text-sm underline" onClick={onClose}>Batal</button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Item / barang</span>
            <select ref={first} className={field} value={r.item} onChange={(e) => set('item', e.target.value)} data-testid="raw-item">
              {RAW_ITEMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Barang</span>
            <input className={`${field} font-sans font-normal`} value={r.name} onChange={(e) => { set('name', e.target.value); setErr(''); }} placeholder={r.item === 'Arang' ? 'mis. Arang batok lot 12' : 'mis. Kelapa tua butir 1'} data-testid="raw-name" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Berat utuh (g)</span>
              <input className={field} inputMode="decimal" value={r.wholeWeight} onChange={(e) => set('wholeWeight', e.target.value)} data-testid="raw-whole" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Air (mL)</span>
              <input className={field} inputMode="decimal" value={r.water} onChange={(e) => set('water', e.target.value)} data-testid="raw-water" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Perlakuan</span>
              <select className={field} value={r.treatment} onChange={(e) => set('treatment', e.target.value as RawMaterial['treatment'])} data-testid="raw-treatment">
                <option value="">— pilih —</option>
                <option value="air">Perlakuan air</option>
                <option value="daging">Perlakuan daging</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Tebal</span>
              <select className={field} value={r.thickness} onChange={(e) => set('thickness', e.target.value as RawMaterial['thickness'])} data-testid="raw-thickness">
                <option value="">— tidak diisi —</option>
                <option value="tebal-daging">Tebal daging</option>
              </select>
            </label>
          </div>
          {r.thickness === 'tebal-daging' && (
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Tebal daging (mm)</span>
              <input className={field} inputMode="decimal" value={r.meatThickness} onChange={(e) => set('meatThickness', e.target.value)} placeholder="boleh diisi nanti di resep" data-testid="raw-meat" />
            </label>
          )}
          {lines.map((l) => (
            <KnowledgeList key={l.product} label={l.label} product={l.product} protocols={protocols} entries={entries} picked={r.refKeys} onToggle={(k) => set('refKeys', r.refKeys.includes(k) ? r.refKeys.filter((x) => x !== k) : [...r.refKeys, k])} />
          ))}
          {err && <p className="text-sm"><span className="bg-safety px-1">{err}</span></p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-paper-grid px-5 py-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          <button type="button" className="btn-primary" onClick={confirm} data-testid="raw-confirm">Konfirmasi</button>
        </div>
      </div>
    </div>
  );
}

/** Daftar "Cuka 1–5" / "Bioleather 1–5" / "Kopra 1–5" = riset produk pengguna (maks. 5 terbaru), bisa dicentang sebagai rujukan. */
export function KnowledgeList({ label, product, protocols, entries, picked, onToggle }: { label: string; product: string; protocols: ProtocolVersion[]; entries: DailyEntry[]; picked: string[]; onToggle: (key: string) => void }) {
  const list = knowledgeFor(product, protocols);
  return (
    <fieldset className="rounded-xl bg-paper p-3" data-testid={`raw-kn-${product}`}>
      <legend className="label-mono px-1">Knowledge · {label} 1–5</legend>
      {list.length ? (
        <ul className="flex flex-col gap-1.5">
          {list.map((p, i) => {
            const st = researchStatus(entries.filter((e) => e.experimentId === p.key));
            return (
              <li key={p.key}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={picked.includes(p.key)} onChange={() => onToggle(p.key)} data-testid={`raw-kn-pick-${p.key}`} />
                  <span>
                    <span className="font-semibold">{label} {i + 1}</span> — {p.name} <span className="font-mono text-[11px] text-muted">({p.key} · versi {p.version} · {st === 'selesai' ? 'selesai' : st === 'berjalan' ? 'berjalan' : 'belum ada laporan'})</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm italic text-muted">Belum ada riset {label} tersimpan — knowledge muncul setelah kamu menyelesaikan resep {label}.</p>
      )}
    </fieldset>
  );
}
