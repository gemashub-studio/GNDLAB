# Risk & Issue Log

## Risiko

| ID | Risiko | Peluang | Dampak | Mitigasi | Pemilik | Status |
|---|---|---|---|---|---|---|
| RSK-01 | Densitas arang belah 2 (ASM-01/02) rentang 3× (50–155 kg/m³) → salah pesan container | Sedang | Tinggi | Badge C + banner; uji ember wajib sebelum go-live fitur arang belah 2 | Data admin | Terbuka |
| RSK-02 | Kelapa Dalam Indonesia lebih besar dari data India → butir/container lebih sedikit | Sedang | Sedang | Sampling 30 butir/lot; kalibrasi via proposal | Data admin | Terbuka |
| RSK-03 | Kadar air kopra asalan sangat bervariasi (8–22%) → berat stok salah | Tinggi | Sedang | Input kadar air wajib di skenario kopra asalan; koreksi otomatis | Produk | Dimitigasi (desain) |
| RSK-04 | Pengguna mengira simulasi 3D = posisi muat nyata | Sedang | Rendah | Label tetap di simulator (ADR-005) | UX | Dimitigasi (desain) |
| RSK-05 | Payload efektif dibatasi aturan jalan lokal (< payload container) | Sedang | Sedang | Field "batas berat truk/jalan" opsional di container custom | Produk | Terbuka |
| RSK-06 | Engine TS menyimpang dari validator Python | Rendah | Tinggi | Golden cases jadi test CI wajib (ADR-001) | Engineering | Dimitigasi (desain) |
| RSK-07 | Kopra edible tercemar bau kopra asap di gudang sama | Sedang | Tinggi (reject buyer) | Warning `ODOR_CONTAMINATION` | Produk | Dimitigasi (desain) |
| RSK-09 | Tahap template R&D tidak sesuai SOP owner | Sedang | Sedang | Tahap bisa diedit (data), konfirmasi sebelum go-live | Owner | Terbuka |
| RSK-10 | Logo/brand resmi belum ada | Tinggi | Rendah | Ikon sementara; token terpusat memudahkan penggantian | Owner | Terbuka |
| RSK-08 | Self-heating kopra basah di tumpukan tinggi | Rendah | Tinggi (kebakaran) | Warning `SELF_HEATING_RISK`, batas tinggi tumpuk | Produk | Dimitigasi (desain) |

## Isu (ditemukan & diselesaikan saat validasi)

