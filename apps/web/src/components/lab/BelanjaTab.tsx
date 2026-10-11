'use client';

import { useEffect, useState } from 'react';
import {
  allocationTotal,
  blankItem,
  blankProof,
  daysInclusive,
  deleteLpj,
  fmtRp,
  itemTotal,
  listLpj,
  newLpj,
  nextLpjId,
  parseRp,
  realizationTotal,
  saveLpj,
  sectionTotal,
  subtotals,
  terbilang,
  usedPrice,
  type LpjPhoto,
  type LpjReport,
} from '@/lib/belanja';
import { downloadBlob } from '@/lib/labMedia';
import { MediaPicker } from './MediaPicker';
import { Section, TextArea, TextInput } from './ui';

/** Foto nota/barang diperkecil (≤ 1400 px, JPEG) supaya tulisan nota tetap terbaca tapi file tidak besar. */
function photoJpeg(file: File): Promise<LpjPhoto | undefined> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, dataUrl: c.toDataURL('image/jpeg', 0.85) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      res(undefined);
    };
    img.src = url;
  });
}

async function downloadDocx(r: LpjReport) {
  const { buildLpjDocx } = await import('@/lib/belanjaDocx');
  const { DOCX_MIME } = await import('@/lib/officeExport');
  downloadBlob(new Blob([buildLpjDocx(r) as Uint8Array<ArrayBuffer>], { type: DOCX_MIME }), `${r.id}-laporan-belanja.docx`);
}

export function BelanjaTab() {
  const [list, setList] = useState<LpjReport[]>([]);
  const [editing, setEditing] = useState<LpjReport>();
  const load = () => void listLpj().then(setList);
  useEffect(load, []);

  if (editing) return <LpjForm key={editing.id} initial={editing} onClose={() => { setEditing(undefined); load(); }} />;

  return (
    <div className="flex flex-col gap-4" data-testid="lpj-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Laporan belanja ({list.length})</h2>
          <p className="text-sm text-muted">Lembar pertanggungjawaban anggaran R&amp;D: bukti nota &amp; foto barang, rincian alokasi, timeline. Unduh sebagai Word.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditing(newLpj(nextLpjId(list.map((x) => x.id))))} data-testid="lpj-new">+ Laporan belanja baru</button>
      </div>
      {list.length ? (
        <ul className="flex flex-col gap-3" data-testid="lpj-list">
          {list.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted">{r.id} · diubah {r.updatedAt.slice(0, 10)}</p>
                <p className="font-semibold">{r.purpose.trim() || r.subject}</p>
                <p className="text-sm">Anggaran {fmtRp(parseRp(r.budget))} · Realisasi {fmtRp(realizationTotal(r))} · Rincian {fmtRp(allocationTotal(r))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => setEditing(r)} data-testid={`lpj-open-${r.id}`}>Buka</button>
                <button type="button" className="btn-ghost" onClick={() => void downloadDocx(r)} data-testid={`lpj-docx-${r.id}`}>Word</button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (!window.confirm(`Hapus laporan belanja ${r.id} beserta foto nota/barangnya? Tidak bisa dibatalkan.`)) return;
                    void deleteLpj(r.id).then(load);
                  }}
                  data-testid={`lpj-del-${r.id}`}
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Belum ada laporan belanja.</p>
      )}
    </div>
  );
}

