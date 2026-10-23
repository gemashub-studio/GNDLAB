# CHANGELOG

Format: [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) · Versi dataset mengikuti SemVer (ADR-002).
Waktu dalam WIB (UTC+7).

## [Ringkasan: Kapasitas Container tanpa kartu] — 2026-10-23
### Diubah
- Tabel Kapasitas Container di halaman Ringkasan tampil langsung tanpa bingkai kartu.

## [Maskot kelapa KORA beranimasi] — 2026-10-23
### Diubah
- Maskot asisten suara kini benar-benar beranimasi (animated WebP 192×240, 288 frame / 14,4 s, 2,2 MB): melambai dengan papan selancar, lalu kickflip skateboard KORA, berulang. Pengguna yang memilih "kurangi gerakan" melihat gambar diam.

## [Maskot kelapa KORA] — 2026-10-23
### Diubah
- Animasi CSS maskot (melayang/miring/memantul) dimatikan supaya gerakan dari file animasi maskot terlihat.
- Maskot asisten suara memakai gambar baru "kelapa KORA" (kelapa peselancar melambai) dengan animasi melayang/berdenyut/miring/memantul seperti sebelumnya.

## [Menu GnD Lab ringkas, flowchart, perintah "isi kolom", bingkai listrik] — 2026-10-20
### Dihapus
- Menu GnD Lab: Ringkasan, Eksperimen, Library, Standar.
### Ditambahkan
- Flowchart PDF halaman GnD Lab (docs/gnd-lab).
- Perintah suara "isi kolom <nama kolom> dengan <nilai>" (termasuk dropdown); modal yang dibuka lewat suara tampil dari atas dengan animasi ElectricBorder.

## [Asisten suara kelapa] — 2026-10-20
### Ditambahkan
- Asisten suara (Groq): kartu sambutan maskot kelapa beranimasi saat pertama masuk; perintah suara untuk membuka halaman/menu, membuka form, dan mengisi data.
- Perlakuan bio leather baru: Rumput, Bunga, Kunyit.

## [Resep: tanpa isi manual; foto perlakuan non-kopra] — 2026-10-20
### Diubah
- Resep/proses baru: kolom isi manual jalur produk dihapus (jalur umum pindah ke dropdown).
- Jalur produk non-kopra menampilkan foto dari "Perlakuan lainnya (Non Kopra)" per jenis (mis. CUKA 1 / CUKA 2), ikut PPTX.

## [Perlakuan di modal revisi] — 2026-10-20
### Diubah
- Revisi data akhir: bagian Perlakuan sama & sinkron dengan form data awal (Green House / Oven Gas / Oven Briket + jumlah produksi, foto & keterangan).

## [Suara: nama kolom + nilai; Resep: tambah kolom jalur & hapus foto] — 2026-10-19
### Ditambahkan
- Perintah suara "nama kolom + nilai" untuk semua kolom form data awal, akhir, dan revisi (angka, teks, dropdown).
- Resep baru: tombol ＋ Tambah kolom jalur produk, tombol ✕ hapus foto; foto per jalur mengikuti nomor perlakuan (GH 1–15, berikutnya mulai 16).

## [Perlakuan di data awal, resep dari pencatatan, Groq Whisper] — 2026-10-19
### Ditambahkan
- Form data awal: Perlakuan (Green House / Oven Gas / Oven Briket) + jumlah produksi.
- Resep baru: Pilih Data yang tersedia, dropdown Jalur produk (perlakuan + keterangan), foto pencatatan di Komposisi bahan.
- PPTX: slide per perlakuan (foto item sebanyak jumlah produksi; awal atas, akhir bawah).
### Diubah
- Pengisian suara memakai Groq Whisper (whisper-large-v3); petasan sukses berjalan sampai OK diklik; tanpa batas jumlah catatan.
### Dihapus
- Halaman Media dan Data Progres Perlakuan, tombol Lihat Progres & Upload Progres, kamera melayang, Gabungkan data, progres di PPTX.

## [Pengisian suara pencatatan] — 2026-10-19
### Ditambahkan
- Tombol "Isi dengan suara" di form data awal & akhir (AssemblyAI Universal-2, bahasa Indonesia): sebut nomor → kolom berkedip neon, sebut kolom + angka → terisi, "next" → kolom berikutnya.

