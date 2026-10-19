/**
 * Pengurai perintah suara pengisian pencatatan (DEC-099), murni (tanpa DOM) supaya bisa diuji.
 *
 *   "satu" / "nomor tiga"              → pilih nomor urut (semua kolom nomor itu berkedip neon)
 *   "berat awal satu kosong tiga empat" → isi kolom Berat awal (nomor aktif) dengan 1034
 *   "berat awal seribu tiga empat"      → 1034 (seribu + 34)
 *   "next" / "neks" / "nex" / "lanjut"  → pindah ke kolom berikutnya (setelah kolom terakhir → nomor berikutnya)
 *   "isi enam koma lima"                → isi kolom yang sedang aktif dengan 6,5
 *   "<nama kolom> <nilai>"              → kolom lain di form (DEC-104): angka, teks bebas, atau pilihan dropdown,
 *                                         mis. "jumlah kopra tiga", "keterangan kopra dibalik tiap dua jam", "metode kopra oven gas"
 */

export interface VoiceField {
  key: string;
  label: string;
  /** Cara menyebut kolom (huruf kecil), mis. ["berat awal"]. */
  say: string[];
  /**
   * Jenis isian: tanpa nilai = kolom per nomor (angka). 'number' / 'text' / 'choice' = kolom lain di form (DEC-104):
   * angka, teks bebas (sisa ucapan), atau pilihan dropdown (dicocokkan ke `options`).
   */
  kind?: 'number' | 'text' | 'choice';
  options?: { value: string; label: string }[];
}

export type VoiceCmd =
  | { kind: 'row'; no: number }
  | { kind: 'fill'; field?: string; value: string }
  /** Bilangan tanpa nama kolom: 1 kata & nomornya ada → pilih nomor; selain itu → isi kolom aktif (DEC-103). */
  | { kind: 'num'; value: string; words: number }
  | { kind: 'next' }
  | { kind: 'unknown'; text: string };

const DIGIT: Record<string, number> = { kosong: 0, nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
const NEXT = new Set(['next', 'neks', 'nex', 'nek', 'nexs', 'nekst', 'lanjut', 'berikutnya']);

/** Huruf kecil, tanpa tanda baca; "1.034" tetap utuh, "seribu" dipecah "se ribu". */
export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d)[.](\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d),(\d)/g, '$1 koma $2')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // satuan yang sama dengan satuan kolom diabaikan ("berat air 500 gram", "tebal 9 mm", DEC-103)
    .filter((t) => !UNIT_WORDS.has(t))
    .map(fuzzyWord)
    .join(' ')
    .replace(/\bse(ribu|ratus|puluh|belas)\b/g, 'se $1')
    .replace(/\bsebelas\b/g, 'se belas')
    .split(' ')
    .filter(Boolean);
}

/** Satuan kolom (g, mL, mm) yang boleh ikut terucap; satuan lain (kg, liter, cm) TIDAK diubah otomatis. */
const UNIT_WORDS = new Set(['gram', 'gr', 'g', 'grm', 'mililiter', 'ml', 'mili', 'milimeter', 'mm']);

/** Kosakata perintah: hasil transkripsi yang sedikit meleset ("ampat", "beratawal", "doa") dicocokkan ke kata terdekat. */
const VOCAB = [
  ...Object.keys(DIGIT).filter((w) => w !== 'se'),
  'sepuluh', 'sebelas', 'seratus', 'seribu', 'belas', 'puluh', 'ratus', 'ribu', 'koma',
  'berat', 'awal', 'akhir', 'air', 'volume', 'tebal', 'daging', 'nomor', 'baris', 'isi', 'lanjut',
  'next', 'neks', 'nex',
  'jumlah', 'produksi', 'item', 'perlakuan', 'metode', 'keterangan', 'kedua', 'ketiga', 'keempat', 'kopra', 'bibit', 'cuka', 'leather', 'total',
];
/** Gabungan kata yang sering ditulis menyatu oleh mesin transkripsi. */
const JOINED: Record<string, string> = {
  beratawal: 'berat awal', beratakhir: 'berat akhir', beratair: 'berat air', volumeair: 'volume air',
  tebalawal: 'tebal awal', tebalakhir: 'tebal akhir', tebaldaging: 'tebal daging',
};
function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length]!;
}
/** Kata → kata kosakata terdekat (selisih ≤1 huruf; ≥8 huruf ≤2), atau apa adanya bila tidak ada yang mirip. */
export function fuzzyWord(t: string): string {
  if (/^\d+$/.test(t) || VOCAB.includes(t) || t === 'se') return t;
  if (JOINED[t]) return JOINED[t]!;
  if (t.length < 3) return t;
  const allow = t.length >= 8 ? 2 : 1;
  let best: [string, number] | undefined;
  for (const [w, out] of [...VOCAB.map((v) => [v, v] as const), ...Object.entries(JOINED)]) {
    if (Math.abs(w.length - t.length) > allow) continue;
    const dist = lev(t, w);
    if (dist <= allow && (!best || dist < best[1])) best = [out, dist];
  }
  return best ? best[0] : t;
}

