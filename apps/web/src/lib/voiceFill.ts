/**
 * Pengurai perintah suara pengisian pencatatan (DEC-099), murni (tanpa DOM) supaya bisa diuji.
 *
 *   "satu" / "nomor tiga"              → pilih nomor urut (semua kolom nomor itu berkedip neon)
 *   "berat awal satu kosong tiga empat" → isi kolom Berat awal (nomor aktif) dengan 1034
 *   "berat awal seribu tiga empat"      → 1034 (seribu + 34)
 *   "next" / "neks" / "nex" / "lanjut"  → pindah ke kolom berikutnya (setelah kolom terakhir → nomor berikutnya)
 *   "isi enam koma lima"                → isi kolom yang sedang aktif dengan 6,5
 */

export interface VoiceField {
  key: string;
  label: string;
  /** Cara menyebut kolom (huruf kecil), mis. ["berat awal"]. */
  say: string[];
}

export type VoiceCmd = { kind: 'row'; no: number } | { kind: 'fill'; field?: string; value: string } | { kind: 'next' } | { kind: 'unknown'; text: string };

const DIGIT: Record<string, number> = { kosong: 0, nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
const NEXT = new Set(['next', 'neks', 'nex', 'nek', 'nexs', 'nekst', 'lanjut', 'berikutnya']);

/** Huruf kecil, tanpa tanda baca; "1.034" tetap utuh, "seribu" dipecah "se ribu". */
export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d)[.](\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d),(\d)/g, '$1 koma $2')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\bse(ribu|ratus|puluh|belas)\b/g, 'se $1')
    .replace(/\bsebelas\b/g, 'se belas')
    .split(/\s+/)
    .filter(Boolean);
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
    const v = parseNumber(t.slice(f.len));
    return v !== undefined ? { kind: 'fill', field: f.key, value: v } : { kind: 'unknown', text: tokens.join(' ') };
  }
  if (t[0] === 'isi') {
    const v = parseNumber(t.slice(1));
    if (v !== undefined) return { kind: 'fill', value: v };
  }
  // hanya bilangan (tanpa nama kolom) = pilih nomor urut
  const n = parseNumber(t);
  if (n && !n.includes(',') && Number(n) > 0) return { kind: 'row', no: Number(n) };
  return { kind: 'unknown', text: tokens.join(' ') };
}

export interface VoiceCursor {
  row: number;
  field: string;
}

/** Terapkan satu perintah ke posisi aktif; kembalikan posisi baru + isian (bila ada). */
export function applyVoice(cmd: VoiceCmd, cur: VoiceCursor, fields: readonly VoiceField[], rowCount: number): { cur: VoiceCursor; fill?: { row: number; field: string; value: string }; error?: string } {
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
