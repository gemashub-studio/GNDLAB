# Jurnal Sesi

### 2026-10-08 · Claude Code (Opus 5.5) · Kickoff + Fase M1
- Membaca seluruh `architecture/`; memasang toolchain (izin owner); baseline `run_all_checks.sh` → SEMUA CEK LULUS.
- `git init` + commit arsitektur.
- M1: monorepo pnpm + Turborepo; `@gemas/calc-engine` (range, units, grid, container, warehouse, moisture, nesting, convert, warnings, trace) + `@gemas/dataset` (sync JSON, Zod, loader SI paritas seed).
- Hasil: 99/99 test (17/17 golden), typecheck bersih. Temuan FND-001..010.
- Benchmark produk & teknik → `benchmark.md`.
- Lanjutan: owner tidak tahu password Postgres → skrip reset (UAC) dijalankan owner; bug psql Windows di run_all_checks.sh diperbaiki (ISS-018). Uji DB penuh LULUS.
- **Tertunda:** parameter R&D (`parameter_template.csv`), konfirmasi tahap BL/CK, review hasil M1 sebelum M2.

### 2026-10-08 · Claude Code (Opus 5.5) · Fase M2 — DIJEDA (sesi limit), BELUM di-commit
**Selesai & terverifikasi:**
- Referensi owner (Jurnal.id, GreaterWMS, Part-DB) dianalisis → `brain/benchmark.md` §2b.
- `apps/web` Next 15.5 + React 19 + Tailwind 3.4 (preset `architecture/06-design` apa adanya, font via next/font).
- Halaman: Beranda (kapasitas dari engine), Muat Container (mode Panduan/wizard 4 langkah + mode Lengkap), Gudang, Konversi (+ inch keliling & koreksi kadar air), Data & Sumber, Panduan (alur kerja, kamus, FAQ, putar tur), Skenario, `/s/[slug]`, Masuk, R&D Lab (placeholder M5).
- UX: tur pertama kali (localStorage), hint "?" di semua istilah (`lib/glossary.ts`), peringatan + saran tindakan.
- Paket dataset: `scenario.ts` (perakit container/custom/gudang/konverter, `availableModes`, `defaultStackHeightM`) — 40/40 test lulus.
- DB: `scripts/windows/setup-dev-db.ps1` (role `gemas_app`, DB `gemas_dev`, `apps/web/.env` gitignored), migrasi `0001_schema` = salinan persis schema.sql, `0002_auth` (auth_verification_token), seed + publish, `prisma db pull` → 21 model. schema_integrity_test 18/18 pada DB hasil migrasi.
- API `/api/v1`: calculate/container, calculate/warehouse, convert, datasets/active, commodities, containers, scenarios (POST/GET), scenarios/[id] (GET/DELETE), measurements & proposals = 501 (M4). Smoke test: 200/422/401/404 sesuai ARD §9.
- Auth next-auth 4 Email (magic link; dev: tautan dicetak di log server), adapter di atas app_user. Login uji `penguji@gemas.test` berhasil.
- tsc web bersih.

**Belum (lanjutkan dari sini):**
1. Uji klik "Simpan" setelah login → cek baris scenario/scenario_override/calc_result + halaman `/s/[slug]` (sedang dikerjakan saat jeda).
2. Test: vitest web (scenario codec, report/CSV, test byte-equal migrasi 0001 vs schema.sql) + Playwright E2E US-01..07, US-09..11 (pakai `channel: 'msedge'` agar tidak unduh browser).
3. PWA: verifikasi `next build` + Serwist sw.js + offline.
4. Review menyeluruh (code-review), cek aksesibilitas 360 px.
5. Logs: traceability (FR-10, UI), decision_log DEC-020 (next/font), DEC-021 (dark mode ditunda — design_spec menggantikan ux_spec §5, tidak ada token gelap → tanya owner), DEC-022 (CSV `;` + BOM), DEC-023 (auth JWT + tabel token), findings FND-013 (angka mockup ≠ engine), FND-014 (storage.* hanya typ), FND-015 (.ps1 harus ASCII di PS 5.1).
6. run_all_checks.sh + commit "Fase M2 selesai".
**Owner bilang:** akan ada beberapa perubahan & penyesuaian di sesi berikutnya — tanyakan dulu sebelum melanjutkan daftar di atas.

