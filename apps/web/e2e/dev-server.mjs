// Server dev khusus E2E (DEC-093): port 3210, folder build .next-e2e, Supabase & kunci server DIMATIKAN
// (env proses mengalahkan .env) agar uji tidak tertahan di layar login.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// selalu jalan dari folder apps/web, dari mana pun dipanggil
const cwd = fileURLToPath(new URL('..', import.meta.url));

const env = {
  ...process.env,
  PROJECT_URL: '',
  ANON_KEY_SUPABASE: '',
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  RESEND_API_KEY: '',
  NEXTAUTH_URL: 'http://localhost:3210',
  NEXT_DIST_DIR: '.next-e2e',
};
const child = spawn('pnpm', ['exec', 'next', 'dev', '--turbopack', '-p', '3210'], { env, cwd, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
