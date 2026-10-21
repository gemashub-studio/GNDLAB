/**
 * Panggilan Groq dengan kunci cadangan (DEC-116): coba GROQ_API_KEY dulu; bila limit habis (429), kunci ditolak
 * (401/403), layanan sedang bermasalah (5xx), atau jaringan gagal → coba kunci berikutnya: GROQ_API_KEY_2 … GROQ_API_KEY_5 (DEC-124).
 * Dipakai transkripsi suara, perencana asisten, dan TTS. Kunci hanya dibaca di server.
 */
export const groqKeys = (env: Record<string, string | undefined> = process.env): string[] =>
  [env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3, env.GROQ_API_KEY_4, env.GROQ_API_KEY_5].map((k) => (k ?? '').trim()).filter((k, i, a) => k && a.indexOf(k) === i);

/** Status yang layak dicoba ulang dengan kunci berikutnya. */
export const shouldFallback = (status: number) => status === 429 || status === 401 || status === 403 || status >= 500;

/**
 * fetch ke Groq dengan header Authorization diisi otomatis; berganti kunci bila perlu.
 * Mengembalikan respons terakhir (berhasil, atau gagal dari kunci terakhir). Galat jaringan dilempar bila semua kunci gagal.
 */
export async function groqFetch(url: string, init: RequestInit, keys: string[] = groqKeys(), fetcher: typeof fetch = fetch): Promise<Response> {
  if (!keys.length) throw new Error('GROQ_API_KEY belum diisi');
  let lastErr: unknown;
  for (let i = 0; i < keys.length; i++) {
    const last = i === keys.length - 1;
    try {
      const res = await fetcher(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${keys[i]}` } });
      if (last || !shouldFallback(res.status)) return res;
      console.warn(`[groq] kunci ${i + 1} gagal (${res.status}) → coba kunci cadangan`);
      await res.body?.cancel().catch(() => undefined);
    } catch (e) {
      // dibatalkan oleh batas waktu pemanggil → jangan coba kunci lain
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      lastErr = e;
      if (last) throw e;
      console.warn(`[groq] kunci ${i + 1} galat jaringan → coba kunci cadangan`);
    }
  }
  throw lastErr ?? new Error('Groq tidak bisa dihubungi');
}
