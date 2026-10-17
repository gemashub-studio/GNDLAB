import { describe, expect, it } from 'vitest';
import { emailError, genOtp, isOtpFormat, maskEmail, otpEmail, otpHash, otpMatches, passwordError, seal, unseal, usernameError } from '@/server/labAuthCore';

describe('login GnD Lab: username + password + OTP email (DEC-090)', () => {
  it('validasi isian', () => {
    expect(usernameError('masciosa')).toBeUndefined();
    expect(usernameError('Lab_01.uji')).toBeUndefined(); // dinormalkan ke huruf kecil
    expect(usernameError('ab')).toMatch(/3–30/);
    expect(usernameError('-awal')).toBeDefined();
    expect(usernameError('ada spasi')).toBeDefined();
    expect(emailError('a@b.co')).toBeUndefined();
    expect(emailError('bukan-email')).toBeDefined();
    expect(passwordError('pendek1')).toMatch(/minimal 8/);
    expect(passwordError('hanyahuruf')).toMatch(/huruf dan angka/);
    expect(passwordError('rahasia123')).toBeUndefined();
  });
  it('OTP 6 digit; disimpan sebagai HMAC terikat tujuan & email; dibandingkan aman', () => {
    for (let i = 0; i < 50; i++) expect(genOtp()).toMatch(/^\d{6}$/);
    expect(isOtpFormat('012345')).toBe(true);
    expect(isOtpFormat('12345')).toBe(false);
    const h = otpHash('s3cret', 'login', 'A@B.co', '123456');
    expect(h).not.toContain('123456');
    expect(otpMatches('s3cret', 'login', 'a@b.co', '123456', h)).toBe(true);
    expect(otpMatches('s3cret', 'login', 'a@b.co', '654321', h)).toBe(false);
    expect(otpMatches('s3cret', 'register', 'a@b.co', '123456', h)).toBe(false);
    expect(otpMatches('lain', 'login', 'a@b.co', '123456', h)).toBe(false);
  });
  it('token sesi dienkripsi AES-GCM (tidak terbaca, tidak bisa diubah)', () => {
    const s = seal('k', JSON.stringify({ access_token: 'aaa', refresh_token: 'rrr' }));
    expect(s).not.toContain('aaa');
    expect(JSON.parse(unseal('k', s))).toEqual({ access_token: 'aaa', refresh_token: 'rrr' });
    expect(() => unseal('kunci-lain', s)).toThrow();
    const parts = s.split('.');
    expect(() => unseal('k', [parts[0], parts[1], `${parts[2]}x`].join('.'))).toThrow();
  });
  it('email: sensor alamat & isi email OTP berlogo', () => {
    expect(maskEmail('masciosa@gmail.com')).toBe('ma•••••a@gmail.com');
    const m = otpEmail({ code: '482913', purpose: 'register', username: 'budi<b>', logoUrl: 'https://x.test/email-logo.png', siteUrl: 'https://x.test/lab' });
    expect(m.subject).toBe('482913 adalah kode verifikasi GnD Lab kamu');
    expect(m.html).toContain('src="https://x.test/email-logo.png"');
    for (const d of '482913') expect(m.html).toContain(`>${d}</td>`);
    expect(m.html).toContain('budi&lt;b&gt;');
    expect(m.html).toContain('menyelesaikan pendaftaran');
    expect(m.text).toContain('482913');
    expect(otpEmail({ code: '000111', purpose: 'login', username: 'x', logoUrl: '', siteUrl: '' }).html).toContain('untuk masuk');
  });
});
