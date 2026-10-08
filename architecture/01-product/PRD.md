---
doc: PRD
title: Product Requirements Document — gemasSTUDIO — Coco Inventory & R&D Lab
version: 1.0.0
status: Draft for build (siap diolah Claude Code)
date: 2026-10-08
owner: masciosa@gmail.com
related: [../02-architecture/ARD.md, ../03-data/ERD.md, ../04-calculation/calculation_spec.md, ../05-ui-ux/ux_spec.md]
---

# PRD — gemasSTUDIO — Coco Inventory & R&D Lab

## 1. Ringkasan

Aplikasi web untuk **menghitung dimensi, berat, volume, dan kebutuhan ruang** (gudang & container) bagi empat komoditas kelapa:

| Kode | Komoditas | Bentuk unit | Batas umum |
|---|---|---|---|
| `kelapa_jambul` | Kelapa tua jambul (semi-husked) | per butir, dalam karung jaring 25 butir | **Volume** |
| `arang_batok_belah2` | Arang batok kelapa belah 2 | per keping (bisa bersarang/nested) atau curah | **Volume** (belah 2) / **Berat** (lump) |
| `kopra_asalan` | Kopra asalan (asap/campur) | curah atau karung 50–65 kg | Volume |
| `kopra_edible` | Kopra edible (putih, cup) | karung 25–50 kg | Volume |

Semua angka referensi berasal dari `00-research/data/coconut_inventory_dataset.json` (riset + tervalidasi otomatis, lihat `logs/validation_log.md`).

## 2. Masalah

1. Pelaku usaha kelapa menghitung kapasitas gudang/container secara kira-kira, sering **salah memilih batas** (mengira berat, padahal volume yang habis duluan — terutama arang belah 2 dan kelapa jambul).
2. Spesifikasi dagang ambigu (contoh: "12–14 inch" untuk kelapa ternyata **keliling**, bukan diameter).
3. Kadar air kopra asalan (8–22%) mengubah berat secara signifikan, tapi jarang dikoreksi.
4. Tidak ada alat yang memperlihatkan **rentang** (min/typ/maks) — semua memberi satu angka seolah pasti.

## 3. Tujuan & Non-Tujuan

### Tujuan (Goals)
- G1. Menghitung kapasitas container (20GP, 40GP, 40HC) per komoditas, beserta **batas pengikat** (VOLUME vs BERAT).
- G2. Menghitung kebutuhan ruang & luas lantai gudang untuk stok tertentu.
- G3. Konversi satuan: butir ↔ kg ↔ karung ↔ m³ ↔ container.
- G4. Simulasi visual tata letak (2D denah + 3D isometrik) karung/tumpukan.
- G5. Setiap hasil menampilkan rentang & tingkat keyakinan data (A/B/C).
- G6. Pengguna bisa **mengkalibrasi** dataset dengan pengukuran sampling lapangan.

### Non-Tujuan (v1)
- Bukan ERP/akuntansi stok penuh (tidak ada harga, invoice, PO).
- Bukan optimasi bin-packing 3D presisi untuk benda tak beraturan (pakai pendekatan densitas curah + grid kemasan, lihat ADR-003).
- Tidak menangani dokumen ekspor/kepabeanan.

## 4. Persona

| Persona | Kebutuhan utama |
|---|---|
| **P1 – Pengepul/Gudang** | "Gudang saya 12×20 m, tinggi tumpuk 2,5 m — muat berapa ton kopra?" |
| **P2 – Eksportir** | "Berapa butir jambul per 40GP? Volume atau berat yang membatasi?" |
| **P3 – Produsen arang** | "Arang belah 2 vs dipecah — berapa selisih ton per container?" |
| **P4 – Admin data/QC** | Memasukkan hasil sampling (timbang, ukur) untuk mengkalibrasi dataset |

## 5. User Stories & Acceptance Criteria