## [Selesaikan pencatatan, batas 1 data, Excel] — 2026-10-19
### Ditambahkan
- Tombol Lihat Progres; tombol Selesaikan (ketik "Selesai") dengan alert petasan, kartu hijau; unduh Excel pencatatan (5 sheet).
### Diubah
- Maks. 1 pencatatan aktif: catatan baru bisa dibuat setelah catatan sebelumnya diselesaikan.

## [Pengingat 2 hari & foto ke Lab AI] — 2026-10-19
### Diubah
- Email pengingat pencatatan belum lengkap dikirim tiap 2 hari (sebelumnya tiap jam).
- Tanya Lab AI: foto dikirim seperti pesan gambar — OCR berjalan sambil AI berpikir, tanpa modal; bisa ditambah pertanyaan. Perbaikan macet "Membaca teks…".

## [Gabungkan data, progres perlakuan, scan foto] — 2026-10-17
### Ditambahkan
- Halaman Media dan Data Progres Perlakuan (/lab/progres) + modal Upload Progres Perlakuan; kamera melayang membuka modal ini.
- Gabungkan data: pencatatan lengkap + riset produk + progres + laporan belanja → TXT/PPTX/Word; slide Laporan belanja padat (nota bercabang ke barang).
- Tanya Lab AI: scan teks dari foto (potong + OCR); skeleton loading menu data.
- Latar animasi DriftWall di semua halaman kecuali GnD Lab.
### Diubah
- Tanya Lab AI: pilihan model dihapus; mode Mendalam = 4 paragraf per kartu + pertanyaan penutup ramah dengan emoji.
- Form pencatatan: klik di luar menutup (konfirmasi bila ada isian); modal digulir ke tengah layar.

## [GnD Lab & perlakuan pencatatan] — 2026-10-15
### Ditambahkan
- Pencatatan awal: 4 jumlah perlakuan + metode (kopra, bibit bio leather, cuka, bio leather), ikut PDF/Word/PPTX (PPTX di slide Kesimpulan).
### Diubah
- Nama lab menjadi GnD Lab (animasi StrokeText/gsap); loading 4 detik; alert sukses muncul dari kanan; kartu menunggu di atas; hapus langsung hilang dari layar.

## [Laporan belanja: simpan & unduh 3 format] — 2026-10-15
### Diubah
- Laporan belanja: tombol Simpan ▾ (PPTX/Word/PDF), isian nama toko + foto nota + foto barang bernama; PPTX diagram cabang nota → barang.

## [PPTX grid foto pencatatan] — 2026-10-15
### Diubah
- PPTX Pencatatan Data: satu slide maks. 20 foto — 10 foto data awal (dengan data di bawahnya) di atas, pembatas, 10 foto data akhir (berat & tebal) di bawah.

## [Pencatatan Data] — 2026-10-15
### Ditambahkan
- Menu Pencatatan Data (menggantikan Bahan Baku): catatan awal N nomor + foto, catatan akhir berdampingan + foto, kartu hasil (unduh PDF/Word/PPTX + pratinjau), halaman Hasil pencatatan data awal dan akhir (3 tabel + kesimpulan), tombol Pilih → Hapus.
### Diubah
- Animasi loading file terbang di tengah layar, alert sukses gaya baru, pratinjau foto layar penuh, urutan tab lab.

## [laporan dengan video] — 2026-10-15
### Ditambahkan
- Unduhan "HTML + video" (laporan gabungan & per hari): video bisa diputar, foto resolusi asli, satu file offline.
- PowerPoint kini berisi video asli yang bisa diputar.
### Diubah
- Rekam video di halaman memakai MP4 bila didukung browser.

## [laporan harian per hari] — 2026-10-14
### Ditambahkan
- Riset Produk: tiap laporan harian bisa diunduh PDF / Word / PowerPoint; tombol "Lanjut ke Hari ke-N" untuk melanjutkan ke hari berikutnya.
### Diperbaiki
- Waktu ukur bawaan ikut tanggal catatan (sebelumnya selalu tanggal hari ini).

