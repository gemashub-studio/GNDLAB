import { NextResponse } from 'next/server';
import { requireLabUser, VoiceError } from '@/server/voiceTranscribe';
import { synthesize, TtsError } from '@/server/voiceTts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Suara jawaban asisten kelapa (DEC-115): { text } → audio/wav (hening di awal sudah dipotong). Wajib login. */
export async function POST(req: Request) {
  try {
    await requireLabUser(req.headers.get('authorization'));
    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    const wav = await synthesize(typeof body.text === 'string' ? body.text : '');
    return new NextResponse(wav as Uint8Array<ArrayBuffer>, { headers: { 'content-type': 'audio/wav', 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof VoiceError || e instanceof TtsError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error('[voice-tts]', e);
    return NextResponse.json({ ok: false, error: 'Suara gagal dibuat.' }, { status: 500 });
  }
}
