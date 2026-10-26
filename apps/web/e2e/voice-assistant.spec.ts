import { test, expect, type Page } from '@playwright/test';

// asisten suara kelapa (DEC-111): kartu sambutan → Ayo → perintah → buka halaman/form & isi data.
// Rencana Groq ditiru (route) supaya uji tidak memakai kuota; mikrofon palsu Chromium.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });

// WAV hening 0,1 dtk (pengganti suara TTS Groq)
const SILENT_WAV = (() => {
  const n = 2400;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
})();
let spoken: string[] = [];
let voices: string[] = [];
const force = async (page: Page) => {
  spoken = [];
  voices = [];
  await page.addInitScript(() => window.localStorage.setItem('gnd-va-force', '1'));
  await page.route('**/api/voice-transcribe', (r) => r.fulfill({ json: { ok: true, text: '' } }));
  await page.route('**/api/voice-tts', async (r) => {
    const b = r.request().postDataJSON() as { text: string; voice?: string };
    spoken.push(b.text);
    voices.push(b.voice ?? '');
    await r.fulfill({ body: SILENT_WAV, contentType: 'audio/wav' });
  });
};

test('kartu sambutan: Gak dulu deh → tidak muncul lagi, tombol kelapa tetap ada', async ({ page }) => {
  test.setTimeout(180_000);
  await force(page);
  await page.goto('/gudang');
  const intro = page.getByTestId('va-intro');
  await expect(intro).toContainText('Mau mulai bersama ku?');
  await expect(intro).toContainText('aku bisa lakukan itu via perintah suara');
  await expect(intro.getByRole('img', { name: 'Maskot kelapa' })).toBeVisible();
  await intro.getByTestId('va-no').click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByTestId('va-fab')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('va-fab')).toBeVisible();
  await expect(page.getByTestId('va-intro')).toHaveCount(0);
});

