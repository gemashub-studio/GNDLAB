'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { authHeader, speak, startSegmenter, stopSpeaking, transcribe, VOICE_FORM_EVENT } from '@/lib/voiceClient';
import { CoconutMascot, type MascotMood } from './CoconutMascot';

interface Plan {
  actions: ({ type: 'navigate'; target: string } | { type: 'click'; target: string } | { type: 'fill'; text: string })[];
  reply: string;
}

const LAB_TABS = [
  ['bahan', 'GnD Lab · Pencatatan Data'],
  ['protokol', 'GnD Lab · Riset Produk'],
  ['belanja', 'GnD Lab · Laporan Belanja'],
] as const;
/** Tombol yang tidak boleh ditekan asisten (hapus data, keluar akun, konfirmasi berbahaya). */
const DANGER = /hapus|delete|del-|logout|keluar|sign-?out|remove|finish-ok|confirm-ok|va-/i;
const ROW_FIELDS = ['berat awal', 'volume air', 'berat air', 'tebal daging', 'berat akhir', 'tebal akhir'];
/** Lama diam yang dianggap ucapan selesai — asisten menunggu kalimat perintah selesai (DEC-111). */
const ASSISTANT_SILENCE_MS = 1300;

const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0;
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
async function waitFor<T>(get: () => T | null | undefined | false, ms = 10_000): Promise<T | undefined> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = get();
    if (v) return v;
    await sleep(120);
  }
  return undefined;
}

/** Konteks layar untuk perencana: halaman, tombol yang terlihat, form suara yang terbuka. */
function screenContext(pages: { href: string; label: string }[]) {
  const seen = new Set<string>();
  const buttons: { id: string; text: string }[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('button[data-testid], a[data-testid], [role="button"][data-testid]'))) {
    const id = el.dataset.testid ?? '';
    if (!id || seen.has(id) || (el as HTMLButtonElement).disabled || !visible(el)) continue;
    const text = (el.getAttribute('aria-label') || el.innerText || '').replace(/\s+/g, ' ').trim();
    if (!text || DANGER.test(id) || DANGER.test(text)) continue;
    seen.add(id);
    buttons.push({ id, text: text.slice(0, 60) });
    if (buttons.length >= 80) break;
  }
  const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => d.querySelector('[data-testid$="-voice"]'));
  const formFields = dialog ? [...ROW_FIELDS, ...Array.from(dialog.querySelectorAll<HTMLElement>('[data-voice-name]')).map((e) => (e.dataset.voiceName ?? '').split('|')[0]!)].filter(Boolean) : undefined;
  return {
    path: `${window.location.pathname}${window.location.search}`,
    pages,
    buttons,
    ...(dialog && { form: dialog.getAttribute('aria-label') ?? 'form pencatatan', formFields }),
  };
}

/** Modal / kartu yang terbuka (bukan panel asisten sendiri), paling akhir di dokumen = paling baru. */
function openDialog(): HTMLElement | undefined {
  const list = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')).filter((d) => !d.dataset.testid?.startsWith('va-') && visible(d));
  return list[list.length - 1];
}

/** Bawa bagian PALING ATAS modal form ke layar (bukan tengah/bagian lain), DEC-113. */
function showTop(el: HTMLElement) {
  // wadah modal yang bisa digulir (overlay overflow-y-auto) → mulai dari atas
  for (let p: HTMLElement | null = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) p.scrollTop = 0;
  }
  el.scrollTop = 0;
  const top = el.getBoundingClientRect().top + window.scrollY - 76;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

