---
doc: Design Spec
title: gemasSTUDIO — Lab Futuristik Visual Language
version: 2.0.0
date: 2026-10-11
replaces: Punk Skate Lab 1.0.0 (2026-10-08)
related: [tokens.json, tailwind.preset.ts, globals.css, ../02-architecture/adr/ADR-011-lab-futuristic-theme.md, ../05-ui-ux/ux_spec.md]
---

# Bahasa Visual gemasSTUDIO — "Lab Futuristik"

Permintaan owner 2026-10-11: tema **lab, futuristik, elegan**, dan Punk Skate tidak dipakai lagi (ADR-011). Kesannya laboratorium modern: latar putih-dingin bergrid halus, panel slate gelap dengan cahaya mint, garis rambut, sudut lembut, tipografi bersih.

Struktur layar & perilaku di `05-ui-ux/ux_spec.md` tetap berlaku.

## Aturan Utama
1. **Sudut lembut:** kartu 16 px, kontrol 12 px, label/status berbentuk pill.
2. **Garis rambut 1 px** (ink 16% alfa) dan **bayangan lembut berlapis**, tanpa bayangan keras atau offset.
3. **Dua aksen:** mint `#63E6CF` (aktif, fokus, keyakinan A, teks aksen di atas ink) dan amber `#F5A524` (tombol utama, peringatan, keyakinan C). Teks di atas keduanya selalu ink.
4. **Tipografi:** Space Grotesk (judul, huruf biasa, tracking rapat) · Archivo (teks, tombol 700) · JetBrains Mono (angka, satuan, label lab, kode batch).
5. **Latar grid 32 px** + cahaya radial mint lembut; kartu putih semi-transparan dengan blur tipis.
6. **Panel ink** (hero, detail eksperimen): slate gelap dengan grid mint 7% dan cahaya radial.
7. **Tanpa elemen miring.** Stiker Punk dihapus; aturan global meluruskan `rotate-*` di luar SVG.
8. **Aksesibilitas tetap wajib:** target sentuh ≥ 44 px, kontras ≥ 4,5:1 untuk teks, keyakinan A/B/C selalu ditulis hurufnya, fokus keyboard outline mint 2 px.

## Komponen (lihat `globals.css`)
`card`, `card-ink`, `btn-primary`, `btn-acid`, `btn-ghost`, `tag-mono`, `badge-conf`, `bar`, `num`, `label-mono`, `field`, `chip`.

## Mockup lama
`mockups/*.dc.html` dibuat untuk Punk Skate Lab. Mockup itu masih boleh jadi acuan **susunan layar**, bukan acuan warna atau gaya.