### 2026-10-09 · Claude Code (Opus 5.5) · Fase M2 SELESAI
- Uji simpan → DB terbukti lewat test integrasi (scenarios.db.test.ts): override, calc_result, idempoten, IDOR, balapan sinkron.
- E2E Playwright (Edge) 13/13: US-01..07, US-09..11, wizard, API, HP 360 px. Ditambah UI US-05 (tumpukan bersarang) & tag CUSTOM (US-09).
- Bug ditemukan & diperbaiki: parseNum "0.575", SW revisi tetap + Vary, + 10 temuan code review (ISS-022).
- ADR-006, DEC-020..025, ISS-019..025, FND-013..019.
- Terbuka: ISS-025 navigasi offline di emulasi; dark mode menunggu owner (DEC-021).
- **Owner minta pekerjaan baru (otonom):** bahasa lebih santai; simulasi kelapa (lingkaran) + container dalam ft; alur proses: loading masuk → kupas serabut → belah → rak jemur (matahari / greenhouse / oven) → cungkil → batok → arang + kalkulator produk jadi; kelapa dipisah per asal (dataran tinggi / rendah). Rencana: lihat plan.md bagian "Fase P".

### 2026-10-09 · Claude Code (Opus 5.5) · Fase P SELESAI (otonom, atas permintaan owner)
- Riset 18 sumber → dataset proses v1.0.0 (ADR-007): asal dataran rendah/tinggi, komposisi buah, kadar air daging, jemur matahari/greenhouse/oven, drum arang.
- Engine `process.ts` + loader proses (rujuk dataset inventory, cek kompatibilitas versi).
- UI `/proses` 6 tahap + rak jemur + banding 3 metode + arang + produk jadi (karung & container).
- Simulasi kelapa lingkaran + ukuran container ft/in (juga di Muat Container, Beranda, CSV/PDF).
- Bahasa UI santai (DEC-027). Test: engine 82, dataset 51, web 21, E2E 18 (+1 fixme ISS-025).
- Terbuka: ISS-025 (offline nav emulasi), ISS-026 (data dataran tinggi), ISS-027 (rendemen arang), ISS-028 (simpan skenario proses), dark mode (DEC-021).
- Berikutnya (menunggu owner): M3 simulator 3D, M4 sampling & kalibrasi, M5 R&D Lab.

### 2026-10-09 · Fase M3 (berjalan)
- S1 ✅ engine layout (commit ef551ae). S2–S3 ✅ Plan2D.tsx, Sim3D.tsx (three + R3F, InstancedMesh). S4 dikodekan: /simulator + tombol "Buka simulator" + menu — BELUM diverifikasi visual/E2E.
- Lanjutan: verifikasi /simulator (2D/3D, gudang, arang bersarang), E2E S5 (angka simulator == kartu hasil golden kemasan, fps 1.200 karung), lalu S6 logs.

### 2026-10-09 · Fase M3 SELESAI
- Simulator /simulator: denah 2D SVG (atas/samping, curah, gudang + lorong, kolom arang), 3D three.js InstancedMesh + slider isi % + putar stuffing; tombol dari kalkulator & gudang.
- Angka simulator == kartu hasil (5 golden kemasan, E2E). 1.892 karung ±48 fps headless (≥30 fps ✅).
- Test: engine 93, dataset 51, web 21, E2E 28 (+1 fixme ISS-025). run_all_checks LULUS.
- Berikutnya: M4 (sampling & kalibrasi) → M5 (R&D Lab). Tanyakan owner bila ada prioritas lain.

