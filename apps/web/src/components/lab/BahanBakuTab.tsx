'use client';

import { useEffect, useRef, useState } from 'react';
import { blankRaw, RAW_ITEMS, researchStatus, variantLabel, variantLines, variantSlots, type DailyEntry, type ProtocolVersion, type RawMaterial, type TreatmentKind } from '@/lib/labStore';
import { Section } from './ui';

/**
 * Menu Bahan Baku (DEC-068): form dalam modal — item/barang, nama barang, berat utuh, air, perlakuan, tebal.
 * Konfirmasi → pindah ke Riset Produk & membuka Resep baru yang sudah terisi bahan baku ini.
 * Varian (Cuka1–10, Bioleather1–10, Kopra1–10) = jalur produk Resep baru; slot terisi otomatis dari resep yang dibuat.
 */
export function BahanBakuTab({ protocols, entries, onConfirm }: { protocols: ProtocolVersion[]; entries: DailyEntry[]; onConfirm: (r: RawMaterial) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Bahan baku" testId="raw-tab" aside={<button type="button" className="btn-primary" onClick={() => setOpen(true)} data-testid="raw-new">+ Bahan baku</button>}>
      <p className="text-sm text-muted">
        Catat bahan baku (item, berat utuh, air, perlakuan air, perlakuan daging, tebal daging mm), lalu tekan <strong>Konfirmasi</strong>: kamu langsung dibawa ke <strong>Riset Produk</strong> dengan resep baru
        yang sudah berisi data bahan baku ini. Perlakuan air: Cuka1–10 / Bioleather1–10. Perlakuan daging: Kopra1–10. Varian yang dipilih otomatis jadi jalur produk di Resep baru, dan semua data ikut terbawa.
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
  const set = <K extends keyof RawMaterial>(k: K, v: RawMaterial[K]) => {
    setR((x) => ({ ...x, [k]: v }));
    setErr('');
  };

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

  // Varian untuk jalur produk: bila hanya satu perlakuan dipilih → otomatis; bila dua-duanya → pengguna memilih.
  const chosen = [r.waterVariant, r.meatVariant].filter(Boolean);
  const jalur = chosen.length === 1 ? chosen[0]! : chosen.includes(r.variant) ? r.variant : '';

  const confirm = () => {
    if (!r.name.trim()) return setErr('Isi nama barang dulu.');
    if (chosen.length > 1 && !jalur) return setErr('Pilih varian mana yang jadi jalur produk resep.');
    onConfirm({ ...r, name: r.name.trim(), variant: jalur });
  };

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
            <input className={`${field} font-sans font-normal`} value={r.name} onChange={(e) => set('name', e.target.value)} placeholder={r.item === 'Arang' ? 'mis. Arang batok lot 12' : 'mis. Kelapa tua butir 1'} data-testid="raw-name" />
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
          <VariantSelect kind="air" value={r.waterVariant} protocols={protocols} entries={entries} onChange={(v) => set('waterVariant', v)} testId="raw-water-variant" />
          <VariantSelect kind="daging" value={r.meatVariant} protocols={protocols} entries={entries} onChange={(v) => set('meatVariant', v)} testId="raw-meat-variant" />
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Tebal daging (mm)</span>
            <input className={field} inputMode="decimal" value={r.meatThickness} onChange={(e) => set('meatThickness', e.target.value)} placeholder="mis. 10,5" data-testid="raw-meat" />
          </label>
          {chosen.length > 1 && (
            <fieldset className="rounded-xl bg-paper p-3" data-testid="raw-jalur">
              <legend className="label-mono px-1">Jalur produk resep baru</legend>
              {chosen.map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="raw-jalur" checked={jalur === v} onChange={() => set('variant', v)} data-testid={`raw-jalur-${v}`} />
                  {variantLabel(v)}
                </label>
              ))}
            </fieldset>
          )}
          {jalur && <p className="text-xs text-muted" data-testid="raw-jalur-info">Jalur produk Resep baru: <strong>{variantLabel(jalur)}</strong> — semua data di atas ikut terbawa.</p>}
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

/** Dropdown varian: perlakuan air = Cuka1–10 & Bioleather1–10; perlakuan daging = Kopra1–10 (terisi otomatis dari Riset Produk). */
export function VariantSelect({ kind, value, protocols, entries, onChange, testId }: {
  kind: TreatmentKind;
  value: string;
  protocols: ProtocolVersion[];
  entries: DailyEntry[];
  onChange: (v: string) => void;
  testId: string;
}) {
  const slots = variantSlots(kind, protocols);
  const picked = slots.find((x) => x.id === value);
  const st = picked?.research && researchStatus(entries.filter((e) => e.experimentId === picked.research!.key));
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-mono">{kind === 'air' ? 'Perlakuan air' : 'Perlakuan daging'}</span>
      <select className={field} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        <option value="">— tidak dipilih —</option>
        {variantLines(kind).map((l) => (
          <optgroup key={l.product} label={l.label}>
            {slots.filter((x) => x.product === l.product).map((x) => (
              <option key={x.id} value={x.id}>{x.label}{x.research ? ` — ${x.research.name}` : ''}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {picked?.research && (
        <span className="text-xs text-muted" data-testid={`${testId}-info`}>
          {picked.label} sudah dipakai: {picked.research.key} &quot;{picked.research.name}&quot; (versi {picked.research.version}, {st === 'selesai' ? 'selesai' : st === 'berjalan' ? 'berjalan' : 'belum ada laporan'}).
        </span>
      )}
    </label>
  );
}
