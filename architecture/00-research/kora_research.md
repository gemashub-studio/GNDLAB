---
title: Riset & Validasi Dokumen KORA — Formula R&D, Produksi per Shift, Ceklis
date: 2026-10-10
status: draft v1 (Fase F) — angka bersumber; GAP ditandai
related: [data/coconut_process_dataset.json, process_research.md, ../07-rnd/PRD_RnD.md, ../logs/assumption_register.md]
---

# Riset & Validasi Dokumen KORA

Permintaan owner (2026-10-10): kalkulator formula R&D **kopra, arang, briket shisha, briket BBQ, briket custom, cuka air kelapa, bioleather**; formula produksi **per shift**; **ceklis R&D, QC, produk**. Sumber utama: folder `Downloads/kora` milik owner (dokumen internal KORA), divalidasi silang dengan literatur.

## 1. Inventaris folder KORA

- 100 berkas, 54 dokumen unik setelah deduplikasi MD5 (banyak salinan `_1`, `(1)`, "Claude outputs", "baru").
- Versi acuan (terbaru, Rev 03 Sep 2026): `New folder/baru/SOP_Kopra_KORA.docx` (KORA-SOP-KPR-01), `SOP_Arang_KORA.docx` (KORA-SOP-ARG-01), `SOP_Turunan_Air_Kelapa_Cuka_Bioleather_KORA.docx` (KORA-SOP-AKL-01), `Form_Ceklis_QC_Kopra/Arang` (KORA-FRM-KPR-01/ARG-01), `Form_Ceklis_QC_Penyimpanan`, `Modul_QC_KORA_COCONUT.docx` (QC-KC-2026-01: kopra edibel/asalan, briket shisha, briket BBQ), `Modul_QS_Arang_Batok_Kelapa_Ekspor.docx` (QS-ABK-001), `RnD_Ronde1_Kopra_Edible_Air_Kelapa_40kg.pdf`, `Tracker_RnD_Ronde1_Kopra_AirKelapa_20kg.xlsx`, `Kebutuhan_dan_Anggaran_RnD_*.xlsx`, `Daftar_Belanja_RnD_Ronde1.pdf`, `KPI_Scoring_Fee_Bogor_Area.xlsx`, `air/` (standar & hasil uji air sumur bor).
- Tidak dibuka/dijalankan: `*.exe`, `*.winmd` (installer — bukan data). Tidak diekstrak: `GEMA SASTRA NASUTION.docx` (dokumen pribadi, di luar lingkup).
- Teks diekstrak tanpa instal paket (zip+XML untuk docx/pptx/xlsx, `pdftotext` untuk PDF); simbol PDF (≤, ≈, ×) rusak di ekstraksi → angka dibaca ulang dari docx/xlsx bila ada.

Kualitas dokumen: SOP Rev 03 sudah memisahkan angka **VALID (bersumber)** vs **STANDAR INTERNAL** vs **GAP** — sangat membantu; aplikasi meneruskan pembedaan ini sebagai keyakinan A/B/C.

## 2. Peta stasiun kerja (KPI Scoring & SOP)

| WS | Stasiun | Input → Output | Key measure |
|---|---|---|---|
| 2.A | Gudang kelapa masuk | kelapa → stok berlot | selisih stok ≤1% |
| 2.B | Jagal belah dua | kelapa → belahan + air kelapa + sabut | butir/jam, % patuh 4 jam |
| 2.C | Jagal butik | batok → cacah ±2,5 cm | kg/jam |
| 2.D / 2.E | Kopra asalan: congkel / potong | belahan muda → daging → potongan | rendemen daging |
| 2.F | Kopra edible | belahan tua → kopra putih | kg kopra/1.000 butir, rasio Edible |
| 1.A / 1.A.1 | Karbonisasi kombi / pengasapan kopra | batok → arang; daging → kopra asap | rendemen arang; yield kopra asap |
| 1.B / 1.C | Pirolisis kolam / drum (jet burner) | batok → arang + asap cair | rendemen, L oli/kg arang, L asap cair/kg batok |
| 3.A / 3.B | Hammer mill / ayak sortase | arang/residu → serbuk → Granule/Mesh-2/Powder | kg/jam, rendemen per fraksi |

Produksi per shift = stasiun pembatas (bottleneck) di rantai ini → dasar kalkulator shift (§6).

