'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RawRecord } from '@/lib/bahanBaku';
import { RAW_ITEMS } from '@/lib/labStore';
import {
  addCatatAwal,
  canCloseCatat,
  KOPRA_METHODS,
  methodLabel,
  closeCatat,
  deleteCatat,
  awalColumns,
  blankRows,
  hasThickness,
  MAX_ROWS,
  missingAkhir,
  missingAwal,
  saveCatatAkhir,
  type AkhirInput,
  TREATMENT_GROUPS,
  TREATMENT_INFO,
  treatmentRows,
  treatmentEntries,
  akhirFilled,
  sortProgress,
  type Treatments,
  type TreatmentEntry,
  type TreatmentKey,
  type CatatRecord,
  type CatatRow,
  addBioCard,
  BIO_PICK_METHODS,
} from '@/lib/pencatatan';
import { photoDataUrl } from '@/lib/photo';
import { CatatResult, DownloadButtons } from './CatatResult';
import { Dropdown } from './Dropdown';
import { askConfirm, ImagePreview, LoadingOverlay, SuccessAlert, useConfirm } from './Overlays';
import { FinishConfirm, FireworksAlert } from './FinishDialogs';
import { VoiceFill } from './VoiceFill';
import { AKHIR_VOICE_FIELDS, AWAL_VOICE_FIELDS } from '@/lib/voiceFill';
import { downloadBlob } from '@/lib/labMedia';

/** Unduh Excel pencatatan (DEC-098): data awal & akhir, perbandingan, tebal daging, perlakuan, kesimpulan. */
async function downloadXlsx(rec: CatatRecord) {
  const { buildCatatXlsx, XLSX_MIME } = await import('@/lib/catatXlsx');
  downloadBlob(new Blob([buildCatatXlsx(rec) as Uint8Array<ArrayBuffer>], { type: XLSX_MIME }), `${rec.id}-pencatatan-data.xlsx`);
}

function XlsxButton({ rec, testId }: { rec: () => CatatRecord | undefined; testId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost min-h-[40px] px-3"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        const r = rec();
        if (!r) return;
        setBusy(true);
        void downloadXlsx(r).finally(() => setBusy(false));
      }}
      data-testid={testId}
    >
      {busy ? '…' : 'Unduh Excel'}
    </button>
  );
}

/** Sebutan suara kolom ke-2, ke-3, … ("jumlah kopra kedua"), DEC-104. */
const ORD = ['', ' kedua', ' ketiga', ' keempat', ' kelima', ' keenam'];
const ord = (i: number) => ORD[i] ?? ` ${i + 1}`;
/** Sebutan singkat jenis perlakuan untuk perintah suara. */
const TR_SAY: Record<TreatmentKey, string[]> = { kopra: ['kopra'], bibit: ['bibit', 'bibit bio leather'], cuka: ['cuka'], bio: ['bio leather'] };
const say = (prefixes: string[], key: TreatmentKey, i: number) => prefixes.flatMap((p) => TR_SAY[key].map((n) => `${p} ${n}${ord(i)}`)).join('|');

/** Loading tampil minimal 4 detik (satu siklus animasi, DEC-079). */
const SAVE_MS = 4000;
const field = 'field min-h-[40px] w-full bg-white px-2 text-sm';

/**
 * PENCATATAN DATA (DEC-074): kartu statistik, catatan awal (N nomor), catatan akhir berdampingan dengan awal,
 * kartu hasil (unduh PDF/Word/PPTX + pratinjau), dan halaman hasil /lab/hasil.
 */
