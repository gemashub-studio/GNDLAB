'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startSegmenter, transcribe, VOICE_FORM_EVENT, type FilledField } from '@/lib/voiceClient';
import { applyVoice, matchOption, normalize, parseVoice, type VoiceCursor, type VoiceField } from '@/lib/voiceFill';

/** Kolom lain di form yang bisa diisi "nama kolom + nilai" (atribut data-voice-name, DEC-104). */
function formFields(root: ParentNode): VoiceField[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-voice-name][data-testid]')).map((el) => {
    const names = (el.dataset.voiceName ?? '').split('|').filter(Boolean);
    const kind = (el.dataset.voiceKind as VoiceField['kind']) ?? 'number';
    let options: VoiceField['options'];
    try {
      options = el.dataset.voiceOptions ? (JSON.parse(el.dataset.voiceOptions) as VoiceField['options']) : undefined;
    } catch {
      options = undefined;
    }
    return { key: `x:${el.dataset.testid}`, label: names[0] ?? '', say: names.map((n) => normalize(n).join(' ')), kind, ...(options && { options }) };
  });
}

/** Isi input/textarea yang dikendalikan React (setter asli + event input). */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  setter?.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
const flash = (el: Element) => {
  el.classList.add('voice-field-active');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  window.setTimeout(() => el.classList.remove('voice-field-active'), 1600);
};

/**
 * Pengisian suara pencatatan (DEC-099). Tombol mikrofon → mendengarkan terus; tiap ucapan dipotong otomatis saat
 * diam (±0,85 detik), ditranskripsi, lalu diurai: "satu" = pilih nomor (kolomnya berkedip neon), "berat awal seribu
 * tiga empat" = isi 1034, "next/neks/nex" = kolom berikutnya.
 */