function Photos({ photos, onChange, testId }: { photos: LpjPhoto[]; onChange: (p: LpjPhoto[]) => void; testId: string }) {
  return (
    <div className="flex flex-col gap-2">
      <MediaPicker
        compact
        testId={testId}
        onFiles={async (fs) => {
          const out: LpjPhoto[] = [];
          for (const f of fs) if (f.type.startsWith('image/')) {
            const ph = await photoJpeg(f);
            if (ph) out.push(ph);
          }
          onChange([...photos, ...out]);
        }}
      />
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((ph) => (
            <figure key={ph.id} className="relative w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.dataUrl} alt={ph.name} className="h-24 w-24 rounded-lg border border-ink/20 object-cover" />
              <button type="button" className="absolute right-1 top-1 rounded-full bg-ink px-1.5 text-[11px] text-paper" onClick={() => onChange(photos.filter((x) => x.id !== ph.id))} aria-label={`Hapus ${ph.name}`}>×</button>
              <figcaption className="truncate font-mono text-[10px] text-muted">{ph.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

const Money = ({ label, n }: { label: string; n: number }) => (
  <div className="rounded-xl bg-paper p-3">
    <p className="label-mono">{label}</p>
    <p className="font-mono text-xl font-semibold">{fmtRp(n)}</p>
    <p className="text-xs italic text-muted">{terbilang(n)}</p>
  </div>
);

function LpjForm({ initial, onClose }: { initial: LpjReport; onClose: () => void }) {
  const [r, setR] = useState(initial);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof LpjReport>(k: K, v: LpjReport[K]) => setR((x) => ({ ...x, [k]: v }));
  const upd = <T,>(arr: T[], i: number, v: Partial<T>) => arr.map((x, k) => (k === i ? { ...x, ...v } : x));
  const save = async () => {
    await saveLpj(r);
    setMsg(`Tersimpan ${new Date().toLocaleTimeString('id-ID')}`);
  };
  let no = 0;

  return (
    <div className="flex flex-col gap-4" data-testid="lpj-form">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-3 border-ink bg-surface p-3">
        <p className="font-mono text-sm">{r.id}{msg && <span className="ml-2 text-muted">· {msg}</span>}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void save()} data-testid="lpj-save">Simpan</button>
          <button type="button" className="btn-ghost" onClick={() => void save().then(() => downloadDocx(r))} data-testid="lpj-docx">Simpan &amp; unduh Word</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>

      <Section title="1 · Surat">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Pengajuan NO (refer)" value={r.refNo} onChange={(v) => set('refNo', v)} placeholder="KPA/001/10/2026" testId="lpj-ref" />
          <TextInput label="Nomor surat" value={r.letterNo} onChange={(v) => set('letterNo', v)} />
          <TextInput label="Kota" value={r.city} onChange={(v) => set('city', v)} placeholder="Bogor" testId="lpj-city" />
          <label className="flex flex-col gap-1.5"><span className="label-mono">Tanggal pengajuan</span><input type="date" className="field" value={r.date} onChange={(e) => set('date', e.target.value)} data-testid="lpj-date" /></label>
          <TextInput label="Perihal" value={r.subject} onChange={(v) => set('subject', v)} />
          <TextInput label="Lampiran" value={r.attachment} onChange={(v) => set('attachment', v)} />
          <TextInput label="Kepada Yth." value={r.recipient} onChange={(v) => set('recipient', v)} placeholder="nama penerima" testId="lpj-to" />
          <TextInput label="di" value={r.recipientPlace} onChange={(v) => set('recipientPlace', v)} />
        </div>
        <TextInput label="Untuk kebutuhan" value={r.purpose} onChange={(v) => set('purpose', v)} placeholder="R&D Produk : Copra, Bio-Leather & Cuka Kelapa" testId="lpj-purpose" />
      </Section>

      <Section title="2 · Nominal">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <TextInput label="Anggaran pengajuan (Rp)" value={r.budget} onChange={(v) => set('budget', v)} placeholder="5.876.200" testId="lpj-budget" />
            <Money label="Anggaran pengajuan" n={parseRp(r.budget)} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="label-mono">Realisasi dan alokasi (otomatis = jumlah total bukti)</p>
            <Money label="Realisasi" n={realizationTotal(r)} />
          </div>
        </div>
      </Section>

      <Section title="3 · Bukti per alokasi" aside={<button type="button" className="btn-ghost" onClick={() => set('proofs', [...r.proofs, blankProof()])} data-testid="lpj-proof-add">+ Bukti</button>}>
        {r.proofs.map((p, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-ink/20 p-3" data-testid={`lpj-proof-${i}`}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1"><TextInput label={`Judul alokasi ${i + 1}`} value={p.title} onChange={(v) => set('proofs', upd(r.proofs, i, { title: v }))} testId={`lpj-proof-title-${i}`} /></div>
              <div className="w-40"><TextInput label="Total alokasi (Rp)" value={p.total} onChange={(v) => set('proofs', upd(r.proofs, i, { total: v }))} testId={`lpj-proof-total-${i}`} /></div>
              {r.proofs.length > 1 && <button type="button" className="btn-ghost" onClick={() => set('proofs', r.proofs.filter((_, k) => k !== i))}>Hapus bukti</button>}
            </div>
            <p className="text-xs italic text-muted">Terbilang: {terbilang(parseRp(p.total))}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="label-mono mb-1">Nota / bukti bayar</p><Photos photos={p.receipts} onChange={(v) => set('proofs', upd(r.proofs, i, { receipts: v }))} testId={`lpj-nota-${i}`} /></div>
              <div><p className="label-mono mb-1">Foto barang</p><Photos photos={p.goods} onChange={(v) => set('proofs', upd(r.proofs, i, { goods: v }))} testId={`lpj-barang-${i}`} /></div>
            </div>
            <TextArea label="Deskripsi" value={p.description} onChange={(v) => set('proofs', upd(r.proofs, i, { description: v }))} testId={`lpj-proof-desc-${i}`} />
          </div>
        ))}
      </Section>

      <Section title="4 · Penutup & tanda tangan">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Kota" value={r.closingCity} onChange={(v) => set('closingCity', v)} />
          <label className="flex flex-col gap-1.5"><span className="label-mono">Tanggal</span><input type="date" className="field" value={r.closingDate} onChange={(e) => set('closingDate', e.target.value)} /></label>
          {r.signers.map((s, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl bg-paper p-3">
              <TextInput label={`Penanda tangan ${i + 1} — nama`} value={s.name} onChange={(v) => set('signers', upd(r.signers, i, { name: v }))} testId={`lpj-sign-name-${i}`} />
              <TextInput label="Jabatan" value={s.role} onChange={(v) => set('signers', upd(r.signers, i, { role: v }))} testId={`lpj-sign-role-${i}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="5 · Lampiran 1 — rincian alokasi" aside={<button type="button" className="btn-ghost" onClick={() => set('sections', [...r.sections, { title: '', intro: '', items: [blankItem()], note: '' }])} data-testid="lpj-sec-add">+ Bagian</button>}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44"><TextInput label="Batas atas faktor 1 (%)" value={r.markupPct} onChange={(v) => set('markupPct', v)} testId="lpj-markup" /></div>
          <p className="flex-1 text-xs text-muted">Faktor 1 = harga dasar + {r.markupPct || 0}%; faktor 0 = harga dasar. Jumlah = jumlah beli × harga dipakai.</p>
        </div>
        <TextArea label="Pengantar lampiran" value={r.appendixIntro} onChange={(v) => set('appendixIntro', v)} />
        {r.sections.map((sec, si) => (
          <div key={si} className="flex flex-col gap-3 rounded-xl border border-ink/20 p-3" data-testid={`lpj-sec-${si}`}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1"><TextInput label={`Judul bagian ${si + 1}`} value={sec.title} onChange={(v) => set('sections', upd(r.sections, si, { title: v }))} placeholder="Perwadahan dan perlengkapan" testId={`lpj-sec-title-${si}`} /></div>
              {r.sections.length > 1 && <button type="button" className="btn-ghost" onClick={() => set('sections', r.sections.filter((_, k) => k !== si))}>Hapus bagian</button>}
            </div>
            <TextArea label="Paragraf pengantar" value={sec.intro} onChange={(v) => set('sections', upd(r.sections, si, { intro: v }))} />
            {sec.items.map((it, ii) => {
              no++;
              const setIt = (v: Partial<typeof it>) => set('sections', upd(r.sections, si, { items: upd(sec.items, ii, v) }));
              const tid = `lpj-item-${si}-${ii}`;
              return (
                <div key={ii} className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-2 sm:grid-cols-[2.5rem_1fr_2fr_5rem_6rem_7rem_4.5rem_auto]" data-testid={tid}>
                  <span className="self-center font-mono text-sm">{no}</span>
                  <input className="field" placeholder="Alokasi" aria-label="Alokasi" value={it.category} onChange={(e) => setIt({ category: e.target.value })} data-testid={`${tid}-cat`} />
                  <input className="field col-span-2 sm:col-span-1" placeholder="Bahan / perlengkapan" aria-label="Bahan / perlengkapan" value={it.name} onChange={(e) => setIt({ name: e.target.value })} data-testid={`${tid}-name`} />
                  <input className="field" placeholder="Jumlah" aria-label="Jumlah beli" inputMode="decimal" value={it.qty} onChange={(e) => setIt({ qty: e.target.value })} data-testid={`${tid}-qty`} />
                  <input className="field" placeholder="Satuan" aria-label="Satuan beli" value={it.unit} onChange={(e) => setIt({ unit: e.target.value })} data-testid={`${tid}-unit`} />
                  <input className="field" placeholder="Harga dasar" aria-label="Harga dasar (Rp)" inputMode="numeric" value={it.basePrice} onChange={(e) => setIt({ basePrice: e.target.value })} data-testid={`${tid}-price`} />
                  <select className="field" aria-label="Faktor" value={it.factor} onChange={(e) => setIt({ factor: e.target.value === '1' ? 1 : 0 })} data-testid={`${tid}-factor`}>
                    <option value={1}>1</option>
                    <option value={0}>0</option>
                  </select>
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
                    <span className="font-mono text-xs" data-testid={`${tid}-total`}>{fmtRp(usedPrice(it, r.markupPct))} → {fmtRp(itemTotal(it, r.markupPct))}</span>
                    <button type="button" className="text-xs text-muted underline" onClick={() => set('sections', upd(r.sections, si, { items: sec.items.filter((_, k) => k !== ii) }))} aria-label={`Hapus baris ${no}`}>hapus</button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="btn-ghost self-start" onClick={() => set('sections', upd(r.sections, si, { items: [...sec.items, blankItem(sec.items[sec.items.length - 1]?.category ?? '')] }))} data-testid={`lpj-item-add-${si}`}>+ Baris</button>
            <p className="text-sm" data-testid={`lpj-sub-${si}`}>Subtotal {subtotals(sec, r.markupPct).map(([c, n]) => `${c} ${fmtRp(n)}`).join(' · ')} — total bagian <b>{fmtRp(sectionTotal(sec, r.markupPct))}</b></p>
            <TextArea label="Catatan setelah tabel" value={sec.note} onChange={(v) => set('sections', upd(r.sections, si, { note: v }))} />
          </div>
        ))}
        <div className="rounded-xl bg-ink p-3 text-paper" data-testid="lpj-total">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-ink">Rekonsiliasi</p>
          <p className="font-mono text-lg">Rincian {fmtRp(allocationTotal(r))}{parseRp(r.budget) ? ` · anggaran ${fmtRp(parseRp(r.budget))} · selisih ${fmtRp(parseRp(r.budget) - allocationTotal(r))}` : ''}</p>
        </div>
        <TextArea label="Catatan rekonsiliasi" value={r.reconciliationNote} onChange={(v) => set('reconciliationNote', v)} />
      </Section>

      <Section title="6 · Lampiran 2 — timeline & output" aside={<button type="button" className="btn-ghost" onClick={() => set('timeline', [...r.timeline, { activity: '', start: '', end: '' }])} data-testid="lpj-tl-add">+ Kegiatan</button>}>
        <TextArea label="Pengantar timeline" value={r.timelineIntro} onChange={(v) => set('timelineIntro', v)} />
        {r.timeline.map((t, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-2 sm:grid-cols-[1fr_10rem_10rem_4rem_auto]" data-testid={`lpj-tl-${i}`}>
            <input className="field col-span-2 sm:col-span-1" placeholder={`Kegiatan ${i + 1}`} aria-label="Kegiatan" value={t.activity} onChange={(e) => set('timeline', upd(r.timeline, i, { activity: e.target.value }))} data-testid={`lpj-tl-act-${i}`} />
            <input type="date" className="field" aria-label="Mulai" value={t.start} onChange={(e) => set('timeline', upd(r.timeline, i, { start: e.target.value }))} data-testid={`lpj-tl-start-${i}`} />
            <input type="date" className="field" aria-label="Selesai" value={t.end} onChange={(e) => set('timeline', upd(r.timeline, i, { end: e.target.value }))} data-testid={`lpj-tl-end-${i}`} />
            <span className="self-center font-mono text-sm" data-testid={`lpj-tl-days-${i}`}>{daysInclusive(t.start, t.end) ?? '–'} hari</span>
            <button type="button" className="text-xs text-muted underline" onClick={() => set('timeline', r.timeline.filter((_, k) => k !== i))}>hapus</button>
          </div>
        ))}
        <TextArea label="Catatan timeline" value={r.timelineNote} onChange={(v) => set('timelineNote', v)} />
        <TextArea label="Output yang dituju" value={r.output} onChange={(v) => set('output', v)} />
      </Section>
    </div>
  );
}
