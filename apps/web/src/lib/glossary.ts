/**
 * Glosarium untuk hint "?" & halaman Panduan. Bahasa gudang, bukan rumus (ux_spec §1.4).
 * Angka ambang diambil dari konstanta engine, bukan diketik ulang.
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
    short: 'Apa yang habis duluan: RUANG (volume) atau BERAT (payload).',
    long: 'Kalau VOLUME, container sudah penuh tapi masih kuat menampung berat — barang ringan seperti kelapa & arang belah 2. Kalau BERAT, ruang masih tersisa tetapi batas muatan container/jalan sudah tercapai — barang padat seperti arang lump di 40HC.',
  },
  confidence: {
    term: 'Keyakinan data A/B/C',
    short: 'A = terukur (jurnal/standar) · B = data dagang · C = estimasi, wajib dicek di lapangan.',
    long: 'Setiap angka default punya tingkat keyakinan. Hasil memakai tingkat yang paling lemah dari angka yang dipakai. Kalau C, anggap sebagai perkiraan awal dan lakukan sampling sebelum memesan container.',
  },
  range: {
    term: 'Rentang min–maks',
    short: 'Hasil terkecil & terbesar yang masuk akal, karena barang alam bervariasi.',
    long: 'Aplikasi menghitung semua kombinasi ujung rentang (berat butir terberat/teringan, densitas terpadat/terlonggar). Pita hitam = rentang, garis oranye = nilai tipikal yang dipakai sebagai jawaban utama.',
  },
  density: {
    term: 'Densitas curah (ρ)',
    short: 'Berapa kg yang muat dalam 1 m³ tumpukan, termasuk rongga.',
    long: 'Berbeda dengan berat jenis benda padat. Bentuk yang sama bisa punya densitas berbeda: lepas, dalam karung, atau bersarang.',
  },
  util: {
    term: 'Utilisasi ruang',
    short: 'Bagian ruang container yang benar-benar terisi barang.',
    long: 'Contoh: arang lump dalam karung tidak mengisi seluruh ruang karena ada celah antarkarung. Kalau densitas sudah "efektif dalam container", utilisasi = 100%.',
  },
  floorUtil: {
    term: 'Utilisasi lantai',
    short: 'Bagian lantai gudang untuk tumpukan; sisanya lorong & ventilasi.',
    long: `Default ${fmt(DEFAULT_FLOOR_UTIL, 2)} artinya ${floorPct}% lantai untuk barang, sisanya untuk lorong, jalur forklift, dan sirkulasi udara.`,
  },
  stackHeight: {
    term: 'Tinggi tumpuk',
    short: 'Tinggi tumpukan barang di gudang (bukan tinggi atap).',
    long: `Sisakan minimal ${fmt(CEILING_CLEARANCE_M, 1)} m di bawah atap untuk ventilasi/sprinkler. Kopra & arang sebaiknya tidak ditumpuk terlalu tinggi (panas & beban).`,
  },
  moisture: {
    term: 'Kadar air',
    short: `Persentase air di dalam barang. Kopra di atas ${heatPct}% berisiko panas sendiri & berjamur.`,
    long: 'Saat kopra dikeringkan, beratnya turun karena airnya hilang, sedangkan bahan keringnya tetap. Koreksi: berat baru = berat lama × (1 − kadar air lama) ÷ (1 − kadar air baru).',
  },
  benchmark: {
    term: 'Benchmark pasar',
    short: 'Angka muat yang dilaporkan eksportir/pembeli, sebagai pembanding.',
    long: 'Kalau hasil hitung jauh dari benchmark, cek bentuk barang, ukuran karung, dan densitas. Satu sumber konservatif sengaja ditampilkan sebagai peringatan.',
  },
  grid: {
    term: 'Representasi grid',
    short: 'Gambar susunan adalah perkiraan rapi, bukan posisi muat sebenarnya.',
  },
  override: {
    term: 'Ubah angka (override)',
    short: 'Ganti angka default dengan hasil ukur Anda sendiri. Dataset asli tidak berubah.',
    long: 'Angka yang terlalu jauh (di bawah setengah nilai minimum atau di atas dua kali maksimum) ditolak supaya tidak salah ketik.',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