const isNumWord = (t: string) => t in DIGIT || ['ribu', 'ratus', 'puluh', 'belas', 'koma'].includes(t) || /^\d+$/.test(t);

/**
 * Kata bilangan → angka (string, desimal pakai koma). Deret angka satuan digabung per digit ("satu kosong tiga empat" = 1034),
 * bilangan bertingkat dijumlah ("dua ratus lima puluh" = 250), campuran: "seribu tiga empat" = 1000 + 34.
 */
export function parseNumber(tokens: readonly string[]): string | undefined {
  if (!tokens.length || !tokens.every(isNumWord)) return undefined;
  const k = tokens.indexOf('koma');
  if (k >= 0) {
    const whole = parseNumber(tokens.slice(0, k)) ?? '0';
    const frac = tokens.slice(k + 1).map((t) => (/^\d+$/.test(t) ? t : t in DIGIT ? String(DIGIT[t]) : '')).join('');
    return frac ? `${whole},${frac}` : whole;
  }
  let total = 0;
  let current = 0;
  let pending = 0;
  let prevBare = false;
  for (const t of tokens) {
    if (/^\d+$/.test(t)) {
      pending = prevBare ? Number(`${pending}${t}`) : Number(t);
      prevBare = true;
      continue;
    }
    if (t in DIGIT) {
      const d = DIGIT[t]!;
      pending = prevBare ? pending * 10 + d : d;
      prevBare = true;
      continue;
    }
    prevBare = false;
    if (t === 'belas') pending += 10;
    else if (t === 'puluh') {
      current += pending * 10;
      pending = 0;
    } else if (t === 'ratus') {
      current += (pending || 1) * 100;
      pending = 0;
    } else if (t === 'ribu') {
      total += (current + pending || 1) * 1000;
      current = 0;
      pending = 0;
    }
  }
  return String(total + current + pending);
}

/** Cocokkan nama kolom di awal token (sebutan terpanjang menang). */
function matchField(tokens: readonly string[], fields: readonly VoiceField[]): { key: string; len: number } | undefined {
  let best: { key: string; len: number } | undefined;
  for (const f of fields)
    for (const s of f.say) {
      const w = s.split(' ');
      if (w.every((x, i) => tokens[i] === x) && (!best || w.length > best.len)) best = { key: f.key, len: w.length };
    }
  return best;
}

/** Satu ucapan → daftar perintah (dipecah di kata "next"). */
export function parseVoice(text: string, fields: readonly VoiceField[]): VoiceCmd[] {
  const out: VoiceCmd[] = [];
  let seg: string[] = [];
  const flush = () => {
    // satu napas bisa berisi beberapa perintah ("dua berat awal seribu"): pecah di tiap nama kolom / "nomor" / "isi"
    let part: string[] = [];
    for (let i = 0; i < seg.length; ) {
      const f = matchField(seg.slice(i), fields);
      const starter = f ? f.len : ['nomor', 'baris', 'isi'].includes(seg[i]!) ? 1 : 0;
      if (starter && part.length) {
        out.push(parseSegment(part, fields));
        part = [];
      }
      part.push(...seg.slice(i, i + Math.max(1, starter)));
      i += Math.max(1, starter);
    }
    if (part.length) out.push(parseSegment(part, fields));
    seg = [];
  };
  for (const t of normalize(text)) {
    if (NEXT.has(t)) {
      flush();
      out.push({ kind: 'next' });
    } else seg.push(t);
  }
  flush();
  return out;
}

function parseSegment(tokens: string[], fields: readonly VoiceField[]): VoiceCmd {
  let t = tokens;
  // kata pengisi yang sering terucap
  while (t.length && ['oke', 'ok', 'ya', 'eh', 'em', 'hmm'].includes(t[0]!)) t = t.slice(1);
  if (!t.length) return { kind: 'unknown', text: tokens.join(' ') };
  if (t[0] === 'nomor' || t[0] === 'baris' || t[0] === 'no') {
    const n = parseNumber(t.slice(1));
    if (n && !n.includes(',') && Number(n) > 0) return { kind: 'row', no: Number(n) };
  }
  const f = matchField(t, fields);
  if (f) {
    const kind = fields.find((x) => x.key === f.key)?.kind;
    if (kind === 'text' || kind === 'choice') {
      const rest = t.slice(f.len).join(' ').trim();
      return rest ? { kind: 'fill', field: f.key, value: rest } : { kind: 'unknown', text: tokens.join(' ') };
    }
    const v = parseNumber(t.slice(f.len));
    return v !== undefined ? { kind: 'fill', field: f.key, value: v } : { kind: 'unknown', text: tokens.join(' ') };
  }
  if (t[0] === 'isi') {
    const v = parseNumber(t.slice(1));
    if (v !== undefined) return { kind: 'fill', value: v };
  }
  // hanya bilangan (tanpa nama kolom): diputuskan saat diterapkan (jumlah nomor diketahui) — lihat applyVoice
  const n = parseNumber(t);
  if (n !== undefined) return { kind: 'num', value: n, words: t.filter((x) => x !== 'se').length };
  return { kind: 'unknown', text: tokens.join(' ') };
}

