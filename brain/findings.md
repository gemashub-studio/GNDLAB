# Temuan Teknis (FND)

Format: ID · tanggal · temuan · **Why** · **How to apply**. Terbaru di bawah.

### FND-001 · 2026-10-08 · Validator memakai volume container nominal, bukan L·W·H
`validate_dataset.py::container_fill` memakai `volume_m3` (20GP = 33,2), sedangkan calc_spec §1 mendefinisikan `V_c = L·W·H` (= 33,196). Selisih ≤ 0,07%.
- **Why:** golden cases dibangkitkan dari volume nominal; supaya engine identik (bukan sekadar dalam toleransi), engine menerima `container.volumeM3` opsional.
- **How to apply:** container dari dataset → isi `volumeM3`; container custom → biarkan kosong (engine pakai L·W·H). Lihat DEC-017.

### FND-002 · 2026-10-08 · Golden jambul pakai `round`, spesifikasi pakai `floor`
`expect_pcs = round(kg/m)` = 22.230; engine (`floor`, calc_spec §3.2) = 22.229. Selisih 1 butir (0,004%) — dalam toleransi ±0,5%.
- **Why:** jangan "memperbaiki" engine ke `round`; spesifikasi benar (tidak boleh menjanjikan butir yang tidak muat).
- **How to apply:** UI menampilkan hasil engine (floor). Bila owner bertanya selisih 1 butir vs dokumen, ini penjelasannya.

### FND-003 · 2026-10-08 · `floor` dalam meter rentan floating-point
Data dalam cm; setelah /100, pembagian pas (mis. 2,352/0,336 = 7) bisa jadi 6,9999999.
- **Why:** grid-fit & nested count memakai floor → salah 1 lapis = ratusan karung.
- **How to apply:** selalu pakai `floorDiv()` dari `@gemas/calc-engine` (epsilon 1e-9), jangan `Math.floor(a/b)` langsung. Ada unit test-nya.

### FND-004 · 2026-10-08 · Loader TS harus paritas 1:1 dengan seed_from_dataset.py
Key parameter di aplikasi (override, kalibrasi M4) harus sama persis dengan `parameter.key` di DB. Loader `packages/dataset` adalah port `unit_for`, `norm_key`, `ranges`, `FORMS` dari seed.
- **Why:** bila beda, override/kalibrasi akan merujuk parameter yang tidak ada di DB.
- **How to apply:** test `loader ↔ seed.sql` membandingkan 102 tuple (key, unit, min, typ, max, keyakinan). Jika seed script berubah, port perubahannya ke `loader.ts` dan test akan memberi tahu.

### FND-005 · 2026-10-08 · Parameter tanpa label keyakinan dianggap C
Berat bersih karung (`bag_net_kg`) & utilisasi volume default (0,8/0,9) tidak berlabel → C (aturan seed: "tanpa label → estimasi").
- **Why:** konsisten & konservatif; konsekuensinya mode PACKAGE dan arang lump selalu memunculkan `LOW_CONFIDENCE_PARAM`.
- **How to apply:** bila owner memverifikasi berat karung/utilisasi, tambahkan `confidence` di dataset (versi baru) — jangan ubah di kode.

### FND-006 · 2026-10-08 · Peringatan keselamatan dievaluasi di kasus terburuk
`SELF_HEATING_RISK` memakai `moisture.max > 10%`, `FLOOR_OVERLOAD` memakai `q_floor.max`. Peringatan lain memakai `typ`. (DEC-016)

### FND-007 · 2026-10-08 · Arah dependensi paket: dataset → calc-engine
`@gemas/dataset` bergantung pada `@gemas/calc-engine` (branded types, `overrideParam`). Engine tetap **zero dependency**; golden test engine membaca JSON langsung via `fs` (bukan lewat paket dataset) untuk menghindari siklus.

