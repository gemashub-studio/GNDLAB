import { describe, expect, it } from 'vitest';
import { planSync, mergeTombs, syncCount, type LocalState } from '@/lib/labSync';
import { newLpj } from '@/lib/belanja';
import type { LabBackup } from '@/lib/labBackup';

const empty = (): LocalState => ({ experiments: new Map(), entries: new Map(), protocols: new Map(), media: new Set(), drafts: new Map(), belanja: new Map(), researchKeys: new Set() });
const remote = (x: Partial<LabBackup>): LabBackup => ({ format: 'gemas-lab', version: 2, exportedAt: 'x', experiments: [], ...x });
const proto = (key: string, v = 1) => ({ id: `${key}-v${v}`, key, version: v, product: 'KE', name: key, author: '', reason: '', createdAt: 'x', ingredients: [], steps: [] });
const entry = (id: string, experimentId: string) => ({ id, experimentId, entryDate: '2026-10-13', createdAt: 'x', protocolId: '', plan: '', actual: '', materials: [], tools: '', conditions: '', measurements: [], deviations: '', interpretation: '', nextStep: '', mediaIds: [] });
const draft = (id: string, updatedAt: string) => ({ id, product: 'KE', name: id, author: '', assistants: '', startDate: '', reason: '', ingredients: [], tools: [], steps: [], pending: { ingredients: [], tools: [], steps: [] }, createdAt: 'x', updatedAt });

describe('sinkron Google Drive — penggabungan (DEC-065)', () => {
  it('catatan resmi: yang belum ada ditambah, yang ada tidak ditimpa', () => {
    const local = { ...empty(), protocols: new Map([['KE-P01-v1', 'x']]) };
    const p = planSync(remote({ protocols: [proto('KE-P01'), proto('KE-P02')], entries: [entry('KE-P02-H01', 'KE-P02')] }), local, []);
    expect(p.add.protocols.map((x) => x.id)).toEqual(['KE-P02-v1']);
    expect(p.add.entries.map((x) => x.id)).toEqual(['KE-P02-H01']);
    expect(syncCount(p)).toBe(2);
  });

  it('ID kembar dengan isi beda (dibuat terpisah) dilaporkan, tidak menimpa/menghilang diam-diam', () => {
    const local = { ...empty(), protocols: new Map([['KE-P01-v1', 'laptop-time']]) };
    const p = planSync(remote({ protocols: [proto('KE-P01')] }), local, []);
    expect(p.conflicts).toEqual(['KE-P01-v1']);
    expect(p.add.protocols).toEqual([]);
  });

  it('draf & laporan belanja: yang lebih baru menang', () => {
    const local = { ...empty(), drafts: new Map([['D-a', '2026-10-13T10:00:00Z'], ['D-b', '2026-10-13T12:00:00Z']]), belanja: new Map([['LPJ-1', '2026-10-13T08:00:00Z']]) };
    const p = planSync(remote({ drafts: [draft('D-a', '2026-10-13T11:00:00Z'), draft('D-b', '2026-10-13T11:00:00Z')], belanja: [{ ...newLpj('LPJ-1'), updatedAt: '2026-10-13T09:00:00Z' }] }), local, []);
    expect(p.replaceDrafts.map((d) => d.id)).toEqual(['D-a']);
    expect(p.replaceBelanja.map((d) => d.id)).toEqual(['LPJ-1']);
    expect(p.add.drafts).toEqual([]);
  });

  it('penghapusan tidak muncul lagi & ikut terhapus di perangkat lain', () => {
    // perangkat ini menghapus riset KE-P02 & draf D-x; Drive masih punya keduanya
    const tombs = [{ kind: 'riset' as const, id: 'KE-P02', at: 'x' }, { kind: 'draf' as const, id: 'D-x', at: 'x' }];
    const p = planSync(remote({ protocols: [proto('KE-P02')], entries: [entry('KE-P02-H01', 'KE-P02')], drafts: [draft('D-x', 'z')] }), empty(), tombs);
    expect(syncCount(p)).toBe(0);
    // perangkat lain menghapus LPJ-9 & riset KE-P05 yang masih ada di sini → hapus di sini
    const local = { ...empty(), belanja: new Map([['LPJ-9', 'a']]), researchKeys: new Set(['KE-P05']) };
    const q = planSync(remote({ deleted: [{ kind: 'belanja', id: 'LPJ-9', at: 'x' }, { kind: 'riset', id: 'KE-P05', at: 'x' }] }), local, []);
    expect(q.deleteLocal.map((t) => t.id)).toEqual(['LPJ-9', 'KE-P05']);
    expect(q.tombs).toHaveLength(2);
  });

  it('nisan digabung tanpa dobel', () => {
    expect(mergeTombs([{ kind: 'draf', id: 'a', at: '1' }], [{ kind: 'draf', id: 'a', at: '2' }, { kind: 'belanja', id: 'a', at: '3' }])).toHaveLength(2);
  });
});

describe('kode perangkat untuk ID baru (DEC-065)', () => {
  it('ID diberi kode perangkat; angka urut tetap terbaca', async () => {
    const { nextProtocolKey, nextProtocolVersion, nextEntryId, nextExperimentId } = await import('@/lib/labStore');
    const { nextLpjId } = await import('@/lib/belanja');
    const v = (key: string, version: number) => ({ id: `${key}-v${version}`, key, version, product: 'KE', name: '', author: '', reason: '', createdAt: '', ingredients: [], steps: [] });
    expect(nextProtocolKey('KE', [v('KE-P01', 1), v('KE-P02K7', 1)], 'M3')).toBe('KE-P03M3');
    expect(nextProtocolVersion('KE-P03M3', [v('KE-P03M3', 1)], 'K7')).toEqual({ id: 'KE-P03M3-v2K7', version: 2 });
    expect(nextEntryId('KE-P01', ['KE-P01-H01', 'KE-P01-H02K7'], 'M3')).toBe('KE-P01-H03M3');
    expect(nextExperimentId('KE', '2026-10-13', ['KE-2610-001K7'], 'M3')).toBe('KE-2610-002M3');
    expect(nextLpjId(['LPJ-202610-01K7'], new Date(2026, 9, 13), 'M3')).toBe('LPJ-202610-02M3');
    expect(nextProtocolKey('KE', [], '')).toBe('KE-P01');
  });
});