## 3. Parameter yang diambil (ringkas; detail & sumber di `data/coconut_formula_dataset.json`)

### 3.1 Kopra (KORA-SOP-KPR-01)
- Grade KA akhir: Edible ≤6,0% (ICC Grade A), Reguler 6,1–8,0% (ICC B), Asalan 8,1–13,9% (ICC C), >13,9% wajib re-dry. Jangan <±4,5% (rapuh).
- Aturan **4 jam** belah → pengering (FAO/APCC; BAFS). Alarm KA ≤35% di 24 jam, ≤20% di 48 jam (FAO HACCP).
- Oven (Yani et al. 2022, JIPI 27(3)): listrik 68°C 13 jam → KA 5%; biomassa 70°C 27 jam → 4,62%; limbah panas ketel 68°C 7,9 jam → 5%. Profil kerja 55–60°C (0–4 jam) lalu 65–70°C; **maks 70°C, jangan >75°C**.
- Greenhouse 3×10×3,5 m (105 m³): ±108 jam (E3S 2024); data KORA 3–5 hari kemarau, 6–9 hari hujan; kapasitas ±1.600–2.000 butir/batch.
- Belerang: 1,5–2 g/butir (internal) ≈ 20–30 g/m³; maks 4 malam (100/50/25/25%); ≥3 malam wajib uji SO₂; UE ≤50 mg/kg.
- Rendemen kopra ±150–250 kg/1.000 butir (FAO/ILO); kopra asap ±0,5 kg/kg daging segar (teoretis).

### 3.2 Arang batok (KORA-SOP-ARG-01)
- Suhu reaktor target 450–500°C (koreksi dari 70–150°C di SOP lama). Rendemen acuan 28–36% (Hudaya & Hartoyo 1990; Unila; FAO/APCC 3:1); **KORA aktual ±20%** → target ≥25% (3 bln), ≥28% (6 bln).
- Standar arang: SNI 01-1682-1996 (KA ≤6%, abu ≤3%, VM ≤15%) & ICC (KA <10%, abu ≤2%, FC ≥75%, benda asing ≤0,5%, ≤5% lolos 6,3 mm).
- Mati hampa ≥8 jam/semalam, tanpa air (Unila: disiram air → KA 29,9% vs 8,5%). Weathering ekspor ≥14 hari & ≤40°C saat packing (IMDG Amdt 42-24 SP 978, wajib 2026).
- Fraksi (usulan KORA, perlu konfirmasi): Granule 2,0–6,3 mm; Mesh-2 0,6–2,0 mm; Powder <0,6 mm.
- Asap cair ±0,25–0,30 L/kg batok (indikatif).

### 3.3 Briket shisha & BBQ (Modul QC KORA COCONUT + riset)
- Shisha: KA ≤5–8%, abu ≤2–3%, FC ≥75–80%, kalor ≥7.000 kkal/kg, bakar ≥60–120 mnt/kubus, nyala 8–10 mnt, densitas 0,9–1,1 g/cm³, kubus mis. 25 mm ±1 mm, abu putih, tanpa percikan.
- BBQ (pillow 5×10 cm): air adonan 22–28%, KA jadi ≤5–8%, abu ≤3–5%, FC ≥70–75%, densitas 0,9–1,2 g/cm³, bakar 2–3 jam, cacat ≤5%. Proses: kanji tergelatinisasi ≥65°C (air panas:dingin ±70:30), aging semalam, angin 2–6 jam, oven 60–90°C bertahap 8–24 jam.
- **Dosis perekat tidak ada di KORA (GAP)** → diisi dari FAO Forestry Paper 63 bab 11: pati **4–8%** dalam pasta air panas, oven ±80°C (keyakinan B). Jurnal: 4% tapioka → 6.930 kal/g (Milya 2023, cangkang sawit); 10% tapioka → briket tempurung 5.975 kal/g, abu 7,1% (BRIN JPHH 2026). Makin banyak perekat → kalor turun (abu & VM naik).
- Air proses perekat (KORA `air/`): TDS <300 ppm, pH 6,5–8,5, Fe <0,3 mg/L; sumur bor KORA TDS 151 ppm, EC 303 µS/cm, **pH 5,92 (sedikit asam)**, Fe belum diukur — Fe memengaruhi warna abu.

