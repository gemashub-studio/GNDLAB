# Riset Rantai Produksi — Kelapa Jambul → Kopra · Air Kelapa · Arang · Briket · Bioleather (Fase G)

Disusun 2026-10-10 untuk permintaan owner Fase G. Dataset hasil riset: `00-research/data/coconut_chain_dataset.json` (v1.0.0, ADR-010).
Angka yang sudah ada di dataset inventory/proses/formula **dirujuk** (field `*_ref`), tidak disalin ulang.

## 1. Ringkasan jawaban atas permintaan owner

| Permintaan | Jawaban riset | Keyakinan |
|---|---|---|
| Berat & diameter rata-rata kelapa tua jambul | **575 g (450–850)**, diameter ekuator **9,5 cm (8,5–11,5)**, keliling 33 cm (30–36) — sudah ada di dataset inventory (`kelapa_jambul`, ICAR + data dagang). Silang-cek SPIL: 4–5 butir per kg kopra; Ikatrinasari 2026: kopra 176 g/butir (dalam), 135 (hibrida), 92 (genjah). | A/B/C |
| Transport berbagai truk & container (ft) | 10 tipe truk (pickup → tronton wingbox) dari Deliveree, SNG Logistic, Astra UD; container 20GP/40GP/40HC dari inventory + **45HC** (Hapag-Lloyd/Maersk). Kapasitas = min(batas volume grid karung, batas payload). | B (container) / C (truk) |
| Catat asal & pisahkan DR/DT | Kelas **DR ≤500 mdpl**, **DT >500 mdpl** (keputusan owner K-03) — menggantikan kode KORA lama <100 / ≥600 yang menyisakan celah 100–600 mdpl. Kode lot `{KELAS}-{YYMMDD}-{NNN}`. DR & DT tidak boleh dicampur di tahap mana pun. | C (keputusan) |
| Pengaruh asal terhadap batok/arang/briket | **GAP**: tidak ditemukan studi terukur ketinggian kebun → abu, FC, kekuatan, warna abu batok. KORA hanya menduga DT lebih padat/FC lebih tinggi. Studi Jember (Nuraisyah 2021, dataran rendah/sedang/tinggi) hanya mengukur bobot buah/sabut/air/tempurung/daging; tabel lengkap tidak dapat diambil. ⇒ kalkulator campuran memakai **hasil lab per lot**. | GAP |
| Sortir saat belah + penanganan | 5 kelas (normal, kurang tua, bertunas, retak, busuk) dengan rute edible/reguler/asalan/reject; syarat edible daging ≥1 cm (KORA); kelapa standar pengepul ≥0,6 kg bersabut (Ikatrinasari). Proporsi grade industri: dalam 15/60/25 %, hibrida 40/40/20 % (edible/reguler/reject). | A/C |
| Penampungan air kelapa | Dinginkan **<10 °C maksimal 2 jam** sejak keluar buah (KORA); batas simpan dingin dirujuk dari formula cuka (`water_max_cold_h`). | C |
| Greenhouse: rak, kemiringan, tray, kipas, belerang | Contoh KORA 3×10×3,5 m: 3 rak 0,65×10×3 m, 6 tingkat, jarak tingkat **0,5 m**, lorong ±0,5 m, ruang atap 0,5 m, pusat belahan ±18 cm → 25–30 belahan/m². Kemiringan: hari 1–2 **telungkup**, hari ≥3 terlentang **15–30°**; tray rak berkipas **10–15°** ke exhaust; oven ±10°. Kipas **2–4 unit Ø16–20″** per 105 m³, nyala 10.00–15.00, mati saat fumigasi. Ventilasi dibuka 10–20 %. Suhu siang 45–60 °C. Belerang **1,5–2 g/butir** atau **20–30 g/m³**, paparan semalam 8–12 jam, wadah tahan api di lantai lorong tengah, ventilasi 30–60 menit sebelum masuk. | C |
| Jemur matahari & oven | Para-para 50–70 cm dari tanah; durasi jemur dirujuk dataset proses (120–240 jam). Oven: ruang contoh 3×6×3 m, tungku terpisah, suhu dirujuk dataset proses (55–70 °C, K-02), tray miring ±10°. | B/C |
| Arang drum/kolam, 2× ayak rotari, hammer mill | Fase karbonisasi berbasis **warna asap** (KORA); penutupan tanah liat 30–60 menit; kolam kedap semalam–2 hari, drum ≥8 jam (formula); hamparan 2–4 jam sebelum ditumpuk. Rendemen lubang tradisional ±30 % (ICC), drum CDB 35 kg/1.000 batok. Volume berguna lubang ±90 % (FAO). Densitas batok belah lepas dirujuk inventory (150–240 kg/m³). Ayak 2× (owner) / 2–3× (KORA). Fraksi & hammer mill dirujuk formula arang. | B/C |
| Kemasan & muat | Kopra 50–60 kg/karung; arang karung 25/30/50 kg & jumbo 1 t, 20ft ±18 t / 40ft ±26 t; briket master box 10 kg (415×217×164 mm) / 20 kg (417×219×330 mm), 20ft lepas 18,0–18,5 t; BBQ pillow 18–19,5 t vs heksagonal 15,5–16,5 t per 20ft. | C |
| Bentuk briket | Kubus 22/25/26/27 mm, heksagonal 22×50 mm, pipih 25×25×17/20 mm, pillow & finger (ukuran vendor beragam). | C |
| Bioleather + selulosa cocopeat/cocofiber | Review MDPI 2025: serat selulosa tanaman di media **tidak mengganggu biosintesis BC** dan menaikkan kekuatan (ikatan hidrogen, penampang sandwich). Perlakuan alkali serat sabut 5 % NaOH (IOP 2018). **GAP** kadar optimal → input R&D bertingkat. | A / GAP |

