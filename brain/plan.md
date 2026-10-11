# Rencana Implementasi M1–M5

Sumber: `architecture/CLAUDE_CODE_PROMPT.md`, PRD §9, ARD §5. Status diperbarui tiap akhir fase.

## Struktur monorepo

```
gemasSTUDIO/
├─ apps/web/                 # M2 — Next.js 15 App Router (UI + /api/v1), Prisma, PWA
├─ packages/calc-engine/     # M1 ✅ — TS murni, zero dependency, SI, golden test
├─ packages/dataset/         # M1 ✅ — salinan JSON (build) + Zod + loader SI (paritas seed)
├─ packages/ui/ (opsional)   # M2 — komponen Lab Futuristik bila dipakai >1 app
├─ architecture/             # spesifikasi (sumber kebenaran desain & data)
└─ brain/                    # otak kedua lintas agent
```
Dependensi: `web → dataset → calc-engine`. Engine tidak bergantung pada apa pun.

## Status

| Fase | Isi | Status | Bukti |
|---|---|---|---|
| M0 | Data, validator, skema | ✅ (handoff) | run_all_checks: 105 PASS |
| M1 | Engine + dataset loader | ✅ 2026-10-08 | 99/99 test (17/17 golden), tsc bersih |
| M2 | Web, DB, API, kalkulator, PWA | ✅ 2026-10-09 (offline nav: ISS-025 terbuka) | 131 unit + 13 E2E, run_all_checks LULUS |
| M3 | Simulator 2D SVG + 3D r3f | ✅ 2026-10-09 | engine 93 (layout 11), E2E simulator 10 (1.892 karung ±48 fps) |
| M4 | Sampling, kalibrasi, approval | ✅ 2026-10-09 | web 32 + 11 DB kalibrasi, E2E kalibrasi 2, run_all_checks LULUS |
| F | Formula R&D, produksi per shift, ceklis (owner 2026-10-10) | ✅ 2026-10-10 | engine 132, dataset 66, web +11, E2E 41 (+1 flaky ISS-041), run_all_checks LULUS |
| M5 | R&D Lab | ⏳ (parameter: draf dari KORA di Fase F) | – |

## M2 — rencana rinci (belum dikerjakan)
1. `apps/web`: Next.js 15 + Tailwind memakai `architecture/06-design/tailwind.preset.ts` & `globals.css` (font Bowlby One/Archivo/JetBrains Mono via `next/font`).
2. Prisma: introspeksi/terjemah 1:1 `schema.sql`; trigger & CHECK lewat migrasi SQL mentah. Seed dari `seed.sql`. Uji `schema_integrity_test.sql` 18/18.
3. API `/api/v1` (ARD §6) — Zod input, server selalu re-calculate pakai `buildContainerInput` + `containerCapacity`; error map: `OverrideOutOfRangeError`/`InvalidMoistureError` → 422, versi tak dikenal → 404.
4. Halaman: Beranda, Kalkulator Container, Gudang, Konverter, Data & Sumber, Skenario (share_slug, CSV, PDF `@react-pdf/renderer`).
5. Komponen kartu hasil: typ besar, pita min–max, badge A/B/C berhuruf, label VOLUME/BERAT, bar `volumeFill`/`weightFill`, benchmark, warnings.
6. PWA: Serwist (lihat benchmark.md) — cache dataset + engine; IndexedDB (`idb`) untuk skenario offline, sinkron idempoten.
7. Auth.js (email magic link) hanya untuk simpan skenario & kalibrasi.
8. Playwright: US-01..07, US-09..11. Mobile 360 px.
**Butuh dari owner sebelum M2 DB:** password postgres lokal (lihat environment.md).