test('Ayo → "buka pencatatan data lalu buat catatan baru" → form terbuka → "jumlah item…" terisi', async ({ page }) => {
  test.setTimeout(240_000);
  await force(page);
  const plans = [
    { actions: [{ type: 'navigate', target: '/lab?t=bahan' }, { type: 'click', target: 'catat-new' }], reply: 'Buka pencatatan data dan membuat catatan baru.' },
    { actions: [{ type: 'fill', text: 'jumlah item dua perlakuan green house jumlah produksi dua' }], reply: 'Mengisi jumlah item dan perlakuan.' },
    { actions: [{ type: 'fill', text: 'nomor dua berat awal seribu tiga puluh empat tebal daging sepuluh' }], reply: 'Mengisi nomor dua.' },
    { actions: [{ type: 'fill', text: 'isi kolom perlakuan dengan oven gas' }], reply: 'Memilih Oven Gas.' },
    { actions: [], reply: 'Maaf, aku belum paham. Coba ucapkan lagi ya.' },
  ];
  const sent: { text: string; ctx: { path: string; form?: string; buttons: { id: string }[] } }[] = [];
  await page.route('**/api/voice-assistant', async (r) => {
    sent.push(r.request().postDataJSON());
    await r.fulfill({ json: { ok: true, ...plans[sent.length - 1] } });
  });
  await page.goto('/');
  await page.getByTestId('va-yes').click();
  const panel = page.getByTestId('va-panel');
  await expect(panel).toContainText('Aku mendengarkan');
  const say = async (t: string) => {
    await panel.getByTestId('va-text').fill(t);
    await panel.getByTestId('va-text').press('Enter');
  };
  await say('tolong buka pencatatan data terus bikin catatan baru ya');
  await expect(page).toHaveURL(/\/lab\?t=bahan/, { timeout: 120_000 });
  const m = page.getByTestId('catat-awal-modal');
  await expect(m).toBeVisible({ timeout: 60_000 });
  // dibuka lewat suara: bingkai listrik + bagian paling atas form tampil (DEC-113)
  await expect(page.getByTestId('va-spark')).toBeVisible();
  await expect(page.getByTestId('va-spark').locator('canvas')).toHaveCount(1);
  await expect(async () => {
    const box = await m.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(220);
  }).toPass({ timeout: 5000 });
  // bingkai listrik terus menyala selama modal terbuka (DEC-114)
  await page.waitForTimeout(6000);
  await expect(page.getByTestId('va-spark')).toBeVisible();
  // sukses → kalimat owner bergiliran (DEC-122)
  await expect(panel.getByTestId('va-status')).toHaveText('Oke, apalagi?');
  expect(sent[0]!.ctx.path).toBe('/');
  await say('jumlah itemnya dua, perlakuannya green house sebanyak dua');
  await expect(m.getByTestId('catat-count')).toHaveValue('2');
  await expect(m.getByTestId('catat-perl-0')).toContainText('Green House');
  await expect(m.getByTestId('catat-perl-count-0')).toHaveValue('2');
  expect(sent[1]!.ctx.form).toBe('Buat catatan awal');
  // isi kolom angka → "<nama kolom>, <nilai>!" (DEC-122)
  await expect(panel.getByTestId('va-status')).toHaveText(/, 2!$/);
  await say('nomor dua berat awalnya seribu tiga puluh empat, tebalnya sepuluh');
  await expect(m.getByTestId('catat-awal-beratAwal-2')).toHaveValue('1034');
  await expect(m.getByTestId('catat-awal-tebalAwal-2')).toHaveValue('10');
  await expect(panel.getByTestId('va-status')).toHaveText(/1034.*10!$/);
  // "isi kolom <nama kolom> dengan <nilai>" — dropdown dipilih otomatis (DEC-113)
  await say('isi kolom perlakuan dengan oven gas');
  await expect(m.getByTestId('catat-perl-0')).toContainText('Oven Gas');
  // TTS (DEC-115): "sebentar aku proses", jawaban, dan perintah tak dikenali diucapkan
  await say('nyanyikan lagu dong');
  // tidak dikenali → kalimat owner (DEC-122)
  await expect(panel.getByTestId('va-status')).toHaveText('Hahaha! Kamu bilang apa?');
  await expect.poll(() => spoken).toContain('Hahaha! Kamu bilang apa?');
  expect(spoken.some((t) => /seribu tiga puluh empat/.test(t))).toBe(true);
  // "sebentar aku proses" hanya di layar, tidak diucapkan (DEC-117)
  expect(spoken.some((t) => /sebentar/i.test(t))).toBe(false);
  expect(spoken).toContain('Oke, apalagi?');
  expect(voices[spoken.indexOf('Oke, apalagi?')]).toBe('autumn');
  expect(spoken.join(' ')).not.toMatch(/\d/);
  // tombol berbahaya tidak pernah dikirim ke perencana
  expect(sent.flatMap((s) => s.ctx.buttons.map((b) => b.id)).some((id) => /delete|hapus|logout/i.test(id))).toBe(false);
  await expect(page.getByTestId('va-spark')).toBeVisible();
  await panel.getByTestId('va-stop').click();
  await expect(page.getByTestId('va-fab')).toBeVisible();
  // modal ditutup → bingkai listrik berhenti
  await expect(page.getByTestId('va-spark')).toBeVisible();
  await m.getByRole('button', { name: 'Batal' }).click();
  await expect(m).toHaveCount(0);
  await expect(page.getByTestId('va-spark')).toHaveCount(0);
});