### 3.4 Cuka air kelapa (KORA-SOP-AKL-01 Bagian B)
- Air kelapa: gula ±1–2,6%, ±4–5 °Brix, pH 5,0–5,7; pH <4,5 dalam 40–60 jam di suhu ruang → ≤10°C dalam ≤2 jam, olah ≤48 jam.
- Must 14–17 °Brix (target 15); pasteurisasi 60–65°C 10–15 mnt; ragi 1–4 g/L (PCA 0,7–0,8; Trinh Ngoc 4); 28–30°C 7–14 hari; starter cuka 10–20% v/v; asetifikasi 27–30°C 3–6 minggu; target asam asetat ≥4% (target KORA 5%), sisa alkohol ≤0,5% (Codex CXS 162); klarifikasi putih telur 7–9 g/L; pasteurisasi botol 60–71°C ≥30 mnt.
- Konversi: ±1% alkohol → ±1% asam asetat; ≥8% alkohol untuk 4% asam.

### 3.5 Bioleather (KORA-SOP-AKL-01 Bagian C)
- Media per L: sukrosa 100 g (10%), ZA 5 g (0,5%), pH 4,0–4,5 dengan cuka; didihkan/75°C 15 mnt; starter K. xylinus 10–15% v/v; statis 28–30°C 7–21 hari; target tebal basah 10–20 mm.
- Pemurnian NaOH 0,1 M (4 g/L) 60–70°C 1 jam (batas keras: NaOH 2–8% merusak serat); netralisasi asam asetat ±0,5%.
- Plastisasi: A gliserol 1% 33 jam; B gliserol 30% berat BC; C gliserin:etanol 100:200 mL. Kering 30–40°C sampai berat konstan.
- Hasil: panen berkala ±19 g/L/hari basah (vs 12,4 sekali panen); berat kering ±1–1,5% berat basah (8,17 dari 625,6 g/L).
- QC: kuat tarik ≥20 MPa (ISO 3376), lipat ≥100×, tebal seragam ±10%.

## 4. Validasi & eksperimen hitung (E1–E7)

| Kode | Uji | Hasil | Status |
|---|---|---|---|
| **E1** | Rumus gula must SOP `(B−b)×V÷100` vs neraca massa `M·(B−b)/(100−B)`, M = V·ρ (ρ≈1,02) | SOP **kurang ±16,7%**: 100 L dari 4→15 °Brix: SOP 11,0 kg, benar ±13,2 kg; dengan rumus SOP Brix akhir hanya **13,35** (di batas bawah 14–17). Tracker R&D memakai rumus SOP yang sama | **Koreksi** — engine pakai neraca massa; tampilkan juga angka rumus lama untuk pembanding |
| **E2** | Titrasi asam asetat | Rumus ringkas `0,06005×V` benar HANYA untuk NaOH 0,1 N & sampel 10 mL. Rumus umum di teks SOP B6.2 `V×N×60,05÷(10×Vs)×100÷10` memberi **10× terlalu besar** (70 mL → 42% bukan 4,2%). Daftar belanja membeli **NaOH 0,5 N & pipet 5 mL** → rumus ringkas melapor 0,84% padahal 8,41% | **Koreksi** — engine: `% = V·N·6,005 ÷ Vs`; N & Vs wajib diisi |
| E3 | Rendemen kopra 53% dari daging segar | Neraca air: daging KA 50% → kopra 6%: 0,532 (KA 45–55% → 0,48–0,59) | Konsisten |
| E4 | Alkohol & asam teoretis | 15% gula → ±9,1% v/v (efisiensi 92% glukosa) → asam asetat maks ±9,4% b/v; Gunathilake 17% → ±9% teramati (efisiensi ±80%) | Konsisten; engine pakai efisiensi sebagai parameter rentang |
| E5 | Neraca adonan briket | 100 kg arang (KA 6%) + tapioka 5% → air ±26 kg untuk adonan 25% → ±105 kg briket KA 6% | Model engine |
| E6 | Kubus shisha | 25 mm × ρ 0,9–1,1 g/cm³ → 14,1–17,2 g/butir (58–71 butir/kg) | Model engine |
| E7 | Kapasitas greenhouse | 117 m² rak × 25–30 belahan/m² → 1.460–1.755 butir | Konsisten dengan 1.600–2.000 |

## 5. Konflik antar-dokumen / dengan dataset proses (K-01…)