### FND-008 · 2026-10-08 · Skrip Python menulis CRLF di Windows
`run_all_checks.sh` membangkitkan ulang `seed.sql`, `data_dictionary.md`, `validation_log.md`, `golden_cases.json` dengan CRLF. `.gitattributes` (`eol=lf`) menormalkan saat commit → diff bersih.
- **How to apply:** abaikan peringatan "CRLF will be replaced by LF"; jangan commit file hasil bangkitan dengan perubahan isi kecuali dataset berubah. `validation_log.md` selalu berubah (timestamp) — wajar.

### FND-009 · 2026-10-08 · Bentuk `trace` mengikuti ARD §6
calc_spec §8 menulis `trace: Record<param, …>`; ARD §6 memakai `{datasetVersion, params}`. Dipilih bentuk ARD + `engineVersion` (untuk kolom `calc_result.engine_version`). DEC-015.

### FND-010 · 2026-10-08 · PostgreSQL lokal butuh password superuser
Installer winget PostgreSQL 16 (unattended) menyetel password yang tidak diketahui owner. Agent **tidak boleh menebak**. Solusi: owner menjalankan `scripts/windows/reset-postgres-password.ps1` (minta UAC, trust sementara → password acak → pg_hba dikembalikan di `finally` → simpan ke `%APPDATA%\postgresql\pgpass.conf`). Sudah dijalankan 2026-10-08; koneksi `postgresql://postgres@localhost:5432/postgres` kini tanpa password di URL.

### FND-011 · 2026-10-08 · psql Windows tidak mempermutasi argumen
`psql "$URL" -c "…"` di Windows mengabaikan `-c` (opsi setelah argumen posisi). Selalu tulis `psql -d "$URL" -c …`. Berlaku juga untuk skrip M2 (migrasi, seed). ISS-018.

### FND-012 · 2026-10-08 · Menjalankan bash dari PowerShell 5.1
`bash.exe -c '…'` dengan path berspasi bisa menelan output. Pola andal: tulis skrip `.sh` (scratchpad) lalu `& "C:\Program Files\Git\bin\bash.exe" path\skrip.sh`. PATH bash harus memuat `/c/Users/user/AppData/Local/Programs/Python/Python312` (alias Microsoft Store `python` menghalangi) dan `/c/Program Files/PostgreSQL/16/bin`.

### FND-013 · 2026-10-09 · Angka di mockup bukan sumber data
`Main.dc.html` memuat angka stok contoh dan beberapa kapasitas yang tidak cocok dengan engine (jambul 40HC "46.090", arang belah 2 "2,8 t"). **How to apply:** mockup = acuan tata letak & gaya saja; angka selalu dari engine (ISS-019).

### FND-014 · 2026-10-09 · `storage.*` dataset hanya punya `typ`
`max_stack_height_m`, `max_pile_height_m`, `max_stack_height_bags` tidak berbentuk rentang → tidak masuk `params`. Dibaca dari blok `storage` lewat `defaultStackHeightM()` di `packages/dataset/src/scenario.ts`.

### FND-015 · 2026-10-09 · Skrip `.ps1` harus ASCII murni
PowerShell 5.1 membaca `.ps1` tanpa BOM sebagai ANSI; "—" (UTF-8) berubah jadi karakter kutip → parse error (ISS-024).

### FND-016 · 2026-10-09 · Service worker & Next.js App Router
- Respons halaman Next membawa `Vary: RSC, Next-Router-State-Tree, …` → `cache.match` gagal kecuali `ignoreVary: true`.
- Jangan precache halaman dengan revisi tetap (`'1'`) → HTML basi setelah deploy. Pakai NetworkFirst untuk halaman; aset `_next/static` sudah berversi dari manifest.
- Hanya cache halaman publik (DEC-024). Panel browser bawaan Claude tidak mendaftarkan SW → uji PWA lewat Playwright (`e2e/pwa.spec.ts`, butuh `PWA_URL` ke `next start`).
- Halaman yang disajikan dari cache tidak melihat `?s=` di server → `useUrlState` memulihkan state di client.

### FND-017 · 2026-10-09 · Menjalankan Playwright di mesin ini
- Pakai `channel: 'msedge'` (Edge terpasang) → tanpa unduh browser.
- `pnpm exec playwright` di Git Bash bisa menggantung tanpa output; jalankan dari PowerShell: `node node_modules/@playwright/test/cli.js test`.
- Saat menguji build produksi, set `PWA_URL` agar config tidak menyalakan dev server (bentrok folder `.next`). Hentikan dev server sebelum `next build`.