export function VoiceFill({ fields, rowCount, inputId, onFill, testId }: { fields: VoiceField[]; rowCount: number; inputId: (row: number, field: string) => string; onFill: (row: number, field: string, value: string) => void; testId: string }) {
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [pending, setPending] = useState(0);
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const cur = useRef<VoiceCursor>({ row: 1, field: fields[0]?.key ?? '' });
  const latest = useRef({ fields, rowCount, inputId, onFill });
  latest.current = { fields, rowCount, inputId, onFill };
  const stopRef = useRef<(() => void) | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  // sorot nomor aktif (semua kolom berkedip neon) + kolom aktif
  const highlight = useCallback((c: VoiceCursor, focus = true) => {
    document.querySelectorAll('.voice-row-neon').forEach((el) => el.classList.remove('voice-row-neon'));
    document.querySelectorAll('.voice-field-active').forEach((el) => el.classList.remove('voice-field-active'));
    const row = document.querySelector(`[data-voice-row="${c.row}"]`);
    row?.classList.add('voice-row-neon');
    const input = document.querySelector<HTMLInputElement>(`[data-testid="${latest.current.inputId(c.row, c.field)}"]`);
    input?.classList.add('voice-field-active');
    if (focus) {
      input?.focus({ preventScroll: true });
      (input ?? row)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);
  const clearHighlight = () => {
    document.querySelectorAll('.voice-row-neon').forEach((el) => el.classList.remove('voice-row-neon'));
    document.querySelectorAll('.voice-field-active').forEach((el) => el.classList.remove('voice-field-active'));
  };

  /** Jalankan teks hasil transkripsi (juga dipakai uji). */
  const box = useRef<HTMLDivElement>(null);
  const run = useCallback(
    async (text: string) => {
      const { fields: f, rowCount: n, onFill: fill } = latest.current;
      setHeard(text);
      // kolom yang terisi → dilaporkan ke asisten kelapa untuk respons "<kolom>, <nilai>!" (DEC-122)
      const done: FilledField[] = [];
      if (!text.trim()) return done;
      const msgs: string[] = [];
      const root: ParentNode = box.current?.closest('[role="dialog"]') ?? document;
      const extra = formFields(root);
      let moved = false;
      for (const cmd of parseVoice(text, [...f, ...extra])) {
        // kolom lain di form: angka / teks / pilihan dropdown (DEC-104)
        const xf = cmd.kind === 'fill' && cmd.field ? extra.find((x) => x.key === cmd.field) : undefined;
        if (xf && cmd.kind === 'fill') {
          const tid = xf.key.slice(2);
          const el = root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(tid)}"]`);
          if (!el) continue;
          if (xf.kind === 'choice') {
            const opt = matchOption(cmd.value, xf.options ?? []);
            if (!opt) {
              msgs.push(`Pilihan “${cmd.value}” tidak ada di ${xf.label}`);
              continue;
            }
            el.click();
            await new Promise((r) => window.setTimeout(r, 60));
            root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(`${tid}-opt-${opt.value || 'none'}`)}"]`)?.click();
            msgs.push(`${xf.label} = ${opt.label}`);
            done.push({ label: xf.label, value: opt.label, num: false });
          } else {
            const v = xf.kind === 'number' ? cmd.value.replace(/,\d+$/, '') : cmd.value;
            setNativeValue(el as HTMLInputElement, v);
            msgs.push(`${xf.label} = ${v}`);
            done.push({ label: xf.label, value: v, num: xf.kind === 'number' });
          }
          flash(el);
          continue;
        }
        moved = true;
        const r = applyVoice(cmd, cur.current, f, n);
        cur.current = r.cur;
        if (r.fill) {
          fill(r.fill.row, r.fill.field, r.fill.value);
          const label = f.find((x) => x.key === r.fill!.field)?.label ?? r.fill.field;
          msgs.push(`#${r.fill.row} ${label} = ${r.fill.value}`);
          done.push({ label, value: r.fill.value, num: true });
        } else if ((cmd.kind === 'row' || cmd.kind === 'num') && !r.error) msgs.push(`Nomor ${r.cur.row}`);
        else if (cmd.kind === 'next' && !r.error) msgs.push(`→ ${f.find((x) => x.key === r.cur.field)?.label} #${r.cur.row}`);
        if (r.error) msgs.push(r.error);
      }
      setNote(msgs.join(' · '));
      if (moved) highlight(cur.current);
      return done;
    },
    [highlight],
  );

  const send = useCallback(
    (blob: Blob) => {
      setPending((p) => p + 1);
      queue.current = queue.current
        .then(async () => {
          try {
            await run(await transcribe(blob));
            setErr('');
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          }
        })
        .finally(() => setPending((p) => p - 1));
    },
    [run],
  );

  const start = async () => {
    setErr('');
    try {
      stopRef.current = await startSegmenter({ onSegment: send, onLevel: setLevel });
    } catch (e) {
      return setErr(e instanceof Error ? e.message : String(e));
    }
    setOn(true);
    setNote('Ucapkan nomor (mis. “satu”), lalu “berat awal seribu tiga empat”, lalu “next”.');
    highlight(cur.current);
  };

  // perintah pengisian dari asisten suara kelapa (DEC-111) → dijalankan di form yang sedang terbuka
  useEffect(() => {
    const onCmd = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; done?: (f: FilledField[]) => void }>).detail;
      if (d?.text) void run(d.text).then((f) => d.done?.(f), () => d.done?.([]));
    };
    window.addEventListener(VOICE_FORM_EVENT, onCmd);
    return () => window.removeEventListener(VOICE_FORM_EVENT, onCmd);
  }, [run]);

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setOn(false);
    clearHighlight();
  };
  useEffect(() => () => stopRef.current?.(), []);

  return (
    <div ref={box} className={`flex flex-col gap-2 rounded-2xl border p-3 ${on ? 'border-acid bg-acid/10' : 'border-ink/15 bg-white'}`} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={on ? stop : () => void start()} className={on ? 'btn-primary !min-h-[42px]' : 'btn-acid !min-h-[42px]'} aria-pressed={on} data-testid={`${testId}-toggle`}>
          {on ? '■ Berhenti' : '🎙 Isi dengan suara'}
        </button>
        {on && (
          <span className="flex h-6 items-end gap-0.5" aria-hidden>
            {[0.35, 0.7, 1, 0.7, 0.35].map((k, i) => (
              <span key={i} className="w-1.5 rounded-full bg-[#1FA88F] transition-[height]" style={{ height: `${Math.max(12, level * k * 100)}%` }} />
            ))}
          </span>
        )}
        {pending > 0 && <span className="prog-pulse text-xs text-muted" data-testid={`${testId}-busy`}>mengenali suara… ({pending})</span>}
        {/* masukan teks untuk mencoba perintah tanpa mikrofon (juga dipakai uji otomatis) */}
        <input
          className="field min-h-[36px] min-w-0 flex-1 bg-white text-xs"
          placeholder="atau ketik perintah, mis. “satu”, “berat awal seribu tiga empat”, “next”"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            const t = e.currentTarget.value;
            e.currentTarget.value = '';
            void run(t);
          }}
          aria-label="Perintah suara (teks)"
          data-enter-skip
          data-testid={`${testId}-text`}
        />
      </div>
      {(heard || note) && (
        <p className="text-xs" data-testid={`${testId}-note`}>
          {heard && <span className="text-muted">“{heard}” → </span>}
          <span className="font-semibold">{note}</span>
        </p>
      )}
      {!heard && !on && <p className="text-xs text-muted">Contoh: “satu” → pilih nomor 1 (kolomnya berkedip) · “berat awal satu kosong tiga empat” atau “… 1034 gram” → 1034 · angka saja (“satu kosong tiga”) → mengisi kolom yang aktif · “next” / “neks” → kolom berikutnya · nomor besar: “nomor dua belas”.</p>}
      {err && <p className="text-xs" role="alert"><span className="bg-safety px-1">{err}</span></p>}
    </div>
  );
}
