---
doc: Research Report
title: Dimensi, Berat & Densitas — Kelapa Jambul, Arang Batok Belah 2, Kopra Asalan, Kopra Edible
dataset_version: 1.0.4
date: 2026-10-08
---

# Laporan Riset

Ringkasan angka rujukan. Data lengkap (min/typ/max, sumber, keyakinan) ada di `data/coconut_inventory_dataset.json`; semua angka di bawah lolos `scripts/validate_dataset.py` (lihat `../logs/validation_log.md`).
Keyakinan: **A** jurnal/standar · **B** data dagang konsisten · **C** estimasi turunan, wajib diverifikasi.

## 1. Kelapa Tua Jambul (semi-husked)

| Atribut | Nilai typ (rentang) | Keyakinan |
|---|---|---|
| Panjang badan (polar) | 10,5 cm (9–12,5) | C (berbasis A) |
| Diameter ekuator | 9,5 cm (8,5–11,5) | C (berbasis A) |
| Tambahan panjang jambul | 3 cm (2–5) | C |
| **Kotak pembatas (P×L×T)** | **13,5 × 9,5 × 9,5 cm** | C |
| Keliling | 33 cm (30–36) — spek dagang "12–14 inch" adalah **keliling** | B |
| Berat per butir | 575 g (450–850); ekspor standar 500–650 g, premium 700–850 g | B |
| Densitas tumpukan lepas | 483 kg/m³ (445–520) | A |
| Densitas efektif dalam karung di container | 385 kg/m³ (360–410) | C |
| Kemasan | Karung jaring PP 25 butir ≈ 14 kg; dimensi efektif terisi 49×34×21 cm | B / C |
| Muat container | 20ft ≈ 22.500 butir (900–1000 karung); 40ft ≈ 45.000–47.500 | B |
| Batas pengikat | **Volume** (20ft hanya ~45% payload terpakai) | – |
| Umur simpan | 30–45 hari ambien; ≈ 75 hari sejak stuffing | B |

## 2. Arang Batok Kelapa Belah 2

| Atribut | Nilai typ (rentang) | Keyakinan |
|---|---|---|
| Batok mentah belah 2 — diameter bibir | 9,5 cm (8–14) | B |
| Batok mentah — kedalaman / tebal dinding | 5,0 cm (4–6,5) / 0,4 cm (0,3–0,6) | C |
| Susut linier karbonisasi | 12% (8–18%) | C |
| **Arang belah 2 — diameter bibir** | **8,4 cm (6,6–12,9)** | C |
| **Arang belah 2 — kedalaman / tebal** | **4,4 cm (3,3–6,0) / 0,35 cm (0,25–0,55)** | C |
| Berat per keping | mentah 85 g (60–120) → arang 25 g (15–42) | C |
| Rendemen massa | 30% (25–35%) | C |
| Densitas arang belah 2 **lepas** | **85 kg/m³ (50–155)** — turunan fisik, belum ada data publik | C ⚠ |
| Densitas arang belah 2 **bersarang** | 145 kg/m³ (85–270) | C ⚠ |
| Densitas arang pecah/lump (perdagangan umum) | 475 kg/m³ (400–550) | B |
| Muat container (lump, karung 25 kg) | 20ft 12–13 t; 40HC ≈ 26 t | B |
| Muat container (batok mentah belah) | 20ft 5–8 t; 40HC 10–16 t (volume-limited) | B |
| Batas pengikat | **Volume** untuk bentuk belah 2; **berat** untuk lump di 40HC | – |

> ⚠ Bentuk belah 2 sangat boros ruang. Sebelum memesan container untuk arang belah 2 utuh, lakukan uji kotak volume terukur (lihat `../logs/field_verification_log.md`).

## 3. Kopra Asalan (asap/campur, mutu petani)

