import { NextResponse } from 'next/server';
import { AuthError, loginStart, loginVerify, missingEnv, registerStart, registerVerify } from '@/server/labAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/lab-auth/{register-start|register-verify|login-start|login-verify} (DEC-090). */
export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const missing = missingEnv();
  if (missing.length) {
    console.error('[lab-auth] env belum diisi:', missing.join(', '));
    return NextResponse.json({ ok: false, error: 'Login belum siap: server belum dikonfigurasi. Hubungi admin.' }, { status: 503 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Permintaan tidak valid.' }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  try {
    switch (action) {
      case 'register-start':
        return NextResponse.json(await registerStart(body, origin));
      case 'register-verify':
        return NextResponse.json({ ok: true, ...(await registerVerify(body)) });
      case 'login-start':
        return NextResponse.json(await loginStart(body, origin));
      case 'login-verify':
        return NextResponse.json({ ok: true, ...(await loginVerify(body)) });
      default:
        return NextResponse.json({ ok: false, error: 'Aksi tidak dikenal.' }, { status: 404 });
    }
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error('[lab-auth]', action, e);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, { status: 500 });
  }
}
