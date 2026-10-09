---
doc: Research Report (Fase P)
title: Parameter Alur Proses Kelapa — loading, kupas sabut, belah, jemur, cungkil, batok & arang
version: 1.0.0
date: 2026-10-09
related: [data/coconut_process_dataset.json, data/coconut_inventory_dataset.json, ../02-architecture/adr/ADR-007-process-dataset.md]
---

# Riset Parameter Alur Proses (Fase P)

Permintaan owner (2026-10-09): kalkulator alur proses dari kelapa masuk sampai produk jadi, dipisah per asal (dataran tinggi / rendah). Dataset utama `coconut_inventory_dataset.json` fokus pada **dimensi & muat**, tidak memuat parameter proses. Laporan ini mendokumentasikan riset tambahan; angka masuk ke `data/coconut_process_dataset.json` (terpisah & ber-versi, ADR-007). Parameter yang SUDAH ada di dataset utama (massa kopra per butir, rendemen arang, kadar air produk, kemasan) **dirujuk, tidak disalin**.

Skala keyakinan sama dengan dataset utama: **A** jurnal/standar terukur, **B** data dagang/lembaga konsisten, **C** estimasi/turunan/satu studi kecil — wajib diverifikasi sampling.

## 1. Komposisi buah kelapa utuh (bersabut), basis basah

| Komponen | Typ | Rentang | Sumber |
|---|---|---|---|
| Sabut | 35 % | 33–50 % | P01 FAO/PCA (35); P03 TNAU (50); P04 FAO Tree of Life (35) |
| Batok (tempurung) | 12 % | 12–20 % | P01 (12); P03 (15); P05 MDPI 2024 (~15); P06 (12–20) |
| Daging (kernel) | 28 % | 25–28 % | P01 (28); P03 (25) |
| Air kelapa | sisa | — | dihitung `1 − sabut − batok − daging` agar neraca massa 100 % |

Catatan: air dihitung sebagai sisa (bukan parameter bebas) supaya evaluasi sudut rentang tidak menghasilkan neraca > 100 %. Serat sabut (coir) 80–90 g/butir (P04).

## 2. Asal kelapa: dataran rendah vs dataran tinggi

Sumber utama P07 Hartawan & Sarjono (2016), Jambi, survei 3 petani per ekologi; batas ketinggian: pasang surut 0–10, rendah 10–100, sedang 100–500, **tinggi > 500 m dpl**.

| Ekologi | Lingkar buah (cm) | Buah bersabut (kg) | Buah tanpa sabut (kg) |
|---|---|---|---|
| Pasang surut | 61,63 | 1,73 | 1,01 |
| Dataran rendah | 59,00 | 1,80 | 1,07 |
| Dataran sedang | 63,03 | 1,73 | 0,97 |
| Dataran tinggi | 55,53 | 1,45 | 1,45 ⚠ |

- Aplikasi memakai **2 kelompok** sesuai permintaan owner: **dataran rendah ≤ 500 m dpl** (gabungan pasang surut/rendah/sedang: 1,73–1,80 kg, typ 1,75 = rata-rata) dan **dataran tinggi > 500 m dpl** (1,45 kg).
- ⚠ Nilai "tanpa sabut" dataran tinggi (1,45) sama dengan berat bersabut — tidak mungkin secara fisik (kemungkinan salah ketik di jurnal). **Tidak dipakai.**
- Fraksi buah tanpa sabut di dataran rendah: 1,01/1,73 = 0,584; 1,07/1,80 = 0,594; 0,97/1,73 = 0,561 → **fraksi sabut = 0,406–0,439 (typ 0,42)**, keyakinan C. Dataran tinggi memakai fraksi sabut umum (§1: 0,33–0,50, typ 0,35) dengan keyakinan C.
- Studi lain (P08 UNIKS, Bone vs Selayar) mendukung arah: buah dataran tinggi lebih kecil & ringan karena fotosintesis lebih rendah. Optimal produksi 0–450 / 100–500 m dpl (P07, P09).
- Semua angka asal = **C** (satu studi, sampel kecil, satu provinsi) → UI wajib menampilkan badge C & mengajak sampling per lot.

## 3. Daging segar → kopra (pengeringan)

| Parameter | Typ | Rentang | Sumber |
|---|---|---|---|
| Kadar air daging segar | 50 % | 45–55 % | P10 CPCRI TB15 (45–55); P03 TNAU (40–50); P11 Mohanraj 2008 (51,8–52) |
| Target kadar air kopra | dari dataset utama | edible ≤ 6 %, asalan typ 12 % | dataset utama `moisture_pct` |

Massa kopra = massa daging segar × (1 − w_awal) / (1 − w_target) (rumus koreksi kadar air calc_spec §5). Cek silang: 1,75 kg × 28 % = 0,49 kg daging @50 % → 0,26 kg kopra @6 % ≈ dataset utama `copra_per_nut_g` typ 250 g ✔.

### Metode pengeringan

