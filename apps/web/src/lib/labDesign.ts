/**
 * Desain eksperimen GEMA RnD (DEC-051) — fungsi murni: faktor & level → unit percobaan (perlakuan ×
 * ulangan, urutan acak ber-seed agar bisa diulang), lembar data, dan ringkasan DESKRIPTIF per perlakuan
 * (n, rata-rata, SD, min, maks dari nilai terakhir tiap unit). Tidak ada uji statistik inferensial.
 */
import draft from '@/data/rndParamDraft.json';
import { parseNum } from './format';
import type { DailyEntry, LabProductId } from './labStore';

export interface Factor {
  name: string;
  unit: string;
  /** Level apa adanya, mis. ["60", "70", "80"] atau ["kontrol", "rendam 15 menit"]. */
  levels: string[];
}

export interface ResponseVar {
  name: string;
  unit: string;
  /** Kunci draf parameter bila dipilih dari saran. */
  key?: string;
}

export interface Run {
  /** Mis. P2-U3. */
  code: string;
  /** P1, P2, … */
  treatment: string;
  /** "Suhu = 70 °C · Waktu = 8 jam". */
  label: string;
  replicate: number;
  /** Urutan kerja acak (1 = pertama). */
  order: number;
}

export interface ExperimentDesign {
  factors: Factor[];
  /** Pembanding: tulis level mana yang jadi kontrol, atau "tanpa kontrol". */
  control: string;
  replicates: number;
  responses: ResponseVar[];
  runs: Run[];
}

export const MAX_FACTORS = 2;
export const MAX_RUNS = 200;

/** "60, 70; 80" → ["60","70","80"]; kosong & duplikat dibuang, urutan dipertahankan. */
export function parseLevels(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const v = raw.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** PRNG mulberry32 — urutan acak bisa diulang dari seed yang sama. */
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const levelText = (f: Factor, l: string) => `${f.name} = ${l}${f.unit ? ` ${f.unit}` : ''}`;

/** Faktorial penuh (≤ 2 faktor) × ulangan; urutan kerja diacak dengan seed (mis. ID eksperimen). */
export function buildRuns(factors: readonly Factor[], replicates: number, seed: string): Run[] {
  const fs = factors.filter((f) => f.name.trim() && f.levels.length);
  if (!fs.length) throw new RangeError('Isi minimal satu faktor dengan levelnya');
  if (fs.length > MAX_FACTORS) throw new RangeError(`Maksimal ${MAX_FACTORS} faktor agar tetap mudah`);
  if (!Number.isInteger(replicates) || replicates < 1) throw new RangeError('Ulangan minimal 1');
  const combos: string[][] = fs.length === 1 ? fs[0]!.levels.map((l) => [l]) : fs[0]!.levels.flatMap((a) => fs[1]!.levels.map((b) => [a, b]));
  if (combos.length * replicates > MAX_RUNS) throw new RangeError(`Terlalu banyak unit (${combos.length * replicates}); maksimal ${MAX_RUNS}`);
  const runs: Run[] = [];
  combos.forEach((c, i) => {
    for (let u = 1; u <= replicates; u++) {
      runs.push({ code: `P${i + 1}-U${u}`, treatment: `P${i + 1}`, label: c.map((l, k) => levelText(fs[k]!, l)).join(' · '), replicate: u, order: 0 });
    }
  });
  const r = rng(seed);
  const order = runs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  order.forEach((runIdx, pos) => (runs[runIdx]!.order = pos + 1));
  return runs;
}

export interface TreatmentStats {
  treatment: string;
  label: string;
  /** Unit yang punya nilai angka. */
  n: number;
  /** Unit tanpa data (atau bukan angka). */
  missing: number;
  mean?: number;
  sd?: number;
  min?: number;
  max?: number;
}

export interface ResponseSummary {
  response: ResponseVar;
  rows: TreatmentStats[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Nilai TERAKHIR (waktu ukur terbaru) tiap unit untuk satu variabel respon. */
export function lastValuePerRun(entries: readonly DailyEntry[], response: ResponseVar): Map<string, { value: string; at: string }> {
  const out = new Map<string, { value: string; at: string }>();
  for (const e of entries) {
    for (const m of e.measurements) {
      if (!m.group || !same(m.name, response.name) || !same(m.unit, response.unit)) continue;
      const at = m.at || e.entryDate;
      const prev = out.get(m.group);
      if (!prev || at >= prev.at) out.set(m.group, { value: m.value, at });
    }
  }
  return out;
}

/** Ringkasan deskriptif per perlakuan (SD sampel, n−1); tanpa uji signifikansi. */
export function summarize(design: ExperimentDesign, entries: readonly DailyEntry[]): ResponseSummary[] {
  const treatments = [...new Map(design.runs.map((r) => [r.treatment, r.label])).entries()];
  return design.responses.map((response) => {
    const last = lastValuePerRun(entries, response);
    const rows = treatments.map(([treatment, label]) => {
      const units = design.runs.filter((r) => r.treatment === treatment);
      const vals = units.map((u) => last.get(u.code)).map((v) => (v ? parseNum(v.value) : Number.NaN)).filter((v) => Number.isFinite(v));
      const n = vals.length;
      const row: TreatmentStats = { treatment, label, n, missing: units.length - n };
      if (n) {
        const mean = vals.reduce((a, b) => a + b, 0) / n;
        row.mean = mean;
        row.min = Math.min(...vals);
        row.max = Math.max(...vals);
        if (n > 1) row.sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
      }
      return row;
    });
    return { response, rows };
  });
}

export interface ParamSuggestion {
  key: string;
  label: string;
  unit: string;
  group: string;
  note: string;
  target: string;
}

/** Kode draf parameter per jalur lab (briket = shisha/BBQ/custom). */
const DRAFT_CODES: Record<LabProductId, string[]> = { KE: ['KE'], CK: ['CK'], BL: ['BL'], AR: ['AR'], BR: ['BS', 'BB', 'BC'] };

/** Saran variabel terukur dari draf parameter (status draf; owner yang memilih). */
export function responseSuggestions(product: LabProductId): ParamSuggestion[] {
  const seen = new Set<string>();
  const out: ParamSuggestion[] = [];
  for (const p of draft.params) {
    if (!DRAFT_CODES[product].includes(p.product_code) || p.data_type !== 'number') continue;
    const id = `${p.label}|${p.unit}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const target = p.target_min || p.target_max ? `${p.target_min || '…'}–${p.target_max || '…'} ${p.unit}`.trim() : '';
    out.push({ key: p.key, label: p.label, unit: p.unit, group: p.group_name, note: p.note, target });
  }
  return out;
}

export const DRAFT_STATUS = draft.status;
