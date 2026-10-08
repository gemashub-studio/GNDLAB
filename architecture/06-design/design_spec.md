---
doc: Design Spec
title: gemasSTUDIO — Punk Skate Lab Visual Language
version: 1.0.0
date: 2026-10-08
related: [tokens.json, tailwind.preset.ts, globals.css, ../05-ui-ux/ux_spec.md]
---

# Bahasa Visual gemasSTUDIO — "Punk Skate Lab"

Gabungan **zine punk/skate** (garis hitam tebal, bayangan keras, stiker miring, huruf tebal) dengan **buku catatan lab** (kertas grid, label monospace, kode eksperimen). Dashboard data yang serius tapi tidak kaku.

Menggantikan token visual di `05-ui-ux/ux_spec.md §5` (struktur layar & perilaku di ux_spec tetap berlaku).

## Aturan Utama
1. **Tanpa sudut membulat.** Semua kartu/tombol `border-radius: 0`.
2. **Garis 3px hitam + bayangan keras offset 6px** pada setiap kartu. Panel gelap memakai bayangan oranye.
3. **Dua aksen saja:** hijau-asam `#C6F135` (aktif, aman, keyakinan A) dan oranye safety `#FF5A1F` (CTA, peringatan, keyakinan C). Teks di atas keduanya selalu hitam.
4. **Tipografi:** Bowlby One (judul UPPERCASE, angka hasil besar) · Archivo (teks, tombol 800 UPPERCASE) · JetBrains Mono (semua angka tabel, satuan, label lab, kode batch).
5. **Latar grid lab 24px** di halaman; kartu putih polos di atasnya.
6. **Stiker:** maksimal satu elemen miring (−6° s/d 2°) per kartu, untuk badge/tag — jangan pada angka atau tabel.
7. **Aksesibilitas tetap wajib:** target sentuh ≥ 44px, kontras ≥ 4,5:1 (semua pasangan di tokens lulus), keyakinan A/B/C selalu ditulis hurufnya, fokus keyboard outline oranye 3px.

## Komponen (lihat `globals.css`)
`card`, `card-ink`, `btn-primary`, `btn-acid`, `tag-mono`, `badge-conf`, `bar`, `num`.

## Mockup Acuan
`mockups/*.dc.html` — salinan artboard kanvas desain:
| File | Layar |
|---|---|
| `Main.dc.html` | Dashboard ringkasan inventory |
| `Calculator.dc.html` | Kalkulator container interaktif (rumus nyata) |
| `RnD.dc.html` | R&D Lab Book |
| `Mobile.dc.html` | Hitung cepat gudang (390×844) |

Mockup memakai format komponen kanvas; Claude Code menerjemahkannya ke React + Tailwind dengan `tailwind.preset.ts`, **bukan** menyalin markup apa adanya. Angka stok di dashboard adalah **data contoh**; angka kapasitas & rumus berasal dari dataset v1.0.4.