### 2026-10-09 · Fase M4 SELESAI
- Sampling lapangan `/sampling` (form, impor CSV semua-atau-tidak, prioritas ASM-06/01/02, statistik), usulan otomatis n ≥ 10 (P5/median/P95), review `/kalibrasi` (setujui/tolak hanya data_admin) → versi dataset patch baru di DB, versi lama utuh (ADR-008, DEC-032..034).
- Realisasi muat: selisih vs prediksi (target ≤ 10%) + densitas tersirat → sampel.
- Test: engine 100 (golden 17/17), dataset 57, web 32 (+11 kalibrasi DB, jalan hanya di DB test segar), E2E utama 28 (+1 fixme ISS-025), E2E kalibrasi 2 (`playwright.calib.config.ts`, port 3100, DB `gemas_test`). run_all_checks + uji DB LULUS.
- Catatan: Prisma menolak `migrate reset` dari agen (FND-020/ISS-031) → owner mereset DB test via `scripts/windows/reset-test-db.ps1` bila ingin mengulang 11 uji kalibrasi DB. E2E kalibrasi bisa diulang tanpa reset.
- DB test `gemas_test` kini punya versi 1.0.5+ hasil uji (wajar). DB dev TIDAK tersentuh (tetap v1.0.4).
- Berikutnya: M5 R&D Lab (parameter owner via `07-rnd/parameter_template.csv` masih menunggu → mulai dengan empty-state).

### 2026-10-10 · Fase F dimulai (otonom)
- Owner minta kalkulator formula R&D (kopra, arang, briket shisha/BBQ/custom, cuka, bioleather), produksi per shift, ceklis R&D/QC/produk; pelajari folder KORA (Downloads/kora (C:/Users/user/Downloads/kora)).
- F0 selesai: 54 dokumen unik dibaca; temuan di `architecture/00-research/kora_research.md` (E1 gula −16,7%, E2 titrasi 10×, K-01 pendinginan arang, K-02 oven kopra, K-03 batas dataran). Riset web: FAO perekat pati 4–8%, oven ±80°C; SNI 01-6235 teks resmi tak terakses.
- Lanjut: F1 dataset formula (lihat plan.md Fase F).
- (lanjutan 2026-10-10) F1–F5 selesai & di-commit: dataset formula v1.0.0 (+ proses v1.1.0), engine formula + shift (angkatan hanya dimulai di jam kerja — model 24/siklus salah ±85%), /formula (7 produk, wizard), /produksi (stasiun pembatas), /ceklis (19 ceklis, IndexedDB `gemas-ceklis`, CSV, cetak). Temuan tambahan: E8 cadangan Ronde 1, K-09 berat butir 0,65 vs ±1,0 kg.
- Sisa: F6 draf parameter M5 (07-rnd/parameter_kora_draft.csv), F7 E2E + logs + run_all_checks + commit "Fase F selesai".

### 2026-10-10 · Fase F SELESAI
- /formula (7 produk), /produksi, /ceklis, dataset formula v1.0.0 + proses v1.1.0, ADR-009, DEC-035..040, ISS-034..041, FND-021..026, draf 111 parameter R&D.
- Test: engine 132 (golden 17/17), dataset 66, web unit +11, E2E 41 lulus + 1 skip (US-10 flaky saat compile dev, lulus 3/3 ulang). run_all_checks + uji DB LULUS.
- Menunggu owner: kelas lot 100–600 mdpl; revisi rumus gula & titrasi di SOP/tracker KORA; data briket (perekat aktual, tebal pillow, kapasitas press/oven); konfirmasi draf parameter R&D → lanjut M5.

### 2026-10-10 · JEDA (owner: lanjut setelah limit direfresh)
- Status: Fase F selesai & di-commit (6a2a6c7). Working tree bersih.
- MULAI DARI SINI sesi berikut: (1) tanyakan jawaban owner atas pertanyaan terbuka di entri "Fase F SELESAI" (kelas lot 100–600 mdpl, data briket, berat butir, revisi SOP gula/titrasi, konfirmasi draf parameter); (2) bila draf parameter disetujui → mulai M5 R&D Lab (CLAUDE_CODE_PROMPT.md §5, PRD_RnD.md, 07-rnd/parameter_kora_draft.csv); bila belum → M5 dengan empty-state + impor CSV.
- Cara jalankan test di Windows: lihat brain/environment.md (PowerShell + node langsung; jangan pakai backtick di Bash).

### 2026-10-10 · Fase G dimulai (owner: rantai produksi lengkap)
- G0 selesai: chain_research.md, dataset rantai v1.0.0 (kendaraan 10 truk + 45HC, kelas DR ≤500/DT >500 mdpl, sortir, air kelapa <10 °C ≤2 jam, desain greenhouse KORA, kolam/drum, kemasan, bentuk briket, aditif bioleather), ADR-010, DEC-041, ISS-037 ditutup, FND-027..029.
- Engine chain.ts selesai (150/150 uji engine). Berikutnya: UI /rantai, lalu E2E + logs + run_all_checks.