## M3–M5 ringkas
- **M3:** `bestGridFit().grid {nx,ny,nz}` & `orientation` sudah tersedia untuk simulator; `nestedCapacity()` untuk kolom arang bersarang. InstancedMesh untuk ≥1.200 karung. Test: angka simulator == kartu hasil untuk semua golden kemasan.
- **M4:** statistik n/mean/min/max/SD; n ≥ 10 → proposal (P5/median/P95); approval `data_admin` → versi patch baru; skenario lama tetap pakai versinya.
- **M5:** `schema_rnd.sql` apa adanya; form dibangkitkan dari `rnd_param_def`; impor CSV dengan preview & alasan penolakan per baris; kode batch `XX-YYMM-NNN` lewat sequence; offline-first.

## Fase P — Alur Proses Kelapa (permintaan owner 2026-10-09, dikerjakan otonom)

Permintaan: bahasa UI lebih santai; simulasi kelapa digambar lingkaran; ukuran container dalam ft;
alur proses lengkap: **loading masuk → kupas serabut → belah → jemur (matahari langsung / greenhouse /
oven) → cungkil daging → produk jadi (kopra)**, plus **batok dikumpulkan → arang**; setiap kelapa
dipisah per **asal: dataran tinggi vs dataran rendah**.

Aturan yang tetap berlaku: angka TIDAK boleh dikarang → parameter proses baru masuk dataset proses
terpisah ber-sumber & ber-keyakinan (A/B/C), atau berupa input pengguna yang jelas ditandai.

Checklist (centang saat selesai + commit per langkah):
- [x] P1 Riset parameter proses (komposisi buah: sabut/batok/daging/air; beda dataran tinggi vs rendah;
      kadar air daging segar; muatan rak (kg/m²) & lama jemur per metode; rendemen arang sudah ada di
      dataset utama) → `architecture/00-research/data/coconut_process_dataset.json` + catatan sumber
      `architecture/00-research/process_research.md` + ADR-007.
- [x] P2 Paket dataset: skema Zod + loader dataset proses + test sumber/rentang.
- [x] P3 Engine `packages/calc-engine/src/process.ts` (fungsi murni, rentang, trace) + unit test.
- [x] P4 UI `/proses`: tahapan bernomor, 2 jalur asal, kalkulator rak (3 metode), batok→arang,
      ringkasan produk jadi; bahasa santai.
- [x] P5 Simulasi container: kelapa = lingkaran (SVG), ukuran container ditampilkan dalam ft/in.
- [x] P6 Pass bahasa santai di seluruh UI (glosarium, hint, peringatan, tur, panduan).
- [x] P7 E2E + run_all_checks + logs (decision/risk/traceability) + commit "Fase P selesai".

## Fase M3 — Simulator 2D & 3D (mulai 2026-10-09)

Spesifikasi: `architecture/CLAUDE_CODE_PROMPT.md` §3, ux_spec §3.3, ADR-005. Angka simulator HARUS identik
dengan kartu hasil kalkulator (pakai engine yang sama, bukan hitung ulang di komponen).

Checklist (centang + commit per langkah; kalau sesi putus, lanjut dari yang belum dicentang):
- [x] S1 Engine `layout.ts`: posisi kemasan dalam container (urutan muat belakang→depan, bawah→atas,
      dari `bestGridFit`), tata letak tumpukan gudang di zona (lorong), kolom bersarang arang; unit test
      (jumlah posisi = `containerCapacity().packs` untuk semua golden kemasan).
- [x] S2 Denah 2D SVG: tampak atas & samping container; denah zona gudang dengan lorong diarsir; hover isi tumpukan.
- [x] S3 3D (three.js + @react-three/fiber, tanpa drei): kotak transparan, karung = InstancedMesh, slider
      "isi %", orbit; dimuat dinamis (tanpa SSR); label "representasi grid".
- [x] S4 Halaman `/simulator` (baca `?s=` dari kalkulator/gudang) + tombol "Buka simulator" di kalkulator & gudang;
      mode arang belah 2 bersarang (kolom).
- [x] S5 Test: unit layout + E2E angka simulator == kartu hasil untuk golden kemasan; ukur fps 1.200 karung.
- [x] S6 Logs (traceability FR-09, decision, risk) + run_all_checks + commit "Fase M3 selesai".

## Fase M4 — Sampling lapangan & kalibrasi (mulai 2026-10-09)