## [Bahan Baku: dropdown kustom, item baru, statistik nyata] — 2026-10-14
### Diubah
- Dropdown Bahan Baku kustom berwarna putih; modal tampil penuh tanpa terpotong & halaman tetap bisa digulir; item baru (kelapa tua/muda, arang mix residu, granul halus/kasar, sekam) dengan aturan kolom wajib; tooltip keterangan perlakuan; alert "Sebentar ya, lagi disiapin." sebelum pindah ke Riset Produk; daftar bahan baku tersimpan; kartu statistik R&D pakai data nyata (Bahan baku, Berjalan).

## [Bahan Baku: perlakuan air & daging terpisah] — 2026-10-13
### Diubah
- Bahan Baku: dropdown Perlakuan air (Cuka1–10, Bioleather1–10) dan Perlakuan daging (Kopra1–10) terpisah & bisa diisi keduanya; tebal daging langsung dalam mm; varian terpilih otomatis jadi jalur produk Resep baru beserta semua datanya. Jalur produk Resep baru juga menyarankan nama varian ini.

## [menu Bahan Baku] — 2026-10-13
### Ditambahkan
- R&D Lab: tab Bahan Baku — form modal (item/barang Kelapa/Arang, barang, berat utuh, air, perlakuan air/daging, tebal daging) + knowledge dari riset sendiri (Cuka/Bioleather 1–5 untuk perlakuan air, Kopra 1–5 untuk tebal daging); Konfirmasi membuka Resep baru yang sudah terisi.
### Dihapus
- Tombol "+ Bahan kelapa" di Resep baru (diganti menu Bahan Baku).

## [navigasi ☰] — 2026-10-13
### Diubah
- Menu utama jadi tombol ☰ di pojok kanan atas (HP & laptop) dengan laci menu berkelompok; sidebar kiri & menu bawah HP dihapus sehingga ruang konten lebih lega.

## [kembali offline] — 2026-10-13
### Diubah
- Atas permintaan owner, aplikasi kembali ke mode offline: panel Sinkron Google Drive disembunyikan sampai dipasang; cadangan/pulihkan file tetap cara memindah data.

## [aplikasi online + sinkron Google Drive] — 2026-10-13
### Ditambahkan
- Tombol "Sinkronkan dengan Google Drive" di /lab → Ringkasan: data lab laptop & HP digabung lewat satu file di Drive pemilik (penghapusan ikut; konflik ID dilaporkan). Panduan: architecture/07-rnd/online-gdrive.md.
- Persiapan hosting Vercel gratis (.vercelignore menjaga .env tidak terunggah).

## [aplikasi GEMA RnD jalur manual] — 2026-10-13
### Ditambahkan
- Resep baru: tabel "Penghitungan bahan baku kelapa" per butir (berat utuh awal/akhir, berat & volume air, tebal daging awal/akhir, proses & hasil proses air/daging, foto/video) + ringkasan jumlah/rata-rata; tampil di halaman riset & laporan PDF/Word/PowerPoint.
### Diubah
- Riset Produk: kolom "Jalur produk" bisa diketik bebas (tetap ada saran 5 jalur); jalur baru otomatis dapat kode 2 huruf untuk kode riset (mis. Minyak Kelapa → MK-P01).

## [aplikasi GEMA RnD laporan belanja] — 2026-10-11
### Ditambahkan
- Tab "Laporan Belanja" di /lab — disederhanakan owner jadi UPLOAD BUKTI ALOKASI saja: tiap alokasi = judul ALOKASI, tabel (kiri foto bukti bayar/nota, kanan foto barang yang dibeli), baris total Rp + terbilang, keterangan di bawah tabel; total seluruh alokasi; unduh Word (.docx).
- PDF kompilasi eksperimen bergaya baru: kartu ringkasan, bagian bernomor, grafik sama dengan laporan riset produk.
- Cadangan & pulihkan lab kini ikut menyimpan laporan belanja (beserta foto nota/barang).
- Hasil riset produk bisa dihapus (ketik kode riset untuk konfirmasi; versi + laporan harian + foto/video dihapus dalam satu transaksi; ditolak bila dipakai eksperimen lain).

