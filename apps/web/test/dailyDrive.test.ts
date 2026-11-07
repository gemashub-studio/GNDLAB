import { describe, expect, it } from 'vitest';
import { dailyDriveError, driveEmbedUrl, nextDailyId, sortDaily } from '@/lib/dailyDrive';
import { docToRow, docsFromBackup, MENU_OF, RND_COLS, rowToDoc } from '@/lib/labDocs';
import { planSync } from '@/lib/labSync';
import { LAB_MENU } from '@/lib/labMenu';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

describe('Daily Report R&D — Pencatatan harian by Drive (DEC-144)', () => {
  it('tautan Drive/Docs → alamat pratinjau; selain Drive ditolak', () => {
    expect(driveEmbedUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(`https://drive.google.com/file/d/${ID}/preview`);
    expect(driveEmbedUrl(`https://drive.google.com/open?id=${ID}`)).toBe(`https://drive.google.com/file/d/${ID}/preview`);
    expect(driveEmbedUrl(`https://drive.google.com/uc?id=${ID}&export=download`)).toBe(`https://drive.google.com/file/d/${ID}/preview`);
    expect(driveEmbedUrl(`https://drive.google.com/drive/folders/${ID}?usp=drive_link`)).toBe(`https://drive.google.com/embeddedfolderview?id=${ID}#grid`);
    expect(driveEmbedUrl(`https://drive.google.com/drive/u/0/folders/${ID}`)).toBe(`https://drive.google.com/embeddedfolderview?id=${ID}#grid`);
    expect(driveEmbedUrl(`https://docs.google.com/document/d/${ID}/edit?usp=sharing`)).toBe(`https://docs.google.com/document/d/${ID}/preview`);
    expect(driveEmbedUrl(`https://docs.google.com/spreadsheets/u/0/d/${ID}/edit#gid=0`)).toBe(`https://docs.google.com/spreadsheets/d/${ID}/preview`);
    expect(driveEmbedUrl(`  https://docs.google.com/presentation/d/${ID}/edit  `)).toBe(`https://docs.google.com/presentation/d/${ID}/preview`);
    for (const bad of ['', 'bukan url', `http://drive.google.com/file/d/${ID}/view`, `https://example.com/file/d/${ID}/view`, 'https://drive.google.com/file/d/x/view', 'https://drive.google.com/drive/my-drive', `https://evil.com/?u=https://drive.google.com/file/d/${ID}`])
      expect(driveEmbedUrl(bad)).toBeUndefined();
    expect(dailyDriveError('')).toMatch(/Tempel tautan/);
    expect(dailyDriveError('https://example.com')).toMatch(/belum dikenali/);
    expect(dailyDriveError(`https://drive.google.com/file/d/${ID}/view`)).toBeUndefined();
  });
  it('ID DR-YYMMDD-NN per hari; tanggal dari waktu upload', () => {
    const now = new Date(2026, 10, 6, 9, 41);
    expect(nextDailyId([], now, '')).toBe('DR-261106-01');
    expect(nextDailyId(['DR-261106-01', 'DR-261106-07', 'DR-261105-09'], now, '')).toBe('DR-261106-08');
    expect(nextDailyId([], now, '-ab')).toBe('DR-261106-01-ab');
    const t = '2026-11-06T02:41:00.000Z';
    expect(sortDaily([{ id: 'DR-261106-01', url: 'a', createdAt: t }, { id: 'DR-261106-02', url: 'b', createdAt: t }, { id: 'DR-261105-01', url: 'c', createdAt: '2026-11-05T01:00:00.000Z' }]).map((x) => x.id)).toEqual(['DR-261106-02', 'DR-261106-01', 'DR-261105-01']);
  });
  it('menu "Daily Report R&D" di anak menu GnD Lab', () => {
    expect(LAB_MENU.map((m) => m.label)).toEqual(['Pencatatan Data', 'Riset Produk', 'Laporan Belanja', 'Gabungkan Data', 'Daily Report R&D']);
  });
  it('sinkron: menu rnd_data "daily_report" (kolom sendiri), append-only lewat planSync', () => {
    expect(MENU_OF.harian).toBe('daily_report');
    expect(RND_COLS).toContain('daily_report');
    const item = { id: 'DR-261106-01', url: `https://drive.google.com/file/d/${ID}/view`, createdAt: '2026-11-06T02:41:00.000Z' };
    const doc = docsFromBackup({ format: 'gemas-lab', version: 2, exportedAt: 'x', experiments: [], harian: [item] } as never).find((d) => d.kind === 'harian')!;
    const row = docToRow(doc);
    expect(row).toMatchObject({ menu: 'daily_report', id: item.id, rev: item.createdAt, daily_report: item });
    expect(rowToDoc(row)).toEqual(doc);
    const empty = { experiments: new Map(), entries: new Map(), protocols: new Map(), media: new Set<string>(), drafts: new Map(), belanja: new Map(), researchKeys: new Set<string>() };
    const remote = { format: 'gemas-lab', version: 2, exportedAt: 'x', experiments: [], harian: [item] } as never;
    expect(planSync(remote, empty, []).add.harian).toEqual([item]);
    expect(planSync(remote, { ...empty, harian: new Set([item.id]) }, []).add.harian).toEqual([]);
  });
});