### 2026-10-10 · Fase G SELESAI
- /rantai (8 tahap: angkut, terima & lot, belah & sortir, pengeringan, congkel & kemas, arang, briket, cuka & bioleather). Register lot offline di IndexedDB `gemas-lot` (CSV).
- Engine chain.ts (18 uji), dataset rantai v1.0.0 (5 uji), lotStore 1 uji, E2E rantai 11/11. run_all_checks + uji DB LULUS. Commit a3cbe08, 35448e2, cea5319.
- GAP yang perlu data owner: dimensi kolam & lama bakar kolam KORA; kapasitas ayakan rotari & hammer mill aktual; hasil lab proksimat batok DT vs DR (n≥3/kelas) untuk rasio briket; dosis cocopeat/cocofiber bioleather (uji bertingkat); ukuran tray aktual greenhouse; payload legal (KIR) truk vendor.
- Masih menunggu owner dari Fase F: revisi SOP gula/titrasi, data briket, konfirmasi draf parameter R&D → M5.

### 2026-10-11 · R&D cuka & bioleather multi-metode SELESAI
- Owner: "simpan dulu" (sudah tersimpan) + kalkulator R&D cuka & bioleather beberapa metode + ceklis.
- Dataset formula v1.1.0 (F24–F29), engine formula-methods.ts (9 uji), panel metode di /formula?p=cuka & ?p=bioleather, 4 ceklis R&D baru + deep link /ceklis?id=, draf parameter M5 118.
- Test: engine 159, dataset 72, E2E formula+rantai 28/28, run_all_checks + DB LULUS.
- GAP: dosis tanin & secang, takaran oles finishing, hasil mother cuka, basis FeSO₄ 1%.

### 2026-10-11 · Ilustrasi langkah infografis
- Owner: tiap langkah pakai ilustrasi gambar sederhana seperti infografis; visual elegan, unik, fun.
- StepFlow + Picto (35 piktogram SVG dua warna, token saja) dipasang di SopList (semua tab /rantai), langkah metode cuka, fase bakar arang, panel bioleather, wizard Formula. lib/picto.ts = tebakan ikon (diuji). DEC-043.
- Test: web unit +2, E2E formula+rantai 29/29.

### 2026-10-11 · GEMA RnD langkah 1 (/lab)
- Owner membawa brief + spesifikasi dari ChatGPT: `architecture/07-rnd/GEMA_RnD_brief.md`, `architecture/07-rnd/asal-chatgpt/arsitektur-GEMA-RnD.md` (FND-032, DEC-044). Owner masih belajar → bahasa sederhana, satu langkah kecil per giliran.
- /lab: dashboard 5 jalur + form eksperimen baru (judul, tanggal, pertanyaan, tujuan, versi metode, kondisi, status) + daftar per jalur + cadangan JSON. Uji unit labStore 3/3, tsc bersih, dicoba di browser (simpan → muat ulang tetap ada; data contoh dihapus lagi).
- Berikutnya (satu per giliran): pengamatan → bahan/batch → hasil+kesimpulan+langkah berikutnya (edit eksperimen) → lampiran → cari/saring → library sumber → pulihkan cadangan → E2E.

### 2026-10-11 · GEMA RnD langkah 2 + tema Lab Futuristik
- Owner kirim 01-temuan-awal & 02-prompt-otonom (ChatGPT) → disimpan di `architecture/07-rnd/asal-chatgpt/`. Riset dicek ulang ke BSN/ISO/Codex/NIST → `07-rnd/research/`, `07-rnd/library/sumber/sources.md` (14 sumber, FND-033, ISS-042).
- Owner: "tema lab, futuristic, elegan" + "jangan pakai punk skate lagi" → ADR-011, tokens v2.0.0, seluruh aplikasi berganti (nama token tetap). CLAUDE.md (root & architecture) diperbarui.
- /lab 4 tab (DEC-045): eksperimen bisa dilengkapi dengan riwayat versi, cari/saring, langkah berikutnya, library, standar per jalur.
- Test: tsc bersih; web unit 53 (lab 7); E2E 47 lulus (lab 2 baru; US-10 & formula ceklis flaky → lulus 2×2 saat diulang, ISS-041).
- Berikutnya (satu per giliran): pengamatan terukur (pakai rnd_param_def/draf parameter) → bahan/batch → lampiran foto → pulihkan cadangan. Pertanyaan owner: maksud "kopra edibel" & pasar; produk akhir bioleather; arang untuk apa; baca naskah SNI via Akses SNI.

