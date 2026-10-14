'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addRaw, type RawRecord } from '@/lib/bahanBaku';
import {
  blankRaw,
  isCoconutItem,
  missingRawFields,
  RAW_ITEMS,
  researchStatus,
  variantLabel,
  variantLines,
  variantSlots,
  type DailyEntry,
  type ProtocolVersion,
  type RawMaterial,
  type TreatmentKind,
} from '@/lib/labStore';
import { Dropdown, type DropdownOption } from './Dropdown';
import { Section } from './ui';

/** Keterangan perlakuan (owner 2026-10-14) — tampil sebagai tooltip saat kolom perlakuan diklik. */
export const TREATMENT_HINT = 'Perlakuan = jumlah uji coba yang akan dilakukan. Mis. Cuka3 = uji coba ke-3 jalur cuka.';
const REDIRECT_MS = 1400;

/**
 * Menu Bahan Baku (DEC-068/069/071): form modal → Konfirmasi menyimpan catatan bahan baku, menampilkan
 * "Sebentar ya, lagi disiapin." lalu pindah ke Riset Produk dengan Resep baru yang sudah terisi.
 */
export function BahanBakuTab({ protocols, entries, records, onSaved, onConfirm }: {
  protocols: ProtocolVersion[];
  entries: DailyEntry[];
  records: RawRecord[];
  onSaved: () => Promise<void>;
  onConfirm: (r: RawMaterial) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<RawRecord>();

  const confirm = async (r: RawMaterial) => {
    const rec = await addRaw(r);
    setOpen(false);
    setBusy(rec);
    await onSaved();
    window.setTimeout(() => {
      setBusy(undefined);
      onConfirm(r);
    }, REDIRECT_MS);
  };

  return (
    <Section title={`Bahan baku (${records.length})`} testId="raw-tab" aside={<button type="button" className="btn-primary" onClick={() => setOpen(true)} data-testid="raw-new">+ Bahan baku</button>}>
      <p className="text-sm text-muted">
        Catat bahan baku, lalu tekan <strong>Konfirmasi</strong>: kamu dibawa ke <strong>Riset Produk</strong> dengan resep baru yang sudah berisi data ini. Perlakuan air: Cuka1–10 / Bioleather1–10.
        Perlakuan daging: Kopra1–10. Varian yang dipilih otomatis jadi jalur produk.
      </p>
      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm" data-testid="raw-list">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase text-muted">
                <th className="py-1.5 pr-3">Kode</th>
                <th className="pr-3">Item</th>
                <th className="pr-3">Barang</th>
                <th className="pr-3">Berat utuh (g)</th>
                <th className="pr-3">Air (mL)</th>
                <th className="pr-3">Perlakuan</th>
                <th>Tebal (mm)</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-paper-grid align-top">
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.id}</td>
                  <td className="pr-3">{r.item}</td>
                  <td className="pr-3">{r.name}</td>
                  <td className="pr-3 font-mono">{r.wholeWeight || '–'}</td>
                  <td className="pr-3 font-mono">{r.water || '–'}</td>
                  <td className="pr-3">{[r.waterVariant, r.meatVariant].filter(Boolean).map(variantLabel).join(', ') || '–'}</td>
                  <td className="font-mono">{r.meatThickness || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm italic text-muted">Belum ada bahan baku tercatat.</p>
      )}
      {open && <RawModal protocols={protocols} entries={entries} onClose={() => setOpen(false)} onConfirm={(r) => void confirm(r)} />}
      {busy && <PreparingAlert rec={busy} />}
    </Section>
  );
}

/** Kartu melayang: sukses + spinner "Sebentar ya, lagi disiapin." sebelum pindah ke Riset Produk. */
function PreparingAlert({ rec }: { rec: RawRecord }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4" role="status" aria-live="polite" data-testid="raw-preparing">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-acid/40 bg-white px-4 py-3 shadow-2xl">
        <span aria-hidden className="h-6 w-6 flex-none animate-spin rounded-full border-[3px] border-acid border-t-transparent" />
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">Bahan baku tersimpan ({rec.id})</span>
          <span className="text-sm text-muted">Sebentar ya, lagi disiapin.</span>
        </span>
      </div>
    </div>,
    document.body,
  );
}

const field = 'field min-h-[44px] text-sm bg-white';

function variantOptions(kind: TreatmentKind, protocols: ProtocolVersion[]): DropdownOption[] {
  const slots = variantSlots(kind, protocols);
  return [
    { value: '', label: '— tidak dipilih —' },
    ...variantLines(kind).flatMap((l) =>
      slots.filter((x) => x.product === l.product).map((x) => ({ value: x.id, label: x.label, group: l.label, ...(x.research && { note: x.research.name }) })),
    ),
  ];
}

/**
 * Modal form bahan baku. Tidak mengunci gulir halaman: modal diletakkan di dokumen pada posisi gulir saat
 * dibuka (bukan kotak tetap ber-scroll sendiri), jadi seluruh isi terlihat dan halaman tetap bisa digulir.
 */