Spesifikasi: `architecture/CLAUDE_CODE_PROMPT.md` §4, PRD US-08, ADR-002, ERD MEASUREMENT/CALIBRATION_PROPOSAL/AUDIT_LOG,
`architecture/logs/assumption_register.md` (prioritas ASM-01, ASM-02, ASM-06), `field_sampling_template.csv`.

Desain kunci (dicatat sebagai ADR-008 saat K5):
- Versi dataset baru = salinan baris versi aktif + nilai parameter yang disetujui (confidence → A, "terukur sendiri").
- Engine untuk versi X = dataset ter-bundle (basis v1.0.4) + override parameter dari DB versi X (patch hanya mengubah nilai).
- Client mengambil override versi aktif saat online & menyimpannya untuk offline; server selalu pakai DB.
- Realisasi stuffing → densitas efektif tersirat → disimpan sebagai sampel `bulk_density` (method realisasi_stuffing) + selisih vs prediksi (target ≤ 10%, PRD §8).

Checklist (centang + commit per langkah):
- [x] K1 Murni: `stats.ts` di calc-engine (n, mean, SD, min, max, P5/median/P95) + `applyParameterOverrides`/`diffParameters` di dataset + test.
- [x] K2 Server versi: dataset per versi dari DB (async), endpoint calculate pakai versi aktif, `/datasets/active` kirim override, client `useDataset` pakai override (+ cache offline).
- [x] K3 Sampling: parser CSV (format persis template) + validasi per baris, service & API `POST /measurements`, statistik, usulan otomatis n ≥ 10.
- [x] K4 Approval: service setujui/tolak (data_admin) → versi patch baru PUBLISHED, versi lama utuh (IR-02), audit actor; API; test integrasi DB alur penuh + skenario lama tetap.
  - Selesai: `server/calibration.ts`, `server/approval.ts`, API `POST /measurements`, `GET /measurements/stats`, `GET /proposals`, `POST /proposals/[id]`; uji `test/calibration.db.test.ts` (11) di DB `gemas_test`. Uji kalibrasi hanya jalan di DB test segar → owner menjalankan `scripts/windows/reset-test-db.ps1` untuk mengulang (FND-020).
- [x] K5 UI: /sampling (form + impor CSV + statistik + prioritas ASM), /kalibrasi (review), realisasi stuffing.
  - Selesai: `app/sampling`, `app/kalibrasi`, `components/sampling/SamplingWorkbench.tsx`, `components/calibration/ProposalReview.tsx`, `lib/realization.ts` (+5 unit test), menu "Sampling". E2E `e2e/calibration.spec.ts` (2) via `playwright.calib.config.ts` → dev server port 3100 + DB test + folder `.next-calib` (teardown memulihkan next-env.d.ts/tsconfig).
- [x] K6 E2E alur penuh (sesi uji via JWT), logs (ADR-008, traceability FR-11/US-08), run_all_checks, commit "Fase M4 selesai".