/** Bingkai listrik (React Bits ElectricBorder) mengikuti posisi modal/kartu yang dibuka lewat suara — terus menyala sampai modal ditutup (DEC-114). */
function VoiceSpark({ target, onDone }: { target: HTMLElement; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const radius = Math.min(32, parseFloat(getComputedStyle(target).borderTopLeftRadius) || 16);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      // modal ditutup (dilepas dari halaman / disembunyikan) → bingkai ikut berhenti
      if (!document.body.contains(target) || !visible(target)) return onDone();
      const r = target.getBoundingClientRect();
      const b = box.current;
      if (b) Object.assign(b.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [target, onDone]);
  return createPortal(
    <div ref={box} className="voice-spark" style={{ position: 'fixed' }} aria-hidden data-testid="va-spark">
      <ElectricBorder color="#63E6CF" speed={1} chaos={1.5} spread={0.6} strands={3} thickness={1.5} borderRadius={radius} interactive={false} style={{ width: '100%', height: '100%' }}>
        <div style={{ width: '100%', height: '100%' }} />
      </ElectricBorder>
    </div>,
    document.body,
  );
}

/**
 * Asisten suara kelapa (DEC-111). Saat pertama masuk: kartu melayang "Mau mulai bersama ku?" (Ayo / Gak dulu deh).
 * Ayo → mikrofon mendengarkan; tiap perintah ditunggu sampai selesai diucapkan (jeda diam ±1,3 detik), ditranskripsi
 * Groq Whisper, direncanakan Groq (gpt-oss-20b) jadi aksi: buka halaman/menu, tekan tombol/buka form, isi form — lalu dijalankan.
 */
export function VoiceAssistant({ show, userKey, pages }: { show: boolean; userKey: string; pages: { href: string; label: string }[] }) {
  const router = useRouter();
  const storeKey = `gnd-va:${userKey}`;
  const [intro, setIntro] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [on, setOn] = useState(false);
  const [mood, setMood] = useState<MascotMood>('idle');
  const [status, setStatus] = useState('');
  const [heard, setHeard] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [spark, setSpark] = useState<HTMLElement>();
  // suara jawaban (TTS Groq Orpheus "autumn", DEC-115): mikrofon dibisukan selama & sesaat setelah asisten berbicara
  const talking = useRef(0);
  const mutedUntil = useRef(0);
  const say = useCallback((text: string) => {
    const t = text.replace(/…/g, '.').trim();
    if (!t) return Promise.resolve();
    talking.current++;
    setMood('talking');
    return speak(t)
      .catch((e: unknown) => console.warn('[tts]', e))
      .finally(() => {
        talking.current--;
        mutedUntil.current = performance.now() + 450;
        if (!talking.current) setMood(stopRef.current ? 'listening' : 'idle');
      });
  }, []);
  const endSpark = useCallback(() => setSpark(undefined), []);
  const allPages = [...pages, ...LAB_TABS.map(([t, label]) => ({ href: `/lab?t=${t}`, label }))];
  const pagesRef = useRef(allPages);
  pagesRef.current = allPages;

  useEffect(() => {
    if (!show) return;
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(storeKey);
    } catch {
      seen = 'x';
    }
    setIntro(!seen);
    setDismissed(!!seen);
  }, [show, storeKey]);
  const remember = (v: string) => {
    try {
      window.localStorage.setItem(storeKey, v);
    } catch {
      /* penyimpanan diblokir: kartu muncul lagi lain kali */
    }
  };

  const execute = useCallback(
    async (plan: Plan) => {
      const before = openDialog();
      let navigated = false;
      for (const a of plan.actions) {
        if (a.type === 'navigate') navigated = true;
        if (a.type === 'navigate') {
          setStatus(`${plan.reply} (membuka halaman…)`);
          const tab = /^\/lab\?t=(\w+)$/.exec(a.target)?.[1];
          if (tab) {
            // tab GnD Lab: buka /lab dulu (bila perlu), lalu klik tabnya — halaman lab membaca ?t= hanya saat dimuat
            if (window.location.pathname !== '/lab') router.push('/lab');
            const btn = await waitFor(() => document.querySelector<HTMLElement>(`[data-testid="lab-tab-${tab}"]`), 60_000);
            if (!btn) throw new Error('Menu GnD Lab belum terbuka.');
            btn.click();
            await waitFor(() => window.location.search.includes(`t=${tab}`), 3000);
            await sleep(300);
          } else {
            router.push(a.target);
            const [p, q] = a.target.split('?');
            await waitFor(() => window.location.pathname === p && (!q || window.location.search.includes(q)), 60_000);
            await sleep(400);
          }
        } else if (a.type === 'click') {
          const el = await waitFor(() => {
            const x = document.querySelector<HTMLElement>(`[data-testid="${CSS.escape(a.target)}"]`);
            return x && visible(x) && !(x as HTMLButtonElement).disabled ? x : null;
          }, 30_000);
          if (!el) throw new Error(`Tombol “${a.target}” tidak ditemukan di layar.`);
          setStatus(plan.reply);
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.click();
          await sleep(350);
        } else if (a.type === 'fill') {
          const box = await waitFor(() => document.querySelector('[role="dialog"] [data-testid$="-voice"]'), 5000);
          if (!box) throw new Error('Belum ada form yang terbuka untuk diisi.');
          window.dispatchEvent(new CustomEvent(VOICE_FORM_EVENT, { detail: { text: a.text } }));
          await sleep(250);
        }
      }
      // modal / kartu yang baru terbuka lewat suara → tampil dari bagian paling atas + bingkai listrik (DEC-113)
      const opened = plan.actions.some((a) => a.type === 'click') ? await waitFor(() => { const d = openDialog(); return d && d !== before ? d : null; }, 2500) : undefined;
      if (opened) {
        showTop(opened);
        setSpark(opened);
      } else if (navigated) window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [router],
  );

  /** Satu perintah (teks) → rencana Groq → jalankan. Dipakai suara & kolom ketik. */
  const handleText = useCallback(
    async (text: string) => {
      const t = text.trim();
      // ucapan kosong / hanya bunyi: status & teks sebelumnya tetap
      if (!t) {
        setMood(stopRef.current ? 'listening' : 'idle');
        return;
      }
      setHeard(t);
      setMood('thinking');
      setStatus('Sebentar, aku proses…');
      void say('Sebentar, aku proses ya.');
      try {
        const res = await fetch('/api/voice-assistant', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ text: t, ctx: screenContext(pagesRef.current) }) });
        const j = (await res.json().catch(() => ({}))) as Partial<Plan> & { error?: string };
        if (!res.ok) throw new Error(j.error ?? `Asisten gagal (${res.status}).`);
        const plan: Plan = { actions: j.actions ?? [], reply: j.reply ?? '' };
        setMood('talking');
        setStatus(plan.reply);
        // jawaban (termasuk "maaf, aku belum paham…" bila perintah tidak dikenali) diucapkan sambil aksi berjalan
        void say(plan.reply);
        await execute(plan);
        setErr('');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
        void say(msg);
      } finally {
        window.setTimeout(() => !talking.current && setMood(stopRef.current ? 'listening' : 'idle'), 1400);
      }
    },
    [execute],
  );

  const onSegment = useCallback(
    (blob: Blob) => {
      setBusy((b) => b + 1);
      queue.current = queue.current
        .then(async () => {
          try {
            setMood('thinking');
            await handleText(await transcribe(blob));
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          }
        })
        .finally(() => setBusy((b) => b - 1));
    },
    [handleText],
  );

  const start = async () => {
    setErr('');
    setOn(true);
    setMood('listening');
    setStatus('Aku mendengarkan… ucapkan perintahmu, mis. “buka pencatatan data lalu buat catatan baru”.');
    try {
      stopRef.current = await startSegmenter({
        onSegment,
        silenceMs: ASSISTANT_SILENCE_MS,
        onSpeaking: (s) => s && !talking.current && setMood('listening'),
        isMuted: () => talking.current > 0 || performance.now() < mutedUntil.current,
      });
    } catch (e) {
      setErr(`${e instanceof Error ? e.message : String(e)} Kamu tetap bisa mengetik perintah di bawah.`);
    }
  };
  const stop = () => {
    stopSpeaking();
    stopRef.current?.();
    stopRef.current = null;
    setOn(false);
    setMood('idle');
    setStatus('');
  };
  useEffect(() => () => stopRef.current?.(), []);

  if (!show) return null;
  const sparkEl = spark ? <VoiceSpark target={spark} onDone={endSpark} /> : null;

  if (intro)
    return (
      <div className="sheet-up fixed bottom-5 right-4 z-[75] flex w-[min(340px,calc(100vw-2rem))] flex-col items-center gap-3 rounded-3xl border border-acid/40 bg-surface p-5 text-center shadow-2xl" role="dialog" aria-labelledby="va-intro-t" data-testid="va-intro">
        <CoconutMascot size={92} mood="talking" />
        <p id="va-intro-t" className="font-display text-lg font-semibold leading-snug">Mau mulai bersama ku?</p>
        <p className="text-sm text-muted">Ucapkan apa saja mengenai pengerjaan data dan menu — aku bisa lakukan itu via perintah suara.</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              remember('ayo');
              setIntro(false);
              setDismissed(false);
              void start();
            }}
            data-testid="va-yes"
          >
            Ayo
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              remember('nanti');
              setIntro(false);
              setDismissed(true);
            }}
            data-testid="va-no"
          >
            Gak dulu deh
          </button>
        </div>
      </div>
    );

  if (!on)
    return (
      <>
      {sparkEl}
      <button type="button" className="fixed bottom-5 right-4 z-[70] rounded-full bg-surface p-1.5 shadow-xl ring-1 ring-ink/10 transition hover:scale-105" onClick={() => void start()} aria-label="Mulai asisten suara" title="Asisten suara" data-testid="va-fab">
        <CoconutMascot size={dismissed ? 46 : 52} mood="idle" />
      </button>
      </>
    );

  return (
    <>
    {sparkEl}
    <div className="fixed bottom-5 right-4 z-[75] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2 rounded-3xl border border-acid/50 bg-surface p-3 shadow-2xl" role="status" aria-live="polite" data-testid="va-panel">
      <div className="flex items-start gap-3">
        <CoconutMascot size={60} mood={mood} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug" data-testid="va-status">{status}</p>
          {heard && <p className="mt-1 text-xs text-muted" data-testid="va-heard">“{heard}”</p>}
          {busy > 0 && <p className="prog-pulse mt-1 text-xs text-muted">memproses… ({busy})</p>}
        </div>
        <button type="button" className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-paper" onClick={stop} aria-label="Hentikan asisten suara" data-testid="va-stop">
          ✕
        </button>
      </div>
      <input
        className="field min-h-[36px] bg-white text-xs"
        placeholder="atau ketik perintah, mis. “buka riset produk lalu resep baru”"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const t = e.currentTarget.value;
          e.currentTarget.value = '';
          void handleText(t);
        }}
        aria-label="Perintah asisten (teks)"
        data-testid="va-text"
        data-enter-skip
      />
      {err && <p className="text-xs" role="alert"><span className="bg-safety px-1">{err}</span></p>}
    </div>
    </>
  );
}
