# Glosarium Domain

Konsep yang sering muncul. Angka contoh merujuk dataset v1.0.4 — **jangan dikutip sebagai sumber**, buka dataset.

## Muat container & gudang
- **Batas pengikat (binding):** apa yang habis duluan — ruang (`VOLUME`) atau payload (`WEIGHT`). Komoditas ringan-bervolume (kelapa jambul, arang belah 2, kopra) hampir selalu VOLUME; arang lump di 40HC jadi WEIGHT.
- **Densitas curah (bulk density):** massa per m³ tumpukan termasuk rongga. Berbeda per *form* (lepas vs dalam karung vs bersarang) — itu sebabnya satu komoditas punya beberapa `commodity_form`.
- **Densitas efektif dalam container:** densitas "terkalibrasi" balik dari realisasi muat pasar (sudah memperhitungkan karung & rongga). Dengan ini utilisasi u = 1.
- **Utilisasi volume (u):** porsi ruang yang benar-benar terisi muatan (0,8 untuk arang lump berkarung).
- **Grid kemasan:** jumlah karung = maks 6 orientasi dari ⌊L/a⌋·⌊W/b⌋·⌊H/c⌋. Dimensi karung lentur = dimensi efektif terkalibrasi, bukan ukuran karung kosong.
- **Stowage factor (SF):** m³ per ton; ρ = 1000/SF.
- **Utilisasi lantai gudang (u_f):** sisa luas untuk lorong & ventilasi (default 0,65). Tinggi tumpuk efektif = tinggi bersih − 0,5 m.
- **Beban lantai (q):** kg/m² di bawah tumpukan; bandingkan dengan kapasitas lantai.

## Komoditas
- **Kelapa jambul (semi-husked):** sabut dikupas kecuali jambul. Spek dagang "12–14 inch" = **keliling** (DEC-006). Umur simpan ambien 30–45 hari.
- **Arang batok belah 2:** setengah tempurung yang dikarbonisasi; bisa disusun **bersarang** (nested, pitch ±1,2 cm/keping). Densitas lepas belum terukur publik (ASM-01) — risiko terbesar proyek.
- **Arang lump/pecah:** bentuk dagang umum; berat-terbatas di 40HC.
- **Kopra asalan:** kopra asap mutu petani; kadar air 8–22% → koreksi berat & risiko self-heating (UN 1363). Bau asap mencemari kopra edible.
- **Kopra edible (putih/cup):** mutu pangan, kadar air ≤ 5–6%.
- **Koreksi kadar air (basis basah):** M₂ = M₁·(1−w₁)/(1−w₂). Bahan kering tetap, air berubah.

## Data & kualitas
- **Keyakinan A/B/C:** A = jurnal/standar; B = data dagang konsisten; C = estimasi engineering, wajib sampling. Campuran "A/C" → C.
- **Rentang min/typ/max + evaluasi sudut:** min/max = ekstrem fungsi di semua kombinasi ujung parameter (2^k).
- **Dataset terversi & immutable:** perubahan = versi baru (SemVer patch untuk koreksi nilai). Skenario menyimpan versinya sendiri → reproducible.
- **Kalibrasi:** sampling lapangan (n ≥ 10) → usulan (P5/median/P95) → approval `data_admin` → versi baru.

## R&D Lab
- **Batch:** satu percobaan, kode `XX-YYMM-NNN` (KE/KA/BL/CK). Status PLANNED → RUNNING → DONE/FAILED/CANCELLED.
- **Tahap (stage):** alur proses dari template produk (26 tahap; wajib dikonfirmasi owner).
- **Parameter sebagai data:** definisi di `rnd_param_def` (tipe number/text/choice/boolean, satuan, target), ber-`def_version`. Form dibangkitkan dari definisi — tanpa migrasi.
- **Out-of-spec:** nilai di luar target, dihitung otomatis & ditandai oranye.
- **Pola industri (benchmark ELN/eBR):** template ber-versi, nilai yang tercatat immutable/append-only, batch merujuk versi definisi yang dipakai.
