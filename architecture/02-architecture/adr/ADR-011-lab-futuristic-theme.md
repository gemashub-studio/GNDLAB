# ADR-011: Gaya visual "Lab Futuristik" menggantikan Punk Skate Lab

- **Status:** Accepted
- **Tanggal:** 2026-10-11
- **Terkait:** permintaan owner 2026-10-11 ("tema lab, futuristic, elegan" lalu "jangan pakai punk skate lagi"); `06-design/design_spec.md` v2.0.0; DEC-045, DEC-046

## Konteks
Sejak M2 seluruh aplikasi memakai Punk Skate Lab (garis hitam 3 px, bayangan keras, stiker miring, Bowlby One kapital). Prompt GEMA RnD dari ChatGPT meminta tampilan studio R&D modern yang hangat dan premium. Saat diberi pilihan, owner memilih tema **lab, futuristik, elegan**, lalu menegaskan Punk Skate tidak dipakai lagi di seluruh aplikasi.

## Keputusan
1. Bahasa visual baru **Lab Futuristik** (tokens v2.0.0) berlaku untuk **seluruh** gemasSTUDIO, bukan hanya `/lab`.
2. **Nama token dipertahankan** (`ink`, `paper`, `acid`, `safety`, `border-3`, `shadow-hard`, …); yang diganti nilainya. Dengan begitu semua halaman berganti sekaligus tanpa menulis ulang kelas, dan risiko regresi kecil. Nama lama jadi agak menyesatkan (`border-3` = 1 px, `shadow-hard` = bayangan lembut); ini dicatat di tokens.json.
3. Gaya global ada di `globals.css`: garis `border-ink` ber-alfa 16%, kotak `border-3` membulat 14 px, `rotate-*` di luar SVG diluruskan, judul Space Grotesk huruf biasa.
4. Warna yang ditulis langsung di kode (SVG simulator, logo, PDF, manifest) dipetakan 1:1 ke nilai baru.
5. Font judul diganti Bowlby One → **Space Grotesk** (next/font, tetap di-host lokal untuk offline — DEC-020).

## Konsekuensi
- Mockup `06-design/mockups/*.dc.html` tinggal acuan susunan layar, bukan acuan gaya.
- Komponen baru sebaiknya memakai kelas `rounded-*` eksplisit; aturan global `border-3` hanya jaring pengaman.
- Bila kelak perlu mode gelap, nama token sebaiknya diganti ke nama semantik (mis. `fg`, `bg`, `accent`), dan itu butuh ADR baru.
