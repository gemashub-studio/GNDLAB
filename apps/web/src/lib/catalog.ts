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
  kelapa_jambul: { short: 'Kelapa jambul', pieceUnit: 'butir', blurb: 'Kelapa tua, sabut dikupas kecuali jambul. Dijual per butir, dikemas karung jaring.' },
  arang_batok_belah2: { short: 'Arang batok', pieceUnit: 'keping', blurb: 'Arang tempurung: belah 2 utuh (ringan, makan tempat) atau lump/pecah (lebih padat).' },
  kopra_asalan: { short: 'Kopra asalan', pieceUnit: 'potong', blurb: 'Kopra asap mutu petani. Kadar air tinggi → berat berubah & risiko panas sendiri.' },
  kopra_edible: { short: 'Kopra edible', pieceUnit: 'potong', blurb: 'Kopra putih mutu pangan (cup). Jangan disimpan bersama kopra asalan.' },
};

export const FORM_UI: Record<string, { label: string; hint: string }> = {
  'kelapa_jambul.bagged': { label: 'Dalam karung jaring', hint: 'Cara muat ekspor umum. Densitas efektif sudah termasuk karung & rongga.' },
  'kelapa_jambul.loose': { label: 'Lepas / curah', hint: 'Tumpukan tanpa karung (data lab). Biasanya untuk gudang, bukan container.' },
  'arang_batok_belah2.lumps': { label: 'Lump / pecah', hint: 'Bentuk dagang paling umum. Di 40HC biasanya BERAT yang habis duluan.' },
  'arang_batok_belah2.halves_loose': { label: 'Belah 2 utuh — lepas', hint: 'Densitas masih ESTIMASI (C). Lakukan uji kotak volume sebelum memesan container.' },
  'arang_batok_belah2.halves_nested': { label: 'Belah 2 utuh — bersarang', hint: 'Disusun saling masuk. Lebih padat dari lepas, tetapi masih estimasi (C).' },
  'arang_batok_belah2.raw_halves': { label: 'Batok mentah belah', hint: 'Batok belum dibakar (bukan arang). Ringan & berongga.' },
  'kopra_asalan.bagged_jute': { label: 'Karung goni', hint: 'Karung goni. Ada celah antarkarung, jadi ruang tidak terisi penuh.' },
  'kopra_asalan.loose_bulk': { label: 'Curah', hint: 'Tanpa karung. Ikuti aturan muatan curah UN 1363 (bisa panas sendiri).' },
  'kopra_edible.bagged': { label: 'Dalam karung', hint: 'Densitas efektif diturunkan dari benchmark muat pasar (sudah termasuk karung & rongga).' },
  'kopra_edible.loose_cups': { label: 'Cup lepas', hint: 'Tanpa karung. Densitas masih estimasi (C).' },
};

export const formLabel = (commodityId: string, formCode: string) =>
  FORM_UI[`${commodityId}.${formCode}`]?.label ?? formCode;

export const MODE_UI: Record<CalcMode, { label: string; hint: string }> = {
  BULK: { label: 'Berat curah', hint: 'Hitung TON dari volume × densitas. Cocok untuk muatan curah/karung.' },
  PIECE: { label: 'Per butir', hint: 'Hitung jumlah BUTIR/KEPING dari volume × densitas ÷ berat per butir.' },
  PACKAGE: { label: 'Per karung', hint: 'Hitung jumlah KARUNG yang muat disusun rapi (grid), dibatasi payload.' },
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
