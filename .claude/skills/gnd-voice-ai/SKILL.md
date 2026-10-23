---
name: gnd-voice-ai
description: Mengubah asisten suara kelapa (VoiceAssistant), pengisian form dengan suara (VoiceFill), TTS Groq Orpheus, transkripsi Whisper, perencana perintah, dan Tanya Lab AI (OpenRouter + filter jawaban + memori). Pakai saat owner minta ubah respons suara, kalimat TTS, model/kunci AI, atau perilaku Tanya Lab AI.
---

# Suara & AI GnD Lab

## Arsitektur
- **Kunci** hanya di server. Groq: `GROQ_API_KEY`, cadangan `GROQ_API_KEY_2…_5` berurutan (`server/groq.ts` `groqFetch`:
  ganti kunci bila 429/401/403/5xx/galat jaringan). OpenRouter: `OPEN_ROUTER_APIKEY`, opsional `OPEN_ROUTER_MODEL`.
- **Transkripsi**: `/api/voice-transcribe` → Whisper large-v3 (id), buang halusinasi ("Terima kasih telah menonton").
- **Perencana** asisten kelapa: `/api/voice-assistant` → gpt-oss-20b JSON (`server/voiceAssistant.ts` `systemPrompt`,
  `sanitizePlan`). Aksi: navigate / click / fill / ask. Tombol berbahaya (hapus/keluar) selalu ditolak.
- **TTS**: `/api/voice-tts` → `canopylabs/orpheus-v1-english`, suara `autumn` (perintah) atau `austin` (jawaban Lab AI);
  batas 300 karakter → teks panjang lewat `speakLong` (dipecah per kalimat ≤ 280). **Simpanan suara** (DEC-139):
  `ttsAudio` = memori sesi → IndexedDB `gnd-tts` (`lib/ttsStore.ts`, kunci `ttsKey(teks, suara)`, maks. 400 klip/40 MB)
  → `/api/voice-tts`; suara baru selalu disimpan. Mengubah kalimat = suara baru dibuat sekali. Teks khusus suara: `lib/ttsText.ts`
  (angka → kata, "maaf" → "ma ap, ", tanda baca intonasi).
- **Maskot & dok** (DEC-133): `CoconutMascot` = gambar `public/assets/mascot/kelapa-kora.webp` + kelas animasi
  `coco-surf--<mood>` (globals.css); `MascotDock` = tombol `va-fab` di sisi kanan (sebagian bersembunyi, seret naik-turun,
  posisi `localStorage gnd-va:dock-y`, klik → keluar 0,55 dtk lalu `start()` setelah 0,7 dtk); panel memakai `bottom` dok.
- **Asisten kelapa** (`components/shell/VoiceAssistant.tsx`): sukses → `successText` (kalimat owner bergiliran, isi angka →
  "<kolom>, <nilai>!"); gagal → `failText`; **pertanyaan → rekaman owner** `public/sounds/tanya-lab-ai.wav` + teks
  `ASK_REDIRECT_TEXT` (asisten hanya navigasi; jawaban ada di Tanya Lab AI).
- **Tanya Lab AI** (`components/lab/AskLabAI.tsx`, `lib/labAi.ts`): `/api/lab-ai` → OpenRouter model gratis dicoba satu
  per satu (`OR_FREE_MODELS`, DEC-139), semua gagal → Groq `GROQ_FALLBACK_MODELS`, memori 8 pesan terakhir (`localStorage gnd-labai:memory`), jawaban disaring `server/labAiFilter.ts`
  (aturan STRIP/JUNK + penyunting Groq) lalu dibacakan suara Austin (paragraf pertama + pertanyaan lanjutan, koma diberi "!"
  — `lib/voiceAnswer.ts`), tombol 🔊/🔇 (`gnd-labai:voice`).

## Jebakan
- Model `:free` OpenRouter bisa dicabut (mis. MiniMax M3.1 Flash, 22 Okt 2026 → 404 "Provider returned error") —
  perbarui `OR_FREE_MODELS` dari `openrouter.ai/models?max_price=0` (FND-053).
- Model "uncensored" gratis tidak tersedia di OpenRouter (2026-10-21; Dolphin Venice & Cydonia berbayar) — cek
  `curl https://openrouter.ai/api/v1/models` sebelum menjanjikan model.
- Model gratis kadang melantur (bahasa Inggris acak, "Created by…", huruf kapital-kecil Unicode) → tambah pola di
  `labAiFilter.ts` + uji di `test/labAiFilter.test.ts` dengan contoh teks owner.
- File WAV dari owner bisa ber-header streaming (panjang 0xFFFFFFFF) → tulis ulang header RIFF/data sebelum dipakai.
- Transkrip WAV owner bisa dibaca lewat server dev lokal: `curl -X POST http://localhost:3210/api/voice-transcribe -H "content-type: audio/wav" --data-binary @file.wav`.
- Mikrofon dibisukan selama asisten bicara (`talk()` + `isMuted`) agar suara sendiri tidak terekam.

## Uji
`test/voiceAssistant.test.ts`, `test/groqTts.test.ts`, `test/voiceAnswer.test.ts`, `test/labAi.test.ts`,
`test/labAiFilter.test.ts`, `e2e/voice-assistant.spec.ts`, `e2e/lab.spec.ts` (Tanya Lab AI).
