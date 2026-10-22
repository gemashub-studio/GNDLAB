# Pohon kelapa tertiup angin (latar transparan)

Animasi dari gambar pohon kelapa yang kamu kirim: daun dan batang bergoyang tertiup angin, lalu satu kelapa jatuh, memantul, dan menggelinding di tanah. Siklusnya 8 detik dan berulang mulus.

## Isi paket

| File | Ukuran | Fungsi |
|---|---|---|
| `palm-wind.js` | ~9 KB | Mesin animasi (WebGL, 60 fps) |
| `palm-tree.webp` | ~280 KB | Pohon + 4 kelapa yang tetap di pohon |
| `palm-front.webp` | ~20 KB | Helai daun depan yang menutupi kelapa |
| `palm-mask.png` | ~12 KB | Peta daun untuk efek kibasan |
| `coconut.png` | ~3 KB | Kelapa yang jatuh |
| `demo.html` | | Contoh pemakaian |
| `palm-wind.webm` | ~1,5 MB | Versi video transparan, cadangan |
| `palm-wind-transparan.webp` | ~3,8 MB | Satu file gambar animasi transparan (paling mudah, paling berat) |

## Pemasangan (disarankan: WebGL)

1. Salin semua file di atas ke satu folder, misalnya `/public/assets/palm/`.
2. Tempel di halaman:

```html
<canvas class="palm-wind" data-src="/assets/palm/" style="width:360px;height:auto"></canvas>
<script src="/assets/palm/palm-wind.js" defer></script>
```

Untuk React/Next.js, render `<canvas className="palm-wind" data-src="/assets/palm/" />` lalu muat skrip sekali, atau panggil `window.PalmWind.mount(canvasRef.current)` di dalam `useEffect`.

Opsi:
- `data-speed="0.8"`: memperlambat (1 = normal).
- Lebar diatur lewat CSS, tinggi menyesuaikan otomatis (rasio 818:1014).

Perilaku otomatis:
- Animasi berhenti saat pohon tidak terlihat di layar (hemat baterai).
- Pengunjung yang mengaktifkan "kurangi gerakan" melihat gambar diam.
- Jika browser tidak mendukung WebGL, canvas diganti gambar statis `palm-tree.webp`.

## Cara paling mudah: satu file gambar

```html
<img src="/assets/palm/palm-wind-transparan.webp" alt="Pohon kelapa tertiup angin" width="320">
```

Transparan di semua browser modern (termasuk Safari), tapi 10 fps dan sekitar 3,8 MB. Cocok untuk uji cepat; untuk halaman utama pakai versi WebGL.

## Alternatif: video WebM transparan

```html
<video src="/assets/palm/palm-wind.webm" autoplay loop muted playsinline width="360"></video>
```

Catatan: transparansi WebM didukung Chrome, Edge, dan Firefox. Safari (iPhone/Mac) menampilkan latar hitam, jadi untuk pengunjung Safari gunakan versi WebGL.

## Catatan lisensi
Gambar pohon berasal dari file yang kamu kirim. Kalau diambil dari situs clipart, pastikan lisensinya mengizinkan dipakai (dan dimodifikasi) untuk website kamu.
