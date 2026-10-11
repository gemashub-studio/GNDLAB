'use client';

import { bundledFormulaDataset } from '@gemas/dataset';
import { useEffect, useState } from 'react';
import { addSulfurRecord, listSulfurRecords, missingSulfurFields, nextSulfurId, SULFUR_FORMS, sulfurCsv, type SulfurForm, type SulfurRecord } from '@/lib/sulfurLog';
import { fmt } from '@/lib/format';

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const blank = () => ({
  startedAt: nowLocal(),
  endedAt: '',
  lotCode: '',
  load: '',
  place: '',
  form: SULFUR_FORMS[0] as SulfurForm,
  amount: '',
  unit: 'g',
  basis: '',
  operator: '',
  ppe: '',
  residueResult: '',
  residueLab: '',
  note: '',
});

/**
 * Perlakuan sulfur kopra (DEC-048): status "dosis belum ditetapkan", bukti yang ada & batas residu
 * produk akhir, lalu pencatatan manual. TIDAK ada angka dosis, jadwal, waktu paparan, atau waktu masuk.
 */
export function SulfurPanel({ place = '' }: { place?: string }) {
  const f = bundledFormulaDataset();
  const sul = f.raw.kopra.sulfur;
  const src = (ids: readonly string[]) => ids.map((id) => f.sources.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);

  const [rows, setRows] = useState<SulfurRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({ ...blank(), place }));
  const [msg, setMsg] = useState('');
  const refresh = () => listSulfurRecords().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    void refresh();
  }, []);
  const id = nextSulfurId(form.startedAt, rows.map((r) => r.id));
  const set = (k: keyof ReturnType<typeof blank>) => (v: string) => setForm((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const miss = missingSulfurFields(form);
    if (miss.length || !id) return setMsg(`Isi dulu: ${miss.join(', ')}.`);
    try {
      await addSulfurRecord({ id, ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) } as Omit<SulfurRecord, 'createdAt'>);
      setMsg(`Tersimpan: ${id}. Catatan tidak bisa diubah; koreksi = catatan baru.`);
      setForm({ ...blank(), place });
      setOpen(false);
      void refresh();
    } catch {
      setMsg('Gagal menyimpan. Coba lagi.');
    }
  };

  const csv = () => {
    const url = URL.createObjectURL(new Blob([sulfurCsv(rows)], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `log-perlakuan-sulfur-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const input = (k: keyof ReturnType<typeof blank>, label: string, opts: { type?: string; ph?: string; req?: boolean } = {}) => (
    <label className="flex flex-col gap-1.5">
      <span className="label-mono">{label}{opts.req ? ' *' : ''}</span>
      <input type={opts.type ?? 'text'} className="field font-sans text-sm font-normal" value={form[k]} placeholder={opts.ph} onChange={(e) => set(k)(e.target.value)} data-testid={`sul-${k}`} />
    </label>
  );

  return (
    <section className="card flex flex-col gap-4" aria-label="Perlakuan sulfur" data-testid="sulfur-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl">Perlakuan sulfur — pencatatan manual</h3>
        <span className="rounded-full border-3 border-safety px-2.5 py-0.5 font-mono text-[11px] font-semibold" data-testid="sulfur-status">DOSIS BELUM DITETAPKAN</span>
      </div>
      <p className="text-sm">{sul.status}</p>

      <details className="rounded-xl bg-paper p-3 text-sm" data-testid="sulfur-evidence">
        <summary className="cursor-pointer font-semibold">Bukti yang sudah ditelusuri & kenapa tidak dipakai menghitung</summary>
        <ul className="mt-2 flex flex-col gap-2">
          {sul.evidence.map((e, i) => (
            <li key={i}>
              <span className="mr-2 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] uppercase">{e.kind === 'internal' ? 'dokumen internal' : e.kind === 'primary_single' ? 'satu studi' : 'resmi'}</span>
              {e.note}{' '}
              <span className="font-mono text-[11px] text-muted">({src(e.source_ids).map((s) => s.id).join(', ')})</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-col gap-1 rounded-xl border-3 border-ink p-3 text-sm" data-testid="sulfur-residue">
        <span className="label-mono">Batas residu produk akhir — bukan dosis</span>
        {sul.residue_limits.map((r) => (
          <span key={r.jurisdiction}>
            <strong>{r.jurisdiction}: ≤ {fmt(r.max_mg_kg, 0)} mg/kg SO₂</strong> — {r.scope}. {r.note}{' '}
            {src(r.source_ids).map((s) => (
              <a key={s.id} href={'url' in s ? (s as { url?: string }).url : undefined} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] underline">{s.id}</a>
            ))}
          </span>
        ))}
        <span className="text-muted">Indonesia: {sul.residue_limit_id_note}</span>
        <span className="text-muted">Uji residu hanya di lab; hasilnya catat di log ini. Batas di atas tidak bisa diubah menjadi dosis.</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="sul-new">{open ? 'Tutup formulir' : '+ Catat perlakuan'}</button>
        {rows.length > 0 && <button type="button" className="btn-ghost" onClick={csv} data-testid="sul-csv">Unduh CSV</button>}
        {msg && <span className="font-mono text-xs" role="status" data-testid="sul-msg">{msg}</span>}
      </div>

      {open && (
        <div className="flex flex-col gap-3 rounded-2xl bg-paper p-4" data-testid="sul-form">
          <p className="text-xs text-muted">Jumlah dan dasar penentuannya kamu isi sendiri, apa adanya. Aplikasi tidak menyarankan dosis, lama paparan, atau waktu masuk kembali. <span className="tag-mono">{id ?? 'ID: isi waktu mulai'}</span></p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {input('startedAt', 'Mulai', { type: 'datetime-local', req: true })}
            {input('endedAt', 'Selesai', { type: 'datetime-local' })}
            {input('lotCode', 'Kode lot', { ph: 'mis. DT-261010-001' })}
            {input('load', 'Muatan', { ph: 'mis. 1.200 butir / 2.400 belahan' })}
            {input('place', 'Tempat', { ph: 'mis. greenhouse 3×10×3,5 m' })}
            <label className="flex flex-col gap-1.5">
              <span className="label-mono">Bentuk *</span>
              <select className="field" value={form.form} onChange={(e) => set('form')(e.target.value)} data-testid="sul-form-kind">
                {SULFUR_FORMS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            {input('amount', 'Jumlah dipakai', { ph: 'angka hasil timbang', req: true })}
            {input('unit', 'Satuan', { ph: 'g, kg, %…', req: true })}
            {input('basis', 'Dasar penentuan jumlah', { ph: 'keputusan siapa / sumber apa', req: true })}
            {input('operator', 'Petugas')}
            {input('ppe', 'APD dipakai')}
            {input('residueResult', 'Hasil uji residu SO₂', { ph: 'mg/kg (dari laporan lab)' })}
            {input('residueLab', 'Lab & no. laporan')}
            {input('note', 'Catatan')}
          </div>
          <button type="button" className="btn-primary self-start" onClick={() => void save()} data-testid="sul-save">Simpan catatan</button>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" data-testid="sul-list">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase text-muted">
                <th className="py-1">ID</th><th>Mulai</th><th>Lot</th><th>Bentuk</th><th className="text-right">Jumlah</th><th>Dasar</th><th>Residu SO₂</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-paper-grid">
                  <td className="py-1.5 pr-2 font-mono text-xs">{r.id}</td>
                  <td className="pr-2 font-mono text-xs">{r.startedAt.replace('T', ' ')}</td>
                  <td className="pr-2 font-mono text-xs">{r.lotCode || '–'}</td>
                  <td className="pr-2">{r.form}</td>
                  <td className="pr-2 text-right font-mono">{r.amount} {r.unit}</td>
                  <td className="pr-2">{r.basis}</td>
                  <td className="font-mono text-xs">{r.residueResult || 'belum dicatat'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">Belum ada catatan perlakuan sulfur di perangkat ini.</p>
      )}
    </section>
  );
}