/** Deret kata bilangan → satu token angka ("lima puluh" → "50"), kata lain apa adanya. */
function numTokens(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) out.push(parseNumber(run) ?? run.join(''));
    run = [];
  };
  for (const t of tokens) {
    if (t !== 'koma' && isNumWord(t)) run.push(t);
    else {
      flush();
      out.push(t);
    }
  }
  flush();
  return out;
}
/**
 * Pilihan dropdown yang paling cocok dengan ucapan (DEC-104): kata ucapan (angka kata → digit) dicari di label pilihan;
 * menang = paling banyak kata cocok (minimal separuh kata ucapan), seri → label terpendek. "cuka dua" → "CUKA 2 - GULA 75g".
 */
export function matchOption(spoken: string, options: readonly { value: string; label: string }[]): { value: string; label: string } | undefined {
  const words = numTokens(normalize(spoken));
  if (!words.length) return undefined;
  let best: { o: { value: string; label: string }; score: number; len: number } | undefined;
  for (const o of options) {
    if (!o.value) continue;
    const lab = numTokens(normalize(`${o.label} ${o.value}`));
    const joined = lab.join('');
    const score = words.filter((w) => lab.some((l) => l === w || (w.length >= 3 && l.startsWith(w))) || (w.length >= 4 && joined.includes(w))).length;
    if (score * 2 < words.length || !score) continue;
    if (!best || score > best.score || (score === best.score && o.label.length < best.len)) best = { o, score, len: o.label.length };
  }
  return best?.o;
}

export interface VoiceCursor {
  row: number;
  field: string;
}

/** Terapkan satu perintah ke posisi aktif; kembalikan posisi baru + isian (bila ada). */
export function applyVoice(cmd: VoiceCmd, cur: VoiceCursor, fields: readonly VoiceField[], rowCount: number): { cur: VoiceCursor; fill?: { row: number; field: string; value: string }; error?: string } {
  if (cmd.kind === 'num') {
    // "satu" / "tiga" (satu kata, nomornya ada) = pilih nomor; "satu kosong tiga" / "seratus" > jumlah nomor / desimal = isi kolom aktif
    const no = Number(cmd.value);
    if (cmd.words === 1 && !cmd.value.includes(',') && Number.isInteger(no) && no >= 1 && no <= rowCount) return { cur: { row: no, field: fields[0]!.key } };
    return { cur, fill: { row: cur.row, field: cur.field, value: cmd.value } };
  }
  if (cmd.kind === 'row') {
    if (cmd.no > rowCount) return { cur, error: `Nomor ${cmd.no} tidak ada (hanya ${rowCount}).` };
    return { cur: { row: cmd.no, field: fields[0]!.key } };
  }
  if (cmd.kind === 'next') {
    const i = fields.findIndex((f) => f.key === cur.field);
    if (i < fields.length - 1) return { cur: { row: cur.row, field: fields[i + 1]!.key } };
    return cur.row < rowCount ? { cur: { row: cur.row + 1, field: fields[0]!.key } } : { cur, error: 'Sudah di kolom terakhir.' };
  }
  if (cmd.kind === 'fill') {
    const field = cmd.field ?? cur.field;
    return { cur: { row: cur.row, field }, fill: { row: cur.row, field, value: cmd.value } };
  }
  return { cur, error: `Tidak dikenali: “${cmd.text}”` };
}

/** Kolom suara form data awal / akhir (sebutan dalam bahasa Indonesia). */
export const AWAL_VOICE_FIELDS: Record<string, VoiceField> = {
  beratAwal: { key: 'beratAwal', label: 'Berat awal', say: ['berat awal'] },
  volAir: { key: 'volAir', label: 'Volume air', say: ['volume air', 'volume', 'vol air'] },
  beratAir: { key: 'beratAir', label: 'Berat air', say: ['berat air'] },
  tebalAwal: { key: 'tebalAwal', label: 'Tebal daging', say: ['tebal daging', 'tebal awal', 'tebal'] },
};
export const AKHIR_VOICE_FIELDS: VoiceField[] = [
  { key: 'beratAkhir', label: 'Berat akhir', say: ['berat akhir', 'berat'] },
  { key: 'tebalAkhir', label: 'Tebal akhir', say: ['tebal akhir', 'tebal daging', 'tebal'] },
];