| Metode | Lama | Sumber |
|---|---|---|
| **Jemur matahari langsung** | 7 hari (5–10) | P12 Thanaraj 2007 (6 hari → 10 %); P10 CPCRI (7–10 hari); P03 TNAU (±8 hari); P11 (7 hari → 9,2 %) |
| **Greenhouse / pengering surya** | 3,5 hari (2,2–4) | P03 TNAU (3–4 hari); P10 CPCRI (3,5–4 hari, −50 %); P13 tunnel 52–57 jam; P11 82 jam |
| **Oven / kiln udara panas** | 36 jam (24–62) | P03 TNAU (24 jam medium-holder; 36 jam smallholder); P10 CPCRI elektrik (30 jam); P12 CRI kiln (62 jam) |

Suhu oven acuan 60–90 °C (P14 Guarte 1996: 90 °C optimum; P15 hybrid 60–70 °C) — informasi, bukan input hitung.

### Kepadatan rak (belahan per m² per susun)

Tidak ada sumber yang langsung memberi kg/m² yang konsisten. Diturunkan dari **geometri**: belahan diletakkan satu lapis, grid persegi selebar diameter mulut batok mentah (dataset utama `geometry.raw_half_shell.rim_diameter`, 8–14 cm, typ 9,5) → `belahan/m² = 1 / d²` → typ ≈ 111, rentang 51–156. Keyakinan **C** (turunan). Pengguna dapat mengganti dengan hitungan nyata raknya.

## 4. Batok → arang

| Parameter | Typ | Rentang | Sumber |
|---|---|---|---|
| Rendemen arang | dataset utama `charcoal_yield_mass_fraction` (0,25–0,35) | — | dirujuk |
| Isi drum 200 L per angkatan | 25 kg batok | 15–25 kg | P16 Arief 2023 |
| Lama bakar | 5 jam | 4–6 jam | P16 |
| Pendinginan | 1 jam | — | P16 |

Catatan: P16 melaporkan rendemen 40–48 % dengan drum bersegel; P17 (coconut board India) ±35 kg arang / 1.000 batok; P18 heat-recovery 33 %. Rentang dataset utama (25–35 %, C) dipertahankan; selisih dicatat sebagai temuan untuk kalibrasi M4.

## 5. Sumber

| ID | Sumber | URL | Grade |
|---|---|---|---|
| P01 | FAO — Tropical Palms, Tabel 9-10 Components of Whole Coconut (Phil. Coco. Auth. 1979) | https://www.fao.org/4/i1590e/i1590e10.pdf | A |
| P03 | TNAU Agritech — Coconut processing & post-harvest | http://www.agritech.tnau.ac.in/expert_system/coconut/coconut/coconut_harvest_postharvest.html | B |
| P04 | FAO — Coconut: Tree of Life | https://www.fao.org/4/Y3612E/y3612e03.htm | A |
| P05 | Vieira et al. 2024, Sustainability 16(7):3066 | https://www.mdpi.com/2071-1050/16/7/3066 | A |
| P06 | Coconut weight & water content analysis | https://www.scribd.com/document/880532501/Coconut-1 | C |
| P07 | Hartawan & Sarjono 2016, Jurnal Media Pertanian 1(2):45–54 | https://jagro.unbari.ac.id/index.php/agro/article/view/15 | A |
| P08 | Morphological characteristics of Cocos nucifera, Bone & Selayar (JUATIKA 2021) | https://ejournal.uniks.ac.id/index.php/JUATIKA/article/view/1503 | A |
| P09 | Tinjauan pustaka tanaman kelapa (UIR) | https://repository.uir.ac.id/4350/5/7%20BAB%202.pdf | C |
| P10 | CPCRI Technical Bulletin 15 — Solar and electrical copra dryers | https://cpcri.gov.in/filemgr/webfs/publication/tb15.pdf | A |
| P11 | Mohanraj & Chandrasekar 2008, Biosystems Eng. — forced convection solar drier | https://www.sciencedirect.com/science/article/abs/pii/S1537511007003583 | A |
| P12 | Thanaraj et al. 2007, J. Food Eng. — CRI kiln vs sun drying | https://www.sciencedirect.com/science/article/abs/pii/S0260877406000616 | A |
| P13 | Sai Krishna 2018 — Solar dryer for copra (thesis, review tunnel dryer) | http://14.139.181.140:8080/xmlui/bitstream/handle/123456789/395/T400.pdf?sequence=1 | B |
| P14 | Guarte et al. 1996, Postharvest Biol. Technol. — drying characteristics of copra | https://www.sciencedirect.com/science/article/abs/pii/S0925521496000324 | A |
| P15 | Dharmasena 2007 — solar hybrid dryer vs improved kiln | https://fileserver-az.core.ac.uk/download/52172577.pdf | A |
| P16 | Arief et al. 2023 — Coconut shell carbonization using smokeless kiln | https://www.cabidigitallibrary.org/doi/pdf/10.5555/20230241177 | A |
| P17 | Coconut Development Board India — Shell charcoal (drum method) | https://coconutboard.gov.in/images/TMOC/Pdf/ProcessingTechnology/shellchar-process.pdf | B |
| P18 | CORD — coconut shell carbonization with waste heat recovery | https://journal.coconutcommunity.org/index.php/journalicc/article/download/247/210 | B |
