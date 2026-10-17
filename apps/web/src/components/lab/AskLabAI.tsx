'use client';

import { useEffect, useRef, useState } from 'react';
import { Fire02Icon, Leaf01Icon, Notebook01Icon, TestTube01Icon, DropletIcon } from '@hugeicons/core-free-icons';
import { PromptBar, type PromptSendMeta } from '@/components/ui/PromptBar';
import { answerCards, askLabAI, buildLabPrompt, CATAT_HINT, LAB_COMMANDS, LAB_EFFORTS, LAB_TOPICS, labGreeting, MAX_PROMPT } from '@/lib/labAi';

interface Msg {
  role: 'ai' | 'user';
  text: string;
  /** sambutan/pesan otomatis (lokal) vs jawaban AI asli */
  auto?: boolean;
  error?: boolean;
}

/**
 * Kartu transparan "Tanya Lab AI" di bawah kartu hitam GnD Lab (DEC-087): sambutan tiap kali GnD Lab dibuka,
 * pesan otomatis saat membuka Pencatatan Data, dan kotak tanya yang dikirim ke AI.
 */
export function AskLabAI({ tab, username }: { tab: string; username?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ role: 'ai', text: labGreeting(username), auto: true }]);
  const [busy, setBusy] = useState(false);
  const hinted = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  // sapaan memakai username begitu status login terbaca
  useEffect(() => {
    setMsgs((m) => (m[0]?.auto ? [{ ...m[0], text: labGreeting(username) }, ...m.slice(1)] : m));
  }, [username]);
  useEffect(() => {
    if (tab === 'bahan' && !hinted.current) {
      hinted.current = true;
      setMsgs((m) => [...m, { role: 'ai', text: CATAT_HINT, auto: true }]);
    }
  }, [tab]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  const controller = useRef<AbortController | null>(null);
  const send = async (raw: string, meta: PromptSendMeta) => {
    const text = raw.trim().slice(0, MAX_PROMPT);
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    controller.current = new AbortController();
    try {
      // @topik, /perintah, dan tingkat jawaban diubah menjadi petunjuk untuk AI (DEC-094)
      const a = await askLabAI(buildLabPrompt(text, meta.effort), 45_000, controller.current.signal);
      setMsgs((m) => [...m, { role: 'ai', text: a }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e instanceof Error ? e.message : String(e), error: true }]);
    } finally {
      setBusy(false);
      controller.current = null;
    }
  };
  // dikte suara (Web Speech API, bahasa Indonesia) bila browser mendukung
  const [canDictate, setCanDictate] = useState(false);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setCanDictate(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  const dictate = () =>
    new Promise<string | undefined>((resolve, reject) => {
      const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
      const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!Rec) return resolve(undefined);
      const r = new Rec();
      r.lang = 'id-ID';
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (ev) => resolve(ev.results[0]?.[0]?.transcript);
      r.onerror = () => reject(new Error('dikte gagal'));
      r.onend = () => resolve(undefined);
      r.start();
    });

  return (
    <section aria-label="Tanya Lab AI" className="flex flex-col gap-3 rounded-3xl border border-ink/10 bg-white/45 p-4 shadow-[0_8px_30px_rgba(14,26,31,0.08)] backdrop-blur-md sm:p-5" data-testid="lab-ai">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-acid" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3" /><path d="M7.5 15h9" /></svg>
          </span>
          Tanya Lab AI
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">jawaban AI · periksa ulang sebelum dipakai</span>
      </div>
      <div ref={list} className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1" aria-live="polite" data-testid="lab-ai-msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'ai' && !m.auto && !m.error ? (
              <AnswerCards text={m.text} />
            ) : (
              <p
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === 'user' ? 'rounded-br-md bg-ink text-paper' : m.error ? 'rounded-bl-md bg-safety/70' : 'rounded-bl-md bg-white/80 text-ink shadow-sm'
                }`}
                data-testid={m.role === 'user' ? 'lab-ai-user' : m.auto ? 'lab-ai-auto' : 'lab-ai-error'}
              >
                {m.text}
              </p>
            )}
          </div>
        ))}
        {busy && (
          <p className="self-start rounded-2xl rounded-bl-md bg-white/80 px-3.5 py-2 text-sm text-muted" role="status" data-testid="lab-ai-busy">
            <span className="prog-pulse">AI sedang berpikir…</span>
          </p>
        )}
      </div>
      {/* kolom tanya: PromptBar (React Bits, DEC-094) — @ topik, / perintah, tingkat jawaban, dikte, tombol kirim/berhenti */}
      <PromptBar
        testId="lab-ai-bar"
        placeholder="Tanya soal briket, kopra, cuka, bio leather… (ketik @ untuk topik, / untuk perintah)"
        sources={LAB_TOPICS.map((t, i) => ({ key: t.key, name: t.name, description: t.description, icon: [Fire02Icon, Leaf01Icon, DropletIcon, TestTube01Icon, Notebook01Icon][i]! }))}
        commands={LAB_COMMANDS.map((c) => ({ key: c.key, name: c.name, description: c.description }))}
        models={[{ key: 'glm-4.7-flash', name: 'GLM-4.7 Flash', tag: 'Lab AI' }]}
        efforts={LAB_EFFORTS}
        defaultEffort="Sedang"
        busy={busy}
        onSend={(text, meta) => void send(text, meta)}
        onStop={() => controller.current?.abort()}
        {...(canDictate && { onDictate: dictate })}
        background="#0E1A1F"
        color="#F3F6F7"
        menuBackground="#16262C"
        sparkColor="#63E6CF"
        sparkBoost={1}
        width={2000}
        radius={16}
        maxRows={5}
        morphDuration={240}
        squash={0.12}
        tilt={8}
        pressScale={0.96}
      />
    </section>
  );
}

/** Jawaban AI sebagai kartu bertahap (maks. 2 paragraf per kartu); klik kartu / "Selanjutnya" untuk bagian berikutnya. */
function AnswerCards({ text }: { text: string }) {
  const cards = answerCards(text);
  const [i, setI] = useState(0);
  const last = i >= cards.length - 1;
  const next = () => !last && setI(i + 1);
  return (
    <div className="flex w-full max-w-[90%] flex-col gap-1.5" data-testid="lab-ai-answer">
      <div
        role="button"
        tabIndex={0}
        onClick={next}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), next())}
        aria-label={last ? 'Bagian terakhir jawaban AI' : 'Tampilkan bagian jawaban berikutnya'}
        className={`sheet-up flex flex-col gap-2 rounded-2xl rounded-bl-md border border-ink/10 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm transition ${last ? '' : 'cursor-pointer hover:border-acid hover:shadow-md'}`}
        key={i}
        data-testid="lab-ai-card"
      >
        {cards[i]!.map((p, k) => (
          <p key={k} className="whitespace-pre-wrap leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      {cards.length > 1 && (
        <div className="flex items-center gap-2 pl-1 text-xs">
          <span className="font-mono text-muted" data-testid="lab-ai-page">
            {i + 1}/{cards.length}
          </span>
          {i > 0 && (
            <button type="button" className="font-semibold text-muted underline" onClick={() => setI(i - 1)}>
              Sebelumnya
            </button>
          )}
          {!last ? (
            <button type="button" className="font-semibold text-[#1FA88F] underline" onClick={next} data-testid="lab-ai-next">
              Selanjutnya →
            </button>
          ) : (
            <span className="text-muted">selesai</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Bentuk minimal Web Speech API (tidak ada di tipe DOM bawaan). */
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}