## [aplikasi GEMA RnD laporan bergrafik] — 2026-10-11
### Ditambahkan
- Laporan riset produk (PDF/Word/PowerPoint) berdesain baru: sampul gelap Lab Futuristik, halaman Ringkasan (kartu KPI), bagian bernomor, tabel zebra, galeri foto 3 kolom, nomor halaman.
- Bagian "Ringkasan hasil & grafik": tabel awal/akhir/min/maks per variabel & kelompok + grafik garis per Hari ke-N dan batang nilai terakhir per kelompok — hanya dari hasil ukur tercatat; data kurang ditulis "data belum cukup".
- Grafik satu sumber (`reportCharts.ts`): bentuk yang sama digambar di PDF dan ditanam sebagai PNG di Word/PowerPoint.

## [aplikasi GEMA RnD riset produk] — 2026-10-11
### Diubah
- Tab "Protokol" bernama "Riset Produk".
### Ditambahkan
- Resep: foto/video per bahan, per alat, & per langkah; alat diisi seperti bahan (nama, jumlah, satuan).
- Halaman riset: resep versi terakhir, laporan harian sampai "Laporan penutup — riset SELESAI", riwayat versi.
- Laporan gabungan riset produk: PDF, Word (.docx), PowerPoint (.pptx) — offline, tanpa library baru.

## [aplikasi GEMA RnD mode peneliti] — 2026-10-11
### Ditambahkan
- Eksperimen baru lewat wizard 3 langkah: pertanyaan & dugaan, desain (faktor & level, pembanding, ulangan, yang diukur — saran dari draf parameter), tinjau daftar unit percobaan dengan urutan kerja acak.
- Lembar data (tabel unit × variabel) — setiap simpan jadi catatan harian baru; nilai terakhir tampil sebagai petunjuk.
- Ringkasan hasil per perlakuan (n, rata-rata, SD, min, maks) + grafik batang; tanpa uji beda nyata.
- PDF "Laporan eksperimen — lengkap": identitas → pertanyaan/dugaan → desain & unit → ringkasan & grafik → protokol → grafik waktu → catatan harian → hasil & kesimpulan → langkah berikutnya → lampiran per catatan.

## Dataset formula v1.2.0 & rantai v1.1.0 + audit kalkulator — 2026-10-11
### Diubah
- **Perlakuan sulfur kopra tanpa dosis otomatis** (DEC-048, ADR-013): blok `kopra.sulfur` kini berisi status, bukti, & batas residu (UE 50 mg/kg kelapa kering = produk akhir). Parameter dosis/jadwal belerang & `bisulfite_soak_pct` dihapus; dataset rantai menghapus `sulfur_exposure_h`, `sulfur_ventilate_h`, `sulfur_room_per_point_m3`, `sulfur_dose_ref`.
- **Keyakinan 60 parameter disesuaikan** dengan sumber yang benar-benar dibaca (DEC-049).
- Sumber baru F30 (E3S 2024), F31 (EU FIP SO₂), F32 (BPOM 11/2019).
- Engine: `sulfurDose` dihapus; `greenhouseServices` hanya kipas; baru `dryingLoadPlan` & `halvesPerTrayCounted`.
### Ditambahkan
- Pengeringan (greenhouse & oven): belahan per tray hitungan sendiri, muatan aktual (angkatan, isi %, tray terpakai), panel asumsi & satuan; log perlakuan sulfur manual (CSV); oven = tanpa fumigasi.
- Cuka & bioleather: label jenis angka, "Simpan sebagai versi protokol" ke GEMA RnD Lab, basis gliserol v/v & b/v.
- Library GEMA RnD: 29 sumber berkategori (standar produk, aturan keamanan, metode uji, panduan proses, …); `07-rnd/library/sumber/sources.md` dibangkitkan dari JSON.

## [aplikasi GEMA RnD catatan harian] — 2026-10-11
### Ditambahkan
- Catatan harian per eksperimen (hanya bisa ditambah; koreksi = catatan baru): rencana, realisasi, bahan & batch, alat, kondisi, hasil ukur mentah (nilai + satuan + waktu + ulangan), penyimpangan, interpretasi, langkah berikutnya, foto/video dengan keterangan.
- Tab Protokol: resep & proses buatan pengguna berversi; versi baru wajib beralasan, versi lama tidak berubah.
- PDF harian & PDF kompilasi eksperimen dengan tabel dan grafik dari data tercatat.
- Cadangan lengkap (data + foto/video) & pulihkan yang hanya menambah. Penjelasan opsi sinkronisasi: `07-rnd/sinkronisasi-opsi.md`.

