import { describe, expect, it } from 'vitest';
import { groupByCategory, localDateTime, nextProgresId, progresError, TREATMENT_OPTIONS, type ProgresItem } from '@/lib/progresPerlakuan';
import { withOcrText } from '@/lib/labAi';
import { docToRow, docsFromBackup, rowToDoc } from '@/lib/labDocs';

const item = (id: string, category: ProgresItem['category'], at: string): ProgresItem => ({ id, treatment: 'Oven Gas', group: 'Perlakuan kopra', category, qty: '25', at, photo: 'sbblob:u:image/jpeg:x', createdAt: at });

describe('Upload Progres Perlakuan (DEC-095)', () => {
  it('pilihan nama perlakuan = semua metode di form data akhir (+ Green House) dengan keterangan', () => {
    const labels = TREATMENT_OPTIONS.map((o) => o.label);
    expect(labels).toContain('Green House');
    for (const m of ['Oven Gas', 'Oven Briket', 'A - PH 40', 'B - PH 40', 'CUKA 1 - GULA 25g', 'CUKA 2 - GULA 75g', 'CUKA 3 - GULA 50', 'Bio Leather A - Gula 25g', 'Bio Leather B - Gula 50g']) expect(labels).toContain(m);
    expect(TREATMENT_OPTIONS.find((o) => o.value === 'CUKA 2 - GULA 75g')!.note).toBe('tambahan gula 75 g');
  });
  it('validasi: foto, perlakuan, kategori, jumlah hanya angka, tanggal', () => {
    const ok = { photo: 'data:x', treatment: 'Oven Gas', category: 'harian', qty: '25', at: localDateTime() };
    expect(progresError(ok)).toBeUndefined();
    expect(progresError({ ...ok, photo: undefined })).toBe('Pilih foto dulu.');
    expect(progresError({ ...ok, treatment: '' })).toBe('Pilih nama perlakuan.');
    expect(progresError({ ...ok, category: '' })).toBe('Pilih kategori.');
    expect(progresError({ ...ok, qty: '2,5' })).toBe('Jumlah produksi/item hanya angka.');
    expect(localDateTime(new Date(2026, 9, 17, 9, 5))).toBe('2026-10-17T09:05');
  });
  it('kode PP-YYMMDD-NN & 3 tabel per kategori (terbaru di atas)', () => {
    expect(nextProgresId(['PP-261017-01', 'PP-261017-03'], new Date(2026, 9, 17), '')).toBe('PP-261017-04');
    const g = groupByCategory([item('a', 'harian', '2026-10-17T01:00:00Z'), item('b', 'bulanan', '2026-10-17T02:00:00Z'), item('c', 'harian', '2026-10-17T03:00:00Z')]);
    expect(g.harian.map((x) => x.id)).toEqual(['c', 'a']);
    expect(g.mingguan).toEqual([]);
    expect(g.bulanan.map((x) => x.id)).toEqual(['b']);
  });
  it('ikut sinkron: menu progres_perlakuan di rnd_data', () => {
    const docs = docsFromBackup({ format: 'gemas-lab', version: 2, exportedAt: 'x', experiments: [], progres: [item('PP-1', 'mingguan', '2026-10-17T01:00:00Z')] });
    expect(docs[0]!.kind).toBe('progres');
    const row = docToRow(docs[0]!);
    expect(row.menu).toBe('progres_perlakuan');
    expect((row as Record<string, unknown>).progres_perlakuan).toMatchObject({ id: 'PP-1', qty: '25' });
    expect(rowToDoc(row)!.data).toMatchObject({ id: 'PP-1' });
  });
  it('teks hasil scan foto (OCR) ditambahkan ke prompt', () => {
    expect(withOcrText('Jelaskan ini', [])).toBe('Jelaskan ini');
    expect(withOcrText('Jelaskan ini', ['pH 4,2 hari ke-3'])).toBe('Jelaskan ini\n\nTeks hasil scan foto:\npH 4,2 hari ke-3');
    expect(withOcrText('q', ['a', 'b'])).toContain('[Foto 2]\nb');
    expect(withOcrText('q', ['x'.repeat(5000)]).length).toBeLessThanOrEqual(2000);
  });
});
