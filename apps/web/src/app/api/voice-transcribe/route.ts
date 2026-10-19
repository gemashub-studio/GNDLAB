import { NextResponse } from 'next/server';
import { requireLabUser, transcribeVoice, VoiceError } from '@/server/voiceTranscribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pengisian suara pencatatan (DEC-099): body = rekaman audio pendek → { text }. */
export async function POST(req: Request) {
  try {
    await requireLabUser(req.headers.get('authorization'));
    const text = await transcribeVoice(await req.arrayBuffer(), req.headers.get('content-type') ?? 'audio/webm');
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    if (e instanceof VoiceError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error('[voice-transcribe]', e);
    return NextResponse.json({ ok: false, error: 'Pengisian suara gagal.' }, { status: 500 });
  }
}