| Atribut | Nilai typ (rentang) | Keyakinan |
|---|---|---|
| Potongan (P × L × tebal) | 8 × 5 × 1,1 cm (4–14 × 3–9 × 0,8–1,6) | C |
| Berat per potong | 60 g (25–130) | C |
| Rendemen | 4 butir per kg kopra (3,5–5) ≈ 250 g kopra/butir | B |
| Kadar air | 12% (8–22%); kopra asap tradisional sering 15–22% | A |
| Kadar minyak | 60% (55–65%) | C |
| Densitas curah | 500 kg/m³ (440–545); stowage factor 1,84–2,27 m³/t | A |
| Densitas dalam karung goni | 440 kg/m³ (400–460) | A |
| Bahaya | Pemanasan sendiri bila basah (UN 1363), debu mudah terbakar, bau tajam | A |

## 4. Kopra Edible (kopra putih, cup)

| Atribut | Nilai typ (rentang) | Keyakinan |
|---|---|---|
| Ukuran cup (diameter/panjang) | 8 cm (4–10); permintaan buyer umum "≤ 9 cm" | B |
| Kedalaman / tebal | 4 cm (2,5–6) / 1,2 cm (0,8–1,6) | B |
| Berat per keping | 80 g (15–180) | C |
| Kadar air | 5% (4–6%) — SNI 01-3946-1995 maks 5%, APCC maks 6% | A |
| Mutu | ALB ≤ 2%, minyak ≥ 60%, jamur nihil | A |
| Densitas dalam karung di container | 320 kg/m³ (300–355) | B |
| Kemasan | Karung 25–50 kg | B |
| Muat container | 20ft 10–11 t (karung 25 kg); 40ft/HC 24–27 t | B |

## 5. Lembar Dimensi per Produk (unit + kemasan)

Satu tabel ringkas untuk input simulator. Semua dimensi kemasan adalah **dimensi efektif terisi** (kotak pembatas di tumpukan), sudah diuji: volume kotak ≥ volume isi, muat dalam karung datar, dan grid-fit cocok dengan benchmark container (bila ada).

| Produk | Unit: kotak pembatas (P×L×T, cm) | Berat unit | Kemasan | Karung datar (cm) | **Karung terisi (P×L×T, cm)** | Isi | Per 20GP (grid) |
|---|---|---|---|---|---|---|---|
| Kelapa jambul | 13,5 × 9,5 × 9,5 | 575 g | Jaring PP | 50 × 80 | **49 × 34 × 21** | 25 butir ≈ 14 kg | 924 karung ≈ 23.100 butir |
| Arang batok belah 2 (utuh) | Ø8,4 × 4,4 (tebal 0,35) | 25 g | – | – | ⚠ uji kotak dulu (ρ 50–155) | – | volume-limited |
| Arang batok (lump, umum dijual) | – | – | PP woven | 56 × 90 | **64 × 45 × 21** | 25 kg | 495 karung ≈ 12,4 t |
| Arang batok (curah besar) | – | – | Jumbo bag | – | **95 × 95 × 130** | 550 kg | 12 bag ≈ 6,6 t (tidak efisien) |
| Kopra asalan | potong 8 × 5 × 1,1 | 60 g | Goni/PP | 70 × 110 | **88 × 55 × 27** | 50 kg | ≈ 13 t (prediksi, belum ada benchmark) |
| Kopra edible | cup Ø8 × 4 (tebal 1,2) | 80 g | Jaring/goni | 60 × 100 | **79 × 53 × 18** | 25 kg | 429 karung ≈ 10,7 t |

## 6. Container Acuan

| Tipe | Dimensi dalam (cm) | Volume | Payload |
|---|---|---|---|
| 20GP | 589,8 × 235,2 × 239,3 | 33,2 m³ | 28.200 kg |
| 40GP | 1203,2 × 235,2 × 239,3 | 67,7 m³ | 26.700 kg |
| 40HC | 1203,2 × 235,2 × 269,8 | 76,3 m³ | 26.500 kg |

## Sumber
Daftar lengkap 22 sumber (S01–S24) dengan URL & grade ada di dataset `sources[]`. Proses pencarian tercatat di `../logs/research_log.md`.
