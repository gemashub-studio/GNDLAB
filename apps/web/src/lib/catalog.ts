/**
 * Label & teks UI berbahasa gudang untuk komoditas/form/mode. Hanya TEKS — semua angka
 * (densitas, massa, dimensi) diambil dari dataset lewat @gemas/dataset.
 */
import type { CalcMode } from '@gemas/calc-engine';

export interface CommodityUi {
  short: string;
  /** Satuan butir/keping untuk mode PIECE. */
  pieceUnit: string;
  blurb: string;
}

export const COMMODITY_UI: Record<string, CommodityUi> = {
  kelapa_jambul: { short: 'Kelapa jambul', pieceUnit: 'butir', blurb: 'Kelapa tua, sabutnya dikupas tapi jambulnya disisakan. Dijual per butir, masuk karung jaring.' },
  arang_batok_belah2: { short: 'Arang batok', pieceUnit: 'keping', blurb: 'Arang dari batok: belah 2 utuh (ringan tapi makan tempat) atau lump/pecah (lebih padat).' },
  kopra_asalan: { short: 'Kopra asalan', pieceUnit: 'potong', blurb: 'Kopra asap dari petani. Masih agak basah, jadi beratnya bisa berubah & gampang panas sendiri.' },
  kopra_edible: { short: 'Kopra edible', pieceUnit: 'potong', blurb: 'Kopra putih kualitas pangan. Jangan disimpan bareng kopra asalan, nanti bau asapnya nempel.' },
};

export const FORM_UI: Record<string, { label: string; hint: string }> = {
  'kelapa_jambul.bagged': { label: 'Dalam karung jaring', hint: 'Cara muat ekspor yang paling umum. Hitungannya sudah termasuk karung & rongga.' },
  'kelapa_jambul.loose': { label: 'Lepas / curah', hint: 'Ditumpuk tanpa karung. Biasanya buat di gudang, bukan buat container.' },
  'arang_batok_belah2.lumps': { label: 'Lump / pecah', hint: 'Bentuk yang paling sering dijual. Di container 40 ft HC biasanya beratnya yang mentok duluan.' },
  'arang_batok_belah2.halves_loose': { label: 'Belah 2 utuh — lepas', hint: 'Angkanya masih kira-kira (C). Coba isi kotak/ember 1 m³ lalu timbang dulu sebelum pesan container.' },
  'arang_batok_belah2.halves_nested': { label: 'Belah 2 utuh — bersarang', hint: 'Disusun masuk-masukan. Lebih padat dari yang lepas, tapi angkanya masih kira-kira (C).' },
  'arang_batok_belah2.raw_halves': { label: 'Batok mentah belah', hint: 'Batok yang belum dibakar (belum jadi arang). Ringan & banyak rongga.' },
  'kopra_asalan.bagged_jute': { label: 'Karung goni', hint: 'Karung goni. Ada celah di antara karung, jadi ruangnya nggak keisi penuh.' },
  'kopra_asalan.loose_bulk': { label: 'Curah', hint: 'Tanpa karung. Ikuti aturan muatan curah UN 1363 — kopra bisa panas sendiri.' },
  'kopra_edible.bagged': { label: 'Dalam karung', hint: 'Angkanya diambil dari laporan muat eksportir, sudah termasuk karung & rongga.' },
  'kopra_edible.loose_cups': { label: 'Cup lepas', hint: 'Tanpa karung. Angkanya masih kira-kira (C).' },
};

export const formLabel = (commodityId: string, formCode: string) =>
  FORM_UI[`${commodityId}.${formCode}`]?.label ?? formCode;

export const MODE_UI: Record<CalcMode, { label: string; hint: string }> = {
  BULK: { label: 'Hitung ton', hint: 'Hasilnya dalam ton. Cocok buat muatan curah atau karungan.' },
  PIECE: { label: 'Hitung butir', hint: 'Hasilnya jumlah butir/keping yang muat.' },
  PACKAGE: { label: 'Hitung karung', hint: 'Hasilnya jumlah karung kalau disusun rapi, sampai batas berat container.' },
};

export const CONTAINER_UI: Record<string, string> = {
  '20GP': '20 kaki standar',
  '40GP': '40 kaki standar',
  '40HC': '40 kaki high cube (lebih tinggi)',
};

export const PACK_UI: Record<string, string> = {
  PP_net_bag: 'Karung jaring PP',
  PP_woven_bag: 'Karung PP woven',
  jumbo_bag: 'Jumbo bag',
  jute_or_PP_bag: 'Karung goni / PP',
  PP_or_jute_net_bag: 'Karung jaring PP / goni',
};
