/**
 * Form "Input barang masuk dan barang keluar" di halaman Gudang (DEC-130): pilih gudang → barang/item → berat (kg)
 * → volume & luas lantai otomatis. Angka hanya dari dataset:
 * - `inv`: densitas curah dataset inventori (kelapa jambul, arang batok) lewat engine gudang;
 * - `carton`: master box briket dataset rantai (C13, keyakinan C) — volume = jumlah box × dimensi box;
 * - `none`: dataset belum punya densitas/kemasan → volume & luas lantai belum bisa dihitung (tidak dikarang).
 */
export type GudangCalc =
  | { kind: 'inv'; commodityId: string; formCode: string }
  | { kind: 'carton'; cartonId: string }
  | { kind: 'none'; reason: string };

export interface GudangItem {
  id: string;
  label: string;
  calc: GudangCalc;
}

export interface Gudang {
  id: string;
  label: string;
  items: GudangItem[];
}

/** Master box acuan briket: 10 kg, kubus 25 mm (dataset rantai). Bisa diganti di pengaturan. */
export const DEFAULT_CARTON = 'mb10_c25';
const NO_DATA = 'Dataset belum punya densitas atau ukuran kemasan untuk barang ini.';
const carton: GudangCalc = { kind: 'carton', cartonId: DEFAULT_CARTON };

export const GUDANG: Gudang[] = [
  { id: 'kopra', label: 'Gudang Kopra', items: [{ id: 'kelapa_jambul', label: 'Kelapa jambul', calc: { kind: 'inv', commodityId: 'kelapa_jambul', formCode: 'loose' } }] },
  { id: 'arang', label: 'Gudang Arang Batok', items: [{ id: 'arang_batok', label: 'Arang batok', calc: { kind: 'inv', commodityId: 'arang_batok_belah2', formCode: 'lumps' } }] },
  {
    id: 'briket',
    label: 'Gudang Briket',
    items: [
      { id: 'coconut_shell_charcoal', label: 'Coconut Shell Charcoal', calc: { kind: 'inv', commodityId: 'arang_batok_belah2', formCode: 'lumps' } },
      { id: 'coconut_charcoal_powder', label: 'Coconut Charcoal Powder', calc: { kind: 'none', reason: NO_DATA } },
      { id: 'biochar', label: 'Biochar & Char Residues', calc: { kind: 'none', reason: NO_DATA } },
      { id: 'sisha', label: 'Sisha Briquettes', calc: carton },
      { id: 'bbq', label: 'BBQ Briquettes', calc: carton },
      { id: 'hexa', label: 'Hexa Briquettes', calc: carton },
      { id: 'pillow', label: 'Pillow Briquettes', calc: carton },
      { id: 'custom', label: 'Custom Moldings', calc: carton },
    ],
  },
  { id: 'bioleather', label: 'Gudang Bio Leather', items: [{ id: 'bio_leather', label: 'Bio leather', calc: { kind: 'none', reason: NO_DATA } }] },
  { id: 'cuka', label: 'Gudang Cuka', items: [{ id: 'cuka', label: 'Cuka air kelapa', calc: { kind: 'none', reason: NO_DATA } }] },
];

export const gudangOf = (id: string) => GUDANG.find((g) => g.id === id) ?? GUDANG[0]!;

/**
 * Gudang & barang untuk komoditas dari tautan bagikan lama (?s=): kopra_* tidak ada di daftar baru → ditambahkan sebagai
 * barang tambahan di Gudang Kopra agar tautan lama tetap bisa dibuka.
 */
export function selectionFor(commodityId: string, formCode: string, label: string): { gudang: string; item: GudangItem } {
  for (const g of GUDANG) {
    const it = g.items.find((i) => i.calc.kind === 'inv' && i.calc.commodityId === commodityId && i.calc.formCode === formCode);
    if (it) return { gudang: g.id, item: it };
  }
  const gudang = commodityId.startsWith('arang') ? 'arang' : 'kopra';
  return { gudang, item: { id: `${commodityId}.${formCode}`, label, calc: { kind: 'inv', commodityId, formCode } } };
}