### 2026-10-11 · GEMA RnD langkah 3: catatan harian, media, protokol, PDF, cadangan
- Owner kirim versi baru 00/02/arsitektur (tambahan: offline, laporan harian, foto/video, PDF tabel+grafik, resep buatan sendiri, HP). ADR-012, DEC-047, `07-rnd/sinkronisasi-opsi.md` (belum tersinkron; A manual sekarang, B server lokal stack yang ada, C cloud).
- IndexedDB `gemas-lab` v2: entries (append-only), media (Blob + thumb), protocols (berversi). PDF @react-pdf (grafik hanya ≥2 titik angka). Cadangan JSON v2 + pulihkan tambah-saja. fflate TIDAK dipakai (butuh izin dependensi).
- Data owner di browser pane: eksperimen "greenhouse 1" (KE-2610-001) — JANGAN dihapus/ubah; upgrade v2 mempertahankannya.
- Test: tsc bersih; unit 59 (lab 13); E2E lab 3 + HP 5, formula+rantai lulus; video webm nyata → thumbnail & PDF diverifikasi visual.
- Berikutnya: hasil ukur memilih variabel dari draf `rnd_param_def`/parameter owner; daftar calon variabel per produk dari literatur (berlabel "temuan literatur", bukan resep); bandingkan eksperimen.

### 2026-10-11 · Audit kalkulator (kopra pengeringan/sulfur, cuka, bioleather) + standar 5 jalur
- Owner minta audit: greenhouse/oven dengan ukuran sendiri + muatan aktual; sulfur tanpa dosis otomatis kecuali ada sumber resmi/primer; audit cuka & bioleather; riset standar 5 jalur.
- Hasil: ADR-013, DEC-048/049/050, ISS-043/044, FND-034/035. Dataset formula v1.2.0, rantai v1.1.0. Engine: sulfurDose dihapus, dryingLoadPlan baru. UI: SulfurPanel (log manual `gemas-perlakuan`), Assumptions + ActualLoad, label jenis angka, SaveProtocol → Lab. Library 29 sumber berkategori; `sources.md` dibangkitkan `scripts/gen_gema_sources.py`.
- Test: engine 160, dataset 74, web unit 65, E2E penuh 67 lulus + 1 skip. Ditemukan & diperbaiki regresi dari commit tema 7bf9a82: uji simulator gudang masih mencari warna lama #C6F135.
- Menunggu owner: basis gliserol (v/v atau b/v); pasar tujuan kopra edibel; baca naskah SNI via Akses SNI; lampiran BPOM 11/2019 untuk batas sulfit.

### 2026-10-11 · GEMA RnD Lab mode peneliti (DEC-051)
- Owner: fokus R&D Lab, isian semudah mungkin, PDF awal–akhir, otonom. Limit dicek: 5 jam 5%, mingguan 21%.
- Selesai L1–L7 (brain/plan.md): wizard desain, lembar data, ringkasan deskriptif, PDF laporan lengkap; draf parameter → JSON aplikasi.
- Test: web unit 67 (labDesign 6), E2E lab+formula 28/28, run_all_checks LULUS. PDF diperiksa visual (simbol ≥ − diganti teks karena font PDF).
- Berikutnya: ubah/tambah desain pada eksperimen lama (greenhouse 1 milik owner belum punya desain); bandingkan 2 eksperimen; impor parameter terkonfirmasi owner ke rnd_param_def.
- (lanjutan) Tambah desain untuk eksperimen lama (lewat riwayat versi) — greenhouse 1 milik owner kini bisa diberi desain. Kunci ganda sumber (F01) di komponen Sources diperbaiki. E2E formula+rantai+lab 41/41.