| Kode | Konflik | Keputusan |
|---|---|---|
| K-01 | **Pendinginan arang**: dataset proses v1.0.0 `charcoal_kiln.cooling_h` = 1 jam (C) vs SOP KORA mati hampa ≥8 jam/semalam (CDB India, FAO) | Dataset proses → **v1.1.0**: cooling 8/10/12 jam (B). Risiko keselamatan (arang menyala ulang) |
| K-02 | **Suhu oven kopra**: dataset proses 60/70/90°C vs KORA maks 70°C, jangan >75°C (IPB 2022) | Dataset proses v1.1.0: 55/68/70°C (A, Yani 2022) + peringatan >70°C |
| K-03 | **Batas dataran**: dataset proses ≤500/>500 mdpl (studi P07) vs KORA DR <100, DT ≥600 mdpl | Klasifikasi lot ikut **definisi operasional KORA**; angka komposisi buah tetap P07. **GAP: 100–600 mdpl tidak berkelas** → tanya owner |
| K-04 | **SNI 01-6235-2000** (briket): Modul QS & banyak jurnal mencantumkan FC ≥77%, kerapatan 0,5–0,6, kuat tekan ≥25; SOP Arang hanya KA ≤8, abu ≤8, VM ≤15, kalor ≥5.000 | Teks resmi tidak dapat diakses (BSN). Pakai 4 parameter yang konsisten di semua sumber (B); FC 77% ditandai "perlu cek BSN" |
| K-05 | Kalor shisha: Modul QS ≥7.500 kal/g vs Modul QC ≥7.000 kkal/kg (kal/g = kkal/kg) | Pakai ≥7.000 (C, spesifikasi pembeli). 7.500 mendekati karbon murni (±7.830); data jurnal briket tapioka 5.975–6.930 kal/g |
| K-06 | Produktivitas belah: SOP lama 300–500 butir/shift vs SOP baru ±7.000 butir/hari (ILO/FAO) | Rentang lebar → parameter C, wajib time study 2 minggu (sudah rencana KORA) |
| K-07 | Starter bioleather: SOP AKL 10–15% vs SOP Kopra C4 2–10% (Lin 2022) | Dipakai 10–15% (SOP AKL lebih baru & spesifik); 2% dicatat sebagai batas bawah literatur |
| K-08 | Gula media bioleather: SOP AKL 10% vs SOP Kopra C4 8–10% | 8/10/10% |

## 6. Model produksi per shift (dirancang)

`output_shift = min_s(kapasitas_s)`; `kapasitas_s = laju_s × orang_s × jam_efektif` (stasiun manual) atau `batch_s × (jam_shift ÷ siklus_s)` (stasiun batch: oven, tungku, greenhouse). Jam efektif = jam shift × (1 − istirahat & setup). Engine mengembalikan kebutuhan bahan (mundur dari target), stasiun pembatas, dan utilisasi tiap stasiun. Laju dari §3/SOP B2.1 (keyakinan C, wajib time study).

## 7. GAP (perlu data owner / uji internal)

1. Dosis perekat briket KORA aktual & jenis (tapioka/molase) — dipakai FAO 4–8% sementara.
2. Dimensi tebal pillow BBQ (hanya 5×10 cm) & berat per biji.
3. Kapasitas mesin press/cetak briket (kg/jam) & oven briket (kg/batch).
4. Kelas lot 100–600 mdpl (K-03).
5. Teks resmi SNI 01-6235-2000, 01-1682-1996, 01-4371-1996, 01-3946-1995 (cek BSN).
6. Kadar Fe air proses (uji lab / Hanna HI97746).
7. Rendemen liter cuka per liter air kelapa; umur simpan cuka & bioleather KORA.
8. Kedalaman baki optimum bioleather (uji 3/5/8 cm).

## 8. Keputusan desain (lihat ADR-009)
- Parameter formula = **data bersumber** (`coconut_formula_dataset.json`), engine murni, UI hanya presentasi.
- Ceklis (R&D, QC, produk) = **data** dalam dataset yang sama, ditelusuri ke kode form KORA (F-K, F-A, F-C) — bukan hardcode di komponen.
- Draf parameter R&D untuk M5 dibangkitkan dari dataset ini (`07-rnd/parameter_kora_draft.csv`) — menunggu konfirmasi owner sebelum diimpor.
