'use client';

import { useState } from 'react';
import {
  addProtocolVersion,
  LAB_PRODUCTS,
  nextProtocolKey,
  nextProtocolVersion,
  type LabProductId,
  type ProtocolIngredient,
  type ProtocolStep,
  type ProtocolVersion,
} from '@/lib/labStore';
import { ProductMark, Section, TextInput } from './ui';

const blankIng = (): ProtocolIngredient => ({ name: '', amount: '', unit: '' });
const blankStep = (): ProtocolStep => ({ text: '', duration: '', conditions: '' });

/**
 * Resep & proses buatan pengguna, berversi. Aplikasi TIDAK mengisi angka resep: semua dari pengguna.
 * Versi yang tersimpan tidak bisa diubah; perubahan = versi baru dengan alasan.
 */
export function ProtocolsTab({ protocols, refresh }: { protocols: ProtocolVersion[]; refresh: () => Promise<void> }) {
  const [product, setProduct] = useState<LabProductId | 'all'>('all');
  const [editing, setEditing] = useState<{ base?: ProtocolVersion; product: LabProductId } | undefined>();
  const keys = [...new Set(protocols.filter((p) => product === 'all' || p.product === product).map((p) => p.key))];

  return (
    <div className="flex flex-col gap-5" data-testid="lab-protocols">
      <div className="card flex flex-col gap-3">
        <p className="text-sm">
          Resep & proses <strong>buatanmu sendiri</strong>. Tiap perubahan menjadi <strong>versi baru</strong>; versi lama tetap utuh dan eksperimen lama tetap menunjuk ke versi yang benar-benar dipakai.
          Aplikasi tidak mengisi angka resep.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jalur</span>
            <select className="field" value={product} onChange={(e) => setProduct(e.target.value as LabProductId | 'all')} data-testid="proto-filter">
              <option value="all">Semua jalur</option>
              {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn-primary" onClick={() => setEditing({ product: product === 'all' ? 'KE' : product })} data-testid="proto-new">+ Resep baru</button>
        </div>
      </div>

      {editing && (
        <ProtocolForm
          protocols={protocols}
          base={editing.base}
          initialProduct={editing.product}
          onCancel={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await refresh();
          }}
        />
      )}

      {keys.length ? (
        <ul className="flex flex-col gap-3" data-testid="proto-list">
          {keys.map((k) => {
            const versions = protocols.filter((p) => p.key === k).sort((a, b) => b.version - a.version);
            const latest = versions[0]!;
            return (
              <li key={k} className="card flex flex-col gap-3" data-testid={`proto-${k}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <ProductMark id={latest.product} />
                  <div className="flex flex-1 flex-col">
                    <span className="font-mono text-xs text-muted">{k} · {versions.length} versi</span>
                    <span className="font-display text-lg font-semibold">{latest.name}</span>
                  </div>
                  <button type="button" className="btn-ghost" onClick={() => setEditing({ base: latest, product: latest.product })} data-testid={`proto-newver-${k}`}>Buat versi baru</button>
                </div>
                {versions.map((v) => <VersionView key={v.id} v={v} />)}
              </li>
            );
          })}
        </ul>
      ) : (
        !editing && <p className="text-sm text-muted">Belum ada resep/proses tersimpan.</p>
      )}
    </div>
  );
}

function VersionView({ v }: { v: ProtocolVersion }) {
  return (
    <details className="rounded-xl bg-paper p-3" open={false}>
      <summary className="cursor-pointer font-mono text-xs">
        <strong>{v.id}</strong> · {v.createdAt.slice(0, 10)} · oleh {v.author || 'pengguna'} · {v.reason || 'tanpa alasan'}
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        {v.ingredients.length > 0 && (
          <table className="w-full">
            <tbody>
              {v.ingredients.map((i, n) => (
                <tr key={n} className="border-t border-paper-grid">
                  <td className="py-1 pr-3">{i.name}</td>
                  <td className="py-1 pr-1 text-right font-mono">{i.amount}</td>
                  <td className="py-1 font-mono text-xs">{i.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ol className="list-decimal pl-5">
          {v.steps.map((s, n) => <li key={n}>{s.text}{s.duration && <span className="font-mono text-xs"> · {s.duration}</span>}{s.conditions && <span className="text-muted"> · {s.conditions}</span>}</li>)}
        </ol>
      </div>
    </details>
  );
}

function ProtocolForm({
  protocols,
  base,
  initialProduct,
  onCancel,
  onSaved,
}: {
  protocols: ProtocolVersion[];
  base?: ProtocolVersion;
  initialProduct: LabProductId;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [product, setProduct] = useState<LabProductId>(base?.product ?? initialProduct);
  const [name, setName] = useState(base?.name ?? '');
  const [author, setAuthor] = useState(base?.author ?? '');
  const [reason, setReason] = useState(base ? '' : 'versi awal');
  const [ings, setIngs] = useState<ProtocolIngredient[]>(base ? base.ingredients.map((i) => ({ ...i })) : [blankIng()]);
  const [steps, setSteps] = useState<ProtocolStep[]>(base ? base.steps.map((s) => ({ ...s })) : [blankStep()]);
  const [msg, setMsg] = useState('');
  const key = base?.key ?? nextProtocolKey(product, protocols);
  const { id, version } = nextProtocolVersion(key, protocols);

  const save = async () => {
    if (!name.trim()) return setMsg('Beri nama resep/proses.');
    if (base && !reason.trim()) return setMsg('Tulis alasan perubahan untuk versi baru.');
    try {
      await addProtocolVersion({
        id,
        key,
        version,
        product,
        name: name.trim(),
        author: author.trim(),
        reason: reason.trim(),
        ingredients: ings.filter((i) => i.name.trim()),
        steps: steps.filter((s) => s.text.trim()),
      });
      await onSaved();
    } catch {
      setMsg('Gagal menyimpan (ID versi sudah ada?).');
    }
  };

  return (
    <Section title={base ? `Versi baru dari ${base.id}` : 'Resep/proses baru'} aside={<span className="tag-mono" data-testid="proto-id">{id}</span>} testId="proto-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Jalur produk</span>
          <select className="field" value={product} disabled={!!base} onChange={(e) => setProduct(e.target.value as LabProductId)} data-testid="proto-product">
            {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <TextInput label="Nama resep/proses" value={name} onChange={setName} placeholder="mis. Kopra oven bertahap" testId="proto-name" />
        <TextInput label="Dibuat/diubah oleh" value={author} onChange={setAuthor} placeholder="nama kamu" testId="proto-author" />
        <TextInput label={base ? 'Alasan perubahan (wajib)' : 'Catatan versi'} value={reason} onChange={setReason} testId="proto-reason" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label-mono mb-2">Komposisi — jumlah persis seperti kamu tentukan</legend>
        {ings.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_5rem_auto] items-center gap-2">
            <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Bahan" value={it.name} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} data-testid={`proto-ing-name-${i}`} />
            <input className="field min-h-[44px] text-sm" placeholder="Jumlah" value={it.amount} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} data-testid={`proto-ing-amount-${i}`} />
            <input className="field min-h-[44px] text-sm" placeholder="Satuan" value={it.unit} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} data-testid={`proto-ing-unit-${i}`} />
            <button type="button" aria-label="Hapus bahan" className="font-mono text-xs underline" onClick={() => setIngs(ings.length > 1 ? ings.filter((_, j) => j !== i) : [blankIng()])}>×</button>
          </div>
        ))}
        <button type="button" className="btn-ghost self-start" onClick={() => setIngs([...ings, blankIng()])}>+ Bahan</button>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="label-mono mb-2">Urutan langkah</legend>
        {steps.map((st, i) => (
          <div key={i} className="grid gap-2 rounded-xl border-3 border-ink p-2 sm:grid-cols-[2rem_1fr_8rem_12rem_auto] sm:items-center">
            <span className="font-mono text-xs">{i + 1}.</span>
            <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Langkah" value={st.text} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} data-testid={`proto-step-${i}`} />
            <input className="field min-h-[44px] text-sm" placeholder="Waktu" value={st.duration} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} />
            <input className="field min-h-[44px] font-sans text-sm font-normal" placeholder="Kondisi (suhu, dll.)" value={st.conditions} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, conditions: e.target.value } : x)))} />
            <button type="button" aria-label="Hapus langkah" className="font-mono text-xs underline" onClick={() => setSteps(steps.length > 1 ? steps.filter((_, j) => j !== i) : [blankStep()])}>×</button>
          </div>
        ))}
        <button type="button" className="btn-ghost self-start" onClick={() => setSteps([...steps, blankStep()])}>+ Langkah</button>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => void save()} data-testid="proto-save">Simpan versi {version}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Batal</button>
        {msg && <span className="font-mono text-xs" role="status">{msg}</span>}
      </div>
    </Section>
  );
}
