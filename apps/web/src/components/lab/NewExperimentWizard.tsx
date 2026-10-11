'use client';

import { useMemo, useState } from 'react';
import { buildRuns, DRAFT_STATUS, MAX_FACTORS, parseLevels, responseSuggestions, type ExperimentDesign, type Factor, type ResponseVar } from '@/lib/labDesign';
import { addExperiment, LAB_PRODUCTS, nextExperimentId, updateExperiment, type Experiment, type LabProductId, type ProtocolVersion } from '@/lib/labStore';
import { Section, TextArea, TextInput } from './ui';

const today = () => new Date().toISOString().slice(0, 10);
type FactorDraft = { name: string; unit: string; levels: string };
const blankFactor = (): FactorDraft => ({ name: '', unit: '', levels: '' });

/**
 * Eksperimen baru dalam 3 langkah (DEC-051): Pertanyaan → Desain → Tinjau.
 * Desain opsional — "Catatan bebas" tetap bisa. Semua isi = keputusan pengguna; saran variabel = draf.
 */
export function NewExperimentWizard({ items, protocols, initialProduct, onSaved, existing }: { items: Experiment[]; protocols: ProtocolVersion[]; initialProduct: LabProductId; onSaved: (id: string) => Promise<void>; /** Tambah desain ke eksperimen lama (disimpan lewat riwayat versi). */ existing?: Experiment }) {
  const [step, setStep] = useState(existing ? 1 : 0);
  const [product, setProduct] = useState<LabProductId>(existing?.product ?? initialProduct);
  const [q, setQ] = useState({ title: existing?.title ?? '', startedAt: existing?.startedAt ?? today(), question: existing?.question ?? '', hypothesis: existing?.hypothesis ?? '', objective: existing?.objective ?? '' });
  const [useDesign, setUseDesign] = useState(true);
  const [factors, setFactors] = useState<FactorDraft[]>([blankFactor()]);
  const [control, setControl] = useState('');
  const [reps, setReps] = useState(3);
  const [responses, setResponses] = useState<ResponseVar[]>([]);
  const [custom, setCustom] = useState({ name: '', unit: '' });
  const [protocolId, setProtocolId] = useState(existing?.methodVersion ?? '');
  const [msg, setMsg] = useState('');

  const id = existing ? existing.id : nextExperimentId(product, q.startedAt, items.map((e) => e.id));
  const suggestions = useMemo(() => responseSuggestions(product), [product]);
  const parsed: Factor[] = factors.map((f) => ({ name: f.name.trim(), unit: f.unit.trim(), levels: parseLevels(f.levels) }));
  const allLevels = parsed.flatMap((f) => f.levels.map((l) => `${f.name} = ${l}${f.unit ? ` ${f.unit}` : ''}`));
  const runs = useMemo(() => {
    if (!useDesign || !id) return undefined;
    try {
      return { ok: true as const, v: buildRuns(parsed, reps, id) };
    } catch (e) {
      return { ok: false as const, message: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDesign, id, JSON.stringify(parsed), reps]);
  const mine = protocols.filter((p) => p.product === product);

  const addResponse = (r: ResponseVar) => {
    if (!r.name.trim()) return;
    if (responses.some((x) => x.name.toLowerCase() === r.name.trim().toLowerCase() && x.unit === r.unit.trim())) return;
    setResponses((rs) => [...rs, { ...r, name: r.name.trim(), unit: r.unit.trim() }]);
  };

  const next = () => {
    setMsg('');
    if (step === 0 && (!q.title.trim() || !id)) return setMsg('Isi judul dan tanggal mulai.');
    if (step === 1 && useDesign) {
      if (!runs?.ok) return setMsg(runs?.message ?? 'Lengkapi desain.');
      if (!responses.length) return setMsg('Pilih minimal satu hal yang diukur.');
    }
    setStep((s) => s + 1);
  };

  const save = async () => {
    if (!id) return;
    const design: ExperimentDesign | undefined =
      useDesign && runs?.ok ? { factors: parsed.filter((f) => f.name && f.levels.length), control: control || 'tanpa kontrol', replicates: reps, responses, runs: runs.v } : undefined;
    try {
      if (existing) {
        if (!design) return setMsg('Lengkapi desain dulu.');
        await updateExperiment(existing.id, { design, hypothesis: q.hypothesis.trim(), methodVersion: protocolId, ...(!existing.processConditions && { processConditions: design.factors.map((f) => `${f.name}: ${f.levels.join(' / ')}${f.unit ? ` ${f.unit}` : ''}`).join('; ') }) });
        await onSaved(existing.id);
        return;
      }
      await addExperiment({
        id,
        product,
        title: q.title.trim(),
        startedAt: q.startedAt,
        question: q.question.trim(),
        objective: q.objective.trim(),
        hypothesis: q.hypothesis.trim(),
        methodVersion: protocolId,
        processConditions: design ? design.factors.map((f) => `${f.name}: ${f.levels.join(' / ')}${f.unit ? ` ${f.unit}` : ''}`).join('; ') : '',
        resultSummary: '',
        conclusion: '',
        status: 'rencana',
        ...(design && { design }),
      });
      await onSaved(id);
    } catch {
      setMsg('Gagal menyimpan (ID sudah dipakai?). Coba lagi.');
    }
  };

  const steps = ['Pertanyaan', 'Desain', 'Tinjau'];
  return (
    <Section title={existing ? `Tambah desain — ${existing.id}` : 'Eksperimen baru'} aside={<span className="tag-mono" data-testid="lab-id">{id ?? 'ID: isi tanggal'}</span>} testId="lab-form">
      <ol className="flex gap-2 font-mono text-[11px]" aria-label="Langkah">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${i === step ? 'bg-ink text-acid' : i < step ? 'bg-acid text-ink' : 'bg-paper text-muted'}`}>{i + 1}. {s}</li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="wiz-q">
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jalur produk</span>
            <select className="field" value={product} onChange={(e) => { setProduct(e.target.value as LabProductId); setResponses([]); }} data-testid="lab-product">
              {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Tanggal mulai</span>
            <input type="date" className="field" value={q.startedAt} onChange={(e) => setQ((x) => ({ ...x, startedAt: e.target.value }))} data-testid="lab-date" />
          </label>
          <div className="sm:col-span-2">
            <TextInput label="Judul percobaan *" value={q.title} onChange={(v) => setQ((x) => ({ ...x, title: v }))} placeholder="mis. Pengaruh suhu oven terhadap kadar air" testId="lab-title" />
          </div>
          <TextArea label="Pertanyaan — apa yang mau diketahui?" value={q.question} onChange={(v) => setQ((x) => ({ ...x, question: v }))} placeholder="mis. Suhu berapa yang paling cepat mencapai KA ≤ 6% tanpa gosong?" testId="lab-question" />
          <TextArea label="Dugaan (hipotesis) — jawabanmu sebelum uji" value={q.hypothesis} onChange={(v) => setQ((x) => ({ ...x, hypothesis: v }))} placeholder="mis. 70 °C lebih cepat dari 60 °C, warna tetap putih" testId="lab-hypothesis" />
          <div className="sm:col-span-2">
            <TextInput label="Tujuan (opsional)" value={q.objective} onChange={(v) => setQ((x) => ({ ...x, objective: v }))} testId="lab-objective" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4" data-testid="wiz-design">
          {existing && <TextArea label="Dugaan (hipotesis)" value={q.hypothesis} onChange={(v) => setQ((x) => ({ ...x, hypothesis: v }))} testId="lab-hypothesis" />}
          {!existing && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!useDesign} onChange={(e) => setUseDesign(!e.target.checked)} className="h-4 w-4" data-testid="wiz-free" />
            Lewati desain — catatan bebas saja
          </label>}
          {useDesign && (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="label-mono mb-1">1 · Apa yang kamu ubah? (faktor & levelnya)</legend>
                {factors.map((f, i) => (
                  <div key={i} className="grid gap-2 rounded-xl border-3 border-ink p-3 sm:grid-cols-[1fr_6rem_2fr]">
                    <input className="field font-sans text-sm font-normal" placeholder="Nama faktor, mis. Suhu oven" value={f.name} onChange={(e) => setFactors((fs) => fs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} data-testid={`wiz-f${i}-name`} />
                    <input className="field text-sm" placeholder="Satuan" value={f.unit} onChange={(e) => setFactors((fs) => fs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} data-testid={`wiz-f${i}-unit`} />
                    <input className="field font-sans text-sm font-normal" placeholder="Level dipisah koma, mis. 60, 70, 80" value={f.levels} onChange={(e) => setFactors((fs) => fs.map((x, j) => (j === i ? { ...x, levels: e.target.value } : x)))} data-testid={`wiz-f${i}-levels`} />
                    {parseLevels(f.levels).length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:col-span-3">
                        {parseLevels(f.levels).map((l) => <span key={l} className="rounded-full bg-acid px-2 py-0.5 font-mono text-[11px]">{l}{f.unit ? ` ${f.unit}` : ''}</span>)}
                      </div>
                    )}
                  </div>
                ))}
                {factors.length < MAX_FACTORS && (
                  <button type="button" className="btn-ghost self-start" onClick={() => setFactors((fs) => [...fs, blankFactor()])} data-testid="wiz-add-factor">+ Faktor kedua</button>
                )}
                <p className="text-xs text-muted">Masukkan pembanding (mis. "tanpa perlakuan") sebagai salah satu level.</p>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="label-mono">2 · Pembanding (kontrol)</span>
                  <select className="field font-sans text-sm font-normal" value={control} onChange={(e) => setControl(e.target.value)} data-testid="wiz-control">
                    <option value="">tanpa kontrol</option>
                    {allLevels.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label-mono">3 · Ulangan per perlakuan</span>
                  <input type="number" min={1} max={20} className="field" value={reps} onChange={(e) => setReps(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} data-testid="wiz-reps" />
                  <span className="text-xs text-muted">Lebih banyak ulangan → variasi antar-unit lebih terlihat.</span>
                </label>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="label-mono mb-1">4 · Apa yang kamu ukur?</legend>
                {responses.length > 0 && (
                  <ul className="flex flex-wrap gap-2" data-testid="wiz-responses">
                    {responses.map((r) => (
                      <li key={`${r.name}|${r.unit}`} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs text-paper">
                        {r.name}{r.unit ? ` (${r.unit})` : ''}
                        <button type="button" aria-label={`Hapus ${r.name}`} className="ml-1 text-acid" onClick={() => setResponses((rs) => rs.filter((x) => x !== r))}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
                {suggestions.length > 0 && (
                  <details className="rounded-xl bg-paper p-3" open data-testid="wiz-suggest">
                    <summary className="cursor-pointer text-xs">Saran dari draf parameter ({DRAFT_STATUS}) — klik untuk menambah</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggestions.map((s) => (
                        <button key={s.key} type="button" title={[s.group, s.target && `target ${s.target}`, s.note].filter(Boolean).join(' · ')} className="rounded-full border-3 border-ink bg-surface px-2.5 py-1 text-xs hover:bg-acid" onClick={() => addResponse({ name: s.label, unit: s.unit, key: s.key })} data-testid={`wiz-sug-${s.key}`}>
                          + {s.label}{s.unit ? ` (${s.unit})` : ''}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
                  <input className="field font-sans text-sm font-normal" placeholder="Ukuran lain, mis. Warna (skor 1–5)" value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} data-testid="wiz-resp-name" />
                  <input className="field text-sm" placeholder="Satuan" value={custom.unit} onChange={(e) => setCustom((c) => ({ ...c, unit: e.target.value }))} data-testid="wiz-resp-unit" />
                  <button type="button" className="btn-ghost" onClick={() => { addResponse(custom); setCustom({ name: '', unit: '' }); }} data-testid="wiz-resp-add">Tambah</button>
                </div>
              </fieldset>
              {runs && !runs.ok && <p className="font-mono text-xs text-ink"><span className="bg-safety px-1">{runs.message}</span></p>}
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3" data-testid="wiz-review">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="label-mono">Judul</dt><dd>{q.title}</dd></div>
            <div><dt className="label-mono">Dugaan</dt><dd>{q.hypothesis || <em className="text-muted">belum dicatat</em>}</dd></div>
            {useDesign && runs?.ok && (
              <>
                <div><dt className="label-mono">Perlakuan × ulangan</dt><dd data-testid="wiz-run-count">{runs.v.length / reps} × {reps} = {runs.v.length} unit</dd></div>
                <div><dt className="label-mono">Diukur</dt><dd>{responses.map((r) => `${r.name}${r.unit ? ` (${r.unit})` : ''}`).join(', ')}</dd></div>
              </>
            )}
          </dl>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Riset produk (resep) yang dipakai (opsional)</span>
            <select className="field" value={protocolId} onChange={(e) => setProtocolId(e.target.value)}>
              <option value="">— belum ada —</option>
              {mine.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
            </select>
          </label>
          {useDesign && runs?.ok && (
            <div className="max-h-64 overflow-auto rounded-xl border-3 border-ink">
              <table className="w-full text-sm" data-testid="wiz-runs">
                <thead className="sticky top-0 bg-surface"><tr className="text-left font-mono text-[10px] uppercase text-muted"><th className="p-2">Urutan kerja</th><th>Kode unit</th><th>Perlakuan</th></tr></thead>
                <tbody>
                  {[...runs.v].sort((a, b) => a.order - b.order).map((r) => (
                    <tr key={r.code} className="border-t border-paper-grid"><td className="p-2 font-mono">{r.order}</td><td className="font-mono font-semibold">{r.code}</td><td>{r.label}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted">Urutan kerja diacak (bisa diulang dari ID eksperimen) agar pengaruh waktu/posisi tidak menumpuk di satu perlakuan. Tulis kode unit di wadah/label sampel.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step > (existing ? 1 : 0) && <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>← Kembali</button>}
        {step < 2 ? (
          <button type="button" className="btn-primary" onClick={next} data-testid="wiz-next">Lanjut →</button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void save()} data-testid="lab-save">{existing ? 'Simpan desain' : 'Simpan eksperimen'}</button>
        )}
        {msg && <span className="font-mono text-xs" role="status" data-testid="lab-msg">{msg}</span>}
      </div>
    </Section>
  );
}
