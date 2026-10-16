import { describe, expect, it } from 'vitest';
import { backupFromDocs, docKey, docsFromBackup, extractBlobs, pullFilter, pushPlan, restoreBlobs, tombTargets } from '@/lib/labDocs';
import type { LabBackup } from '@/lib/labBackup';
import { planSync, syncCount, type LocalState } from '@/lib/labSync';
import type { CatatRecord } from '@/lib/pencatatan';

const B64 = 'A'.repeat(400);
const catat = (id: string, updatedAt: string): CatatRecord => ({ id, item: 'Kelapa tua', count: 1, rows: [{ no: 1, beratAwal: '1000', volAir: '', beratAir: '', tebalAwal: '', fotoAwal: `data:image/jpeg;base64,${B64}` }], createdAt: '2026-10-16T01:00:00.000Z', updatedAt });
const backup = (b: Partial<LabBackup>): LabBackup => ({ format: 'gemas-lab', version: 2, exportedAt: 'x', experiments: [], ...b });
const empty = (): LocalState => ({ experiments: new Map(), entries: new Map(), protocols: new Map(), media: new Set(), drafts: new Map(), belanja: new Map(), researchKeys: new Set(), catat: new Map(), bahan: new Set() });

describe('sinkron Supabase — dokumen (DEC-085)', () => {
  it('cadangan ↔ dokumen: jenis, id, versi; nisan jadi dokumen "tomb"', () => {
    const docs = docsFromBackup(backup({ catat: [catat('PD-1', '2026-10-16T02:00:00.000Z')], deleted: [{ kind: 'belanja', id: 'LPJ-1', at: '2026-10-16T03:00:00.000Z' }] }));
    expect(docs.map((d) => [d.kind, d.id, d.rev])).toEqual([
      ['catat', 'PD-1', '2026-10-16T02:00:00.000Z'],
      ['tomb', 'belanja|LPJ-1', '2026-10-16T03:00:00.000Z'],
    ]);
    const back = backupFromDocs(docs);
    expect(back.catat![0]!.id).toBe('PD-1');
    expect(back.deleted).toEqual([{ kind: 'belanja', id: 'LPJ-1', at: '2026-10-16T03:00:00.000Z' }]);
  });

  it('rencana unggah: baru → unggah; append-only tidak diulang; yang berubah hanya bila lebih baru; terhapus di server tidak dihidupkan', () => {
    const remote = new Map([
      [docKey('experiment', 'KE-1'), { rev: 'a', deleted: false }],
      [docKey('catat', 'PD-1'), { rev: '2026-10-16T02:00', deleted: false }],
      [docKey('catat', 'PD-2'), { rev: '2026-10-16T05:00', deleted: false }],
      [docKey('belanja', 'LPJ-9'), { rev: '1', deleted: true }],
    ]);
    const todo = pushPlan(
      [
        { kind: 'experiment', id: 'KE-1', rev: 'zzz' },
        { kind: 'experiment', id: 'KE-2', rev: 'a' },
        { kind: 'catat', id: 'PD-1', rev: '2026-10-16T03:00' },
        { kind: 'catat', id: 'PD-2', rev: '2026-10-16T04:00' },
        { kind: 'belanja', id: 'LPJ-9', rev: '9' },
      ],
      remote,
    );
    expect(todo.map((d) => d.id)).toEqual(['KE-2', 'PD-1']);
  });

  it('ambil dari server: lewati yang versinya sama dengan perangkat; nisan selalu diterapkan; yang dihapus diabaikan', () => {
    const rows = [
      { kind: 'catat', id: 'PD-1', rev: 'r1', deleted: false },
      { kind: 'catat', id: 'PD-2', rev: 'r2', deleted: false },
      { kind: 'tomb', id: 'catat|PD-3', rev: 't', deleted: false },
      { kind: 'catat', id: 'PD-4', rev: 'r4', deleted: true },
    ];
    expect(pullFilter(rows, new Map([[docKey('catat', 'PD-1'), 'r1'], [docKey('tomb', 'catat|PD-3'), 't']])).map((r) => r.id)).toEqual(['PD-2', 'catat|PD-3']);
  });

  it('foto/video dipindah ke Storage lewat penanda lalu dipulihkan persis', async () => {
    const store = new Map<string, string>();
    const put = async (mime: string, b64: string) => {
      const p = `h${store.size}`;
      store.set(p, b64);
      expect(mime).toMatch(/^(image\/jpeg|video\/mp4)$/);
      return p;
    };
    const doc = { rows: [{ fotoAwal: `data:image/jpeg;base64,${B64}`, note: 'pendek' }], media: { type: 'video/mp4', data: B64, name: 'v.mp4' }, small: 'data:image/png;base64,AAAA' };
    const out = (await extractBlobs(doc, put)) as typeof doc;
    expect(out.rows[0]!.fotoAwal).toBe('sbblob:u:image/jpeg:h0');
    expect(out.media.data).toBe('sbblob:b:h1');
    expect(out.small).toBe('data:image/png;base64,AAAA');
    expect(await restoreBlobs(out, async (p) => store.get(p)!)).toEqual(doc);
  });

  it('nisan → target penghapusan di server', () => {
    expect(tombTargets({ kind: 'catat', id: 'PD-1' })).toEqual([['catat', 'id', 'PD-1']]);
    expect(tombTargets({ kind: 'riset', id: 'KE-P01' }).map((t) => t[0])).toEqual(['protocol', 'entry', 'media']);
  });

  it('planSync kini mencakup pencatatan data: baru ditambah, lebih baru menggantikan, nisan menghapus', () => {
    const local = { ...empty(), catat: new Map([['PD-1', '2026-10-16T01:00'], ['PD-3', 'x']]) };
    const remote = backup({ catat: [catat('PD-1', '2026-10-16T09:00'), catat('PD-2', '2026-10-16T02:00')], deleted: [{ kind: 'catat', id: 'PD-3', at: 'z' }] });
    const plan = planSync(remote, local, []);
    expect(plan.add.catat!.map((x) => x.id)).toEqual(['PD-2']);
    expect(plan.replaceCatat.map((x) => x.id)).toEqual(['PD-1']);
    expect(plan.deleteLocal).toEqual([{ kind: 'catat', id: 'PD-3', at: 'z' }]);
    expect(syncCount(plan)).toBe(3);
    // versi perangkat lebih baru → tidak ditimpa
    expect(planSync(remote, { ...empty(), catat: new Map([['PD-1', '2026-10-17']]) }, []).replaceCatat).toEqual([]);
  });
});