## [aplikasi GEMA RnD + tema Lab Futuristik] — 2026-10-11
### Diubah
- Gaya visual seluruh aplikasi: Punk Skate Lab → **Lab Futuristik** (ADR-011, tokens v2.0.0): latar putih-dingin bergrid halus, panel slate dengan cahaya mint, garis rambut, sudut lembut, aksen mint #63E6CF & amber #F5A524, judul Space Grotesk.
### Ditambahkan
- `/lab` GEMA RnD Lab: Ringkasan (5 jalur, aktif & terbaru, langkah berikutnya, status riset), Eksperimen (cari/saring, formulir, detail, lengkapi hasil/kesimpulan dengan riwayat versi, langkah berikutnya), Library sumber (14 sumber, status pemeriksaan), Standar per jalur.
- Riset standar awal: `07-rnd/research/standar-produk/` (5 dossier), `research/metode-dan-validasi/tata-riset.md`, `library/sumber/sources.md`, `research/updates.md`. Dokumen asli ChatGPT di `07-rnd/asal-chatgpt/`.

## [aplikasi ilustrasi langkah] — 2026-10-11
### Ditambahkan
- Setiap langkah SOP (8 tab Rantai Produksi), langkah metode cuka, fase bakar arang, panel bioleather, dan tombol tahap wizard Formula R&D kini berilustrasi: kartu infografis "stiker" bernomor dengan piktogram dua warna (35 gambar), panah alur, selotip, efek tegak-terangkat saat disentuh.

## [aplikasi R&D metode] — 2026-10-11
### Ditambahkan
- Formula R&D → Cuka: panel "Bandingkan metode asetifikasi" (statis, semi-kontinu, generator, aerasi, kontrol tanpa gula) — cuka pertama, siklus, liter per siklus & per 1/3/12 bulan, status asam ≥4%, alat, plus-minus, langkah kerja.
- Formula R&D → Bioleather: panel metode — kultur (sekali/berkala/mother), plastisasi A/B/C (takaran gliserol/gliserin/etanol), pewarna alami (mordan, garam, kopi), finishing (lilin karnauba+minyak, AESO).
- 4 ceklis R&D baru (rnd-cuka-metode, rnd-blt-kultur, rnd-blt-plastis, rnd-blt-finish); tautan langsung `/ceklis?id=…`.
- Dataset formula v1.1.0 (sumber F24–F29); dataset rantai v1.0.1; draf parameter R&D 118 (+7 pilihan metode).

## [aplikasi Fase G] — 2026-10-10
### Ditambahkan
- Rantai Produksi `/rantai` (8 tahap): angkut truk & container (pickup → tronton wingbox, 20GP/40GP/40HC/45HC) dengan butir per rit, pembatas ruang/berat & jumlah rit; register lot asal DR ≤500 / DT >500 mdpl (kode lot otomatis, offline, CSV) + gudang per asal; belah–sortir–air kelapa (pendingin per 2 jam); desainer greenhouse (rak, tingkat, lorong, tray, kelapa/tray, kemiringan, kipas, belerang, titik bakar, gambar skematis), jemur, oven; grade & kalkulator kemas gudang/kendaraan; arang per asal drum/kolam + fase asap + ayak rotari 2× + hammer mill + kemas; briket campuran DT:DR dari hasil lab (selang rasio layak) + bahan baku per asal + bentuk pasar; bioleather + cocopeat/cocofiber/bahan lain.
- Dataset rantai produksi v1.0.0 (`00-research/data/coconut_chain_dataset.json`, sumber C01–C20), ADR-010.
### Diubah
- Kelas asal lot: DR ≤500 / DT >500 mdpl (keputusan owner; menggantikan kode KORA <100 / ≥600 mdpl). ISS-037 ditutup.

