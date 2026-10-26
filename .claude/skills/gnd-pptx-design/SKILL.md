---
name: gnd-pptx-design
description: Mengubah / memeriksa desain laporan PPTX & DOCX GnD Lab (pencatatan data awal-akhir, riset produk, laporan belanja, gabungan data) yang dibuat tanpa dependensi di apps/web/src/lib/officeExport.ts. Pakai saat owner minta ubah tema/desain/ikon/font laporan PowerPoint/Word, atau saat perlu merender slide untuk dicek visual.
---

# Desain PPTX/DOCX GnD Lab

## Peta kode
- `apps/web/src/lib/officeExport.ts` — OOXML ditulis tangan + `zipStore`. Fungsi utama: `buildPptx(report, charts, videos)`,
  `buildDocx`, `buildTreePptx(items)` (laporan belanja: nota → cabang barang), `packPptx` (tema, master, layout).
- Model data: `ResearchReport` (`lib/researchReport.ts`); sumber: `buildResearchReport` (riset), `buildCatatReport`
  (`lib/pencatatan.ts`), `lpjTreeSlides`/`lpjReport` (`lib/belanjaExport.ts`), `buildGabungReport` + `reportText`
  (`lib/gabungData.ts`, menu Gabungkan Data).
- Satuan EMU: slide 12192000 × 6858000; `M = 500000` margin; `CW = SW − 2M`. `BODY_TOP = 1300000` (di bawah kepala judul).

## Tema saat ini (DEC-121 → DEC-127, infografik "Ciencia" referensi owner)
- Warna: `INK 2B2320`, `MINT` (=karat) `A64B2A`, `MINT_D` (=zaitun) `5E7B3A`, `AMBER` (=marun) `7B3B34`, `TAUPE A58E83`,
  `BG FBFAF7` (kertas), `PAPER F1EDE8`, `GRID DCD4CC`, `KICK_BAR A8A29E`, `SIDE CFC8C3`, `THIN_NUM B3A6A0`, `GROUND 5B4636`.
- Font: tema mayor Georgia (judul serif), minor Arial Narrow (isi); angka besar `Segoe UI Light` (`PRun.font`).
  Font koran asli tidak diketahui/berlisensi → jelaskan ke owner bila diminta "persis".
- Komponen: `masthead()` (kotak putih "GnD Lab" + kalimat pembuka tebal karat), `kickerBar(id,cx,y,teks,ikon?)` (bilah abu,
  teks putih kapital), `pageNo()` (nomor kecil kanan atas), `sideLabel()` (label tegak "Contextos lab"), `pIcon()` + `ICONS`
  (path SVG M/L/C/Z kotak 100×100 → `a:custGeom`; isi + `cut` berwarna kertas untuk lubang), `iconFor(judul)`,
  `productPanel()` (siluet di atas pita tanah + lingkaran keterangan marun), poin daftar `▪` karat, linimasa titik di sampul.
- Menambah ikon: tambahkan entri di `ICONS` (koordinat 0–100), jenisnya di `IconKind`, lalu (opsional) kata kunci di `iconFor`.

## Jebakan
- **ID bentuk (`cNvPr id`) harus unik per slide.** Pemakaian: judul 2–8, KPI 20+, grid foto/progres 100+, paket blok 200+,
  belanja 400+, folio 89–92, ikon kicker 9100–9101, panel produk 9200–9260. Pakai ≥ 9000 untuk komponen baru.
- `pSeg`/`pLine` didefinisikan setelah `buildPptx` (const) — aman karena dipanggil saat runtime, bukan saat modul dimuat.
- Teks panjang: `pTextBox(..., { autofit: false })` tidak menyusut — hitung tinggi sendiri.
- Patch dengan Python: tulis skrip ke file di scratchpad, pakai raw string `r"""…"""` (`\b`, `\s`, `\n` di string biasa
  rusak: backspace / newline asli). Regex escape lebih aman diganti `startsWith`/logika biasa.

## Cek visual (wajib setelah ubah desain)
- **Sesi cloud Linux** (tanpa PowerPoint): tulis PPTX lewat vitest sementara, lalu
  `soffice --headless --convert-to pdf cek.pptx` dan `pdftoppm -f N -l N -r 80 -png cek.pdf slide`, baca PNG. Cari nomor
  slide dengan `pdftotext -f i -l i`. Rekaman catat harus punya `finishedAt` + nilai akhir agar slide Data akhir/penjelasan ikut.
1. Buat contoh berkas lewat uji vitest sementara (`apps/web/test/zz_render.test.ts`, hapus setelahnya) yang menulis
   `cek-*.pptx` ke scratchpad: riset (`buildResearchReport` dengan JPG contoh di `scratchpad/jpg/s0..2.jpg`),
   pencatatan (`buildCatatReport` 6 baris + foto), belanja (`buildTreePptx(lpjTreeSlides(...))`), gabungan.
2. Render tiap slide ke PNG dengan PowerPoint COM (PowerShell):
   ```powershell
   $p = New-Object -ComObject PowerPoint.Application
   $pr = $p.Presentations.Open("$o\cek-riset.pptx", $true, $false, $false)
   foreach ($s in $pr.Slides) { $s.Export("$o\out\riset-" + $s.SlideIndex + ".png", "PNG", 1280, 720) }
   $pr.Close(); $p.Quit()
   ```
   (`Remove-Item` di scratchpad diblokir → tulis ke folder baru.) Lalu buka PNG dengan Read dan periksa tumpang tindih.
3. Kirim beberapa PNG ke owner (SendUserFile) — sebutkan foto di contoh hanya gambar contoh.

## Uji
`apps/web/test/gabung.test.ts` (komponen infografik, ikon, gabungan), `test/officeExport.test.ts`, `test/pencatatan.test.ts`,
`test/belanja.test.ts`. Jalankan `npx vitest run` dari `apps/web`.
