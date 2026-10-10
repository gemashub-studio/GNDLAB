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
  brix: {
    term: '°Brix',
    short: 'Kadar gula (padatan terlarut) dalam cairan, diukur pakai refraktometer. 15 °Brix ≈ 15% gula.',
    long: 'Air kelapa tua biasanya 4–5 °Brix. Untuk cuka, gula ditambah sampai 14–17 °Brix supaya alkoholnya cukup (≥8%) untuk jadi cuka ≥4%.',
  },
  must: {
    term: 'Must',
    short: 'Air kelapa yang sudah disaring, ditambah gula, dan dipanaskan sebentar — siap diberi ragi.',
  },
  titrasi: {
    term: 'Titrasi',
    short: 'Cara mengukur keasaman cuka: tetesi NaOH sampai warnanya merah muda, catat berapa mL yang terpakai.',
    long: 'Hasilnya tergantung kekuatan NaOH (N) dan banyaknya sampel. Rumus singkat 0,06005 × V cuma benar untuk NaOH 0,1 N dan sampel 10 mL.',
  },
  rendemen: {
    term: 'Rendemen',
    short: 'Berapa persen hasil dari bahan masuk. Mis. 100 kg batok jadi 30 kg arang = rendemen 30%.',
  },
  perekat: {
    term: 'Perekat (binder)',
    short: 'Lem dari tepung (biasanya tapioka) yang dimasak jadi pasta, buat menyatukan serbuk arang jadi briket.',
    long: 'Pati harus matang (tergelatinisasi, ≥65°C). Terlalu banyak perekat bikin kalor turun dan abu naik — umumnya 4–8% dari berat arang (FAO).',
  },
  adonan: {
    term: 'Kadar air adonan',
    short: 'Seberapa basah campuran arang + perekat sebelum dicetak. Target 22–28%.',
  },
  mati_hampa: {
    term: 'Mati hampa',
    short: 'Memadamkan arang dengan menutup rapat semua lubang udara (pakai tanah liat basah), BUKAN disiram air. Minimal 8 jam.',
  },
  weathering: {
    term: 'Weathering',
    short: 'Arang diangin-anginkan di tempat beratap minimal 14 hari sebelum dikemas untuk ekspor, biar nggak panas sendiri di kapal.',
  },
  pembatas: {
    term: 'Stasiun pembatas',
    short: 'Tahap yang paling lambat. Hasil satu shift nggak bisa lebih dari kemampuan tahap ini — tambah orang/mesin di sini dulu.',
  },
  shift: {
    term: 'Efisiensi shift',
    short: 'Berapa persen jam kerja yang benar-benar dipakai produksi (dipotong istirahat, setup, ganti lot). 85% = 6,8 jam dari 8 jam.',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