export function PencatatanTab({ records, oldRaw, onChanged }: { records: CatatRecord[]; oldRaw: RawRecord[]; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<'' | 'awal' | 'akhir'>('');
  const [preview, setPreview] = useState<CatatRecord>();
  const [toast, setToast] = useState<'' | 'saving' | 'finishing'>('');
  const [done, setDone] = useState<CatatRecord>();
  const [drafted, setDrafted] = useState<CatatRecord>();
  // revisi data akhir catatan yang sudah lengkap (DEC-083)
  const [revise, setRevise] = useState<CatatRecord>();
  const [revised, setRevised] = useState<CatatRecord>();
  const [ask, dialog] = useConfirm();
  // Selesaikan (DEC-098): ketik "Selesai" → simpan (bila dari form) → kartu hijau → petasan
  const [finishing, setFinishing] = useState<{ rec: CatatRecord; akhir?: AkhirInput[]; tr?: Treatments }>();
  const [success, setSuccess] = useState(false);
  // mode pilih (DEC-076): hanya catatan lengkap (awal & akhir) yang bisa dipilih
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState(0);
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const removePicked = async () => {
    const ids = [...picked];
    if (!ids.length) return;
    if (!(await ask({ title: 'Hapus catatan', message: `Hapus ${ids.length} catatan terpilih?\nData yang sudah dihapus TIDAK dapat dipulihkan.`, okLabel: `Hapus (${ids.length})` }))) return;
    const n = await deleteCatat(ids);
    // langsung hilang dari layar (tidak menunggu muat ulang), lalu muat ulang dari penyimpanan
    setRemoved((cur) => new Set([...cur, ...ids]));
    setPreview((p) => (p && ids.includes(p.id) ? undefined : p));
    setPicked(new Set());
    setSelecting(false);
    await onChanged();
    setDeleted(n);
  };
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const live = records.filter((r) => !removed.has(r.id));
  const pending = live.filter((r) => !r.finishedAt);
  const finished = live.length - pending.length;
  // kartu: yang menunggu data akhir di atas, yang lengkap di bawah (DEC-079)
  const ordered = [...pending, ...live.filter((r) => r.finishedAt)];
  const complete = live.filter((r) => r.finishedAt);

  const finish = async (f: { rec: CatatRecord; akhir?: AkhirInput[]; tr?: Treatments }) => {
    setFinishing(undefined);
    setMode('');
    setRevise(undefined);
    setPreview(undefined);
    setToast('finishing');
    const started = Date.now();
    try {
      if (f.akhir) await saveCatatAkhir(f.rec.id, f.akhir, f.tr, true);
      await closeCatat(f.rec.id);
      await onChanged();
      window.setTimeout(() => {
        setToast('');
        setSuccess(true);
      }, Math.max(0, 1500 - (Date.now() - started)));
    } catch (e) {
      setToast('');
      await ask({ title: 'Belum bisa diselesaikan', message: e instanceof Error ? e.message : String(e), okLabel: 'OK', danger: false });
    }
  };

  const saveAwal = async (item: string, rows: CatatRow[], treatments?: Treatments) => {
    setMode('');
    setToast('saving');
    const started = Date.now();
    await addCatatAwal(item, rows, treatments);
    await onChanged();
    window.setTimeout(() => setToast(''), Math.max(0, SAVE_MS - (Date.now() - started)));
  };
  const saveAkhir = async (id: string, akhir: AkhirInput[], treatments: Treatments, isRevision = false) => {
    setMode('');
    setRevise(undefined);
    setToast('finishing');
    const started = Date.now();
    const rec = await saveCatatAkhir(id, akhir, treatments);
    await onChanged();
    window.setTimeout(() => {
      setToast('');
      if (isRevision) setRevised(rec);
      else setDone(rec);
    }, Math.max(0, SAVE_MS - (Date.now() - started)));
  };
  // "Simpan dulu": data akhir belum lengkap disimpan sebagai pembaruan terbaru (DEC-082)
  const saveDraft = async (id: string, akhir: AkhirInput[], treatments: Treatments) => {
    setMode('');
    setToast('saving');
    const started = Date.now();
    const rec = await saveCatatAkhir(id, akhir, treatments, false);
    await onChanged();
    window.setTimeout(() => {
      setToast('');
      setDrafted(rec);
    }, Math.max(0, SAVE_MS - (Date.now() - started)));
  };

  return (
    <div className="flex flex-col gap-5" data-testid="catat-tab">
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3" data-testid="catat-stats">
        {[
          ['Catatan data awal', live.length, 'catat-stat-awal'],
          ['Catatan data akhir', finished, 'catat-stat-akhir'],
          ['Menunggu data akhir', pending.length, 'catat-stat-pending'],
        ].map(([k, v, id]) => (
          <div key={id as string} className="card card-data flex flex-col gap-1" data-testid={id as string}>
            <dt className="label-mono">{k}</dt>
            <dd className="font-mono text-3xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => setMode('awal')} data-testid="catat-new">+ Buat catatan baru</button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!pending.length}
          title={pending.length ? '' : 'Buat & simpan catatan awal dulu'}
          onClick={() => setMode('akhir')}
          data-testid="catat-akhir"
        >
          Buat pencatatan data akhir
        </button>
        <SelectMenu
          selecting={selecting}
          count={picked.size}
          disabled={!complete.length}
          onOne={() => setSelecting(true)}
          onAll={() => {
            setSelecting(true);
            setPicked(new Set(complete.map((r) => r.id)));
          }}
          onDelete={() => void removePicked()}
          onCancel={() => {
            setSelecting(false);
            setPicked(new Set());
          }}
        />
        {!pending.length && <span className="text-xs text-muted" data-testid="catat-akhir-hint">{live.length ? 'Semua catatan awal sudah punya data akhir.' : 'Pencatatan data akhir bisa dibuka setelah ada catatan awal tersimpan.'}</span>}
      </div>

      {ordered.length ? (
        <ul className="flex flex-col gap-3" data-testid="catat-list">
          {ordered.map((r) => {
            const can = selecting && !!r.finishedAt;
            const on = picked.has(r.id);
            const open = () => (can ? toggle(r.id) : selecting ? undefined : setPreview(r));
            return (
            <li key={r.id}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={selecting ? on : undefined}
                onClick={open}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
                className={`card card-data flex cursor-pointer flex-col gap-3 transition sm:flex-row sm:items-center sm:justify-between ${r.closedAt ? 'border-[#1FA88F] bg-[#E3F7F1]' : ''} ${on ? 'border-acid ring-2 ring-acid/50' : 'hover:border-acid'} ${selecting && !r.finishedAt ? 'cursor-not-allowed opacity-50' : ''}`}
                data-testid={`catat-card-${r.id}`}
              >
                {selecting && (
                  <input
                    type="checkbox"
                    className="h-5 w-5 flex-none accent-[#1FA88F]"
                    checked={on}
                    disabled={!r.finishedAt}
                    onChange={() => toggle(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={r.finishedAt ? `Pilih ${r.id}` : `${r.id} belum lengkap — tidak bisa dipilih`}
                    data-testid={`catat-check-${r.id}`}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-mono text-xs text-muted">{r.id} · {r.createdAt.slice(0, 10)}</span>
                  <span className="font-display text-lg font-semibold">{r.item} · {r.count} {r.count === 1 ? 'item' : 'item'}</span>
                  {treatmentRows(r.treatments).length > 0 && <span className="text-xs text-muted">{treatmentRows(r.treatments).map(([t, c, m]) => `${t.replace('Jumlah perlakuan ', '')}: ${c} × ${m}`).join(' · ')}</span>}
                  <span className={`self-start rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${r.closedAt ? 'bg-[#1FA88F] text-white' : r.finishedAt ? 'bg-acid text-ink' : 'bg-safety text-ink'}`} data-testid={`catat-status-${r.id}`}>
                    {r.closedAt ? '✓ Selesai' : r.finishedAt ? 'Awal & akhir lengkap · belum diselesaikan' : 'Menunggu data akhir'}
                    {!r.finishedAt && r.akhirSavedAt && ` · tersimpan sementara (${akhirFilled(r)}/${r.count})`}
                  </span>
                  {r.finishedAt && !!r.progress?.length && (
                    <span className="flex flex-wrap items-center gap-2 rounded-xl border border-acid/50 bg-acid/10 px-2.5 py-1.5 text-xs" data-testid={`catat-progress-${r.id}`}>
                      <span className="prog-pulse inline-block h-2 w-2 rounded-full bg-[#1FA88F]" aria-hidden />
                      <span className="font-semibold">Progres harian sedang berlangsung</span>
                      <span className="text-muted">{r.progress.length} foto · terakhir {[...r.progress].map((p) => p.date).sort().at(-1)}</span>
                      <span className="flex -space-x-2">
                        {sortProgress(r.progress).slice(-4).map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={p.id} src={p.photo} alt={`Progres ${p.date}`} className="h-7 w-7 rounded-full border-2 border-white object-cover" />
                        ))}
                      </span>
                    </span>
                  )}
                </div>
                {!selecting && <DownloadButtons rec={r} testId={`catat-dl-${r.id}`} />}
              </div>
            </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm italic text-muted">Belum ada pencatatan. Mulai dengan “+ Buat catatan baru”.</p>
      )}

      {oldRaw.length > 0 && (
        <details className="rounded-xl bg-paper p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Catatan bahan baku lama ({oldRaw.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {oldRaw.map((r) => <li key={r.id} className="font-mono text-xs">{r.id} · {r.item} · {r.name} · berat utuh {r.wholeWeight || '–'} g</li>)}
          </ul>
        </details>
      )}

      {mode === 'awal' && <AwalModal onClose={() => setMode('')} onConfirm={(item, rows, t) => void saveAwal(item, rows, t)} />}
      {mode === 'akhir' && <AkhirModal pending={pending} onClose={() => setMode('')} onConfirm={(id, a, t) => void saveAkhir(id, a, t)} onDraft={(id, a, t) => void saveDraft(id, a, t)} onFinish={(rec, akhir, tr) => setFinishing({ rec, akhir, tr })} />}
      {revise && <AkhirModal key={revise.id} pending={[revise]} revision onClose={() => setRevise(undefined)} onConfirm={(id, a, t) => void saveAkhir(id, a, t, true)} onDraft={() => undefined} onFinish={(rec, akhir, tr) => setFinishing({ rec, akhir, tr })} />}
      {preview && (
        <PageModal title={`Pratinjau ${preview.id}`} onClose={() => setPreview(undefined)} testId="catat-preview" wide>
          <CatatResult rec={preview} />
          <div className="mt-5 border-t border-paper-grid pt-4">
            <p className="label-mono mb-2">Unduh</p>
            <div className="flex flex-wrap gap-2">
              <DownloadButtons rec={preview} testId="catat-preview-dl" />
              <XlsxButton rec={() => preview} testId="catat-preview-xlsx" />
            </div>
            {canCloseCatat(preview) && (
              <button type="button" className="btn-primary mr-2 mt-3" onClick={() => setFinishing({ rec: preview })} data-testid="catat-finish">
                Selesaikan
              </button>
            )}
            {preview.finishedAt && !preview.closedAt && (
              <button
                type="button"
                className="btn-acid mt-3"
                onClick={() => {
                  setRevise(preview);
                  setPreview(undefined);
                }}
                data-testid="catat-revise"
              >
                Revisi data akhir
              </button>
            )}
          </div>
        </PageModal>
      )}
      {toast && <LoadingOverlay testId="catat-toast" text={toast === 'saving' ? 'Tunggu ya, data sedang di save.' : 'Menyimpan data akhir…'} />}
      {done && (
        <SuccessAlert testId="catat-done" message="Yes!! akhirnya selesai.., yuk download/simpan hasil data nya." onClose={() => setDone(undefined)}>
          <button type="button" className="rounded-lg bg-[#66cdaa] px-4 py-1.5 text-sm font-semibold text-white hover:brightness-95" onClick={() => window.location.assign(`/lab/hasil?id=${encodeURIComponent(done.id)}`)} data-testid="catat-done-view">Lihat</button>
          <button type="button" className="rounded-lg border border-[#66cdaa] px-4 py-1.5 text-sm font-semibold text-[#3a9e7c]" onClick={() => setDone(undefined)} data-testid="catat-done-later">Nanti</button>
        </SuccessAlert>
      )}
      {drafted && (
        <SuccessAlert testId="catat-drafted" title="Tersimpan !" message={`Data akhir ${drafted.id} disimpan sementara (${akhirFilled(drafted)} dari ${drafted.count} nomor). Lanjutkan kapan saja; unduhan sudah memakai data terbaru.`} onClose={() => setDrafted(undefined)} />
      )}
      {revised && <SuccessAlert testId="catat-revised" title="Tersimpan !" message={`Revisi data akhir ${revised.id} tersimpan. Unduhan sudah memakai data terbaru.`} onClose={() => setRevised(undefined)} />}
      {dialog}
      {finishing && <FinishConfirm id={finishing.rec.id} onBack={() => setFinishing(undefined)} onOk={() => void finish(finishing)} />}
      {success && <FireworksAlert message="Sukses! data berhasil di selesaikan." onClose={() => setSuccess(false)} />}
      {deleted > 0 && <SuccessAlert testId="catat-deleted" message={`${deleted} catatan dihapus permanen.`} onClose={() => setDeleted(0)} />}
    </div>
  );
}

/** Perlakuan terisi & total jumlah produksinya. */
const perlFilledOf = (list: readonly TreatmentEntry[]) => list.filter((e) => e.method && e.count.trim());
const perlTotalOf = (list: readonly TreatmentEntry[]) => perlFilledOf(list).reduce((n, e) => n + (parseInt(e.count, 10) || 0), 0);
/** Pesan galat perlakuan (pasangan tidak lengkap / total melebihi jumlah item), atau '' bila valid. */
const perlError = (list: readonly TreatmentEntry[], itemCount: number) =>
  list.some((e) => (e.method && !e.count.trim()) || (!e.method && e.count.trim()))
    ? 'Lengkapi perlakuan: pilih perlakuan dan isi jumlah produksinya (atau kosongkan keduanya).'
    : perlTotalOf(list) > itemCount
      ? `Total jumlah produksi perlakuan (${perlTotalOf(list)}) melebihi jumlah item (${itemCount}).`
      : '';

/**
 * Bagian "Perlakuan" (DEC-101) — dipakai form data awal DAN modal revisi data akhir (DEC-106), keduanya menulis ke
 * data yang sama (treatments.kopra) sehingga selalu sinkron: dropdown Green House / Oven Gas / Oven Briket + jumlah
 * produksi; item dibagi berurutan. `withNotes` = sekalian foto & keterangan per perlakuan (di revisi).
 */
function PerlakuanFields({ value, onChange, itemCount, testId, withNotes = false, title = 'Perlakuan' }: { value: TreatmentEntry[]; onChange: (fn: (cur: TreatmentEntry[]) => TreatmentEntry[]) => void; itemCount: number; testId: string; withNotes?: boolean; title?: string }) {
  const list = value.length ? value : [{ method: '', count: '' }];
  const setAt = (i: number, patch: Partial<TreatmentEntry>) => onChange((cur) => (cur.length ? cur : [{ method: '', count: '' }]).map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const total = perlTotalOf(list);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-acid/50 bg-acid/5 p-3" data-testid={testId}>
      <span className="label-mono" data-testid={`${testId}-title`}>{title}</span>
      {list.map((e, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl bg-white p-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Dropdown
                label={`Perlakuan ${list.length > 1 ? i + 1 : ''}`.trim()}
                testId={`catat-perl-${i}`}
                voice={`perlakuan${ord(i)}`}
                value={e.method}
                onChange={(v) => setAt(i, { method: v })}
                placeholder="— pilih perlakuan —"
                options={KOPRA_METHODS.filter((m) => m === e.method || !list.some((x) => x.method === m)).map((m) => ({ value: m, label: methodLabel(m), note: TREATMENT_INFO.kopra.methods[m] ?? '' }))}
              />
            </div>
            <label className="flex flex-col gap-1.5 sm:w-48">
              <span className="label-mono">Jumlah produksi</span>
              <input className={field} inputMode="numeric" enterKeyHint="next" value={e.count} onChange={(ev) => setAt(i, { count: ev.target.value.replace(/\D/g, '') })} placeholder="mis. 15" data-testid={`catat-perl-count-${i}`} data-voice-name={`jumlah produksi${ord(i)}|jumlah kopra${ord(i)}`} data-voice-kind="number" />
            </label>
            {list.length > 1 && (
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center self-end rounded-full text-xl hover:bg-safety" onClick={() => onChange((cur) => cur.filter((_, j) => j !== i))} aria-label={`Hapus perlakuan ${i + 1}`} data-testid={`catat-perl-del-${i}`}>
                ✕
              </button>
            )}
          </div>
          {withNotes && (
            <div className="flex items-start gap-2">
              <div className="flex flex-none flex-col gap-1">
                <span className="text-xs text-muted">Foto</span>
                <RowPhoto value={e.photo} label={`Foto perlakuan ${i + 1}`} onChange={(v) => setAt(i, { photo: v })} testId={`catat-tr-photo-kopra-${i}`} />
              </div>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-muted">Keterangan</span>
                <textarea
                  className="field min-h-[44px] w-full resize-y bg-white text-sm"
                  rows={2}
                  value={e.note ?? ''}
                  maxLength={500}
                  onChange={(ev) => setAt(i, { note: ev.target.value })}
                  placeholder="mis. suhu oven 60 °C, dibalik tiap 2 jam"
                  aria-label={`Keterangan perlakuan ${i + 1}`}
                  data-testid={`catat-tr-note-kopra-${i}`}
                  data-voice-name={`keterangan perlakuan${ord(i)}|keterangan kopra${ord(i)}`}
                  data-voice-kind="text"
                />
              </label>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {list.length < KOPRA_METHODS.length && (
          <button type="button" className="btn-ghost !min-h-[36px] text-sm" onClick={() => onChange((cur) => [...(cur.length ? cur : [{ method: '', count: '' }]), { method: '', count: '' }])} data-testid="catat-perl-add">
            + Tambah perlakuan
          </button>
        )}
        <span className={`text-xs ${itemCount && total > itemCount ? 'font-semibold text-[#B4532A]' : 'text-muted'}`} data-testid="catat-perl-total">
          {itemCount && total > itemCount ? `⚠ Total jumlah produksi ${total} melebihi ${itemCount} item — nomor di atas ${itemCount} tidak punya foto.` : total ? `Total jumlah produksi ${total}${itemCount ? ` dari ${itemCount} item` : ''} — item dibagi berurutan (perlakuan pertama = nomor awal).` : 'Opsional. Jumlah produksi = banyak item untuk perlakuan itu.'}
        </span>
      </div>
    </section>
  );
}

/** Modal di dalam alur halaman (tanpa kunci gulir): tampil penuh, halaman tetap bisa digulir (DEC-071). */
/**
 * Enter di kolom isian → pindah ke kolom isian berikutnya (melewati yang hanya-baca/tersembunyi); dari kolom
 * terakhir → fokus ke tombol konfirmasi (DEC-091). Textarea tetap memakai Enter untuk baris baru.
 */
function enterToNext(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
  const t = e.target;
  if (!(t instanceof HTMLInputElement) || ['file', 'checkbox', 'radio', 'button', 'submit'].includes(t.type)) return;
  const all = Array.from(e.currentTarget.querySelectorAll<HTMLInputElement>('input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([readonly]):not([disabled]):not([data-enter-skip])')).filter((el) => el.getClientRects().length > 0);
  const i = all.indexOf(t);
  if (i < 0) return;
  e.preventDefault();
  const next = all[i + 1];
  const target: HTMLElement | null = next ?? e.currentTarget.querySelector<HTMLElement>('[data-testid$="-confirm"]');
  target?.focus();
  if (next) next.select();
  target?.scrollIntoView({ block: 'nearest' });
}

function PageModal({ title, onClose, children, footer, testId, wide = false, enterNext = false, dirty = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; testId: string; wide?: boolean; enterNext?: boolean; dirty?: boolean }) {
  const [top, setTop] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  // klik di luar / Esc menutup form; bila sudah ada isian, minta konfirmasi dulu (DEC-095)
  const requestClose = useCallback(async () => {
    if (dirtyRef.current && !(await askConfirm({ title: 'Tutup form?', message: 'Isian yang belum disimpan akan hilang.', okLabel: 'Tutup', danger: false }))) return;
    onClose();
  }, [onClose]);
  useLayoutEffect(() => setTop(window.scrollY + 80), []);
  useEffect(() => {
    // layar otomatis diarahkan ke modal yang dibuka
    if (top) card.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [top]);
  useEffect(() => {
    card.current?.querySelector<HTMLElement>('input,[role=combobox],button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[data-testid="confirm-dialog"]') && void requestClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);
  return createPortal(
    <>
      <div className="fixed inset-0 z-[45] bg-ink/50" onClick={() => void requestClose()} aria-hidden data-testid={`${testId}-backdrop`} />
      <div className="absolute inset-x-0 z-50 flex justify-center px-3 pb-10 sm:px-4" style={{ top, scrollMarginTop: 72 }} onClick={(e) => e.target === e.currentTarget && void requestClose()}>
        <div ref={card} role="dialog" aria-modal="true" aria-label={title} style={{ scrollMarginTop: 80 }} className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} rounded-2xl bg-surface shadow-2xl`} data-testid={testId} {...(enterNext && { onKeyDown: enterToNext })}>
          <div className="flex items-center justify-between gap-3 border-b border-paper-grid px-5 py-4">
            <h2 className="text-lg">{title}</h2>
            <button type="button" className="font-mono text-sm underline" onClick={onClose} data-testid={`${testId}-close`}>Tutup</button>
          </div>
          <div className="px-4 py-4 sm:px-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-paper-grid px-5 py-3">{footer}</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Form catatan awal: item + jumlah → baris bernomor sebanyak jumlah. */
function AwalModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (item: string, rows: CatatRow[], treatments?: Treatments) => void }) {
  const [item, setItem] = useState<string>(RAW_ITEMS[0]);
  // perlakuan (DEC-101): Green House / Oven Gas / Oven Briket + jumlah produksi; item dibagi berurutan ke tiap perlakuan
  const [perl, setPerl] = useState<TreatmentEntry[]>([{ method: '', count: '' }]);
  const perlFilled = perlFilledOf(perl);
  const [countText, setCountText] = useState('');
  const [rows, setRows] = useState<CatatRow[]>([]);
  const [err, setErr] = useState('');
  const cols = awalColumns(item);

  const setCount = (t: string) => {
    setCountText(t);
    setErr('');
    const n = Math.min(MAX_ROWS, Math.max(0, parseInt(t, 10) || 0));
    // nilai yang sudah diketik dipertahankan saat jumlah diubah
    setRows((cur) => blankRows(n).map((r, i) => cur[i] ?? r));
  };
  const setCell = (i: number, k: keyof CatatRow, v: string | undefined) => {
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    setErr('');
  };
  const confirm = () => {
    if (!rows.length) return setErr('Isi jumlah total item dulu (minimal 1).');
    const pe = perlError(perl, rows.length);
    if (pe) return setErr(pe);
    const miss = missingAwal(item, rows);
    if (miss.length) return setErr(`Masih kosong (${hasThickness(item) ? 'berat awal / tebal daging' : 'berat awal'}) di nomor: ${miss.slice(0, 12).join(', ')}${miss.length > 12 ? `, … (${miss.length} nomor)` : ''}.`);
    const keep = new Set(cols.map(([k]) => k as string));
    const treatments: Treatments | undefined = perlFilled.length ? { kopra: perlFilled.map((e) => ({ method: e.method, count: e.count.trim() })) } : undefined;
    onConfirm(item, rows.map((r) => ({ no: r.no, beratAwal: r.beratAwal.trim(), volAir: keep.has('volAir') ? r.volAir.trim() : '', beratAir: keep.has('beratAir') ? r.beratAir.trim() : '', tebalAwal: keep.has('tebalAwal') ? r.tebalAwal.trim() : '', ...(r.fotoAwal && { fotoAwal: r.fotoAwal }) })), treatments);
  };

  return (
    <PageModal
      title="Buat catatan awal"
      onClose={onClose}
      testId="catat-awal-modal"
      enterNext
      dirty={!!countText || perl.some((e) => !!(e.method || e.count)) || rows.some((r) => !!(r.beratAwal || r.volAir || r.beratAir || r.tebalAwal || r.fotoAwal))}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          <button type="button" className="btn-primary" onClick={confirm} data-testid="catat-awal-confirm">Konfirmasi</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <PerlakuanFields
          testId="catat-awal-perlakuan"
          value={perl}
          onChange={(fn) => {
            setPerl(fn);
            setErr('');
          }}
          itemCount={rows.length}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Dropdown label="Item / barang" required testId="catat-item" voice="item|barang" value={item} onChange={setItem} options={RAW_ITEMS.map((i) => ({ value: i, label: i }))} />
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jumlah total item <span className="text-safety" aria-hidden>*</span></span>
            <input className="field min-h-[44px] bg-white text-sm" inputMode="numeric" enterKeyHint="next" value={countText} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} placeholder="mis. 50" data-testid="catat-count" data-voice-name="jumlah item|jumlah total item|jumlah total" data-voice-kind="number" />
            <span className="text-xs text-muted">Maks. {MAX_ROWS}. Kolom isian muncul sebanyak jumlah ini.</span>
          </label>
        </div>
          <VoiceFill
            testId="catat-awal-voice"
            fields={cols.map(([k]) => AWAL_VOICE_FIELDS[k]!)}
            rowCount={rows.length}
            inputId={(row, k) => `catat-awal-${k}-${row}`}
            onFill={(row, k, v) => setCell(row - 1, k as keyof CatatRow, v)}
          />
        {rows.length > 0 && (
          <RowsGrid
            head={['Foto', ...cols.map(([, l]) => l)]}
            rows={rows}
            render={(r, i) => [
              <RowPhoto key="foto" value={r.fotoAwal} label={`Foto awal nomor ${r.no}`} onChange={(v) => setCell(i, 'fotoAwal', v)} testId={`catat-awal-foto-${r.no}`} />,
              ...cols.map(([k, l]) => <input key={k} aria-label={`${l} nomor ${r.no}`} className={field} inputMode="decimal" enterKeyHint="next" value={r[k]} onChange={(e) => setCell(i, k, e.target.value)} data-testid={`catat-awal-${k}-${r.no}`} />),
            ]}
          />
        )}
        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
      </div>
    </PageModal>
  );
}

/**
 * Foto per nomor (DEC-075): tombol pilih/ambil foto (di HP membuka kamera atau galeri), pratinjau kecil, hapus.
 * `readOnly` = hanya menampilkan (foto data awal di form data akhir).
 */
function RowPhoto({ value, onChange, label, testId, readOnly = false }: { value?: string; onChange?: (v: string | undefined) => void; label: string; testId: string; readOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);
  const pv = zoom && value ? <ImagePreview src={value} alt={label} onClose={() => setZoom(false)} /> : null;
  if (readOnly)
    return value ? (
      <>
        <button type="button" onClick={() => setZoom(true)} aria-label={`Lihat ${label}`} className="rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-14 w-[42px] rounded-lg object-cover" data-testid={testId} />
        </button>
        {pv}
      </>
    ) : (
      <span className="font-mono text-xs text-muted" data-testid={testId}>tanpa foto</span>
    );
  return (
    <span className="flex items-center gap-1.5">
      {value && (
        <span className="relative">
          <button type="button" onClick={() => setZoom(true)} aria-label={`Lihat ${label}`} className="rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} className="h-14 w-[42px] rounded-lg object-cover" data-testid={`${testId}-img`} />
          </button>
          <button type="button" aria-label={`Hapus ${label}`} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-ink text-[11px] leading-none text-paper" onClick={() => onChange?.(undefined)}>×</button>
        </span>
      )}
      <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-xl border border-ink/20 bg-white px-2.5 text-xs font-semibold hover:border-acid" aria-label={label}>
        {busy ? '…' : value ? 'Ganti' : '+ Foto'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            onChange?.(await photoDataUrl(f, 1000, 0.82, true));
            setBusy(false);
          }}
          data-testid={testId}
        />
      </label>
      {pv}
    </span>
  );
}

/** Tombol "Pilih" (DEC-076): Pilih salah satu / Pilih semua; setelah ada pilihan → Hapus (permanen) & Batal. */
function SelectMenu({ selecting, count, disabled, onOne, onAll, onDelete, onCancel }: { selecting: boolean; count: number; disabled: boolean; onOne: () => void; onAll: () => void; onDelete: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  const item = 'flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-acid/15';
  const run = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn-ghost"
        disabled={disabled}
        title={disabled ? 'Belum ada catatan lengkap (awal & akhir)' : ''}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="catat-select"
      >
        Pilih{selecting ? ` (${count})` : ''} ▾
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-ink/15 bg-white py-1 shadow-xl" data-testid="catat-select-menu">
          <button type="button" role="menuitem" className={item} onClick={run(onOne)} data-testid="catat-select-one">Pilih salah satu</button>
          <button type="button" role="menuitem" className={item} onClick={run(onAll)} data-testid="catat-select-all">Pilih semua</button>
          {count > 0 && (
            <button type="button" role="menuitem" className={`${item} text-[#c0392b]`} onClick={run(onDelete)} data-testid="catat-select-delete">
              <span className="font-semibold">Hapus ({count})</span>
              <span className="text-xs text-muted">Jika sudah dihapus, data tidak dapat dipulihkan.</span>
            </button>
          )}
          {selecting && <button type="button" role="menuitem" className={item} onClick={run(onCancel)} data-testid="catat-select-cancel">Batal</button>}
          <p className="border-t border-paper-grid px-3 py-2 text-[11px] text-muted">Hanya catatan berstatus lengkap (awal &amp; akhir) yang bisa dipilih.</p>
        </div>
      )}
    </div>
  );
}

/** Tabel isian: desktop = baris dengan kolom; HP = kartu per nomor (2 kolom). */
function RowsGrid({ head, rows, render }: { head: string[]; rows: CatatRow[]; render: (r: CatatRow, i: number) => ReactNode[] }) {
  return (
    <div className="flex flex-col gap-2" data-testid="catat-rows">
      <div className="hidden gap-2 px-2 font-mono text-[10px] uppercase text-muted sm:grid" style={{ gridTemplateColumns: `3rem repeat(${head.length}, minmax(0,1fr))` }}>
        <span>No</span>
        {head.map((h) => <span key={h}>{h}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={r.no} data-voice-row={r.no} className="grid grid-cols-2 items-center gap-2 rounded-xl bg-paper p-2 sm:[grid-template-columns:var(--cols)]" style={{ ['--cols' as string]: `3rem repeat(${head.length}, minmax(0,1fr))` }}>
          <span className="col-span-2 font-mono text-sm font-semibold sm:col-span-1">#{r.no}</span>
          {render(r, i).map((node, j) => (
            <label key={j} className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase text-muted sm:hidden">{head[j]}</span>
              {node}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Form data akhir: pilih catatan awal (bila >1), lalu isi akhir di samping nilai awal. */
type AkhirVals = Record<number, { beratAkhir: string; tebalAkhir: string; fotoAkhir?: string }>;
/** Isian awal form data akhir = data yang sudah tersimpan (termasuk "Simpan dulu"). */
const valsOf = (rec?: CatatRecord): AkhirVals => Object.fromEntries((rec?.rows ?? []).map((r) => [r.no, { beratAkhir: r.beratAkhir ?? '', tebalAkhir: r.tebalAkhir ?? '', ...(r.fotoAkhir && { fotoAkhir: r.fotoAkhir }) }]));
const trOf = (rec?: CatatRecord): TreatmentState =>
  Object.fromEntries(TREATMENT_GROUPS.map((g) => {
    const e = treatmentEntries(rec?.treatments, g.key);
    return [g.key, e.length ? e.map((x) => ({ ...x })) : [{ count: '', method: '' }]];
  })) as TreatmentState;

function AkhirModal({ pending, onClose, onConfirm, onDraft, onFinish, revision = false }: { pending: CatatRecord[]; revision?: boolean; onClose: () => void; onConfirm: (id: string, akhir: AkhirInput[], treatments: Treatments) => void; onDraft: (id: string, akhir: AkhirInput[], treatments: Treatments) => void; onFinish: (rec: CatatRecord, akhir: AkhirInput[], treatments: Treatments) => void }) {
  const [id, setId] = useState(pending.length === 1 ? pending[0]!.id : '');
  const rec = pending.find((p) => p.id === id);
  const [tr, setTr] = useState<TreatmentState>(() => trOf(rec));
  const [vals, setVals] = useState<AkhirVals>(() => valsOf(rec));
  const [err, setErr] = useState('');
  const coco = rec ? hasThickness(rec.item) : false;
  const merged = rec ? rec.rows.map((r) => ({ ...r, beratAkhir: vals[r.no]?.beratAkhir ?? '', tebalAkhir: vals[r.no]?.tebalAkhir ?? '', ...(vals[r.no]?.fotoAkhir && { fotoAkhir: vals[r.no]!.fotoAkhir }) })) : [];
  const [touched, setTouched] = useState(false);
  const set = (no: number, k: 'beratAkhir' | 'tebalAkhir' | 'fotoAkhir', v: string | undefined) => {
    setTouched(true);
    // pertahankan isian lain di nomor yang sama (termasuk foto) saat satu kolom diubah
    setVals((x) => ({ ...x, [no]: { beratAkhir: '', tebalAkhir: '', ...x[no], [k]: v } }));
    setErr('');
  };
  const confirm = () => {
    if (!rec) return setErr('Pilih catatan awal dulu.');
    // revisi: pasangan perlakuan harus lengkap; total > jumlah item hanya diperingatkan (catatan lama bisa memakai arti lain)
    if (revision && tr.kopra.some((e) => (e.method && !e.count.trim()) || (!e.method && e.count.trim()))) return setErr(perlError(tr.kopra, rec.count));
    const miss = missingAkhir(rec.item, merged);
    if (miss.length) return setErr(`Data akhir masih kosong di nomor: ${miss.slice(0, 12).join(', ')}${miss.length > 12 ? `, … (${miss.length} nomor)` : ''}.`);
    onConfirm(rec.id, akhirOut(), tr);
  };
  const akhirOut = () => merged.map((r) => ({ no: r.no, beratAkhir: r.beratAkhir, tebalAkhir: r.tebalAkhir, ...(r.fotoAkhir && { fotoAkhir: r.fotoAkhir }) }));
  const draft = () => {
    if (!rec) return setErr('Pilih catatan awal dulu.');
    onDraft(rec.id, akhirOut(), tr);
  };
  const ro = 'field min-h-[40px] w-full bg-paper-grid/60 px-2 text-sm text-muted';
  // isian form saat ini (belum tentu tersimpan) → unduhan Excel & tombol Selesaikan (DEC-098)
  const complete = !!rec && !missingAkhir(rec.item, merged).length;
  const current = (): CatatRecord | undefined => (rec ? { ...rec, rows: merged, treatments: tr, finishedAt: rec.finishedAt ?? (complete ? new Date().toISOString() : undefined) } : undefined);

  return (
    <PageModal
      title={revision ? `Revisi data akhir · ${pending[0]?.id ?? ''}` : 'Pencatatan data akhir'}
      onClose={onClose}
      testId="catat-akhir-modal"
      enterNext
      dirty={touched}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          {rec && <XlsxButton rec={current} testId="catat-akhir-xlsx" />}
          {rec && complete && !rec.closedAt && (
            <button type="button" className="btn-acid" onClick={() => onFinish(rec, akhirOut(), tr)} title="Simpan data akhir & tandai pencatatan selesai" data-testid="catat-akhir-finish">
              Selesaikan
            </button>
          )}
          {!revision && <button type="button" className="btn-acid" onClick={draft} title="Simpan isian yang sudah ada walau belum lengkap; bisa dilanjutkan nanti" data-testid="catat-akhir-draft">Simpan dulu</button>}
          <button type="button" className="btn-primary" onClick={confirm} data-testid="catat-akhir-confirm">{revision ? 'Simpan revisi' : 'Konfirmasi data akhir'}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {pending.length > 1 && (
          <Dropdown
            label="Pilih catatan awal yang tersedia"
            required
            testId="catat-pick"
            value={id}
            onChange={(v) => {
              setId(v);
              const next = pending.find((p) => p.id === v);
              setVals(valsOf(next));
              setTr(trOf(next));
            }}
            placeholder="— pilih catatan awal —"
            options={pending.map((p) => ({ value: p.id, label: `${p.item} · ${p.count} item`, note: `${p.id} · ${p.createdAt.slice(0, 10)}` }))}
          />
        )}
        {rec && (
          <>
            <p className="text-sm text-muted" data-testid="catat-akhir-info">
              {rec.id} · {rec.item} · {rec.count} item. Kolom kiri = data awal (tidak bisa diubah), kolom kanan = data akhir (isi semua).
            </p>
            <VoiceFill
              testId="catat-akhir-voice"
              fields={coco ? AKHIR_VOICE_FIELDS : AKHIR_VOICE_FIELDS.slice(0, 1)}
              rowCount={rec.rows.length}
              inputId={(row, k) => `catat-akhir-${k === 'beratAkhir' ? 'berat' : 'tebal'}-${row}`}
              onFill={(row, k, v) => set(row, k as 'beratAkhir' | 'tebalAkhir', v)}
            />
            <RowsGrid
              head={['Foto awal', 'Berat awal (g)', 'Berat akhir (g)', ...(coco ? ['Tebal awal (mm)', 'Tebal akhir (mm)'] : []), 'Foto akhir']}
              rows={merged}
              render={(r) => [
                <RowPhoto key="fa" value={r.fotoAwal} label={`Foto awal nomor ${r.no}`} readOnly testId={`catat-akhir-fotoawal-${r.no}`} />,
                <input key="ba" className={ro} value={r.beratAwal} readOnly tabIndex={-1} aria-label={`Berat awal nomor ${r.no}`} />,
                <input key="bk" className={field} inputMode="decimal" enterKeyHint="next" value={r.beratAkhir} onChange={(e) => set(r.no, 'beratAkhir', e.target.value)} aria-label={`Berat akhir nomor ${r.no}`} data-testid={`catat-akhir-berat-${r.no}`} />,
                ...(coco
                  ? [
                      <input key="ta" className={ro} value={r.tebalAwal} readOnly tabIndex={-1} aria-label={`Tebal awal nomor ${r.no}`} />,
                      <input key="tk" className={field} inputMode="decimal" enterKeyHint="next" value={r.tebalAkhir} onChange={(e) => set(r.no, 'tebalAkhir', e.target.value)} aria-label={`Tebal akhir nomor ${r.no}`} data-testid={`catat-akhir-tebal-${r.no}`} />,
                    ]
                  : []),
                <RowPhoto key="fk" value={r.fotoAkhir} label={`Foto akhir nomor ${r.no}`} onChange={(v) => set(r.no, 'fotoAkhir', v)} testId={`catat-akhir-foto-${r.no}`} />,
              ]}
            />
            {revision && (
              <PerlakuanFields
                testId="catat-revisi-perlakuan"
                value={tr.kopra}
                onChange={(fn) => {
                  setTouched(true);
                  setErr('');
                  setTr((x) => ({ ...x, kopra: fn(x.kopra) }));
                }}
                itemCount={rec.count}
                withNotes
                title="Perlakuan kopra"
              />
            )}
            <TreatmentFields value={tr} onChange={(fn) => { setTouched(true); setTr(fn); }} {...(revision && { hide: ['kopra' as TreatmentKey], legend: 'Perlakuan lainnya (Non Kopra)', picker: true })} />
          </>
        )}
        {err && <p className="text-sm" role="alert"><span className="bg-safety px-1">{err}</span></p>}
      </div>
    </PageModal>
  );
}

type TreatmentState = Record<TreatmentKey, TreatmentEntry[]>;

/**
 * Perlakuan (opsional) di form data akhir (DEC-081): tiap jenis berisi kolom "jumlah perlakuan" + dropdown
 * "Perlakuan/metode"; tombol + menambah pasangan kolom baru di bawahnya, ✕ menghapus kolom tambahan.
 */
function TreatmentFields({ value, onChange, hide = [], legend = 'Perlakuan (opsional)', picker = false }: { value: TreatmentState; onChange: (fn: (x: TreatmentState) => TreatmentState) => void; hide?: TreatmentKey[]; legend?: string; picker?: boolean }) {
  const edit = (key: TreatmentKey, i: number, patch: Partial<TreatmentEntry>) => onChange((x) => ({ ...x, [key]: x[key].map((e, j) => (j === i ? { ...e, ...patch } : e)) }));
  const [picking, setPicking] = useState(false);
  const bioBox = useRef<HTMLDivElement>(null);
  // kartu perlakuan bio leather baru dari modal ＋ (DEC-141) → tampilkan kartunya
  const pick = (method: string) => {
    onChange((x) => ({ ...x, bio: addBioCard(x.bio, method) }));
    setPicking(false);
    requestAnimationFrame(() => bioBox.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  return (
    <fieldset className="grid grid-cols-1 gap-3 rounded-xl bg-paper p-3 sm:grid-cols-2" data-testid="catat-treatments">
      <legend className="label-mono px-1" data-testid="catat-treatments-legend">{legend}</legend>
      {TREATMENT_GROUPS.filter((g) => !hide.includes(g.key)).map((g) => (
        <div key={g.key} ref={g.key === 'bio' ? bioBox : undefined} className="flex flex-col gap-2 rounded-xl bg-white p-3" data-testid={`catat-tr-${g.key}`}>
          <span className="label-mono">{g.title}</span>
          {value[g.key].map((e, i) => (
            <div key={i} className={`flex flex-col gap-2 ${i > 0 ? 'border-t border-ink/10 pt-2' : ''}`}>
            <div className="flex items-end gap-2">
              <label className="flex w-24 flex-none flex-col gap-1.5">
                <span className="text-xs text-muted">Jumlah</span>
                <input
                  className="field min-h-[44px] bg-white text-sm"
                  inputMode="numeric"
                  value={e.count}
                  onChange={(ev) => edit(g.key, i, { count: ev.target.value.replace(/[^\d]/g, '') })}
                  placeholder="mis. 3"
                  aria-label={`${g.title} ${i + 1}`}
                  data-testid={`catat-tr-count-${g.key}-${i}`}
                  data-voice-name={say(['jumlah', 'jumlah perlakuan'], g.key, i)}
                  data-voice-kind="number"
                />
              </label>
              <div className="min-w-0 flex-1">
                <Dropdown
                  label="Perlakuan/metode"
                  testId={`catat-tr-method-${g.key}-${i}`}
                  voice={say(['metode', 'perlakuan'], g.key, i)}
                  value={e.method}
                  onChange={(v) => edit(g.key, i, { method: v })}
                  options={[{ value: '', label: '— pilih —' }, ...g.methods.map((m) => ({ value: m, label: m, note: TREATMENT_INFO[g.key].methods[m] ?? '' }))]}
                />
              </div>
              {i > 0 && (
                <button
                  type="button"
                  className="mb-2 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted hover:bg-safety hover:text-ink"
                  onClick={() => onChange((x) => ({ ...x, [g.key]: x[g.key].filter((_, j) => j !== i) }))}
                  aria-label={`Hapus kolom ${g.title} ${i + 1}`}
                  data-testid={`catat-tr-del-${g.key}-${i}`}
                >
                  ✕
                </button>
              )}
            </div>
            {/* foto (potret 3:4) & keterangan per kolom perlakuan (DEC-089) */}
            <div className="flex items-start gap-2">
              <div className="flex flex-none flex-col gap-1">
                <span className="text-xs text-muted">Foto</span>
                <RowPhoto value={e.photo} label={`Foto ${g.title} ${i + 1}`} onChange={(v) => edit(g.key, i, { photo: v })} testId={`catat-tr-photo-${g.key}-${i}`} />
              </div>
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-muted">Keterangan</span>
                <textarea
                  className="field min-h-[44px] w-full resize-y bg-white text-sm"
                  rows={2}
                  value={e.note ?? ''}
                  maxLength={500}
                  onChange={(ev) => edit(g.key, i, { note: ev.target.value })}
                  placeholder="mis. suhu oven 60 °C, dibalik tiap 2 jam"
                  aria-label={`Keterangan ${g.title} ${i + 1}`}
                  data-testid={`catat-tr-note-${g.key}-${i}`}
                  data-voice-name={say(['keterangan'], g.key, i)}
                  data-voice-kind="text"
                />
              </label>
            </div>
            </div>
          ))}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center self-start rounded-full text-2xl font-bold leading-none text-ink hover:bg-acid"
            onClick={() => onChange((x) => ({ ...x, [g.key]: [...x[g.key], { count: '', method: '' }] }))}
            aria-label={`Tambah kolom ${g.title}`}
            title="Tambah kolom"
            data-testid={`catat-tr-add-${g.key}`}
          >
            +
          </button>
        </div>
      ))}
      {picker && (
        <button
          type="button"
          className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-1.5 font-mono text-xs font-bold text-ink shadow-sm hover:bg-acid sm:col-span-2"
          onClick={() => setPicking(true)}
          aria-label="Tambah kartu perlakuan baru"
          aria-haspopup="dialog"
          data-testid="catat-tr-pick-open"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-lg leading-none text-paper">+</span>
          Tambah perlakuan
        </button>
      )}
      {picking && <TreatmentPicker onPick={pick} onClose={() => setPicking(false)} />}
    </fieldset>
  );
}

/** Modal pilihan perlakuan bio leather (DEC-141) — lapisan di atas form revisi; menutupnya tidak menutup form. */
function TreatmentPicker({ onPick, onClose }: { onPick: (method: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button[data-pick]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 px-3" onClick={(e) => e.target === e.currentTarget && onClose()} data-testid="catat-tr-picker-backdrop">
      <div ref={box} role="dialog" aria-modal="true" aria-label="Tambah perlakuan baru" className="w-full max-w-md rounded-2xl bg-surface shadow-2xl" data-testid="catat-tr-picker">
        <div className="flex items-center justify-between gap-3 border-b border-paper-grid px-5 py-3">
          <h3 className="text-base">Tambah perlakuan baru</h3>
          <button type="button" className="font-mono text-sm underline" onClick={onClose} data-testid="catat-tr-picker-close">Tutup</button>
        </div>
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto p-3">
          {BIO_PICK_METHODS.map((m, i) => (
            <li key={m}>
              <button type="button" data-pick className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-acid focus:bg-acid focus:outline-none" onClick={() => onPick(m)} data-testid={`catat-tr-pick-${i}`}>
                <span className="text-sm font-semibold">{m}</span>
                <span className="text-xs text-muted">{TREATMENT_INFO.bio.methods[m]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
