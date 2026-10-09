# Decision Log

Indeks keputusan. Keputusan arsitektur berbobot didokumentasikan penuh sebagai ADR di `02-architecture/adr/`.

| ID | Tanggal | Keputusan | Alasan singkat | Dokumen |
|---|---|---|---|---|
| DEC-001 | 2026-10-08 | Satu engine TS murni untuk client & server | Offline + konsistensi angka | ADR-001 |
| DEC-002 | 2026-10-08 | Dataset terversi & immutable; override per skenario; kalibrasi via proposal | Reproducible & audit | ADR-002 |
| DEC-003 | 2026-10-08 | Nilai = rentang {min,typ,max}; min/max via evaluasi sudut 2^k | Variasi komoditas alami | ADR-003, calc_spec §2 |
| DEC-004 | 2026-10-08 | Satuan internal SI, branded types | Cegah bug satuan | ADR-004 |
| DEC-005 | 2026-10-08 | Model muat densitas efektif + grid kemasan | Akurat empiris, cepat | ADR-005 |
| DEC-006 | 2026-10-08 | Spek dagang "12–14 inch" kelapa ditafsirkan sebagai **keliling** | π·D (D 9,5 cm) = 29,8 cm ≈ 12 inch; tafsiran diameter (30–36 cm) tidak masuk akal untuk kelapa tanpa sabut | dataset `circumference_cm`, validator `jambul.circumference` |
| DEC-007 | 2026-10-08 | Benchmark 10–11 rb butir/20ft dipertahankan sebagai **skenario konservatif**, bukan dihapus | Satu sumber menyimpang ~50%; bisa jadi reefer/palet/butir besar | dataset, WARN di validation_log |
| DEC-008 | 2026-10-08 | Keyakinan campuran ("A/C") dihitung sebagai yang terlemah | Prinsip konservatif | validator & seed |
| DEC-009 | 2026-10-08 | Arang belah 2 dimodelkan 4 form: halves_loose, halves_nested, lumps, raw_halves | Densitas berbeda hingga 4× antar bentuk | ERD §3 |
| DEC-011 | 2026-10-08 | Nama aplikasi **gemasSTUDIO** | Keputusan owner | HANDOFF §6 |
| DEC-012 | 2026-10-08 | Gaya visual "Punk Skate Lab" (tanpa radius, garis 3px, bayangan keras, aksen #C6F135/#FF5A1F) menggantikan arah awal bernuansa kelapa lembut | Permintaan owner: lebih punk/skate, seperti lab | `06-design/design_spec.md` |
| DEC-013 | 2026-10-08 | Parameter R&D disimpan sebagai data (`rnd_param_def`, ber-versi), bukan kolom | Parameter dari owner menyusul & akan berubah; tanpa migrasi | `07-rnd/schema_rnd.sql` |
| DEC-014 | 2026-10-08 | Tahap proses R&D = template umum industri, wajib dikonfirmasi owner | Belum ada SOP owner | `07-rnd/PRD_RnD.md` §6 |
| DEC-010 | 2026-10-08 | Kelapa jambul 2 form: loose (483) & bagged (385) | Densitas lab ≠ densitas efektif container | ERD §3, ISS-004 |
| DEC-015 | 2026-10-08 | Bentuk `trace` = `{engineVersion, datasetVersion, params}` + field `confidence` gabungan di setiap CalcOutput | ARD §6 dan calc_spec §8 berbeda; ARD dipilih karena menjadi kontrak API; `engineVersion` mengisi `calc_result.engine_version` | packages/calc-engine/src/trace.ts |
| DEC-016 | 2026-10-08 | Peringatan keselamatan (SELF_HEATING_RISK, FLOOR_OVERLOAD) dievaluasi pada kasus terburuk (max); peringatan lain pada typ. CONSERVATIVE_BENCHMARK_GAP bila typ > maks benchmark konservatif × (1 + 0,10) | Konservatif untuk risiko kebakaran/struktur; ambang 10% = TOL validator | packages/calc-engine/src/warnings.ts |
| DEC-017 | 2026-10-08 | Engine menerima volume nominal container (`volumeM3`) dari dataset; tanpa itu → L·W·H | Golden & validator memakai `volume_m3`; container custom tetap L·W·H | packages/calc-engine/src/container.ts |
| DEC-018 | 2026-10-08 | Parameter tanpa label keyakinan (berat bersih karung, utilisasi volume default) = C | Konsisten dengan aturan seed "tanpa label → estimasi" | packages/dataset/src/loader.ts |
| DEC-019 | 2026-10-08 | Monorepo pnpm 9 + Turborepo 2; paket diekspor sebagai sumber TS (tanpa build); arah dependensi web → dataset → calc-engine | Engine tetap zero-dependency; golden test engine membaca fixture via fs (tanpa siklus) | ARD §5 |
| DEC-020 | 2026-10-09 | Font dimuat lewat `next/font` (di-host lokal), bukan `@import` Google Fonts di globals.css; selebihnya globals.css & tailwind.preset.ts dipakai apa adanya | PWA harus tampil benar saat offline | apps/web/src/app/globals.css, layout.tsx |
| DEC-021 | 2026-10-09 | Dark mode DITUNDA | `06-design/design_spec.md` menggantikan token ux_spec §5 dan tidak punya token gelap; menambah warna di luar token butuh ADR → menunggu keputusan owner | brain/sessions.md |
| DEC-022 | 2026-10-09 | Ekspor CSV memakai pemisah `;` + UTF-8 BOM; angka format Indonesia | Excel lokal Indonesia memakai koma desimal | apps/web/src/lib/report.ts |
| DEC-023 | 2026-10-09 | Login magic link sesi JWT + tabel `auth_verification_token`; skenario offline-first dengan UUID client sebagai id | Lihat ADR | ADR-006 |
| DEC-024 | 2026-10-09 | Service worker: aset build di-precache berversi; HANYA halaman kalkulator publik di-cache (NetworkFirst, abaikan Vary & query); halaman per-pengguna tidak di-cache | Offline andal tanpa HTML basi & tanpa bocor data akun di HP bersama | apps/web/src/app/sw.ts |
| DEC-025 | 2026-10-09 | Wizard "Panduan" 4 langkah + hint "?" + tur pembuka + halaman Panduan sebagai lapisan orientasi di atas tata letak mockup | Permintaan owner (mudah dipahami); pola dari referensi Jurnal.id | brain/benchmark.md §2b |
| DEC-026 | 2026-10-09 | Parameter alur proses di dataset terpisah `00-research/data/coconut_process_dataset.json` v1.0.0 (bersumber, ber-keyakinan); air kelapa = sisa neraca massa; kepadatan rak diturunkan dari geometri | Permintaan owner Fase P; dataset inventory immutable | ADR-007 |
| DEC-027 | 2026-10-09 | Bahasa UI santai (sapaan "kamu", istilah gudang); pesan resmi engine (calc_spec §6) TETAP, UI menambah judul santai + saran per kode peringatan | Permintaan owner ("bahasanya terlalu kaku"); pesan engine = kontrak API | apps/web/src/components/ui/Warnings.tsx, lib/glossary.ts |
| DEC-028 | 2026-10-09 | Ukuran container ditampilkan dalam ft/in (nama dagang "20 ft", "40 ft High Cube"); kode 20GP/40GP/40HC tetap di data & API | Permintaan owner; ADR-004 (konversi hanya di presentasi) | apps/web/src/lib/imperial.ts |
| DEC-029 | 2026-10-09 | Simulasi kelapa: lingkaran SVG, 1 lingkaran = kapasitas ÷ jumlah sel, diisi per asal; kapasitas dari engine (jambul PIECE) | Permintaan owner; tetap berlabel "gambar perkiraan" (ADR-005) | apps/web/src/components/sim/ContainerCircleSim.tsx |