## Fase F — Formula R&D, Produksi per Shift & Ceklis (owner 2026-10-10, otonom)
Permintaan: kalkulator formula kopra, arang, briket shisha, briket BBQ, briket custom, cuka air kelapa, bioleather; formula produksi per shift; ceklis R&D, QC, produk. Pelajari folder KORA milik owner (Downloads/kora (C:/Users/user/Downloads/kora)), validasi riset, tulis temuan. UI sesuai gaya, wizard + hint + tutorial.
Riset: `architecture/00-research/kora_research.md` (E1–E7, K-01..K-08, GAP). Teks KORA terekstrak hanya di scratchpad sesi (tidak di repo); ekstraktor: zip+XML (docx/pptx/xlsx), pdftotext.
- [x] F0 Baca & validasi KORA → kora_research.md, FND-021..024
- [x] F1 Dataset `00-research/data/coconut_formula_dataset.json` v1.0.0 (parameter bersumber + ceklis + laju stasiun) + koreksi dataset proses v1.1.0 (K-01 pendinginan arang 8–12 jam, K-02 oven kopra maks 70°C) + Zod/loader + test; ADR-009
- [x] F2 Engine `calc-engine/src/formula.ts`: gula must (neraca massa, E1), titrasi umum (E2), alkohol/asetat teoretis, media & hasil bioleather, kopra (rendemen, grade, alarm 24/48 jam, belerang), arang (rendemen, fraksi), briket (adonan, perekat, air, hasil, butir/kg), produksi shift (bottleneck) + unit test
- [x] F3 UI `/formula` per produk (7 tab) + wizard/hint/tur
- [x] F4 UI `/produksi` rencana per shift
- [x] F5 UI `/ceklis` R&D / QC / produk (data-driven, simpan di perangkat, cetak)
- [x] F6 Draf `architecture/07-rnd/parameter_kora_draft.csv` (KE/KA/BL/CK + produk baru AR/BS/BB/BC) untuk M5 — tunggu konfirmasi owner
- [x] F7 E2E, logs (DEC/ISS/traceability/CHANGELOG), run_all_checks, commit "Fase F selesai"
Pertanyaan ke owner (jangan blokir kerja): kelas lot 100–600 mdpl (K-03); dosis perekat & tebal pillow BBQ aktual; kapasitas press/oven briket.