function RawModal({ protocols, entries, onClose, onConfirm }: { protocols: ProtocolVersion[]; entries: DailyEntry[]; onClose: () => void; onConfirm: (r: RawMaterial) => void }) {
  const [r, setR] = useState<RawMaterial>(blankRaw());
  const [err, setErr] = useState('');
  const [top, setTop] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const set = <K extends keyof RawMaterial>(k: K, v: RawMaterial[K]) => {
    setR((x) => ({ ...x, [k]: v }));
    setErr('');
  };

  useLayoutEffect(() => setTop(window.scrollY + 80), []);
  useEffect(() => {
    card.current?.querySelector<HTMLElement>('[role=combobox]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const coconut = isCoconutItem(r.item);
  const chosen = [r.waterVariant, r.meatVariant].filter(Boolean);
  const jalur = chosen.length === 1 ? chosen[0]! : chosen.includes(r.variant) ? r.variant : '';
  const usedInfo = (id: string) => {
    const s = id ? variantSlots(id.startsWith('KE-') ? 'daging' : 'air', protocols).find((x) => x.id === id) : undefined;
    if (!s?.research) return null;
    const st = researchStatus(entries.filter((e) => e.experimentId === s.research!.key));
    return `${s.label} sudah dipakai: ${s.research.key} "${s.research.name}" (versi ${s.research.version}, ${st === 'selesai' ? 'selesai' : st === 'berjalan' ? 'berjalan' : 'belum ada laporan'}).`;
  };

  const confirm = () => {
    const miss = missingRawFields(r);
    if (miss.length) return setErr(`Wajib diisi: ${miss.join(', ')}.`);
    if (chosen.length > 1 && !jalur) return setErr('Pilih varian mana yang jadi jalur produk resep.');
    onConfirm({ ...r, name: r.name.trim(), variant: jalur });
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[45] bg-ink/50" onClick={onClose} aria-hidden data-testid="raw-backdrop" />
      <div className="absolute inset-x-0 z-50 flex justify-center px-3 pb-10 sm:px-4" style={{ top }}>
        <div ref={card} role="dialog" aria-modal="true" aria-label="Form bahan baku" className="w-full max-w-lg rounded-2xl bg-surface shadow-2xl" data-testid="raw-modal">
          <div className="flex items-center justify-between border-b border-paper-grid px-5 py-4">
            <h2 className="text-lg">Bahan baku</h2>
            <button type="button" className="font-mono text-sm underline" onClick={onClose}>Batal</button>
          </div>
          <div className="flex flex-col gap-4 px-5 py-4">
            <Dropdown label="Item / barang" required testId="raw-item" value={r.item} onChange={(v) => set('item', v)} options={RAW_ITEMS.map((i) => ({ value: i, label: i }))} />
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Barang <span className="text-safety" aria-hidden>*</span></span>
              <input className={`${field} font-sans font-normal`} value={r.name} onChange={(e) => set('name', e.target.value)} placeholder={coconut ? 'mis. Kelapa tua butir 1' : `mis. ${r.item} lot 12`} data-testid="raw-name" />
            </label>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="label-mono">Berat utuh (g) <span className="text-safety" aria-hidden>*</span></span>
                <input className={field} inputMode="decimal" value={r.wholeWeight} onChange={(e) => set('wholeWeight', e.target.value)} data-testid="raw-whole" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label-mono">
                  Air (mL) {coconut ? <span className="text-safety" aria-hidden>*</span> : <span className="normal-case tracking-normal text-muted">(opsional)</span>}
                </span>
                <input className={field} inputMode="decimal" value={r.water} onChange={(e) => set('water', e.target.value)} data-testid="raw-water" />
              </label>
            </div>
            <Dropdown label="Perlakuan air" optional hint={TREATMENT_HINT} testId="raw-water-variant" value={r.waterVariant} onChange={(v) => set('waterVariant', v)} options={variantOptions('air', protocols)} />
            {usedInfo(r.waterVariant) && <p className="-mt-2 text-xs text-muted" data-testid="raw-water-variant-info">{usedInfo(r.waterVariant)}</p>}
            <Dropdown label="Perlakuan daging" {...(coconut ? { required: true } : { optional: true })} hint={TREATMENT_HINT} testId="raw-meat-variant" value={r.meatVariant} onChange={(v) => set('meatVariant', v)} options={variantOptions('daging', protocols)} />
            {usedInfo(r.meatVariant) && <p className="-mt-2 text-xs text-muted" data-testid="raw-meat-variant-info">{usedInfo(r.meatVariant)}</p>}
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">
                Tebal daging (mm) {coconut ? <span className="text-safety" aria-hidden>*</span> : <span className="normal-case tracking-normal text-muted">(opsional)</span>}
              </span>
              <input className={field} inputMode="decimal" value={r.meatThickness} onChange={(e) => set('meatThickness', e.target.value)} placeholder="mis. 10,5" data-testid="raw-meat" />
            </label>
            {chosen.length > 1 && (
              <fieldset className="rounded-xl bg-paper p-3" data-testid="raw-jalur">
                <legend className="label-mono px-1">Jalur produk resep baru</legend>
                {chosen.map((v) => (
                  <label key={v} className="flex min-h-[36px] items-center gap-2 text-sm">
                    <input type="radio" name="raw-jalur" checked={jalur === v} onChange={() => set('variant', v)} data-testid={`raw-jalur-${v}`} />
                    {variantLabel(v)}
                  </label>
                ))}
              </fieldset>
            )}
            {jalur && <p className="text-xs text-muted" data-testid="raw-jalur-info">Jalur produk Resep baru: <strong>{variantLabel(jalur)}</strong> — semua data di atas ikut terbawa.</p>}
            {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-paper-grid px-5 py-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
            <button type="button" className="btn-primary" onClick={confirm} data-testid="raw-confirm">Konfirmasi</button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
