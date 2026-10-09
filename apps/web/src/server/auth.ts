import 'server-only';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import EmailProvider from 'next-auth/providers/email';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import { prisma } from './db';

export type Role = 'viewer' | 'editor' | 'data_admin';

const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const toAdapterUser = (u: { id: string; email: string }): AdapterUser => ({ id: u.id, email: u.email, emailVerified: null });

/**
 * Adapter minimal di atas tabel `app_user` (schema.sql) + `auth_verification_token` (migrasi 0002).
 * Sesi memakai JWT, jadi tabel session/account NextAuth tidak dibutuhkan (DEC-023).
 */
export const gemasAdapter: Adapter = {
  async createUser(user: Omit<AdapterUser, 'id'>) {
    const email = user.email.toLowerCase();
    const role: Role = adminEmails().includes(email) ? 'data_admin' : 'editor';
    return toAdapterUser(await prisma.app_user.create({ data: { email, role } }));
  },
  async getUser(id) {
    const u = await prisma.app_user.findUnique({ where: { id } });
    return u && toAdapterUser(u);
  },
  async getUserByEmail(email) {
    const u = await prisma.app_user.findUnique({ where: { email: email.toLowerCase() } });
    return u && toAdapterUser(u);
  },
  async getUserByAccount() {
    return null; // tidak ada provider OAuth
  },
  async updateUser(user) {
    const u = await prisma.app_user.findUniqueOrThrow({ where: { id: user.id } });
    return toAdapterUser(u); // email & peran tidak diubah lewat NextAuth
  },
  async linkAccount() {
    return undefined;
  },
  async createVerificationToken(t) {
    await prisma.auth_verification_token.create({ data: t });
    return t;
  },
  async useVerificationToken({ identifier, token }) {
    try {
      return await prisma.auth_verification_token.delete({ where: { identifier_token: { identifier, token } } });
    } catch {
      return null; // token sudah dipakai / tidak ada
    }
  },
};

/**
 * Batas permintaan tautan masuk per email (anti spam email). In-memory per proses — cukup untuk satu
 * server; deployment multi-instance perlu penyimpanan bersama (catat di risk log).
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_WINDOW = 3;
const loginHits = new Map<string, number[]>();
export function allowLoginEmail(email: string, now = Date.now()): boolean {
  const key = email.toLowerCase();
  const recent = (loginHits.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  if (recent.length >= LOGIN_MAX_PER_WINDOW) {
    loginHits.set(key, recent);
    return false;
  }
  recent.push(now);
  loginHits.set(key, recent);
  if (loginHits.size > 10_000) loginHits.clear(); // pengaman memori
  return true;
}

export const authOptions: NextAuthOptions = {
  adapter: gemasAdapter,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 3600 },
  pages: { signIn: '/masuk', verifyRequest: '/masuk?cek=1', error: '/masuk' },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER || 'smtp://localhost:25',
      from: process.env.EMAIL_FROM || 'gemasSTUDIO <noreply@localhost>',
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url, provider }) {
        if (!allowLoginEmail(identifier)) {
          throw new Error('Terlalu banyak permintaan tautan masuk. Coba lagi beberapa menit lagi.');
        }
        if (!process.env.EMAIL_SERVER) {
          if (process.env.NODE_ENV === 'production') throw new Error('EMAIL_SERVER belum diatur');
          // Mode pengembangan: tidak ada SMTP — tautan dicetak di terminal server.
          console.log(`\n[gemasSTUDIO] Tautan masuk untuk ${identifier}:\n${url}\n`);
          return;
        }
        const { createTransport } = await import('nodemailer');
        const transport = createTransport(provider.server);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: 'Masuk ke gemasSTUDIO',
          text: `Klik tautan ini untuk masuk ke gemasSTUDIO (berlaku 15 menit):\n${url}\n\nKalau kamu nggak merasa minta, abaikan saja email ini.`,
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Peran dibaca dari DB hanya saat login (atau token lama tanpa peran) — bukan di setiap request.
      // Perubahan peran berlaku setelah pengguna login ulang.
      if (user?.id || token.role === undefined) {
        const id = user?.id ?? token.sub;
        const u = id ? await prisma.app_user.findUnique({ where: { id }, select: { role: true } }) : null;
        token.role = u?.role ?? 'viewer';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

export async function currentUser(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions);
  const u = s?.user as { id?: string; email?: string; role?: Role } | undefined;
  return u?.id && u.email ? { id: u.id, email: u.email, role: u.role ?? 'viewer' } : null;
}
