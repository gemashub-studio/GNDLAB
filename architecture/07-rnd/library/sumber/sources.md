# Library Sumber — GEMA RnD

Daftar sumber yang dipakai GEMA RnD. Versi yang dibaca aplikasi: `../apps/web/src/data/gemaSources.json`. Uji unit memastikan setiap `source_id` di JSON juga tercatat di file ini.

**Status pemeriksaan**
- `diperiksa` = halaman resmi dibuka sendiri pada tanggal akses.
- `dilaporkan` = disebut penelusuran awal (ChatGPT, 11-10-2026), tapi belum bisa dikonfirmasi ulang.
- `belum-diperiksa` = belum dibuka.

**Penting:** "Berlaku" di katalog BSN adalah status dokumen standar. Itu **bukan** bukti standar wajib diterapkan, dan bukan bukti produk memenuhi standar. Isi teknis SNI (angka syarat mutu) **belum dibaca dari naskah resmi**.

| source_id | Judul | Lembaga · tahun | Jenis | URL | Akses | Status | Produk | Yang didukung | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-001 | SNI 01-3946-1995 Kopra | BSN · 1995 | standar produk | https://pesta.bsn.go.id/produk/detail/4354-sni01-3946-1995 | 2026-10-11 | diperiksa | KE | Katalog: Berlaku; ICS 67.080.10; ditetapkan 07-08-1995; 13 hal; format cetak; Rp 30.000 | Judul "Kopra" tanpa "edibel"; naskah belum dibaca |
| GS-002 | SNI 01-4371-1996 Cuka fermentasi | BSN · 1996 | standar produk | https://pesta.bsn.go.id/produk/detail/4785-sni01-4371-1996 | 2026-10-11 | diperiksa | CK | Katalog: Berlaku; ICS 67.220.20; ditetapkan 02-12-1996; 11 hal; Rp 30.000 | Belum pasti mencakup cuka air kelapa; naskah belum dibaca |
| GS-003 | SNI 01-3711-1995 Cuka makan | BSN · 1995 | standar produk | https://pesta.bsn.go.id/produk/detail/4106-sni01-3711-1995 | 2026-10-11 | diperiksa | CK | Katalog: Berlaku; ICS 67.220.20; ditetapkan 07-08-1995; 8 hal; Rp 15.000 | Hubungan dengan GS-002 belum jelas; naskah belum dibaca |
| GS-004 | SNI 01-1682-1996 Arang tempurung kelapa | BSN · 1996 | standar produk | https://pesta.bsn.go.id/produk/by_ics?ics_no=75.160.10&key= | 2026-10-11 | dilaporkan | AR, BR | Penelusuran awal: tercantum Berlaku di daftar ICS 75.160.10 | Halaman daftar timeout saat dicek ulang. Salinan tak resmi beredar di Scribd/pdfcoffee, bukan acuan resmi |
| GS-005 | SNI 1683:2021 Arang kayu | BSN · 2021 | standar produk | https://pesta.bsn.go.id/produk/detail/13633-sni16832021 | 2026-10-11 | diperiksa | AR | Katalog: Berlaku; Komtek 65-02; ICS 71.100.60-01-A; ditetapkan 29-09-2021; 13 hal; PDF; Rp 30.000 | Untuk arang KAYU, bukan tempurung |
| GS-006 | SNI 01-6235-2000 Briket arang kayu | BSN · 2000 | standar produk | https://pesta.bsn.go.id/produk/detail/5750-sni01-6235-2000 | 2026-10-11 | dilaporkan | BR | Penelusuran awal: Berlaku. Halaman detail terbuka, tapi tabel datanya tidak terbaca alat | Judul khusus briket arang KAYU; ruang lingkup untuk tempurung belum dicek |
| GS-007 | ISO 3376:2020 Leather — tensile strength & percentage elongation | ISO (IULTCS/IUP 6) · 2020 | metode uji | https://www.iso.org/standard/75173.html | 2026-10-11 | diperiksa | BL | Published ed. 4; berlaku untuk semua jenis leather; tahap 90.60 (tinjauan) | Ruang lingkupnya kulit (leather); kesesuaian untuk bioleather belum divalidasi |
| GS-008 | ISO 2589:2016 Leather — determination of thickness | ISO (IULTCS/IUP 4) · 2016 | metode uji | https://www.iso.org/standard/68859.html | 2026-10-11 | diperiksa | BL | Published ed. 3; dikonfirmasi 2021; kini tahap 90.20 (tinjauan sistematik) | Sama dengan GS-007 |
| GS-009 | ISO 3377-2:2025 Leather — double edge tear load | ISO (IULTCS/IUP 8) · 2025 | metode uji | https://www.iso.org/standard/89399.html | 2026-10-11 | diperiksa | BL | Published ed. 3 (10-2025), menggantikan edisi 2016; CHF 44 | Sama dengan GS-007 |
| GS-010 | ISO/IEC 17025:2017 Kompetensi lab pengujian & kalibrasi | ISO/CASCO · 2017 | mutu laboratorium | https://www.iso.org/standard/66912.html | 2026-10-11 | diperiksa | semua | Published ed. 3; dikonfirmasi 2023; juga diadopsi sebagai SNI ISO/IEC 17025:2017 (Berlaku di katalog BSN) | Persyaratan lab, bukan desain eksperimen atau standar produk |
| GS-011 | Codex CXC 1-1969 General Principles of Food Hygiene | FAO/WHO · rev. 2022, terbit 2023 | pedoman keamanan pangan | https://doi.org/10.4060/cc6125en | 2026-10-11 | diperiksa | KE, CK | GHP + HACCP sepanjang rantai pangan; direvisi 1997, 2003, 2020, 2022 | Pedoman umum; tidak menggantikan aturan nasional |
| GS-012 | OECD Good Laboratory Practice and Compliance Monitoring | OECD | pedoman studi keselamatan | https://www.oecd.org/en/topics/sub-issues/testing-of-chemicals/good-laboratory-practice-and-compliance-monitoring.html | – | belum-diperiksa | semua | Penelusuran awal: untuk studi non-klinis yang diajukan ke otoritas | Belum dibuka ulang |
| GS-013 | NIST/SEMATECH e-Handbook §5.3 & §5.3.3.2 | NIST | panduan statistik | https://www.itl.nist.gov/div898/handbook/pri/section3/pri3.htm | 2026-10-11 | diperiksa | semua | Urutan memilih rancangan: tujuan → variabel & level → rancangan; rancangan blok acak untuk menghilangkan pengaruh faktor pengganggu | Panduan umum, bukan khusus pangan/bahan |
| GS-014 | FAQ Pesta Online BSN | BSN | info resmi akses standar | https://pesta.bsn.go.id/faq | 2026-10-11 | diperiksa | semua | SNI gratis bisa dibaca di akses-sni.bsn.go.id; Pesta hanya menampilkan SNI berstatus berlaku; tarif SNI berbayar diatur PP 40/2018 | Portal Akses SNI timeout saat dicek; syarat akun belum diketahui |