## [aplikasi Fase F] — 2026-10-10
### Ditambahkan
- Formula R&D `/formula`: kopra, arang, briket shisha / BBQ / custom, cuka air kelapa, bioleather — wizard per tahap, daftar bahan, sumber & keyakinan per angka, kotak TEMUAN untuk rumus dokumen yang dikoreksi.
- Produksi per shift `/produksi`: lini produksi, stasiun pembatas, kebutuhan orang/unit untuk target.
- Ceklis `/ceklis`: 19 ceklis R&D / QC / produk dari form KORA, simpan offline, CSV, cetak.
- Dataset formula v1.0.0 (`00-research/data/coconut_formula_dataset.json`); draf parameter R&D M5 (`07-rnd/parameter_kora_draft.csv`, 111 parameter).
### Diperbaiki
- Dataset proses v1.1.0: pendinginan arang 1 jam → 8–12 jam; oven kopra 60–90 °C → 55–70 °C.

## [aplikasi M4] — 2026-10-09
### Ditambahkan
- Sampling lapangan (`/sampling`): form cepat, impor CSV format template (semua-atau-tidak), kartu prioritas ASM-06/01/02, statistik n/rata-rata/SD/P5/median/P95.
- Usulan kalibrasi otomatis (n ≥ 10) dan review `data_admin` (`/kalibrasi`) → versi dataset patch baru di database (ADR-008). File dataset repo tidak berubah.
- Realisasi muat: selisih aktual vs prediksi (target ≤ 10 %) + densitas tersirat sebagai sampel.
- API: `POST /api/v1/measurements`, `GET /api/v1/measurements/stats`, `GET /api/v1/proposals`, `POST /api/v1/proposals/{id}`.
- Database test terpisah `gemas_test` untuk uji yang mengubah versi aktif.
### Diperbaiki
- `/icon.svg` 500 di dev karena berkas duplikat di `public/` (ISS-032).

## [arsitektur 1.1.0] — 2026-10-08
### Ditambahkan
- Nama aplikasi resmi **gemasSTUDIO** (keputusan owner).
- `06-design/`: bahasa visual "Punk Skate Lab" — `tokens.json`, `tailwind.preset.ts`, `globals.css`, `design_spec.md`, 4 mockup (`Main`, `Calculator`, `RnD`, `Mobile`). Kontras 11/11 pasangan warna lulus WCAG AA (terendah 6,06:1).
- `07-rnd/`: modul R&D Lab — `PRD_RnD.md` (RD-01..10), `schema_rnd.sql` (parameter sebagai data), `parameter_template.csv` untuk diisi owner.
- `tests/rnd_integrity_test.sql`: 21 uji (RI-01..RI-04, CHECK, view, audit). `run_all_checks.sh` kini menguji DB R&D.
- `CLAUDE_CODE_PROMPT.md`: langkah gaya visual di M2 + Fase **M5 R&D Lab** + prompt impor parameter.
### Diperbaiki selama validasi
- `rnd_param_def`: parameter tipe `choice` tanpa daftar pilihan sempat lolos karena CHECK bernilai NULL dianggap lulus di PostgreSQL (ISS-012).

## [dataset 1.0.4] — 2026-10-08
### Ditambahkan
- Dimensi karung **terisi** & ukuran karung **datar** untuk semua kemasan yang sebelumnya kosong (ISS-011):
  - Arang 25 kg PP woven: datar 56×90 → terisi **64×45×21 cm** (495 karung/20GP ≈ 12,4 t; 40HC dibatasi berat 26,5 t).
  - Arang jumbo bag 550 kg: **95×95×130 cm** (jumbo standar 90×90×100 cm hanya memuat ~385 kg arang lump).
  - Kopra asalan 50 kg: datar 70×110 → terisi **88×55×27 cm** (belum ada benchmark container).
  - Kopra edible 25 kg: datar 60×100 → terisi **79×53×18 cm** (429 karung/20GP ≈ 10,7 t; 975/40HC ≈ 24,4 t).
  - Kelapa jambul: ukuran datar karung jaring 50×80 cm.
- Field `density_ref` per kemasan (densitas acuan untuk uji isi karung).
- Sumber S23 (ukuran karung goni) & S24 (jumbo bag FIBC).
- Validator: uji kemasan `holds_content`, `fits_flat_bag` (rumus kantong bantal), `grid` vs benchmark ton. Golden cases 13 → **17**.

