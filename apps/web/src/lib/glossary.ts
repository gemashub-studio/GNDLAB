/**
 * Glosarium untuk hint "?" & halaman Panduan. Bahasa santai ala obrolan di gudang (DEC-027),
 * bukan rumus. Angka ambang diambil dari konstanta engine, bukan diketik ulang.
 */
import { CEILING_CLEARANCE_M, DEFAULT_FLOOR_UTIL, SELF_HEATING_MOISTURE } from '@gemas/calc-engine';
import { fmt } from './format';

const floorPct = fmt(DEFAULT_FLOOR_UTIL * 100);
const heatPct = fmt(SELF_HEATING_MOISTURE * 100);

export interface GlossaryEntry {
  term: string;
  short: string;
  long?: string;
}

export const GLOSSARY = {
  binding: {
    term: 'Batas pengikat',
    short: 'Mana yang habis duluan: ruangnya penuh, atau beratnya sudah mentok.',
    long: 'VOLUME = container sudah penuh sesak tapi masih kuat — biasa terjadi di barang ringan kayak kelapa & arang belah 2. BERAT = ruang masih sisa tapi muatan sudah sampai batas maksimal container — biasa di arang lump yang padat.',
  },
  confidence: {
    term: 'Huruf A / B / C',
    short: 'Seberapa yakin angkanya: A diukur, B dari pedagang, C masih kira-kira.',
    long: 'Hasil hitungan ikut huruf yang paling lemah dari angka yang dipakai. Kalau dapat C, anggap sebagai perkiraan awal — timbang/ukur sendiri dulu sebelum pesan container.',
  },
  range: {
    term: 'Rentang min–maks',
    short: 'Kelapa kan nggak ada yang persis sama — ini hasil paling sedikit & paling banyak yang masuk akal.',
    long: 'Aplikasi mencoba semua kombinasi ujung (butir paling berat/ringan, tumpukan paling padat/longgar). Pita hitam = rentangnya, garis oranye = angka yang paling sering terjadi.',
  },
  density: {
    term: 'Kepadatan (ρ)',
    short: 'Berapa kg barang yang muat di 1 m³, rongganya ikut dihitung.',
    long: 'Barang yang sama bisa beda kepadatannya: ditumpuk lepas, dikarungin, atau disusun masuk-masukan (bersarang).',
  },
  util: {
    term: 'Ruang yang terpakai',
    short: 'Berapa bagian ruang container yang beneran terisi barang.',
    long: 'Contoh: arang lump dalam karung nggak bisa ngisi 100% ruang karena ada celah antarkarung. Kalau kepadatannya sudah "dalam container", isinya dianggap 100%.',
  },
  floorUtil: {
    term: 'Lantai yang terpakai',
    short: 'Bagian lantai gudang buat tumpukan; sisanya buat lorong & sirkulasi udara.',
    long: `Default ${fmt(DEFAULT_FLOOR_UTIL, 2)} artinya ${floorPct}% lantai buat barang, sisanya buat jalan, forklift, dan angin-anginan.`,
  },
  stackHeight: {
    term: 'Tinggi tumpukan',
    short: 'Seberapa tinggi barang ditumpuk (bukan tinggi atap gudang).',
    long: `Sisakan minimal ${fmt(CEILING_CLEARANCE_M, 1)} m di bawah atap buat ventilasi. Kopra & arang jangan ditumpuk kelewat tinggi — bisa panas & berat.`,
  },
  moisture: {
    term: 'Kadar air',
    short: `Seberapa basah barangnya. Kopra di atas ${heatPct}% gampang panas sendiri & jamuran.`,
    long: 'Waktu kopra dikeringkan, beratnya turun karena airnya hilang — bagian keringnya tetap. Jadi berat baru = berat lama × (1 − air lama) ÷ (1 − air baru).',
  },
  benchmark: {
    term: 'Pembanding pasar',
    short: 'Angka muat yang dilaporkan eksportir/pembeli — buat pembanding.',
    long: 'Kalau hasilnya beda jauh, cek bentuk barang, ukuran karung, dan kepadatannya. Satu laporan yang angkanya jauh lebih rendah sengaja ditampilkan sebagai peringatan.',
  },
  grid: {
    term: 'Gambar simulasi',
    short: 'Gambarnya perkiraan yang dirapikan, bukan posisi barang yang sebenarnya.',
  },
  override: {
    term: 'Ubah angka',
    short: 'Pakai hasil ukurmu sendiri. Data asli nggak ikut berubah.',
    long: 'Angka yang terlalu jauh (kurang dari setengah minimum atau lebih dari dua kali maksimum) ditolak, biar nggak salah ketik.',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
