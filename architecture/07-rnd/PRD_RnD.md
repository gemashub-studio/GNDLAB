---
doc: PRD Addendum
title: PRD — Modul R&D Lab (Pencatatan Batch Produk Turunan Kelapa)
version: 1.0.0
status: Draft — parameter produk MENYUSUL dari owner
date: 2026-10-08
related: [schema_rnd.sql, parameter_template.csv, ../06-design/design_spec.md, ../01-product/PRD.md]
---

# PRD — Modul R&D Lab gemasSTUDIO

## 1. Ringkasan
Buku catatan lab digital untuk percobaan produk turunan kelapa: **Kopra Edible (KE), Kopra Asalan (KA), Bioleather (BL), Cuka Kelapa (CK)**. Setiap percobaan = satu **batch** dengan kode `KE-2610-001` (produk-TahunBulan-urut), melewati tahap proses, dan dicatat nilai parameternya.

**Prinsip kunci:** parameter adalah **data**, bukan kode. Owner mengisi `parameter_template.csv` → diimpor ke tabel `rnd_param_def` → form input muncul otomatis. Menambah/mengubah parameter tidak butuh migrasi atau deploy.

## 2. Persona
| Persona | Kebutuhan |
|---|---|
| Peneliti/operator lab | Catat batch cepat dari HP/tablet, termasuk foto & observasi |
| Owner / kepala R&D | Definisikan parameter & target; bandingkan batch; lihat yang keluar spesifikasi |

## 3. User Stories
| ID | Story | Acceptance Criteria |
|---|---|---|
| RD-01 | Membuka batch baru per produk | Kode otomatis `XX-YYMM-NNN`, unik; prefix harus sama dengan produk (ditolak DB bila tidak) |
| RD-02 | Memindah batch antar tahap | Tahap hanya dari template produk tsb (RI-04) |
| RD-03 | Mengisi nilai parameter | Form dibangkitkan dari `rnd_param_def` aktif; tipe angka/teks/pilihan/ya-tidak divalidasi (RI-02, RI-03) |
| RD-04 | Melihat nilai di luar target | `out_of_spec` dihitung otomatis; ditandai oranye di UI |
| RD-05 | Owner mengimpor parameter | Upload `parameter_template.csv` → preview → simpan; baris tidak valid ditolak dengan alasan per baris |
| RD-06 | Mengubah definisi parameter | Membuat `def_version` baru; nilai lama tetap merujuk definisi lama |
| RD-07 | Membandingkan batch | Tabel/grafik parameter yang sama lintas batch dalam satu produk |
| RD-08 | Menutup batch | Status DONE/FAILED wajib tanggal selesai; peringatan bila parameter wajib belum lengkap |
| RD-09 | Melampirkan foto per tahap | Disimpan ke storage, tautan di `rnd_attachment` |
| RD-10 | Batch turunan | Batch ulangan menautkan `parent_batch` |

## 4. Kebutuhan Fungsional
| ID | Kebutuhan | Prioritas |
|---|---|---|
| RFR-01 | CRUD batch + status PLANNED → RUNNING → DONE/FAILED/CANCELLED | Must |
| RFR-02 | Form parameter dinamis dari definisi | Must |
| RFR-03 | Impor CSV parameter (format `parameter_template.csv`) | Must |
| RFR-04 | Penandaan out-of-spec | Must |
| RFR-05 | Foto & observasi per tahap | Should |
| RFR-06 | Perbandingan lintas batch + ekspor CSV | Should |
| RFR-07 | Offline-first (catat di lab tanpa sinyal, sinkron nanti) | Should |

## 5. Status Saat Ini
- ✅ Skema DB `schema_rnd.sql` — 21/21 uji lulus (`tests/rnd_integrity_test.sql`)
- ✅ Seed 4 produk + 26 tahap template
- ✅ Mockup UI: artboard "R&D Lab" di kanvas desain (`06-design/mockups/RnD.dc.html`)
- ⏳ **Parameter produk: menunggu owner mengisi `parameter_template.csv`**
- ⏳ Implementasi aplikasi (Fase M5 di `CLAUDE_CODE_PROMPT.md`)

## 6. Catatan Tahap Template
Tahap proses adalah alur umum industri dan **wajib dikonfirmasi owner**:
- KE: Terima kelapa → Belah & buang air → Pengeringan → Cungkil & sortir → Kemas
- KA: Terima kelapa → Belah → Asap/jemur → Cungkil → Kering lanjut → Karungkan
- BL: Siapkan media → Inokulasi starter → Fermentasi lembaran → Panen & cuci → Pemurnian → Plastisasi → Pengeringan → Finishing
- CK: Saring bahan → Fermentasi alkohol → Fermentasi asetat → Penuaan → Saring → Pasteurisasi → Botolkan