## [dataset 1.0.3] — 2026-10-08
### Diperbaiki
- `arang_batok_belah2.bulk_density.charcoal_halves_loose`: 110/150/200 → **50/85/155 kg/m³**. Estimasi lama tidak konsisten dengan fisika karbonisasi: ρ = ρ_batok_mentah × yield ÷ (1 − susut)³ = 195 × 0,30 ÷ 0,88³ ≈ 86 kg/m³ (ISS-010). Ditambah field `derivation` dan uji silang validator.
- `…charcoal_halves_nested`: 200/260/320 → **85/145/270 kg/m³** (rasio bersarang/lepas 1,7× dipertahankan).

## [dataset 1.0.2] — 2026-10-08
### Diperbaiki
- `kelapa_jambul.packaging[0].bag_dims_cm_filled`: 70×45×30 → **49×34×21 cm**. Uji grid fit lama menghasilkan 285 karung/20GP vs benchmark 900–1000 (ISS-003). Nilai baru diturunkan balik dari benchmark → 924 karung.

## [dataset 1.0.1] — 2026-10-08
### Diperbaiki
- `arang_batok_belah2.mass_per_unit_g.charcoal_half.max`: 35 → **42 g** (= 120 g × yield 0,35). Ditemukan validator (ISS-001).
- `arang_batok_belah2.geometry.charcoal_half_cm.*`: min/max dihitung ulang tepat dari rumus `raw × (1 − shrinkage)` dengan pasangan ekstrem yang benar (min memakai susut maks, max memakai susut min): rim 6,6/8,4/12,9; depth 3,3/4,4/6,0; wall 0,25/0,35/0,55 cm.
- `kelapa_jambul.geometry.solid_volume_cm3.max`: 800 → **865** (= π/6 × 12,5 × 11,5²).

## [dataset 1.0.0] — 2026-10-08
### Ditambahkan
- Dataset awal 4 komoditas, 3 container, 20 sumber, hasil riset web (lihat `research_log.md`).

## [arsitektur 1.0.0] — 2026-10-08
### Ditambahkan
- PRD, ARD, ADR-001..005, ERD, `schema.sql`, `seed.sql`, kamus data, spesifikasi kalkulasi, spesifikasi UX.
- `scripts/validate_dataset.py`, `scripts/seed_from_dataset.py`, `scripts/run_all_checks.sh`.
- `tests/schema_integrity_test.sql` (18 uji IR-01..IR-08), `tests/fixtures/golden_cases.json` (13 kasus).
### Diperbaiki selama validasi
- Validator: deteksi bentuk arang memakai `startswith("arang")` — sebelumnya teks "batok mentah belah (bukan arang)" ikut terbaca sebagai arang (ISS-002).
- Seed: form kelapa jambul dipecah `loose` & `bagged` agar densitas dalam-karung (385) tersedia untuk kalkulasi container (ISS-004).
- Seed: urutan pemetaan satuan — `charcoal_yield_mass_fraction` sempat terpetakan sebagai kg 0,0003 alih-alih fraksi 0,30 (ISS-005); ditambah pengaman fraksi ≤ 1 & massa per unit ≤ 50 kg.
- Seed: sufiks satuan dibuang dari key parameter (`mass_per_unit_g` → `mass_per_unit`, satuan di kolom `unit`) (ISS-006).
- Skema: trigger `forbid_published_mutation` & `audit_row` ditulis ulang dengan percabangan `TG_OP`/`TG_TABLE_NAME` eksplisit (akses field `NEW` pada tabel/operasi yang salah akan error saat runtime) (ISS-007).
- PRD: baseline metrik keyakinan C dikoreksi dari "22" (perkiraan) menjadi **30 dari 45** (dihitung otomatis) (ISS-008).

## Dataset proses v1.0.0 — 2026-10-09
- Baru: `00-research/data/coconut_process_dataset.json` (komposisi buah, asal dataran rendah/tinggi, kadar air daging segar, 3 metode pengeringan, drum arang). Riset & sumber: `00-research/process_research.md`. Keputusan: ADR-007.
- Dataset inventory v1.0.4 TIDAK berubah.
