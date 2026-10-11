'use client';

import type { FormulaChecklist } from '@gemas/dataset';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChoiceGroup } from '@/components/ui/fields';
import { Note, Sources, useFormula } from '@/components/formula/shared';
import { checklistCsv, STATUS_TEXT, summarize, type ChecklistFill, type Mark } from '@/lib/checklist';
import { deleteFill, listFills, saveFill } from '@/lib/checklistStore';

type TypeFilter = FormulaChecklist['type'];
type ProductFilter = 'all' | FormulaChecklist['product'];

const TYPE_UI: Record<TypeFilter, { label: string; blurb: string }> = {
  rnd: { label: 'Ceklis R&D', blurb: 'Sebelum & selama percobaan batch: satu variabel per uji, data wajib dicatat.' },
  qc: { label: 'Ceklis QC', blurb: 'Titik kontrol di lini produksi (form KORA F-K, F-A, F-C) — per shift / batch.' },
  product: { label: 'Ceklis produk', blurb: 'Syarat rilis produk jadi sebelum packing & kirim.' },
};
const PRODUCT_UI: Record<Exclude<ProductFilter, 'all'>, string> = { kopra: 'Kopra', arang: 'Arang', briket: 'Briket', cuka: 'Cuka', bioleather: 'Bioleather' };