## 2. Cek tautan dari owner

| Tautan | Isi | Dipakai? |
|---|---|---|
| TikTok vt.tiktok.com/ZSqxE9bH2 | PT Berkah Mandiri Indonesia — video kopra putih reguler/asalan; tanpa angka | Konteks visual saja |
| TikTok bonumcommune 7320931388587248902 | Rumah jemur 10×7 m Larantuka, 4.700 butir, 1.395,9 kg kopra/siklus mingguan (≈297 g kopra/butir; ≈67 butir/m² lantai, rak bertingkat) | Silang-cek kapasitas (C) |
| Instagram rifai_big | Tidak terbaca (butuh login) | — |
| YouTube (18 tautan) | Pembelerangan kopra putih (Al-Amin), sortir edible/reguler/asalan, proses kopra edible (kelapakutv), 3 jenis kopra putih (Rano Farm), greenhouse + oven (Koperasi Sisandei Nabire), tenda UV, oven 2×24 jam KA 5 %, oven + tungku | Konfirmasi alur & praktik (C); tidak ada angka rak/kipas yang terukur |
| Google “ukuran/berat kelapa jambul” | Spek dagang “12–14 inch” = keliling (sudah dicatat inventory) | Ya (inventory) |
| Blog SPIL | 4–5 butir kelapa tua per 1 kg kopra (200–250 g/butir) | Silang-cek (C) |

## 3. Temuan & keputusan

- **CH-01 (K-03 selesai):** batas asal tunggal 500 mdpl. ISS-037 ditutup; label KORA lama dipetakan: “<100 mdpl” ⊂ DR, “≥600 mdpl” ⊂ DT.
- **CH-02:** angka rak/kipas/belerang hanya dari SOP KORA (C). Rumus kalkulator greenhouse = geometri murni (jumlah rak muat, tingkat = ⌊(tinggi − ruang atap) ÷ jarak tingkat⌋, luas tray × belahan/m²) — tidak ada konstanta baru.
- **CH-03:** jumlah kipas & titik bakar belerang untuk ruang ≠105 m³ adalah **skala linear dari contoh KORA** (turunan, ditandai). Wajib uji suhu/RH antar tingkat & uji bau SO₂ di ujung lorong.
- **CH-04:** pengaruh ketinggian kebun terhadap mutu batok = GAP. Rencana R&D: uji proksimat (KA, abu, VM, FC) + kuat tekan briket per lot DR vs DT minimal n = 3 per kelas sebelum menetapkan rasio campuran baku.
- **CH-05:** truk = data vendor/platform (C); payload legal ikut JBI di buku KIR (aturan ODOL). Kalkulator memakai typ (konservatif) dan memberi peringatan.
- **CH-06:** kapasitas ayakan rotari & dimensi kolam KORA belum tercatat → input pengguna (tidak diberi angka bawaan).

## 4. Sumber

Daftar lengkap C01–C20 (URL/dokumen + grade) ada di `00-research/data/coconut_chain_dataset.json` → `sources`. Sumber utama: Ikatrinasari et al. 2026 (J. Agro Ind. Perkebunan), Hapag-Lloyd & Maersk (container), Deliveree/SNG/Astra UD (truk), CDB India & FAO & ICC (arang), MDPI 2025 & IOP 2018 (BC + serat), dokumen SOP KORA.
