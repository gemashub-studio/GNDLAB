---
name: gnd-checkpoint
description: Checkpoint wajib di akhir SETIAP tugas gemasSTUDIO/GnD Lab (permintaan owner 2026-10-21) — simpan pekerjaan, temuan, dan info baru menjadi log, temuan FND, skill, lalu commit (+ deploy bila disetujui). Pakai saat tugas selesai, sebelum melapor ke owner, atau saat owner bilang "simpan", "checkpoint", "catat".
---

# Checkpoint gemasSTUDIO (wajib tiap tugas selesai)

Owner meminta: **setiap pekerjaan, temuan, dan info baru selalu disimpan supaya menjadi skill dan checkpoint.**
Jalankan langkah ini berurutan sebelum melapor "selesai". Jangan menyimpan rahasia (kunci API, password, token) di mana pun.

## 1. Log formal (`architecture/logs/`)
- Keputusan/fitur baru → satu baris `| DEC-NNN | tanggal | isi | Owner | berkas |` di `decision_log.md` (nomor lanjut dari baris terakhir).
- Bug/risiko yang belum selesai → `risk_issue_log.md`.
- `bash architecture/scripts/run_all_checks.sh` harus "SEMUA CEK LULUS" (skrip ini juga memperbarui `validation_log.md`).

## 2. Otak kedua (`brain/`)
- Temuan teknis (jebakan, perilaku tak terduga, angka/format penting, cara kerja yang terbukti) → `brain/findings.md` sebagai
  `### FND-NNN · YYYY-MM-DD · judul` + isi ringkas + *Why* + *How to apply*. Tulis begitu ditemukan, jangan menunggu akhir.
- Satu entri sesi di `brain/sessions.md` (apa dikerjakan, DEC terkait, yang tertunda / menunggu owner).
- Status fase / pekerjaan tertunda → `brain/plan.md`.

## 3. Jadikan skill
Bila tugas menghasilkan **prosedur yang bisa diulang** (cara uji, cara render, pola kode, jebakan alat), perbarui skill di
`.claude/skills/`:
- `gnd-pptx-design` — generator PPTX/DOCX (`apps/web/src/lib/officeExport.ts`): token desain, komponen, cara render & cek.
- `gnd-e2e-verify` — Playwright di server `web-e2e` (port 3210), tiruan API, screenshot, flake.
- `gnd-voice-ai` — asisten suara kelapa, Groq (Whisper/planner/TTS), Lab AI OpenRouter + filter.
- Prosedur baru yang tidak cocok di skill mana pun → buat skill baru `gnd-<topik>/SKILL.md` (frontmatter `name` + `description`
  yang menyebut kapan dipakai). Isi = langkah konkret + jebakan, bukan riwayat.

## 4. Commit = checkpoint
- `git add` hanya berkas yang memang diubah tugas ini (jangan ikutkan `apps/web/next-env.d.ts` buatan dev server, `.env*`,
  atau perubahan agent lain yang belum jelas). Pesan commit bahasa Indonesia + `(DEC-NNN)`, diakhiri baris
  `Co-Authored-By` sesuai pengingat sistem.
- Deploy Vercel (`npx vercel deploy --prod --yes` dari root repo) sudah disetujui owner untuk proyek ini.
- Push GitHub: **jangan force push**. Status 2026-10-21: push tertahan karena commit remote `11825ac` (menghapus 14 berkas) —
  tunggu keputusan owner.

## 5. Lapor ke owner
Ringkas dalam bahasa Indonesia: apa yang berubah, hasil uji (angka lulus/gagal apa adanya), URL deploy, dan hal yang menunggu
keputusan owner.