| ID | Story | Acceptance Criteria (tervalidasi) |
|---|---|---|
| US-01 | Sebagai P2, saya memilih komoditas + container dan melihat kapasitas | Untuk `kelapa_jambul` + 20GP default, hasil ≈ **22.230 butir** (±10% dari benchmark 22.500), label `VOLUME-limited`. Golden case `jambul_20GP`. |
| US-02 | Sebagai P3, saya membandingkan bentuk arang | Lump/pecah 20GP ≈ **12,6 t** (benchmark 12–13 t); batok mentah belah ≈ **6,5 t** (benchmark 5–8 t). Golden case `arang_*`. |
| US-03 | Sebagai P1, saya input massa stok & tinggi tumpuk → luas lantai | 50 t, ρ 500, h 2,5 m, utilisasi 0,65 → **61,54 m²**. Golden case `warehouse_floor_area`. |
| US-04 | Sebagai P1, saya mengoreksi berat kopra karena kadar air | 1.000 kg @15% → 6% = **904,26 kg**. Golden case `moisture_correction`. |
| US-05 | Sebagai P3, saya menghitung tumpukan arang bersarang | Tinggi 100 cm, h cup 4,4 cm, pitch 1,2 cm → **80 keping/kolom**. Golden case `nested_stack_count`. |
| US-06 | Sebagai P2, saya melihat berapa karung muat (grid) | Karung 49×34×21 cm di 20GP → **924 karung** (benchmark 900–1000). Golden case `grid_fit_bags_20GP`. |
| US-07 | Sebagai pengguna, saya melihat rentang min–typ–maks | Setiap kartu hasil menampilkan 3 nilai + badge keyakinan A/B/C. |
| US-08 | Sebagai P4, saya input hasil sampling | Form sampling tersimpan sebagai `MEASUREMENT`; bila n ≥ 10, sistem mengusulkan override nilai typ (perlu approval). |
| US-09 | Sebagai pengguna, saya override parameter | Semua parameter bisa diedit per-skenario tanpa mengubah dataset dasar; hasil memberi tanda "custom". |
| US-10 | Sebagai pengguna, saya simpan & bagikan skenario | Skenario punya URL unik; bisa diekspor CSV/PDF. |
| US-11 | Sebagai pengguna, saya dapat peringatan keselamatan | Kopra asalan kadar air > 10% → peringatan *self-heating*; arang → peringatan mudah terbakar; kopra edible + asalan dalam satu ruang → peringatan kontaminasi bau. |

## 6. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Katalog 4 komoditas dari dataset versi terkunci | Must |
| FR-02 | Katalog container (20GP/40GP/40HC) + custom (input L×W×H, payload) | Must |
| FR-03 | Mode hitung: **A. Curah** (densitas), **B. Per-butir** (geometri), **C. Kemasan** (grid karung) | Must |
| FR-04 | Deteksi batas pengikat VOLUME vs BERAT | Must |
| FR-05 | Kalkulator ruang gudang (luas lantai, jumlah tumpukan, lorong) | Must |
| FR-06 | Konverter satuan dua arah | Must |
| FR-07 | Koreksi kadar air | Must |
| FR-08 | Mode rentang: hitung min/typ/max serentak | Must |
| FR-09 | Simulasi visual 2D denah & 3D isometrik | Should |
| FR-10 | Skenario simpan/ulang/bagikan, ekspor CSV & PDF | Should |
| FR-11 | Input sampling lapangan & kalibrasi dataset (dengan approval) | Should |
| FR-12 | Monte Carlo (opsional) untuk sebaran hasil | Could |
| FR-13 | Multi-bahasa ID/EN | Could |

## 7. Kebutuhan Non-Fungsional

| ID | Kebutuhan | Target terukur |
|---|---|---|
| NFR-01 | Kecepatan kalkulasi | < 50 ms per skenario di client (engine murni TS) |
| NFR-02 | Akurasi engine | 100% golden cases lulus pada toleransi yang tercantum |
| NFR-03 | Offline-first | Kalkulator jalan tanpa internet (PWA; dataset ter-bundle) |
| NFR-04 | Mobile | Layout bekerja di 360 px; target sentuh ≥ 44 px |
| NFR-05 | Traceability | Setiap angka default dapat ditelusuri ke `source_id` |
| NFR-06 | Audit | Setiap perubahan dataset tercatat di `AUDIT_LOG` + `logs/CHANGELOG.md` |
| NFR-07 | Satuan | Internal SI (m, kg, m³); tampilan cm/kg/ton |
| NFR-08 | Aksesibilitas | WCAG 2.1 AA kontras; angka tidak hanya dibedakan warna |

## 8. Metrik Keberhasilan

- ≥ 90% skenario uji pengguna menghasilkan selisih ≤ 10% dari realisasi muat (diukur lewat form "realisasi" setelah stuffing).
- Jumlah parameter berkeyakinan **C** turun dari **30 (dari 45 parameter unik; baseline v1.0.4: A=6, B=9, C=30)** → ≤ 12 setelah 3 bulan sampling. Angka baseline dihitung otomatis di `logs/validation_log.md` (`confidence_profile`); prioritas sampling di `logs/assumption_register.md`.
- Waktu menjawab "muat berapa?" < 30 detik dari buka aplikasi.

## 9. Rilis Bertahap

| Fase | Isi | Gate keluar |
|---|---|---|
| **M0 – Data** | Dataset v1.0.4 + validator + skema DB teruji (SELESAI) | `validate_dataset.py` exit 0 |
| **M1 – Engine** | Paket `calc-engine` TS + unit test golden cases | 17/17 golden case lulus |
| **M2 – UI Kalkulator** | Form + kartu hasil + rentang | Uji US-01..07 |
| **M3 – Simulator** | 2D denah, 3D isometrik | Uji US-06 visual = angka |
| **M4 – Data lapangan** | Sampling, kalibrasi, audit | Uji US-08 |

## 10. Risiko & Asumsi Kunci
Lihat `logs/risk_issue_log.md` dan `logs/assumption_register.md`. Risiko terbesar: **densitas arang belah 2 (loose/nested) belum ada data terukur publik** — default ditandai C dan wajib diuji ember/drum di gudang sebelum dipakai untuk keputusan muat.
