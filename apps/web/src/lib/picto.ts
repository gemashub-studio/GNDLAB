/**
 * Nama piktogram langkah & tebakan dari teks (modul murni, tanpa JSX — bisa diuji di Node).
 * Gambar SVG-nya ada di components/ui/StepFlow.tsx.
 */
export const PICTO_NAMES = ['coconut', 'split', 'truck', 'sack', 'scale', 'label', 'pallet', 'vessel', 'cover', 'drop', 'thermo', 'clock', 'cold', 'tap', 'bubbles', 'cob', 'burette', 'bottle', 'fire', 'sun', 'oven', 'fan', 'rack', 'sheet', 'soak', 'brush', 'sieve', 'hammer', 'drum', 'smoke', 'spoon', 'check', 'shield', 'mix', 'press'] as const;
export type PictoName = (typeof PICTO_NAMES)[number];

/** Aturan tebakan piktogram dari teks langkah (urutan = prioritas). */
const RULES: [RegExp, PictoName][] = [
  [/k3|masker|respirator|apar|apd|backdraft|iritan|korosif/, 'shield'],
  [/titrasi|naoh 0,1 n|fenolftalein/, 'burette'],
  [/belerang|sulfur|fumigasi|so₂/, 'smoke'],
  [/asap|warna asap/, 'smoke'],
  [/kipas|exhaust|ventilasi/, 'fan'],
  [/difuser|aerator|pompa udara|aerasi/, 'bubbles'],
  [/tongkol|serutan|acetifier|generator/, 'cob'],
  [/keran|tarik .*%|isi ulang/, 'tap'],
  [/drum/, 'drum'],
  [/kolam|bakar|nyalakan|bara|tungku/, 'fire'],
  [/hammer|giling/, 'hammer'],
  [/ayak|saring/, 'sieve'],
  [/oven|pasteurisasi|panaskan/, 'oven'],
  [/jemur|matahari|para-para/, 'sun'],
  [/dingin|kulkas|< ?10/, 'cold'],
  [/telungkup|terlentang|rak|tray|tingkat/, 'rack'],
  [/cetak|press/, 'press'],
  [/aduk|adonan|perekat|campur/, 'mix'],
  [/rendam|celup|bilas|netral/, 'soak'],
  [/oles|lilin|resin|finishing|kuas/, 'brush'],
  [/pewarna|kopi|mordan|tawas/, 'soak'],
  [/lembar|bioleather|kultur|baki/, 'sheet'],
  [/botol|label: keasaman/, 'bottle'],
  [/timbang|timbangan/, 'scale'],
  [/label|kode lot/, 'label'],
  [/palet|tumpuk|fifo|gudang/, 'pallet'],
  [/karung|kemas|master box|jumbo/, 'sack'],
  [/truk|kendaraan|rit|muat/, 'truck'],
  [/belah|congkel|jambul|sabut/, 'split'],
  [/kain|tutup/, 'cover'],
  [/air kelapa|cairan|tetes/, 'drop'],
  [/gula|ragi|starter|dosis|takar/, 'spoon'],
  [/wadah|tangki|jeriken|ember/, 'vessel'],
  [/jam|hari|menit|minggu|siklus/, 'clock'],
  [/suhu|°c/, 'thermo'],
  [/media|must|asetifikasi/, 'vessel'],
  [/panen|pemurnian/, 'soak'],
  [/jadi kulit|kulit|plastis/, 'sheet'],
  [/fermentasi|alkohol/, 'bubbles'],
  [/klarifikasi/, 'sieve'],
  [/pengering|kering/, 'sun'],
  [/grade|rilis/, 'label'],
  [/rendemen|bahan|resep|bom/, 'scale'],
  [/desain|rencana|uji coba/, 'check'],
  [/kelapa|lot|asal/, 'coconut'],
  [/ukur|uji|cek|qc|catat|sortir|kadar air/, 'check'],
];

export function guessPicto(text: string): PictoName {
  const t = text.toLowerCase();
  return RULES.find(([re]) => re.test(t))?.[1] ?? 'check';
}