### 2026-10-11 · Riset Produk (DEC-052)
- Owner: ganti Protokol → Riset Produk; foto/video bahan, alat (seperti bahan), langkah; laporan harian sampai selesai; laporan docx/ppt/pdf.
- officeExport.ts (zip store + OOXML) — DOCX & PPTX divalidasi dibuka Word & PowerPoint via COM (baca saja): 4 tabel/3 gambar; 13 slide/3 gambar.
- Test: web unit 72, E2E lab 11/11, run_all_checks LULUS.
- (lanjutan) DEC-053: tanggal mulai/selesai otomatis, asisten, Urutan hari (Hari ke-N), rencana harian otomatis. Unit 74, E2E lab 11/11, Word/PPT tervalidasi.
- (lanjutan) DEC-054 draf resep (Simpan/Selesai/On going proses) + DEC-055 kamera (MediaPicker; webcam di halaman butuh https/localhost — di HP via http LAN pakai kamera bawaan lewat tombol Foto/Video). E2E lab 13/13 (kamera palsu), unit 73.
- (lanjutan) DEC-056: tanpa filter jalur, On going Lanjutkan/Hapus draf, Hasil riset unduh per versi. Unit 74, E2E lab 14/14.

### 2026-10-11 · JEDA (owner: simpan temuan, lanjut setelah token aman)
- Status: semua fitur Riset Produk ter-commit (draf/Selesai/On going=draf saja, Hasil riset unduh per versi PDF/Word/PPT, kamera laptop & HP, Hari ke-N, tanggal selesai otomatis, asisten). E2E lab 14/14, run_all_checks LULUS.
- MULAI DARI SINI: brain/plan.md → "BACKLOG — lanjut setelah limit aman" butir 1 (hapus hasil riset).
- Cara uji di Windows: brain/environment.md (PowerShell + node langsung). Office COM (Word/PowerPoint) tersedia untuk validasi DOCX/PPTX (buka baca-saja).
- Data owner di browser pane: eksperimen "greenhouse 1" (KE-2610-001) — jangan dihapus.
- (jeda 2) Owner minta laporan berdesain bagus + grafik setelah limit aman; rencana lengkap di brain/plan.md "RENCANA — Laporan berdesain bagus + grafik" (prioritas sebelum hapus hasil riset). Konteks sesi 93% saat dicatat → mulai sesi baru.

## 2026-10-11 malam · Claude (Opus 5.5) — laporan bergrafik + laporan belanja
- DEC-058: laporan riset produk berdesain (sampul, KPI, bagian bernomor, tabel zebra, galeri) + grafik dari `reportCharts.ts` (satu geometri → PDF Svg & PNG untuk Word/PPT). Divalidasi: unit, E2E lab desktop 9/9, visual PDF (Edge), Word→PDF & PPT→PNG via COM.
- DEC-059: tab Laporan Belanja (LPJ) mengikuti Google Doc owner (dibaca via /mobilebasic). Ekspor Word divalidasi visual di Word.
- Trik validasi visual tanpa poppler: Word COM SaveAs2 PDF, PowerPoint COM Slide.Export PNG, lalu Edge (Playwright headed, channel msedge) screenshot PDF.
- Lanjut: backlog butir 1 (hapus hasil riset), PDF eksperimen gaya baru, LPJ ke PDF + ikut file cadangan.
- Lanjutan: DEC-060 — LPJ jadi bukti alokasi saja (permintaan owner); backlog butir 1 (hapus hasil riset) SELESAI. E2E lab 17/17. Catatan: server dev preview pernah basi (aset 404) → preview_stop + preview_start web memperbaiki.
- DEC-061: laporan belanja ikut cadangan lab (uji unit + E2E cadangan lulus). Berikutnya: PDF eksperimen gaya baru (pakai SpecChart/reportCharts), lalu bandingkan dua eksperimen.
- DEC-062: PDF kompilasi eksperimen gaya baru (dicek visual). Berikutnya: bandingkan dua eksperimen; ekspor PDF laporan belanja (opsional).