test('pertanyaan "apa itu briket?" → bukan tugas asisten navigasi: rekaman suara owner diputar + teks arahan ke Tanya Lab AI (DEC-126)', async ({ page }) => {
  test.setTimeout(180_000);
  await force(page);
  await page.addInitScript(() => window.localStorage.setItem('gnd-va:local', 'nanti'));
  await page.route('**/api/voice-assistant', (r) => r.fulfill({ json: { ok: true, actions: [{ type: 'ask', text: 'apa itu briket?' }], reply: 'Aku carikan.' } }));
  let labAi = 0;
  await page.route('**/api/lab-ai', (r) => {
    labAi++;
    return r.fulfill({ json: { ok: true, text: 'x' } });
  });
  const clips: string[] = [];
  page.on('request', (r) => r.url().includes('/sounds/') && clips.push(new URL(r.url()).pathname));
  await page.goto('/gudang');
  await page.getByTestId('va-fab').click();
  const panel = page.getByTestId('va-panel');
  await expect(panel).toContainText('Aku mendengarkan');
  await panel.getByTestId('va-text').fill('apa itu briket?');
  await panel.getByTestId('va-text').press('Enter');
  await expect(panel.getByTestId('va-status')).toHaveText('Aduh! Bukannya aku gak bisa jawab, tapi peranku hanya perintah navigasi cepat. Mungkin kamu bisa pergi ke menu Tanya Lab AI pada halaman GnD Lab.');
  await expect.poll(() => clips).toContain('/sounds/tanya-lab-ai.wav');
  expect(labAi).toBe(0);
  expect(spoken).toEqual([]);
});

test('tooltip "Harap tutup fitur ini…" bisa ditutup; kartu aktif berbingkai listrik di atas bingkai modal; tutup otomatis 10 menit tanpa perintah', async ({ page }) => {
  test.setTimeout(180_000);
  await force(page);
  await page.clock.install();
  await page.addInitScript(() => window.localStorage.setItem('gnd-va:local', 'nanti'));
  await page.goto('/gudang');
  await expect(page.getByTestId('va-tip')).toHaveText(/Harap tutup fitur ini jika sudah menggunakannya\./);
  await page.getByTestId('va-fab').click();
  const panel = page.getByTestId('va-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('va-tip')).toBeVisible();
  await expect(page.getByTestId('va-panel-spark').locator('canvas')).toHaveCount(1);
  // kartu kelapa di atas lapisan bingkai listrik modal
  const z = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="va-panel"]')!.closest('.fixed') as HTMLElement;
    const probe = document.createElement('div');
    probe.className = 'voice-spark';
    document.body.appendChild(probe);
    const r = [Number(getComputedStyle(card).zIndex), Number(getComputedStyle(probe).zIndex)];
    probe.remove();
    return r;
  });
  expect(z[0]).toBeGreaterThan(z[1]!);
  await page.getByTestId('va-tip-close').click();
  await expect(page.getByTestId('va-tip')).toHaveCount(0);
  // 9 menit: masih terbuka; 10 menit tanpa perintah: ditutup otomatis
  await page.clock.fastForward('09:00');
  await expect(panel).toBeVisible();
  await page.clock.fastForward('01:30');
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('va-fab')).toBeVisible();
});

test('DEC-139: suara TTS disimpan di perangkat → kalimat yang sama (juga setelah muat ulang) tidak meminta Groq lagi', async ({ page }) => {
  test.setTimeout(180_000);
  await force(page);
  await page.route('**/api/voice-assistant', (r) => r.fulfill({ json: { ok: true, actions: [], reply: 'Maaf, aku belum paham. Coba ucapkan lagi ya.' } }));
  const shown: string[] = [];
  const round = async () => {
    await page.goto('/konversi');
    await page.getByTestId('va-yes').click();
    const panel = page.getByTestId('va-panel');
    await expect(panel).toContainText('Aku mendengarkan');
    for (let i = 0; i < 3; i++) {
      await panel.getByTestId('va-text').fill('nyanyikan lagu dong');
      await panel.getByTestId('va-text').press('Enter');
      await expect(panel.getByTestId('va-status')).not.toHaveText(/sebentar/i, { timeout: 30_000 });
      await page.waitForTimeout(400);
      shown.push((await panel.getByTestId('va-status').textContent()) ?? '');
    }
    await panel.getByTestId('va-stop').click();
  };
  await round();
  await expect.poll(() => spoken.length).toBeGreaterThan(0);
  const first = [...spoken];
  // setiap kalimat hanya sekali meminta suara ke server
  expect(new Set(first).size).toBe(first.length);
  await expect
    .poll(() => page.evaluate(() => new Promise<number>((res) => { const r = indexedDB.open('gnd-tts'); r.onsuccess = () => { const c = r.result.transaction('clips').objectStore('clips').count(); c.onsuccess = () => res(c.result); }; r.onerror = () => res(-1); })))
    .toBeGreaterThanOrEqual(first.length);
  // muat ulang (memori sesi hilang) → kalimat yang sama diambil dari IndexedDB, bukan Groq
  await page.evaluate(() => localStorage.removeItem('gnd-va:local'));
  await round();
  const again = spoken.slice(first.length);
  expect(again.filter((t) => first.includes(t))).toEqual([]);
  // putaran kedua memang mengucapkan kalimat yang sudah pernah dibuat (jadi suaranya dari simpanan)
  expect(shown.slice(3).some((t) => first.includes(t))).toBe(true);
});

