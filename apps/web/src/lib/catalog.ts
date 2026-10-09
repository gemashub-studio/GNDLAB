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

/** Label parameter berbahasa gudang (hanya teks; nilai dari dataset). */
const PARAM_UI: Record<string, string> = {
  bulk_density: 'Densitas curah',
  true_density: 'Densitas padat',
  moisture: 'Kadar air',
  oil_content: 'Kadar minyak',
  mass_per_unit: 'Berat per butir',
  'mass_per_unit.raw_half_shell': 'Berat per batok mentah',
  'mass_per_unit.charcoal_half': 'Berat per keping arang',
  mass_per_piece: 'Berat per potong',
  charcoal_yield_mass_fraction: 'Rendemen arang (berat)',
  packing_fraction_random: 'Fraksi isi acak',
  'yield.nuts_per_kg_copra': 'Butir per kg kopra',
  'yield.copra_per_nut': 'Kopra per butir',
  'geometry.nest_pitch': 'Jarak susun bersarang',
  'geometry.linear_shrinkage_on_carbonization': 'Susut dimensi saat dibakar',
  'geometry.tuft_extra_length': 'Panjang jambul',
  'geometry.body.length_polar': 'Panjang buah',
  'geometry.body.diameter_equatorial': 'Diameter buah',
  'geometry.circumference': 'Keliling buah',
  'geometry.solid_volume': 'Volume padat per butir',
};
const GEOM_PART: Record<string, string> = {
  raw_half_shell: 'batok mentah',
  charcoal_half: 'keping arang',
  piece: 'potongan',
};
const GEOM_DIM: Record<string, string> = {
  wall_thickness: 'Tebal dinding',
  rim_diameter: 'Diameter bibir',
  depth: 'Kedalaman',
  thickness: 'Tebal',
  width: 'Lebar',
  length: 'Panjang',
  rim_diameter_or_length: 'Diameter / panjang',
  depth_or_width: 'Kedalaman / lebar',
};

export function paramLabel(key: string): string {
  if (PARAM_UI[key]) return PARAM_UI[key];
  const m = /^geometry\.(raw_half_shell|charcoal_half|piece)\.(.+)$/.exec(key);
  if (m && GEOM_DIM[m[2]!]) return `${GEOM_DIM[m[2]!]} ${GEOM_PART[m[1]!]}`;
  return key;
}

/**
 * Prioritas sampling (CLAUDE_CODE_PROMPT §4 M4, logs/assumption_register.md): risiko tertinggi dulu.
 * Kunci alami `komoditas|bentuk|parameter`; cara ukur = teks register (bukan angka).
 */
export const SAMPLING_PRIORITY: { asm: string; key: string; how: string; method: string }[] = [
  { asm: 'ASM-06', key: 'kelapa_jambul|bagged|bulk_density', how: 'Catat realisasi muat tiap container (jumlah butir/karung & berat).', method: 'realisasi_stuffing' },
  { asm: 'ASM-01', key: 'arang_batok_belah2|halves_loose|bulk_density', how: 'Isi kotak/ember bervolume terukur (≥ 0,2 m³) dengan keping lepas, timbang, ulangi.', method: 'ember_1m3' },
  { asm: 'ASM-02', key: 'arang_batok_belah2|halves_nested|bulk_density', how: 'Susun keping bersarang dalam kotak, timbang, ulangi.', method: 'ember_1m3' },
];