| ID | Isu | Ditemukan oleh | Resolusi | Status |
|---|---|---|---|---|
| ISS-001 | Massa maks arang belah 2 tidak konsisten dengan yield (35 vs 42 g) | `validate_dataset.py` CROSS | Dataset 1.0.1 | Selesai |
| ISS-002 | Benchmark batok mentah salah dikira arang (string match) | `validate_dataset.py` BENCH | Logika `startswith` | Selesai |
| ISS-003 | Dimensi karung jambul estimasi → 285 karung vs benchmark 900–1000 | Golden `grid_fit_bags_20GP` | Dataset 1.0.2: 49×34×21 cm + uji grid permanen | Selesai |
| ISS-004 | Jambul hanya punya densitas lab, bukan densitas dalam karung | Seed ke PostgreSQL | 2 form: loose & bagged | Selesai |
| ISS-005 | `charcoal_yield_mass_fraction` terpetakan kg 0,0003 | Query hasil seed | Urutan pemetaan + pengaman | Selesai |
| ISS-006 | Key parameter membawa sufiks satuan lama | Review hasil seed | `norm_key()` | Selesai |
| ISS-007 | Trigger PL/pgSQL mengakses field `NEW` yang tak ada | Review kode + uji PostgreSQL 16 | Tulis ulang trigger; 18/18 uji lulus | Selesai |
| ISS-008 | Metrik PRD memakai angka perkiraan (22) | Hitung otomatis | 30 dari 45; dihasilkan validator | Selesai |
| ISS-010 | Densitas arang belah 2 lepas (typ 150) ~75% lebih tinggi dari turunan fisika (≈ 86) | Review saat menulis register asumsi | Dataset 1.0.3 (50/85/155) + uji `arang.halves_loose_density` | Selesai |
| ISS-011 | Dimensi karung terisi hanya ada untuk kelapa jambul; arang, kopra asalan, kopra edible & jumbo bag kosong → mode PACKAGE & simulator tidak bisa jalan | Audit "dimensi per produk" sebelum handoff | Dataset 1.0.4 + 12 uji kemasan baru di validator | Selesai |
| ISS-012 | `rnd_param_def` tipe choice tanpa pilihan lolos (CHECK NULL = lulus) | `tests/rnd_integrity_test.sql` | CHECK ditulis eksplisit dengan CASE | Selesai |
| ISS-013 | Parameter produk R&D belum ada | Permintaan owner | Template CSV + empty-state di UI; menunggu owner | Terbuka (menunggu owner) |
| ISS-009 | Kopra asalan belum punya benchmark muat container | Research log | Golden case bertanda "perlu data lapangan" | Terbuka (butuh data) |
| ISS-014 | Golden jambul membulatkan (`round` → 22.230) sedangkan calc_spec §3.2 memakai `floor` (engine 22.229) | Implementasi M1 | Selisih 0,004%, dalam toleransi; engine tetap `floor` (tidak menjanjikan butir yang tak muat) | Diterima |
| ISS-015 | `floor` dalam meter rentan galat floating-point (pembagian pas jadi x,9999999) | Implementasi M1 | `floorDiv` dengan epsilon 1e-9 + uji regresi | Selesai |
| ISS-016 | calc_spec §8 vs ARD §6 berbeda bentuk `trace` | Implementasi M1 | DEC-015 | Selesai |
| ISS-017 | Uji DB lokal belum jalan: PostgreSQL 16 terpasang tetapi password superuser hanya diketahui owner | Setup M1 | Owner menjalankan reset-postgres-password.ps1 (password acak di pgpass.conf); uji DB 18/18 + seed + R&D 21/21 lulus | Selesai |
| ISS-018 | run_all_checks.sh: di Windows `psql "$PGURL" -c …` mengabaikan semua opsi setelah URL (getopt tanpa permutasi) → DB tidak dibuat; dan baris FAIL dari uji SQL tidak menggagalkan skrip | Uji DB pertama di Windows | URL lewat `-d`; fungsi `run_sql_test` menandai gagal bila ada FAIL/ERROR | Selesai |
| ISS-019 | Angka kapasitas di mockup `Main.dc.html` tidak semua cocok dengan engine (jambul 40HC "46.090", arang belah 2 "2,8 t") | Review mockup M2 | Angka UI selalu dari engine; mockup hanya acuan tata letak | Selesai |
| ISS-020 | `parseNum("0.575")` terbaca 575 (dikira titik ribuan) | Unit test M2 | Ribuan hanya bila grup pertama tidak diawali 0 + test | Selesai |
| ISS-021 | Service worker: revisi precache halaman tetap `'1'` (HTML basi setelah update) & navigasi offline gagal karena header `Vary` | Uji E2E offline | NetworkFirst + `ignoreVary/ignoreSearch`, aset build berversi otomatis | Selesai |
| ISS-022 | Review kode M2: IDOR GET skenario by UUID, balapan sinkron clientId (500), cache SW menyimpan halaman per-pengguna, satuan stok gudang tak sinkron saat tautan dipulihkan, query DB peran di tiap request, tanpa rate limit tautan masuk | Code review M2 | Semua diperbaiki + test; rate limit masih in-memory (perlu store bersama bila multi-instance) | Selesai (catatan) |
| ISS-023 | US-05 (tumpukan bersarang) & penanda "custom" US-09 belum punya UI | Pemetaan US→UI sebelum E2E | Alat tumpukan bersarang di Konversi + tag CUSTOM pada hasil | Selesai |
| ISS-024 | `.ps1` tanpa BOM dibaca ANSI oleh PowerShell 5.1; karakter "—" merusak parsing | Setup DB M2 | Skrip `.ps1` dibuat ASCII murni | Selesai |
| ISS-025 | Offline: navigasi antarhalaman saat/sesudah koneksi putus tidak stabil di emulasi Playwright (Edge/Chromium): browser me-reload halaman aktif & membatalkan navigasi; kadang halaman tujuan baru tampil setelah navigasi kedua. Service worker terbukti menyajikan halaman dari cache (log SW: cache hit 200) dan kalkulator tetap menghitung di halaman yang sudah terbuka | Uji E2E offline M2 | e2e/pwa.spec.ts ditandai `fixme`; perlu uji di HP Android nyata (mode pesawat) + kemungkinan ganti `<Link>` → `<a>` saat offline agar tidak memakai jalur RSC Next | Terbuka |
