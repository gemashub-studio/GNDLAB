# Benchmark Produk & Teknik

Benchmark **fitur/teknik**, bukan angka data (angka hanya dari dataset). Sumber adalah halaman vendor/komunitas — klaim pemasaran, belum diuji independen. Riset 2026-10-08.

## 1. Kalkulator muat container (pesaing/pembanding)
| Produk | Kekuatan | Pelajaran untuk gemasSTUDIO |
|---|---|---|
| SeaRates Load Calculator | Container/truk/palet, 3D interaktif, API, aturan stacking/tilt | Mereka fokus kotak kaku; kita unggul di **komoditas curah & kemasan lentur** + rentang min/typ/max + batas pengikat |
| EasyCargo | Payload & volume real-time, multi-stop, laporan langkah demi langkah untuk kru | M3: tampilkan bar volume/berat *live* saat slider; pertimbangkan "urutan stuffing" sebagai laporan PDF |
| 3DBinPacking | Panduan pemuatan bertahap berwarna | M3: slider "isi %" kita = versi sederhana dari urutan pemuatan |

**Diferensiasi gemasSTUDIO:** ketidakpastian eksplisit (badge A/B/C, pita rentang), bahasa gudang, offline di HP, kalibrasi dari lapangan. Tidak ada pembanding yang menangani densitas curah/kadar air.

Sumber: [SeaRates load calculator](https://www.searates.com/en/load-calculator/), [SeaRates API](https://www.searates.com/reference/api-load-calculator), [EasyCargo 3D](https://www.easycargo3d.com/en/3d-container-load-calculator/), [3DBinPacking blog](https://blog.3dbinpacking.com/en/?p=2903)

## 2. ELN / electronic batch record (untuk M5)
- Template ber-versi; perubahan elemen global menurun ke template (MasterControl).
- Riwayat versi template & item tidak bisa dihapus (E-WorkBook).
- Field dinamis & kalkulasi otomatis (eLabNext, Revvity E-Notebook).
- Nilai per langkah disimpan sebagai record penyelesaian yang **immutable** (Tulip eBR).
- **Implikasi:** cocok dengan desain `rnd_param_def` + `def_version`. Tambahan yang layak dipertimbangkan di M5: koreksi nilai = baris baru (append-only), bukan UPDATE. Cek dulu apakah `schema_rnd.sql` sudah menegakkannya sebelum mengusulkan ADR.

Sumber: [MasterControl eBR](https://www.mastercontrol.com/manufacturing/master-batch-lot-history-record), [E-WorkBook 8.2](https://www.rdworldonline.com/e-workbook-suite-8-2/), [eLabNext](https://www.elabnext.com/pricing/), [Tulip eBR template](https://support.tulip.co/docs/ebr-process-template), [Dotmatics F&B ELN](https://www.scientific-computing.com/press-releases/studies-notebook-food-and-beverage)

## 3. PWA offline Next.js (untuk M2 / M5)
- **Serwist** (`@serwist/next`) = penerus next-pwa untuk App Router; SW aktif hanya di production.
- Serwist butuh Webpack; Next 16 default Turbopack (Next 15 sesuai ARD tidak terdampak untuk build). Verifikasi rilis Serwist saat memasang.
- IndexedDB via paket `idb`; flag `synced` per record; sinkron saat event `online`. API server harus **idempoten** (pakai client-generated id) agar retry tidak menggandakan.

Sumber: [LogRocket Next.js 16 PWA](https://blog.logrocket.com/nextjs-16-pwa-offline-support/), [Next.js PWA 2026 guide](https://www.iloveblogs.blog/post/progressive-web-apps-complete-guide-2026), [contoh repo Serwist](https://github.com/smarts-uz/js-next-pwa-serwist)
