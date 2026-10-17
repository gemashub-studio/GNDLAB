/**
 * Inti login GnD Lab (DEC-090) — murni (Node crypto), diuji unit:
 * validasi isian, kode OTP 6 digit (disimpan sebagai HMAC, bukan teks), enkripsi token sesi (AES-256-GCM),
 * dan template email OTP sederhana berlogo.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 60_000;
export const OTP_MAX_PER_HOUR = 5;

export type OtpPurpose = 'register' | 'login';

export function normUsername(s: string): string {
  return s.trim().toLowerCase();
}

/** 3–30 karakter: huruf kecil, angka, titik, garis bawah, minus; diawali huruf/angka. */
export function usernameError(s: string): string | undefined {
  const u = normUsername(s);
  if (!u) return 'Username wajib diisi.';
  if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(u)) return 'Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau minus (diawali huruf/angka).';
  return undefined;
}

export function emailError(s: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) ? undefined : 'Alamat email tidak valid.';
}

export function passwordError(s: string): string | undefined {
  if (s.length < 8) return 'Password minimal 8 karakter.';
  if (s.length > 72) return 'Password maksimal 72 karakter.';
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'Password harus berisi huruf dan angka.';
  return undefined;
}

export function genOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export const isOtpFormat = (code: string) => /^\d{6}$/.test(code.trim());

/** HMAC kode (terikat tujuan & email) — kode asli tidak pernah disimpan. */
export function otpHash(secret: string, purpose: OtpPurpose, email: string, code: string): string {
  return createHmac('sha256', secret).update(`${purpose}:${email.trim().toLowerCase()}:${code.trim()}`).digest('hex');
}

export function otpMatches(secret: string, purpose: OtpPurpose, email: string, code: string, hash: string): boolean {
  const a = Buffer.from(otpHash(secret, purpose, email, code), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

const key32 = (secret: string) => createHash('sha256').update(`gnd-lab-otp:${secret}`).digest();

/** Enkripsi teks (token sesi) dengan AES-256-GCM. */
export function seal(secret: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key32(secret), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}

export function unseal(secret: string, sealed: string): string {
  const [iv, tag, enc] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !enc) throw new Error('payload rusak');
  const d = createDecipheriv('aes-256-gcm', key32(secret), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

/** Sensor email untuk ditampilkan: masciosa@gmail.com → ma•••••a@gmail.com */
export function maskEmail(email: string): string {
  const [u = '', dom = ''] = email.split('@');
  if (u.length <= 2) return `${u[0] ?? ''}•@${dom}`;
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 3))}${u.slice(-1)}@${dom}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Email OTP sederhana: logo situs, kode 6 digit besar, masa berlaku, catatan keamanan. */
export function otpEmail(opts: { code: string; purpose: OtpPurpose; username: string; logoUrl: string; siteUrl: string }): { subject: string; html: string; text: string } {
  const action = opts.purpose === 'register' ? 'menyelesaikan pendaftaran' : 'masuk';
  const subject = `${opts.code} adalah kode verifikasi GnD Lab kamu`;
  const digits = opts.code.split('').map((d) => `<td style="width:44px;height:54px;border:2px solid #0E1A1F;border-radius:10px;background:#F3F6F7;font:700 28px/54px 'Courier New',monospace;color:#0E1A1F;text-align:center">${d}</td>`).join('<td style="width:8px"></td>');
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#EEF2F3;font-family:Arial,Helvetica,sans-serif;color:#0E1A1F">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EEF2F3;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DCE3E6">
<tr><td style="background:#0E1A1F;padding:20px 24px"><img src="${esc(opts.logoUrl)}" width="168" height="44" alt="gemasSTUDIO · GnD Lab" style="display:block;border:0"></td></tr>
<tr><td style="padding:28px 24px 8px">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#1FA88F;font-weight:700">Kode verifikasi</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Halo ${esc(opts.username)},</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#2A3A41">Masukkan kode berikut untuk ${action} di GnD Lab.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 20px"><tr>${digits}</tr></table>
<p style="margin:0 0 6px;font-size:13px;color:#5B6B72;text-align:center">Kode berlaku <strong>10 menit</strong> dan hanya bisa dipakai sekali.</p>
</td></tr>
<tr><td style="padding:16px 24px 24px"><p style="margin:0;padding:12px 14px;background:#F3F6F7;border-radius:10px;font-size:12px;line-height:1.6;color:#5B6B72">Bukan kamu yang meminta? Abaikan email ini — akunmu tetap aman. Jangan berikan kode ini kepada siapa pun.</p></td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #E2E8EA;font-size:11px;color:#8A9AA0"><a href="${esc(opts.siteUrl)}" style="color:#1FA88F;text-decoration:none">gemasSTUDIO · GnD Lab</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `Halo ${opts.username},\n\nKode verifikasi GnD Lab kamu untuk ${action}: ${opts.code}\nBerlaku 10 menit dan hanya sekali pakai.\n\nBukan kamu? Abaikan email ini.\n${opts.siteUrl}`;
  return { subject, html, text };
}