const today = () => new Date().toISOString().slice(0, 10);
const blankFill = (c: FormulaChecklist): ChecklistFill => ({
  id: crypto.randomUUID(),
  checklistId: c.id,
  date: today(),
  shift: '',
  officer: '',
  lot: '',
  marks: c.items.map(() => undefined),
  notes: c.items.map(() => ''),
  remark: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChecklistPage() {
  const f = useFormula();
  const [type, setType] = useState<TypeFilter>('qc');
  const [product, setProduct] = useState<ProductFilter>('all');
  const [fill, setFill] = useState<ChecklistFill>();
  const [history, setHistory] = useState<ChecklistFill[]>();
  const [msg, setMsg] = useState<string>();

  const reload = useCallback(() => listFills().then(setHistory).catch(() => setHistory([])), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  // Tautan langsung dari kalkulator: /ceklis?id=rnd-cuka-metode → buka ceklis itu.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    const c = id ? f.checklists.find((x) => x.id === id) : undefined;
    if (!c) return;
    setType(c.type);
    setProduct(c.product);
    setFill(blankFill(c));
  }, [f]);

  const list = f.checklists.filter((c) => c.type === type && (product === 'all' || c.product === product));
  const def = fill ? f.checklists.find((c) => c.id === fill.checklistId) : undefined;
  const sum = useMemo(() => (def && fill ? summarize(def, fill.marks) : undefined), [def, fill]);

  const setMark = (i: number, m: Mark) => setFill((x) => x && { ...x, marks: x.marks.map((v, j) => (j === i ? (v === m ? undefined : m) : v)) });
  const setNote = (i: number, v: string) => setFill((x) => x && { ...x, notes: x.notes.map((n, j) => (j === i ? v : n)) });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-2.5">
          <Link href="/formula" className="font-mono text-xs font-bold no-underline">← FORMULA R&amp;D</Link>
          <h1 className="text-[40px] sm:text-[52px]">Ceklis</h1>
          <p className="max-w-xl text-[15px]">
            Ceklis R&amp;D, QC, dan rilis produk dari SOP & form KORA. Isi di HP saat kerja — tersimpan di perangkat walau tanpa sinyal, bisa diunduh CSV atau dicetak.
          </p>
        </div>
        <span className="tag-mono -rotate-[1.5deg]">EXP-CEKLIS // {f.checklists.length} CEKLIS</span>
      </header>

      {!fill && (
        <>
          <ChoiceGroup
            legend="Jenis ceklis"
            columns={3}
            value={type}
            onChange={setType}
            options={(Object.keys(TYPE_UI) as TypeFilter[]).map((t) => ({
              value: t,
              label: TYPE_UI[t].label,
              aside: <span className="font-mono text-xs">{f.checklists.filter((c) => c.type === t).length}</span>,
              testId: `ctype-${t}`,
            }))}
          />
          <p className="text-sm">{TYPE_UI[type].blurb}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter produk">
            {(['all', ...Object.keys(PRODUCT_UI)] as ProductFilter[]).map((p) => (
              <button key={p} type="button" aria-pressed={product === p} onClick={() => setProduct(p)} className="chip min-h-[44px]" data-testid={`cprod-${p}`}>
                {p === 'all' ? 'Semua' : PRODUCT_UI[p]}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2" data-testid="checklist-list">
            {list.length === 0 && <p className="text-sm">Belum ada ceklis {TYPE_UI[type].label.toLowerCase()} untuk produk ini.</p>}
            {list.map((c) => (
              <article key={c.id} className="card flex flex-col gap-3" data-testid={`cl-${c.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tag-mono">{PRODUCT_UI[c.product].toUpperCase()}</span>
                  <span className="font-mono text-xs">{c.form_ref}</span>
                </div>
                <h2 className="text-xl">{c.stage}</h2>
                <p className="font-mono text-xs">
                  {c.items.length} item · {c.items.filter((i) => i.critical).length} kritis
                </p>
                <button type="button" className="btn-primary self-start" onClick={() => { setFill(blankFill(c)); setMsg(undefined); }} data-testid={`open-${c.id}`}>
                  Isi ceklis
                </button>
              </article>
            ))}
          </div>

          <section aria-labelledby="hist-h" className="card flex flex-col gap-3">
            <h2 id="hist-h" className="text-2xl">Riwayat di perangkat ini</h2>
            {history === undefined ? (
              <p className="font-mono text-sm">Memuat…</p>
            ) : history.length === 0 ? (
              <p className="text-sm">Belum ada ceklis tersimpan.</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="checklist-history">
                {history.map((h) => {
                  const d = f.checklists.find((c) => c.id === h.checklistId);
                  if (!d) return null;
                  const s = summarize(d, h.marks);
                  return (
                    <li key={h.id} className="flex flex-wrap items-center gap-3 border-2 border-ink p-3">
                      <span className={`px-1 font-mono text-[11px] font-bold ${s.status === 'fail' ? 'bg-safety' : s.status === 'incomplete' ? 'bg-paper' : 'bg-acid'}`}>{STATUS_TEXT[s.status].toUpperCase()}</span>
                      <span className="min-w-0 flex-1 font-bold">{d.stage}</span>
                      <span className="font-mono text-xs">{h.date} · {h.lot || '—'} · {h.officer || '—'}</span>
                      <button type="button" className="btn-ghost min-h-0 py-1.5 text-xs" onClick={() => setFill(h)}>Buka</button>
                      <button type="button" className="btn-ghost min-h-0 py-1.5 text-xs" onClick={async () => { await deleteFill(h.id); void reload(); }}>Hapus</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {fill && def && sum && (
        <section aria-labelledby="fill-h" className="flex flex-col gap-4" data-testid="checklist-fill">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <button type="button" className="btn-ghost" onClick={() => { setFill(undefined); void reload(); }}>← Daftar ceklis</button>
            <span className="font-mono text-xs">{def.form_ref}</span>
          </div>
          <div className="card flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="tag-mono">{TYPE_UI[def.type].label.toUpperCase()} · {PRODUCT_UI[def.product].toUpperCase()}</span>
                <h2 id="fill-h" className="mt-2 text-2xl">{def.stage}</h2>
              </div>
              <span
                className={`border-3 border-ink px-3 py-2 font-extrabold uppercase ${sum.status === 'fail' ? 'bg-safety' : sum.status === 'incomplete' ? 'bg-paper' : 'bg-acid'}`}
                data-testid="checklist-status"
                data-status={sum.status}
              >
                {STATUS_TEXT[sum.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['date', 'Tanggal', 'date'],
                  ['shift', 'Shift', 'text'],
                  ['officer', 'Petugas', 'text'],
                  ['lot', 'Lot / batch', 'text'],
                ] as const
              ).map(([k, label, t]) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="label-mono">{label}</span>
                  <input type={t} value={fill[k]} onChange={(e) => setFill({ ...fill, [k]: e.target.value })} className="field text-base" data-testid={`fill-${k}`} />
                </label>
              ))}
            </div>
            <p className="font-mono text-xs">
              {sum.answered}/{sum.total} dijawab · {sum.ok} OK · {sum.ng} TIDAK{sum.criticalOpen > 0 && ` · ${sum.criticalOpen} item kritis belum dicek`}
            </p>
            <ol className="flex flex-col gap-2">
              {def.items.map((it, i) => {
                const m = fill.marks[i];
                return (
                  <li key={i} className={`flex flex-col gap-2 border-2 border-ink p-3 ${m === 'ng' ? 'bg-paper' : 'bg-surface'}`} data-testid={`item-${i}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="font-mono text-sm font-bold">{String(i + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1 text-[15px]">
                        {it.text}
                        {it.critical && <span className="ml-2 bg-ink px-1 font-mono text-[10px] font-bold text-acid">KRITIS</span>}
                      </span>
                      <div className="flex gap-2" role="group" aria-label={`Hasil item ${i + 1}`}>
                        <button type="button" aria-pressed={m === 'ok'} onClick={() => setMark(i, 'ok')} className="chip min-h-[44px] px-4" data-testid={`ok-${i}`}>OK</button>
                        <button type="button" aria-pressed={m === 'ng'} onClick={() => setMark(i, 'ng')} className={`chip min-h-[44px] px-4 ${m === 'ng' ? '!bg-safety' : ''}`} data-testid={`ng-${i}`}>Tidak</button>
                      </div>
                    </div>
                    {m === 'ng' && (
                      <input value={fill.notes[i] ?? ''} onChange={(e) => setNote(i, e.target.value)} placeholder="Apa yang tidak sesuai & tindakan koreksinya?" className="field text-sm" aria-label={`Catatan item ${i + 1}`} />
                    )}
                  </li>
                );
              })}
            </ol>
            <label className="flex flex-col gap-1">
              <span className="label-mono">Catatan umum / keputusan</span>
              <textarea value={fill.remark} onChange={(e) => setFill({ ...fill, remark: e.target.value })} rows={3} className="field min-h-[96px] py-2 text-base" />
            </label>
            {sum.status === 'fail' && (
              <Note tone="warn" title="Ada item kritis yang tidak sesuai">Tahan batch/lot (karantina), cari akar masalah, catat tindakan koreksi sebelum lanjut (Modul QC §3.2).</Note>
            )}
            <Sources ids={def.source_ids} />
            <div className="flex flex-wrap gap-3 print:hidden">
              <button type="button" className="btn-primary" data-testid="fill-save" onClick={async () => { await saveFill(fill); setMsg('Tersimpan di perangkat ini.'); void reload(); }}>
                Simpan di perangkat
              </button>
              <button type="button" className="btn-ghost" onClick={() => download(`ceklis_${def.id}_${fill.date}.csv`, checklistCsv(def, fill))} data-testid="fill-csv">
                Unduh CSV
              </button>
              <button type="button" className="btn-ghost" onClick={() => window.print()}>Cetak</button>
              <button type="button" className="btn-ghost" onClick={() => setFill(blankFill(def))}>Kosongkan</button>
            </div>
            {msg && <p role="status" className="font-bold" data-testid="fill-msg">{msg}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