## 2026-10-13 · Claude — jalur produk manual
- DEC-063: Jalur produk Riset Produk diisi bebas (datalist preset); kode otomatis; E2E lab desktop 12/12, unit lulus.
- DEC-064: penghitungan bahan baku kelapa di resep (form, draf, versi, laporan); dicek visual PDF. Satuan tebal mm = asumsi, tanyakan owner bila perlu.
- ONLINE 2026-10-13: https://gemasstudio.vercel.app (Vercel project gemasstudio, root apps/web, build `pnpm run vercel-build`). Catatan: konektor Vercel MCP = akun lain (403) → pakai CLI (`vercel api`). Sisa owner: buat Google Client ID (online-gdrive.md).
- DEC-067 navigasi ☰; DEC-068 menu Bahan Baku (knowledge = riset pengguna sendiri, maks 5/jalur — tafsiran "Cuka 1-5" dsb.; konfirmasi ke owner bila maksudnya lain). Tombol + Bahan kelapa dihapus.
- DEC-069: Bahan Baku direvisi owner — perlakuan air (Cuka/Bioleather 1–10) & daging (Kopra 1–10) terpisah, tebal mm, varian = jalur produk Resep baru. E2E lab 20/20.
- DEC-070: link HP R&D Lab https://gemas-rnd.vercel.app (domain proyek, bukan alias — alias kena Vercel Authentication). Manifest /lab-manifest.webmanifest.

## 2026-10-14 · Claude — Bahan Baku UI
- DEC-071: dropdown kustom (Dropdown.tsx), modal tanpa kunci gulir (portal absolute di posisi scroll), item baru + kolom wajib, tooltip perlakuan, alert spinner, catatan bahan baku (gemas-bahan), statistik hero nyata. Catatan teknis: heredoc Git Bash panjang sering gagal → tulis skrip .py ke scratchpad.
- DEC-072: laporan harian per hari PDF/Word/PPT + tombol Lanjut ke Hari ke-N; waktu ukur ikut tanggal catatan. E2E lab 20/20.

## 2026-10-15 · Claude — laporan dengan video
- DEC-073: HTML+video, video tertanam di PPTX (GUID p14:media yang benar: {DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}; dicek PowerPoint COM MediaFormat.Length), rekam MP4. Fragmented MP4 dari MediaRecorder tetap terbaca PowerPoint.
- DEC-074..076: Pencatatan Data (awal/akhir/hasil), foto per nomor, loader & alert gaya owner, pilih & hapus. E2E lab 20/20, unit 106. Catatan: tombol Lihat pakai window.location.assign (router.push bentrok dengan replaceState LabPage).
- DEC-079: perlakuan pencatatan, GnD Lab (gsap StrokeText — dependensi baru gsap 3.15.0), loading 4s, alert dari kanan, urutan kartu, hapus. Catatan: testid lab-title sudah dipakai wizard → judul pakai lab-heading; cache .next korup (EUNKNOWN) → hapus .next & restart preview.
- DEC-080: judul GnD Lab StrokeText trigger=loop.
- DEC-081: perlakuan pindah ke form data akhir, multi-kolom (+/x), Treatments = entry[] (kompatibel format lama).
- DEC-082/083: LightTunnel di hero, Simpan dulu (akhirSavedAt), dialog konfirmasi di halaman (window.confirm diblokir di webview → hapus gagal), revisi data akhir, rumus berat awal − air − akhir.
- DEC-084: Supabase init+link (gopdardjgllizvjpkfwm), env PROJECT_URL/ANON_KEY_SUPABASE -> NEXT_PUBLIC_* via next.config, status koneksi di Ringkasan. Belum ada tabel/sinkron. Catatan: PowerShell owner blokir npx.ps1 -> pakai npx.cmd.
- DEC-085: sinkron Supabase GnD Lab (lab_docs + lab-blobs + lab_members, login email link). db push via login role tanpa kata sandi DB (npx supabase db push). `supabase db query` menggantung di Git Bash — pakai `db advisors`/`migration list`. Anggota baru: insert into lab_members.
- DEC-086: kamera melayang + progres harian (3 tahap) + PPTX padat; remote GitHub GNDLAB (publik). Catatan: owner sering memakai browser pane sendiri — jangan klik/isi data di pane saat dia aktif; .next sering korup (UNKNOWN -4094) → stop, rm -rf .next, start.
- DEC-087: login wajib (Supabase) untuk lab, profil header, neon menu, Tanya Lab AI (siputzx glm47flash; saat dicek 503 All nodes failed), PPTX grafik garis native + perlakuan di bawah data akhir + slide penjelasan perlakuan; dev pakai --turbopack.
- DEC-088/089: foto potret 3:4; perlakuan + foto & keterangan. Push GitHub sekarang jalan dari agen (kredensial GCM owner tersimpan).
