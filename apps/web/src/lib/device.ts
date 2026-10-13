/**
 * Kode perangkat untuk ID baru (DEC-065): 2 karakter acak per browser, HANYA dipakai bila sinkron Google
 * Drive aktif — supaya laptop & HP yang sama-sama membuat data saat offline tidak menghasilkan ID kembar.
 * Tanpa sinkron, ID tetap format lama (mis. KE-P01).
 */
const DEV_KEY = 'gemas-device-code';
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function syncEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return true;
  try {
    return !!localStorage.getItem('gemas-google-client-id');
  } catch {
    return false;
  }
}

/** '' bila sinkron tidak aktif / penyimpanan browser tak ada; selain itu kode tetap per browser, mis. "K7". */
export function deviceTag(): string {
  if (!syncEnabled()) return '';
  try {
    let c = localStorage.getItem(DEV_KEY);
    if (!c) {
      // huruf pertama selalu huruf, agar angka urut di depannya tetap terbaca (mis. 01K7, bukan 0123)
      const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!;
      c = pick(CHARS.slice(0, 24)) + pick(CHARS);
      localStorage.setItem(DEV_KEY, c);
    }
    return c;
  } catch {
    return '';
  }
}