## Fase G — Rantai produksi lengkap + kalkulator tiap proses (owner 2026-10-10, otonom)
Permintaan owner (ringkas): bahan baku = kelapa tua utuh JAMBUL (berat & diameter seragam → cari rata-rata bersumber).
Asal WAJIB tercatat & dipisah: pesisir/dataran rendah ≤500 mdpl vs gunung/bukit/dataran tinggi >500 mdpl (jawaban K-03 — sama dengan dataset proses P07).
Kalkulator & SOP & alat untuk SETIAP proses:
1. Pengangkutan: container berbagai ukuran (ft) + berbagai jenis truk, dengan simulasi.
2. Penyimpanan awal saat bahan datang (gudang, per lot asal).
3. Kupas sabut, belah, sortir kondisi & usia + penanganan, tampung air kelapa (standar simpan).
4. Pengeringan: GREENHOUSE desainer (dimensi → ukuran rak, level, baris, jarak antar rak, tray/rak, kelapa/tray, kemiringan, kipas, belerang gram, titik & waktu bakar, teknis, SOP, alat) + matahari + oven.
5. Congkel & QC → grade; SOP packing + kalkulator packing gudang & container (ft).
6. Arang per asal: tungku drum pirolisis & kolam; persiapan → bakar → dingin → ayak rotari 2× → sortir → arang batok / serbuk (hammer mill); kalkulator packing per output.
7. Briket: bahan baku per % asal (DT:DR) → kekuatan & warna abu; perekat; air; bentuk/jenis; SOP, alat, waktu, kapasitas, oven, packing.
8. Turunan: cuka (ada), bioleather + opsi tambahan selulosa cocopeat/cocofiber/lainnya.
Link owner untuk dicek: 1 TikTok vt, IG rifai_big, TikTok bonumcommune, 18 YouTube, spil.co.id (1 kg kopra berapa biji kelapa), query Google ukuran/berat kelapa jambul.
- [x] G0 Riset → chain_research.md + dataset rantai v1.0.0 (ADR-010) — commit a3cbe08
- [x] G-engine: packages/calc-engine/src/chain.ts (18 uji) — commit 35448e2
- UI rencana: halaman /rantai, tab angkut·terima·belah·kering·kemas·arang·briket·turunan (components/chain/*)
- [x] G1 Transport (truk + container) & penerimaan/gudang per asal
- [x] G2 Kupas/belah/sortir/air kelapa
- [x] G3 Pengeringan (greenhouse desainer + matahari + oven)
- [x] G4 Congkel/QC/grade + packing gudang & container
- [x] G5 Arang (drum/kolam, ayak rotari 2×, hammer mill, packing per output)
- [x] G6 Briket (campuran asal, perekat, air, bentuk, oven, packing)
- [x] G7 Bioleather + selulosa tambahan; cuka
- [x] G8 E2E, logs, run_all_checks, commit (UI cea5319)

## M5 lanjutan — GEMA RnD Lab "peneliti" (owner 2026-10-11, otonom)
Tujuan: isian semudah mungkin + PDF laporan lengkap awal–akhir.
- [x] L1 Data: draf parameter (`07-rnd/parameter_kora_draft.csv`) → `apps/web/src/data/rndParamDraft.json` lewat skrip (DATA, bukan hardcode); saran variabel ukur berlabel "draf, belum dikonfirmasi".
- [x] L2 Model: `Experiment.hypothesis` + `design` {factors[{name,unit,levels[]}], control, replicates, responses[{name,unit}], runs[{code,treatment,order}]} — perubahan tetap lewat applyUpdate (riwayat).
- [x] L3 UI: wizard eksperimen baru 3 langkah (Pertanyaan → Desain → Tinjau), desain opsional.
- [x] L4 Lembar data: grid unit × respon → simpan = DailyEntry baru (group = kode unit).
- [x] L5 Analisis deskriptif per perlakuan (n, rata-rata, SD, min, maks; nilai terakhir per unit) + grafik.
- [x] L6 PDF "laporan lengkap" awal–akhir (kompilasi diperluas).
- [x] L7 Uji unit + E2E + logs (DEC-051) + run_all_checks + commit.

## M5 lanjutan — "Riset Produk" (owner 2026-10-11, otonom)
- [x] R1 Ganti label Protokol → Riset Produk (id URL `protokol` tetap).
- [x] R2 Resep: foto/video per bahan & per langkah (media store, experimentId = kunci riset), daftar Alat.
- [x] R3 Laporan harian per riset (DailyEntry experimentId = kunci riset, append-only) + tandai selesai.
- [x] R4 Laporan gabungan PDF + DOCX + PPTX tanpa dependensi baru (zip "store" + XML Office sendiri, offline).
- [x] R5 Uji (unit: zip/docx/pptx struktur; E2E) + logs DEC-052 + commit.

## BACKLOG — lanjut setelah limit aman (dicatat 2026-10-11)
1. **Hasil riset bisa dihapus** (permintaan owner). Rancangan: tombol Hapus di kartu Hasil riset → konfirmasi ketik nama riset + saran "Unduh cadangan dulu"; hapus SEMUA versi (store protocols, key), laporan harian (entries experimentId = key) & media terkait (experimentId = key) dalam satu transaksi; tambah DEC + E2E. Catatan: ini satu-satunya penghapusan catatan resmi — wajib konfirmasi kuat.
2. Bandingkan dua eksperimen berdampingan.
3. Konfirmasi draf parameter R&D (119) oleh owner → status bukan "draf".
4. Menunggu owner: basis gliserol (v/v | b/v); pasar tujuan kopra edibel; baca naskah SNI (akses-sni.bsn.go.id); lampiran BPOM 11/2019 batas sulfit; pilihan sinkronisasi laptop↔HP (07-rnd/sinkronisasi-opsi.md).

## SELESAI 2026-10-11 (DEC-058) — Laporan berdesain bagus + grafik
Sisa: PDF eksperimen (CompileDoc) belum ikut gaya baru & masih pakai Chart lama; foto sampul PPTX/PDF hanya bila ada foto.
### Rencana awal (arsip)
Kajian kondisi sekarang:
- `apps/web/src/lib/labPdf.tsx`: PDF eksperimen (kompilasi) sudah punya grafik garis per variabel (Chart) & batang rata-rata±SD per perlakuan (SummaryBars); tampilan polos (kotak Block per kolom, banyak "belum dicatat").
- `apps/web/src/lib/researchReport.ts` → model `ResearchReport` (blok teks/tabel/gambar) dipakai `researchPdfBlob` (labPdf), `buildDocx`/`buildPptx` (officeExport.ts). **Laporan riset produk BELUM punya grafik sama sekali**; desain = daftar blok berurutan.
- Data grafik tersedia: hasil ukur laporan harian (`measurementSeries` di labStore), Hari ke-N (`dayNumber`), status/tanggal (`researchDates`), desain eksperimen (`summarize` di labDesign).
Rancangan:
1. Model laporan tambah `charts: ChartSpec[]` (garis per variabel vs Hari ke-N; batang per perlakuan; kelompok = ulangan/unit) — SATU sumber data untuk PDF/DOCX/PPTX; hanya data tercatat, <2 titik → tidak digambar + teks "data belum cukup".
2. Gambar grafik sekali sebagai SVG (fungsi murni `chartSvg(spec)` → string, diuji unit) → PDF: komponen react-pdf Svg setara; DOCX/PPTX: SVG → PNG lewat canvas di browser (`svgToPng`) lalu ditanam sebagai gambar (DrawingML chart asli terlalu rumit; PNG cukup & terbaca Word/PPT).
3. Desain (token Lab Futuristik): sampul (judul, kode, status pill, tanggal mulai–selesai, durasi, pembuat+asisten, foto utama bila ada); halaman "Ringkasan" berisi kartu KPI (jumlah hari, laporan, variabel diukur, nilai awal→akhir tiap variabel, versi resep); bagian bernomor dengan garis aksen mint; tabel bergaris tipis zebra; galeri foto 2–3 kolom berkapsi; footer halaman + disclaimer.
4. PPTX: 1 slide sampul, 1 ringkasan KPI, 1 slide per grafik (besar), komposisi/alat/hari, foto 2 per slide, 1 slide per laporan harian ringkas.
5. Eksperimen (labPdf CompileDoc) ikut gaya yang sama + sampul & KPI.
6. Validasi: uji unit chartSvg/model; E2E unduh 3 format; buka DOCX/PPTX via Word/PowerPoint COM (baca saja) & cek jumlah gambar/grafik; PDF dibaca visual (Read pdf). Simbol ≥ − ± tidak ada di font PDF bawaan → pakai teks.

## PERMINTAAN BARU — Tab "Laporan Belanja" (LPJ) (owner 2026-10-11)
Contoh owner: Google Doc "LPJ_PR_Request_RnD_Kora_Revisi" (link di chat; dibaca via /mobilebasic). Struktur yang harus diikuti:
1. Kop "INTERNAL OF MEMO · LEMBAR PERTANGGUNGJAWABAN"; Pengajuan NO (refer no. pengajuan) | kota, tanggal; Nomor surat; Perihal; Lampiran; Kepada Yth. + di tempat; salam & paragraf pembuka (no. pengajuan, tanggal, kebutuhan R&D produk).
2. Anggaran pengajuan Rp + terbilang; Realisasi & alokasi Rp + terbilang (otomatis).
3. Bukti per alokasi (berulang): judul alokasi, foto nota/bukti bayar, foto barang, total alokasi Rp + terbilang, deskripsi.
4. Penutup, "Hormat kami", kota/tanggal, 2 penanda tangan (nama + jabatan).
5. Lampiran 1 rincian alokasi: tabel per bagian (No, Alokasi, Bahan/perlengkapan, Jumlah beli, Satuan beli, Harga dasar, Faktor 1/0, Harga dipakai, Jumlah) + paragraf bagian + subtotal per alokasi + rekonsiliasi total. Aturan owner di dokumen: faktor 1 = harga dasar + batas atas 50%; faktor 0 = harga dasar; jumlah = jumlah beli × harga dipakai.
6. Lampiran 2 timeline: No, Kegiatan, Mulai, Selesai, Hari (otomatis, inklusif) + catatan + output yang dituju.
Status: SELESAI 2026-10-11 (DEC-059) lalu DISEDERHANAKAN owner (DEC-060) jadi upload bukti alokasi saja — tab /lab?t=belanja, ekspor Word divalidasi di Word. Belum: ekspor PDF LPJ, nama/penanda tangan tersimpan sebagai bawaan, cadangan LPJ ikut file cadangan lab.
