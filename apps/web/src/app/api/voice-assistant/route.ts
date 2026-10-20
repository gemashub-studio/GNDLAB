import { NextResponse } from 'next/server';
import { AssistantError, planVoiceCommand, type AssistantContext } from '@/server/voiceAssistant';
import { requireLabUser, VoiceError } from '@/server/voiceTranscribe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Asisten suara kelapa (DEC-111): { text, ctx } → { actions, reply }. Wajib login (kuota Groq). */
export async function POST(req: Request) {
  try {
    await requireLabUser(req.headers.get('authorization'));
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; ctx?: Partial<AssistantContext> };
    const c = body.ctx ?? {};
    const ctx: AssistantContext = {
      path: typeof c.path === 'string' ? c.path.slice(0, 200) : '/',
      pages: Array.isArray(c.pages) ? c.pages.slice(0, 40).filter((p) => p && typeof p.href === 'string' && typeof p.label === 'string') : [],
      buttons: Array.isArray(c.buttons) ? c.buttons.slice(0, 80).filter((b) => b && typeof b.id === 'string' && typeof b.text === 'string').map((b) => ({ id: b.id.slice(0, 80), text: b.text.slice(0, 60) })) : [],
      ...(typeof c.form === 'string' && { form: c.form.slice(0, 80) }),
      ...(Array.isArray(c.formFields) && { formFields: c.formFields.filter((f): f is string => typeof f === 'string').slice(0, 60).map((f) => f.slice(0, 40)) }),
    };
    return NextResponse.json({ ok: true, ...(await planVoiceCommand(typeof body.text === 'string' ? body.text : '', ctx)) });
  } catch (e) {
    if (e instanceof VoiceError || e instanceof AssistantError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error('[voice-assistant]', e);
    return NextResponse.json({ ok: false, error: 'Asisten suara gagal.' }, { status: 500 });
  }
}
