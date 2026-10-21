import { NextResponse } from 'next/server';
import { askOpenRouter, cleanHistory, LabAiError } from '@/server/labAi';
import { requireLabUser, VoiceError } from '@/server/voiceTranscribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Tanya Lab AI (DEC-123): { prompt, history } → { text, model }. Wajib login (kuota OpenRouter). */
export async function POST(req: Request) {
  try {
    await requireLabUser(req.headers.get('authorization'));
    const body = (await req.json().catch(() => ({}))) as { prompt?: unknown; history?: unknown };
    const out = await askOpenRouter(typeof body.prompt === 'string' ? body.prompt : '', cleanHistory(body.history));
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof VoiceError) return NextResponse.json({ ok: false, error: e.message.replace('pengisian suara', 'Lab AI') }, { status: e.status });
    if (e instanceof LabAiError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error('[lab-ai]', e);
    return NextResponse.json({ ok: false, error: 'Lab AI gagal.' }, { status: 500 });
  }
}
