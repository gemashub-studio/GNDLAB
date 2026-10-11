# ADR-013: Tanpa dosis sulfur otomatis; keyakinan mengikuti sumber yang benar-benar dibaca; label jenis angka

- **Status:** Accepted
- **Tanggal:** 2026-10-11
- **Terkait:** permintaan owner "Audit dan perbaiki kalkulator" 2026-10-11; DEC-048, DEC-049, DEC-050; ADR-003, ADR-009, ADR-010, ADR-012; ISS-042, ISS-043, ISS-044

## Konteks
Kalkulator kopra (Formula → Kopra; Rantai → Pengeringan) menghitung dosis belerang (g/butir, g/m³, jadwal malam, titik bakar), lama paparan, dan ventilasi sebelum masuk. Semua angka itu berasal dari SOP internal KORA. Owner meminta: tanpa dosis otomatis sebelum ada sumber resmi/primer yang menetapkan dosis proses khusus kopra edibel beserta basis hitungnya; batas residu produk akhir bukan dosis; jangan mengarang SOP pembakaran, paparan, atau masuk kembali.

Audit dataset formula juga menemukan 60 parameter berkeyakinan A/B yang **hanya** bersumber SOP internal KORA, atau yang jurnal/standarnya hanya dikutip lewat SOP. Ini bertentangan dengan konvensi dataset sendiri ("angka standar internal KORA = C"). Selain itu kalkulator cuka dan bioleather tidak membedakan angka teoritis, literatur, isian pengguna, dan hasil uji.

## Keputusan
1. **Sulfur (DEC-048):** penelusuran 2026-10-11 tidak menemukan dosis resmi/primer. Satu studi E3S 2024 deskriptif, tanpa jumlah kelapa dan tanpa residu. Maka `kopra.sulfur.auto_dose = false` (skema Zod mewajibkan `false`). Parameter dosis, jadwal, paparan, ventilasi, dan titik bakar dihapus dari dataset (formula v1.2.0, rantai v1.1.0) dan dari engine (`sulfurDose` dihapus; `greenhouseServices` tinggal kipas). UI menampilkan status "dosis belum ditetapkan", bukti yang ditelusuri tanpa angka dosis, batas residu UE 50 mg/kg sebagai syarat produk akhir, dan **log perlakuan manual** append-only (`gemas-perlakuan`). Oven ditandai tanpa fumigasi.
2. **Keyakinan (DEC-049):** parameter yang sumbernya hanya F01–F06 (dokumen internal) → **C**. Parameter A yang jurnal/standarnya hanya dikutip lewat SOP (F10–F21) → maks **B**. Alasan ditulis di `note`. Dikunci oleh uji dataset.
3. **Label jenis angka (DEC-050):** kalkulator cuka dan bioleather memberi label **Teoritis · Literatur · Isian/resepmu · Hasil ujimu · Saran AI** (saran AI tidak ada). Isian bisa disimpan sebagai **versi protokol** di GEMA RnD Lab tanpa mengubah versi lama.
4. **Basis gliserol:** "gliserol 1%" tanpa basis v/v atau b/v. Kalkulator menampilkan mL (v/v) **dan** g (b/v); owner yang menentukan.
5. **Pengeringan:** kapasitas dari ukuran milik pengguna + rak/tray, ditambah "belahan per tray hitungan sendiri" dan **muatan aktual** (`dryingLoadPlan`: belahan, angkatan, isi %, tray terpakai). Asumsi dan satuan ditampilkan.

## Konsekuensi
- Badge keyakinan banyak turun ke B/C. Ini lebih jujur, dan peringatan keyakinan rendah muncul lebih sering.
- Bila kelak ada dosis resmi/primer: tambahkan sumber, ubah `auto_dose` lewat ADR baru, dan tulis ulang uji yang mengunci `false`.
- Library sumber GEMA RnD kini dikategorikan; `07-rnd/library/sumber/sources.md` dibangkitkan dari JSON (`scripts/gen_gema_sources.py`).
