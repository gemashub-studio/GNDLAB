# ADR-007: Dataset proses terpisah + engine alur proses (Fase P)

- **Status:** Accepted
- **Tanggal:** 2026-10-09
- **Terkait:** permintaan owner 2026-10-09; ADR-001..005; `00-research/process_research.md`

## Konteks
Owner meminta kalkulator alur proses: loading masuk → kupas sabut → belah → jemur (matahari / greenhouse / oven) → cungkil → produk jadi (kopra), batok → arang, dipisah per asal (dataran tinggi / rendah). Dataset inventory v1.0.4 tidak memuat parameter proses. Aturan proyek: angka tidak boleh dikarang; dataset inventory immutable per versi.

## Keputusan
1. Parameter proses disimpan di **`00-research/data/coconut_process_dataset.json` (v1.0.0)**, terpisah dari dataset inventory, dengan `source_ids` & keyakinan per angka. Parameter yang sudah ada di dataset inventory **dirujuk** (kopra per butir untuk cek silang, rendemen arang, kadar air produk, diameter mulut batok, kemasan) — tidak diduplikasi.
2. **Neraca massa terjaga:** air kelapa = sisa `1 − sabut − batok − daging` (bukan parameter bebas); bila sisa < 0 pada kombinasi sudut → dipotong 0 + peringatan.
3. **Kepadatan rak** diturunkan dari geometri dataset inventory (`1/d²`, keyakinan C), bisa diganti angka nyata pengguna.
4. Engine `process.ts` tetap **fungsi murni** (ADR-001) dengan rentang sudut (ADR-003). Satuan waktu proses = **jam** (ADR-004 tidak mengatur waktu; dicatat di sini).
5. Asal kelapa = **2 kelompok** (dataran rendah ≤ 500 m dpl, dataran tinggi > 500 m dpl) mengikuti batas studi P07; seluruh angka asal berkeyakinan C.
6. Tampilan ukuran container dalam **ft/in** hanya di lapisan presentasi (ADR-004).

## Konsekuensi
- (+) Dataset inventory & golden cases tidak tersentuh; parameter proses bisa dikalibrasi terpisah (M4).
- (−) Dua dataset harus kompatibel versi (`requires_inventory_dataset`), dicek di loader & test.