### FND-018 · 2026-10-09 · Komponen client vs server di App Router
Fungsi biasa yang diekspor dari file `'use client'` tidak bisa dipanggil dari server component → helper presentasi ditaruh di `apps/web/src/lib/present.ts` (tanpa `'use client'`).

### FND-019 · 2026-10-09 · Offline Next App Router: jalur "Falling back to browser navigation"
Saat offline, klik `<Link>` → fetch `?_rsc=` gagal → Next melakukan navigasi dokumen (MPA) ke tujuan; SW menyajikan HTML dari cache (terbukti 200), tetapi pada emulasi offline Chromium, browser kemudian me-*reload* halaman lama dan membatalkan navigasi (CDP: `STARTNAV reload`, bukan skrip). Belum terselesaikan (ISS-025). Ide berikut: (1) uji di HP nyata; (2) saat `navigator.onLine === false`, render menu sebagai `<a>` biasa; (3) cache payload RSC untuk halaman publik.

### FND-020 · 2026-10-09 · Prisma menolak `migrate reset` dari agen AI
Prisma 6.19 mendeteksi dijalankan oleh Claude Code dan menolak `migrate reset` tanpa persetujuan eksplisit pengguna (env `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). Agen TIDAK boleh mengakalinya. Solusi: global setup vitest (`apps/web/test/db-setup.ts`) hanya `migrate deploy` + seed bila kosong; uji yang butuh DB segar (`calibration.db.test.ts`) melewati diri bila sudah ada sampel; owner mereset sendiri via `scripts/windows/reset-test-db.ps1` (menolak URL selain `gemas_test`).

### FND-021 · 2026-10-10 · Rumus gula must di SOP/tracker KORA kurang ±16,7%
`(Brix target − Brix awal) × L ÷ 100` mengabaikan pengenceran oleh gula sendiri. Neraca massa: `x = M·(B−b)/(100−B)`, M = V·ρ. 100 L 4→15 °Brix: 11,0 kg (SOP) vs ±13,2 kg; dengan rumus SOP Brix akhir 13,35. Engine pakai neraca massa (kora_research.md E1).

### FND-022 · 2026-10-10 · Titrasi asam asetat: rumus ringkas hanya untuk NaOH 0,1 N & sampel 10 mL
Rumus umum di teks SOP B6.2 salah 10×; daftar belanja membeli NaOH 0,5 N & pipet 5 mL → rumus ringkas `0,06005×V` meleset 10×. Benar: `% b/v = V·N·6,005 ÷ Vs`.

### FND-023 · 2026-10-10 · Dataset proses v1.0.0 berbahaya di pendinginan arang (1 jam)
SOP KORA & CDB/FAO: mati hampa ≥8 jam/semalam; IMDG SP 978 weathering ≥14 hari & ≤40°C. Juga oven kopra maks 70°C (bukan 90). Koreksi → dataset proses v1.1.0.

### FND-024 · 2026-10-10 · Dokumen KORA = parameter R&D yang ditunggu M5
SOP Rev 03 sudah membedakan VALID / STANDAR INTERNAL / GAP → peta langsung ke keyakinan A/B/C. Draf parameter_template dibangkitkan dari dataset formula (bukan hardcode), menunggu konfirmasi owner.

### FND-025 · 2026-10-10 · Model kapasitas batch per shift: angkatan hanya dimulai di jam kerja
Model awal (24 ÷ siklus) menganggap oven/tungku diisi ulang kapan saja → oven 13 jam dihitung 1,85 angkatan/hari padahal 1 shift 8 jam hanya 1 (aturan 4 jam & bongkar-muat butuh orang). Akibatnya stasiun pembatas salah (belah, bukan oven). Engine `batchesPerDay()` mensimulasi kondisi tunak 60 hari.

### FND-026 · 2026-10-10 · Komponen di dalam render & angka di UI
Dua jebakan yang tertangkap saat review sendiri: (1) mendefinisikan komponen (`function Inputs()`) di dalam komponen lain → field di-mount ulang tiap ketikan (fokus hilang) — pakai variabel JSX; (2) angka resep yang "kecil" (gula alami 1–2,6%, pematangan 3–4 minggu, target rendemen 25%) sempat tertulis di UI — semua dipindah ke dataset bersumber.

### FND-027 · 2026-10-10 · Ketinggian kebun → mutu batok/briket = GAP literatur
Tidak ada studi terukur ketinggian kebun vs abu/FC/kekuatan/warna abu batok. Studi Jember (Nuraisyah 2021) hanya bobot komponen buah; tabelnya tak bisa diambil. KORA hanya menduga DT lebih padat. Keputusan: kalkulator campuran DT:DR memakai hasil lab per lot; rencana uji proksimat + kuat tekan n ≥ 3 per kelas (chain_research.md CH-04).

### FND-028 · 2026-10-10 · Kode asal KORA lama menyisakan celah 100–600 mdpl
SOP KORA: DR <100 / DT ≥600 mdpl. Owner memutuskan batas tunggal 500 mdpl (DR ≤500 / DT >500), sama dengan studi Jambi P07. ISS-037 ditutup.

### FND-029 · 2026-10-10 · Desain rak greenhouse KORA = satu-satunya sumber angka rak
Rak 0,65 m, 6 tingkat × 0,5 m, lorong ±0,5 m, pusat belahan 18 cm (25–30 belahan/m²), telungkup hari 1–2 lalu miring 15–30°, kipas 2–4 × Ø16–20″ per 105 m³, belerang 1,5–2 g/butir atau 20–30 g/m³. Semua keyakinan C → kalkulator memakai geometri murni + parameter ini, skala ruang lain ditandai turunan.

### FND-030 · 2026-10-11 · Metode cuka: kecepatan vs keluaran
Data sumber: statis (dengan starter cuka hidup) ±28 hari/siklus; semi-kontinu (Othaman 2014) ±4 minggu tapi hanya ⅔–¾ ditarik → per 3 bulan TIDAK lebih banyak dari statis; keunggulannya tanpa starter baru & lebih sedikit kerja. Generator ±32 jam/run setelah 5 run kondisi; aerasi 5–7 hari/siklus (pilot). Keluaran besar generator/aerasi menganggap cairan alkohol selalu siap → kapasitas fermentasi alkohol jadi pembatas baru. Kontrol tanpa gula: gula alami 1–2,6% → asam ±0,7% (gagal 4%).

### FND-031 · 2026-10-11 · Bioleather: basis resep berbeda-beda
Plastisasi A = % larutan (gliserol 1%), B = % berat BC kering (30%), C = rasio gliserin:etanol 1:2 → engine memisahkan basis agar tidak tertukar. Takaran oles lilin/AESO (g/m²), dosis secang & tanin = GAP (diisi uji). Basis "FeSO₄ 1%" pada pewarna kopi ambigu → tidak dihitung otomatis.

### FND-032 · 2026-10-11 · Brief "GEMA RnD" (owner, dari ChatGPT) = M5 R&D Lab + tambahan
Disimpan di `architecture/07-rnd/GEMA_RnD_brief.md`. Selisih dengan PRD_RnD/schema_rnd: (1) jalur produk 5 (KE, CK, BL, **arang, briket**) vs skema 4 (KE, KA, BL, CK) → arang & briket belum ada di `rnd_product`; (2) tambahan field kesimpulan + langkah berikutnya per eksperimen; (3) library sumber dengan label bukti; (4) tegas: data kosong = "belum dicatat", satu langkah kecil per giliran, bahasa sederhana. Spesifikasi `asal-chatgpt/arsitektur-GEMA-RnD.md` menyusul dari owner (sudah diterima).

### FND-033 · 2026-10-11 · SNI bisa dibaca gratis; angka SNI di repo masih sekunder
FAQ Pesta BSN: SNI gratis dibaca di akses-sni.bsn.go.id; Pesta hanya menampilkan SNI berstatus berlaku. Katalog dicek: SNI 01-3946-1995 Kopra, 01-4371-1996 Cuka fermentasi, 01-3711-1995 Cuka makan, 1683:2021 Arang kayu = Berlaku. SNI 01-1682-1996 & 01-6235-2000 tidak bisa dikonfirmasi ulang (timeout). Angka SNI di 00-research berasal dari sumber sekunder → ISS-042. ISO 3377-2 kini edisi 2025; Codex CXC 1-1969 revisi 2022.

### FND-034 · 2026-10-11 · Dosis sulfur kopra edibel: tidak ada sumber resmi/primer
Penelusuran: E3S 2024 (Apriyanto dkk.) satu studi deskriptif tanpa jumlah kelapa & residu; BAFS TB-09 tanpa dosis; SOP KORA internal. UE: SO₂ ≤50 mg/kg kelapa kering (produk akhir). → DEC-048: tanpa dosis otomatis, log manual.

### FND-035 · 2026-10-11 · 60 parameter formula berkeyakinan terlalu tinggi
Parameter A/B yang hanya bersumber SOP KORA (F01–F06), atau jurnal yang hanya dikutip lewat SOP (F10–F21), diturunkan ke C / maks B (DEC-049). Plastisasi bioleather A/B/C berlabel A padahal hanya F03. Basis gliserol 1% (v/v vs b/v) tidak diketahui (ISS-043).

### FND-036 · 2026-10-11 · Pelajaran teknis sesi GEMA RnD
- Heredoc Git Bash di sesi ini memotong `\` & `\n` di skrip Python panjang → tulis skrip ke file (scratchpad) lalu jalankan; `sed` dengan `&` di teks pengganti menyisipkan teks cocok (pernah merusak JSON dataset).
- DOCX/PPTX bisa dibuat tanpa dependensi (zip store + OOXML) dan divalidasi dengan Word/PowerPoint via COM.
- Webcam di halaman butuh konteks aman (https/localhost); HP via http LAN → pakai input `capture`.
- Form React yang dipakai ulang harus diberi `key` unik per "buat baru", kalau tidak state lama (termasuk ID draf) terbawa.

### FND-037 · 2026-10-20 · SOP pekerja KORA v1.0 → v1.1
- Owner memberi 3 SOP poster pekerja (Downloads/SOP-KORA-01-kopra, -02-arang, -03-aman-weathering .pdf, 3 hal, buatan Chromium). Hasil v1.1 di `Downloads/SOP-KORA-v1.1/` (+ `sumber/`: HTML lembar tambahan, `lembar_tambahan.py`, `bangun_v11.py`). Tidak masuk repo karena repo GNDLAB publik & SOP = dokumen internal.
- **Keputusan owner: kadar air kopra harus < 5%** (Edible; diterapkan juga ke Asalan — minta konfirmasi). Dataset app masih Edible ≤ 6% (ICC) / Asalan ≤ 13,9% — belum diubah.
- Kekurangan utama v1.0: aturan 4 jam, alarm KA 24/48 jam, moisture meter, rantai dingin air kelapa, profil & batas suhu Koven, batok KA ≤ 15%, tanda asap Comba, suhu reaktor Pirol + termokopel, bongkar aman, ICC FC/fines, UN1361/UN1363, oli bekas B3.
- Keputusan owner: belah kelapa harus 50:50 (dua belahan sama besar) — masuk SOP-01 langkah 6.
- Konflik dibiarkan untuk owner: jemur v1.0 "daging menghadap atas" vs SOP Rev 03 telungkup 1–2 hari.
- SOP-KORA-04 (riset QC pasar, 6 hal) → v1.1 (7 hal) + PPTX. Temuan: pembanding P1/P2 di rapor lab = basis basah (abu+FC+ZT ≈ 94,4) sementara sampel Kora basis kering; arang mentah ZT 16,16% > SNI/APCC/usulan ≤ 15%; usulan arang SOP-04 (KA ≤ 8%, abu ≤ 2%) beda dengan SOP-02 (≤ 6%, ≤ 3%); tabel grade hal 4 kalori Premium "≤ 7.500" & Grade C "≥ 7.100" kemungkinan salah ketik. Hitungan "turun … poin" hal 5 dicek: cocok. Isian v1.1 semua SOP kini satu sumber: sumber/isian.py.
- 2026-10-21: SOP-01 v1.1 jadi 5 hal — hal 5 "Jamur Saat Jemur & K3 Wajib" (cegah 4 jam/para-para/tutup embun/alarm KA; pilah ringan→cuci→Asalan, banyak→Asalan, kuning-hijau/hitam tembus/busuk→REJECT musnahkan; dari SOP Rev 03 F4/F5/F7). Keputusan owner: dilarang celana pendek & sandal jepit di semua area kerja (masuk SOP-01 hal 5, SOP-02 hal 4, SOP-03 hal 4). ke_pptx.py --v11 = hanya bangun v1.1 (jangan timpa PPTX yang sedang dibuka owner).

### FND-038 · 2026-10-21 · Patch kode lewat Python di Git Bash
Heredoc + string Python biasa merusak regex/escape: `\b` jadi karakter backspace, `\n` di string tiga-kutip jadi baris baru asli, `\s` memberi SyntaxWarning, dan teks yang memuat tiga tanda kutip menutup string lebih awal. *Why:* beberapa kali menghasilkan regex rusak (voiceTranscribe, ttsText, labAiFilter, officeExport `deck`). *How to apply:* tulis skrip ke file di scratchpad (Write tool) dengan raw string, cek `grep -c $'\x08'` = 0, lalu jalankan `tsc`; regex escape sebaiknya diganti logika `startsWith`.

### FND-039 · 2026-10-21 · Rahasia Vercel tidak bisa diuji lokal
Variabel bertipe Secret (OPEN_ROUTER_APIKEY, GROQ_API_KEY_2..5) tidak bisa ditarik (`vercel env run`/`pull` memberi nilai kosong). *How to apply:* uji integrasi dengan fetch tiruan (unit) + cek rute produksi menolak tanpa login (401); minta owner mencoba sekali di aplikasi. Jangan menulis rahasia ke berkas.

### FND-040 · 2026-10-21 · OpenRouter gratis tanpa model "uncensored"
Daftar model `:free` (cek `https://openrouter.ai/api/v1/models`) tidak memuat Dolphin Venice/Cydonia (berbayar). Model gratis kadang melantur (Inggris acak, "Created by: …®", huruf kapital-kecil Unicode) → disaring `server/labAiFilter.ts` (aturan + penyunting Groq). *How to apply:* contoh teks rusak dari owner → tambah pola + uji di `test/labAiFilter.test.ts`.

### FND-041 · 2026-10-21 · Batas TTS Orpheus 300 karakter
`synthesize` memotong input di 300 karakter → jawaban panjang kehilangan pertanyaan penutup. *How to apply:* pakai `speakLong` (dipecah per kalimat ≤ 280, potongan berikutnya disiapkan selagi diputar). Suara: `autumn` (perintah), `austin` (jawaban Lab AI); server hanya menerima keduanya (`pickVoice`).

### FND-042 · 2026-10-21 · WAV dari owner ber-header streaming
`tts.wav` owner mencantumkan panjang data 0xFFFFFFFF (diklaim ±24 jam). *How to apply:* tulis ulang header RIFF/`data` dengan panjang sebenarnya (Python `struct`) sebelum ditaruh di `public/sounds/`; transkripnya bisa dibaca lewat `/api/voice-transcribe` server dev lokal.

### FND-043 · 2026-10-21 · Tautan Canva owner
`canva.com/d/<id>` butuh login & bukan format yang diterima `read-design`/`resolve-shortlink` (itu untuk canva.link). *How to apply:* cari desainnya lewat `search-designs` (urut terbaru) di akun owner. Template owner = "Infografik Manglar - Editable" (versi editable infografik mangrove yang sama dengan gambar Pinterest). Ekspor PNG desain itu ditolak (izin) → pakai thumbnail. Koneksi Canva bisa terputus; owner yang menyambung ulang.

### FND-044 · 2026-10-21 · Jendela OptionWheel yang pas
Pilihan berjarak d: geser tegak `R·sin(d·tilt)` (R = tinggi baris / tilt), diputar `d·tilt` di titik kiri-tengah → ujung kanan teks naik/turun `lebar·sin`, ditambah blur 2 px/langkah. *How to apply:* `wheelWindow()` di `LabPage.tsx` memakai lebar label dari `offsetWidth` (tidak terpengaruh transform; ukur ulang via ResizeObserver karena font termuat belakangan). Event `wheel` OptionWheel non-pasif → batasi area roda selebar teks agar gulir di luar menu tetap menggulir halaman; di ujung daftar gulir diteruskan ke halaman.

### FND-045 · 2026-10-21 · Render PPTX untuk cek visual
PowerPoint terpasang di mesin owner → `Slides[i].Export(png, "PNG", 1280, 720)` lewat PowerShell COM memberi gambar persis seperti di PowerPoint. *How to apply:* lihat skill `gnd-pptx-design`; `Remove-Item` di scratchpad diblokir → ekspor ke folder baru.

### FND-046 · 2026-10-22 · Server uji 3210 macet "Compiling …"
Server `web-e2e` (folder build `.next-e2e`) bisa macet berkompilasi > 10 menit (curl ke 3210 tidak pernah menjawab) sementara server 3000 normal. *How to apply:* hentikan preview `web-e2e`, `rm -rf apps/web/.next-e2e`, mulai lagi (kompilasi pertama /gudang ±35 dtk). Playwright `webServer` gagal "exit code 143" bila 3210 tidak hidup → nyalakan lewat preview_start `web-e2e`.

### FND-047 · 2026-10-22 · Uji timer di Playwright & tur sambutan
`page.clock.install()` membiarkan waktu tetap berjalan (waitForTimeout/screenshot ikut memajukan timer halaman) → untuk menguji hitungan mundur (mis. 10 detik) panggil `page.clock.pauseAt(Date.now()+1000)` lalu majukan dengan `runFor`. Tur sambutan "Halo! Nggak perlu kira-kira lagi" menutupi layar pada kunjungan pertama → di uji set `localStorage['gemas.tour.v1']='done'`.

### FND-048 · 2026-10-22 · Hamparan (overlay) dekoratif tetap: jangan halangi klik
Elemen `fixed` dekoratif (pohon kelapa WebGL) yang sebagian tampak di tepi layar menangkap klik di area transparannya dan menutupi tombol di ponsel. *How to apply:* `pointer-events: none` pada pembungkus saat diam + satu area pemicu kecil (`pointer-events: auto`) di tepi layar; uji dengan `document.elementFromPoint` bahwa isi di sebelahnya tetap bisa diklik.

### FND-049 · 2026-10-22 · "1 Issue" hydration di server dev = SSR basi
Setelah komponen client (PalmCorner) diubah berkali-kali, server dev Turbopack bisa tetap merender HTML versi lama sementara bundel client sudah baru → galat "Hydration failed" di semua halaman (indikator dev "1 Issue"). *How to apply:* cek HTML server (`curl -s localhost:3210/<hal> | grep data-testid=...`); bila elemen baru tidak ada, mulai ulang server dev (preview_stop/preview_start) lalu uji ulang — bukan bug kode. Uji `pageerror` kosong di beberapa halaman setelah mulai ulang. Indikator dev "N" Next.js juga menempati pojok kiri bawah → jangan klik koordinat di situ dalam uji.

### FND-050 · 2026-10-22 · Sorot + klik pada elemen yang sama
Desktop: mengklik area pemicu = mouseenter lalu click → kalau keduanya men-toggle, elemen terbuka lalu langsung tertutup (atau sebaliknya). *How to apply:* jeda buka/tutup beruntun (≥ 0,7 dtk, `Date.now()` — `performance.now()` tidak ikut jam tiruan Playwright) dan tutup-lewat-sorotan hanya setelah kursor sempat keluar (mouseleave).