test('DEC-141: panel maskot ditutup → suara TTS berhenti (sedang diputar maupun masih dimuat)', async ({ page }) => {
  test.setTimeout(180_000);
  spoken = [];
  await page.addInitScript(() => {
    window.localStorage.setItem('gnd-va-force', '1');
    // catat semua <audio> yang diputar
    const w = window as unknown as { __audios: HTMLAudioElement[] };
    w.__audios = [];
    const play = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function (this: HTMLAudioElement) {
      w.__audios.push(this);
      return play.call(this);
    };
  });
  // WAV hening 4 dtk supaya masih diputar saat panel ditutup; respons TTS kedua ditahan 3 dtk
  const n = 24000 * 4;
  const wav = Buffer.alloc(44 + n * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
  let slow = false;
  await page.route('**/api/voice-transcribe', (r) => r.fulfill({ json: { ok: true, text: '' } }));
  await page.route('**/api/voice-tts', async (r) => {
    spoken.push((r.request().postDataJSON() as { text: string }).text);
    if (slow) await new Promise((res) => setTimeout(res, 3000));
    await r.fulfill({ body: wav, contentType: 'audio/wav' });
  });
  await page.route('**/api/voice-assistant', (r) => r.fulfill({ json: { ok: true, actions: [], reply: 'Maaf, aku belum paham. Coba ucapkan lagi ya.' } }));
  const audios = () => page.evaluate(() => (window as unknown as { __audios: HTMLAudioElement[] }).__audios.map((a) => ({ paused: a.paused, src: a.src })));
  const panel = page.getByTestId('va-panel');
  const ask = async () => {
    await panel.getByTestId('va-text').fill('nyanyikan lagu dong');
    await panel.getByTestId('va-text').press('Enter');
  };

  // 1. sedang diputar → tutup → berhenti
  await page.goto('/konversi');
  await page.getByTestId('va-yes').click();
  await expect(panel).toContainText('Aku mendengarkan');
  await ask();
  await expect.poll(async () => (await audios()).filter((a) => !a.paused).length, { timeout: 30_000 }).toBe(1);
  await panel.getByTestId('va-stop').click();
  await expect.poll(async () => (await audios()).filter((a) => !a.paused).length).toBe(0);

  // 2. suara masih dimuat (respons TTS lambat) → tutup → tidak pernah diputar
  slow = true;
  await page.getByTestId('va-fab').click();
  await expect(panel).toContainText('Aku mendengarkan', { timeout: 15_000 });
  const before = (await audios()).length;
  const asked = spoken.length;
  await ask();
  await expect.poll(() => spoken.length, { timeout: 30_000 }).toBeGreaterThan(asked);
  await panel.getByTestId('va-stop').click();
  await page.waitForTimeout(4500);
  expect((await audios()).length).toBe(before);
});

