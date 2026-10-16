'use client';

import { useEffect, useRef, useState } from 'react';
import { askLabAI, CATAT_HINT, labGreeting, MAX_PROMPT } from '@/lib/labAi';

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
  const [q, setQ] = useState('');
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

  const send = async () => {
    const text = q.trim();
    if (!text || busy) return;
    setQ('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const a = await askLabAI(text);
      setMsgs((m) => [...m, { role: 'ai', text: a }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e instanceof Error ? e.message : String(e), error: true }]);
    } finally {
      setBusy(false);
    }
  };

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
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.role === 'user' ? 'rounded-br-md bg-ink text-paper' : m.error ? 'rounded-bl-md bg-safety/70' : 'rounded-bl-md bg-white/80 text-ink shadow-sm'
              }`}
              data-testid={m.role === 'user' ? 'lab-ai-user' : m.auto ? 'lab-ai-auto' : m.error ? 'lab-ai-error' : 'lab-ai-answer'}
            >
              {m.text}
            </p>
          </div>
        ))}
        {busy && (
          <p className="self-start rounded-2xl rounded-bl-md bg-white/80 px-3.5 py-2 text-sm text-muted" role="status" data-testid="lab-ai-busy">
            <span className="prog-pulse">AI sedang berpikir…</span>
          </p>
        )}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="field min-h-[44px] flex-1 resize-none bg-white/90 text-sm"
          rows={1}
          value={q}
          maxLength={MAX_PROMPT}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Tanya soal briket, kopra, cuka, bio leather…"
          aria-label="Pertanyaan untuk Lab AI"
          data-testid="lab-ai-input"
        />
        <button type="submit" className="btn-primary" disabled={busy || !q.trim()} data-testid="lab-ai-send">Kirim</button>
      </form>
    </section>
  );
}
