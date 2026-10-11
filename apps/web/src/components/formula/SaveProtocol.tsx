'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  addProtocolVersion,
  listProtocols,
  nextProtocolKey,
  nextProtocolVersion,
  type LabProductId,
  type ProtocolIngredient,
  type ProtocolVersion,
} from '@/lib/labStore';

/**
 * Simpan isian kalkulator sebagai VERSI PROTOKOL di GEMA RnD Lab (ADR-012): resep tetap milik
 * pengguna; versi lama tidak diubah. Bisa jadi resep baru atau versi berikutnya dari resep yang ada.
 */
export function SaveProtocol({ product, defaultName, ingredients, context, testId = 'save-proto' }: {
  product: LabProductId;
  defaultName: string;
  /** Bahan & jumlah dari isian kalkulator — disimpan apa adanya (teks). */
  ingredients: ProtocolIngredient[];
  /** Ringkasan isian yang dipakai (mis. °Brix target), disimpan di alasan versi. */
  context: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [protocols, setProtocols] = useState<ProtocolVersion[]>([]);
  const [target, setTarget] = useState<string>('new');
  const [name, setName] = useState(defaultName);
  const [author, setAuthor] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (open) void listProtocols().then((p) => setProtocols(p.filter((x) => x.product === product))).catch(() => setProtocols([]));
  }, [open, product]);

  const keys = [...new Set(protocols.map((p) => p.key))];
  const key = target === 'new' ? nextProtocolKey(product, protocols) : target;
  const { id, version } = nextProtocolVersion(key, protocols);

  const save = async () => {
    if (!name.trim()) return setMsg('Beri nama resep.');
    if (target !== 'new' && !reason.trim()) return setMsg('Tulis alasan perubahan untuk versi baru.');
    try {
      await addProtocolVersion({
        id,
        key,
        version,
        product,
        name: name.trim(),
        author: author.trim(),
        reason: [reason.trim() || 'versi awal', `dari kalkulator Formula R&D: ${context}`].join(' — '),
        ingredients,
        steps: [],
      });
      setMsg(`Tersimpan sebagai ${id}. Langkah proses bisa kamu lengkapi sebagai versi berikutnya di Lab → Riset Produk.`);
      setOpen(false);
    } catch {
      setMsg('Gagal menyimpan (ID versi sudah ada?). Coba lagi.');
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid={`${testId}-open`}>
          {open ? 'Batal' : 'Simpan sebagai riset produk'}
        </button>
        {msg && <span className="font-mono text-xs" role="status" data-testid={`${testId}-msg`}>{msg} <Link href="/lab?t=protokol" className="underline">Buka Lab</Link></span>}
      </div>
      {open && (
        <div className="grid gap-3 rounded-xl bg-paper p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Simpan ke</span>
            <select className="field" value={target} onChange={(e) => setTarget(e.target.value)} data-testid={`${testId}-target`}>
              <option value="new">Resep baru</option>
              {keys.map((k) => <option key={k} value={k}>Versi baru dari {k}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Nama resep</span>
            <input className="field font-sans text-sm font-normal" value={name} onChange={(e) => setName(e.target.value)} data-testid={`${testId}-name`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Dibuat oleh</span>
            <input className="field font-sans text-sm font-normal" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">{target === 'new' ? 'Catatan versi' : 'Alasan perubahan (wajib)'}</span>
            <input className="field font-sans text-sm font-normal" value={reason} onChange={(e) => setReason(e.target.value)} data-testid={`${testId}-reason`} />
          </label>
          <p className="text-xs text-muted sm:col-span-2">
            Disimpan sebagai <strong className="font-mono">{id}</strong>: {ingredients.length} bahan dengan jumlah persis dari isianmu. Versi lama tidak berubah.
          </p>
          <button type="button" className="btn-primary self-start" onClick={() => void save()} data-testid={`${testId}-save`}>Simpan versi {version}</button>
        </div>
      )}
    </div>
  );
}
