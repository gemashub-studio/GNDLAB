# Library Sumber — GEMA RnD

> Dibangkitkan dari `../apps/web/src/data/gemaSources.json` oleh `scripts/gen_gema_sources.py` — **jangan edit manual**; ubah JSON lalu jalankan skrip. Uji unit memastikan keduanya sinkron.

Dicek: 2026-10-11.

**Status pemeriksaan**
- `diperiksa` = halaman resmi dibuka sendiri pada tanggal akses (isi naskah bisa tetap belum dibaca — lihat kolom keterbatasan).
- `dilaporkan` = disebut sumber lain/penelusuran awal, belum bisa dikonfirmasi ulang.
- `belum-diperiksa` = belum dibuka.

**Penting:** "Berlaku" di katalog BSN = status dokumen, BUKAN bukti wajib diterapkan atau produk memenuhi standar. Batas residu (mis. SO₂) = syarat produk akhir, BUKAN dosis proses.

## Standar produk

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-001 | SNI 01-3946-1995 Kopra | BSN · 1995 | https://pesta.bsn.go.id/produk/detail/4354-sni01-3946-1995 | 2026-10-11 | diperiksa | KE | Kopra (ICS 67.080.10 buah & produk turunan); 13 hal, format cetak | Belum dibaca dari naskah — parameter belum diketahui dari sumber resmi | Judul tanpa "edibel"; naskah belum dibaca; angka KA 5% di repo dari sumber sekunder (ISS-042). |
| GS-002 | SNI 01-4371-1996 Cuka fermentasi | BSN · 1996 | https://pesta.bsn.go.id/produk/detail/4785-sni01-4371-1996 | 2026-10-11 | diperiksa | CK | Cuka fermentasi (ICS 67.220.20); 11 hal | Belum dibaca dari naskah | Belum pasti mencakup cuka air kelapa; naskah belum dibaca. |
| GS-003 | SNI 01-3711-1995 Cuka makan | BSN · 1995 | https://pesta.bsn.go.id/produk/detail/4106-sni01-3711-1995 | 2026-10-11 | diperiksa | CK | Cuka makan (ICS 67.220.20); 8 hal | Belum dibaca dari naskah | Hubungan dengan GS-002 belum jelas; naskah belum dibaca. |
| GS-004 | SNI 01-1682-1996 Arang tempurung kelapa | BSN · 1996 | https://pesta.bsn.go.id/produk/by_ics?ics_no=75.160.10&key= | 2026-10-11 | dilaporkan | AR, BR | Arang tempurung kelapa (bahan bakar padat, ICS 75.160.10) | Menurut salinan tak resmi: definisi, syarat mutu, sampling, cara uji, kemasan, penandaan — belum dicek ke naskah resmi | Halaman BSN timeout saat dicek ulang. Salinan tak resmi di internet bukan acuan. |
| GS-005 | SNI 1683:2021 Arang kayu | BSN · 2021 | https://pesta.bsn.go.id/produk/detail/13633-sni16832021 | 2026-10-11 | diperiksa | AR | Arang KAYU; Komtek 65-02; 13 hal; PDF | Belum dibaca dari naskah | Untuk arang kayu, bukan tempurung. |
| GS-006 | SNI 01-6235-2000 Briket arang kayu | BSN · 2000 | https://pesta.bsn.go.id/produk/detail/5750-sni01-6235-2000 | 2026-10-11 | dilaporkan | BR | Briket arang KAYU | Jurnal sekunder menyebut KA, abu, zat terbang, karbon terikat, kerapatan, kalor — belum dicek ke naskah resmi | Judul khusus briket arang kayu; tabel detail tidak terbaca saat dicek ulang. |
| GS-020 | Codex CXS 162R-1987 Regional (European) Standard for Vinegar | Codex Alimentarius · 1987 | https://www.fao.org/fao-who-codexalimentarius/codex-texts/list-standards/en/ | 2026-10-11 | dilaporkan | CK | Cuka (regional Eropa) | Menurut sumber sekunder: asam asetat ≥50 g/L, sisa alkohol | Halaman daftar standar Codex tidak terbaca alat; naskah belum dibaca langsung; regional Eropa. |
| GS-025 | EN 1860-2:2005 Barbecue charcoal and barbecue charcoal briquettes — Requirements and test methods | CEN · 2005 | https://www.fao.org/wood-energy-info-portal/search/detail/en/c/1539657/ | 2026-10-11 | diperiksa | AR, BR | Arang & briket untuk alat BBQ (pasar Eropa) | Persyaratan & metode uji (isi belum dibaca) | Naskah berbayar belum dibaca; hanya untuk BBQ — arang shisha tidak tercakup. |

## Aturan keamanan / regulasi

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-015 | EU food additives database — Sulphur dioxide–sulphites (E 220–228), kategori 04.2.1 dried coconut | European Commission (Reg. (EC) 1333/2008 Annex II; Reg. (EU) 1129/2011) · 2011 | https://ec.europa.eu/food/food-feed-portal/screen/food-additives/search/details/POL-FAD-IMPORT-3044 | 2026-10-11 | diperiksa | KE | Pangan yang dipasarkan di Uni Eropa | SO₂ maks 50 mg/kg (total, dari semua sumber) khusus kelapa kering; ≤10 mg/kg dianggap tidak ada | Bukan dosis fumigasi; hanya berlaku untuk pasar UE. |
| GS-016 | Peraturan BPOM Nomor 11 Tahun 2019 tentang Bahan Tambahan Pangan | BPOM RI · 2019 | https://peraturan.go.id/id/peraturan-bpom-no-11-tahun-2019 | 2026-10-11 | diperiksa | KE, CK | BTP untuk pangan di Indonesia; cuka = kategori pangan 12.3 'Cuka makan' (cekbtp.pom.go.id) | Jenis & batas maksimum BTP per kategori pangan | Lampiran batas sulfit untuk kopra/kelapa kering BELUM dibaca. |
| GS-029 | IMDG Code Amdt 42-24: charcoal = UN1361 CARBON, animal or vegetable origin, Class 4.2 (SP 978) — wajib sejak 1 Jan 2026 | IMO (dikutip pemberitahuan resmi Hapag-Lloyd) · 2024 | https://www.hapag-lloyd.com/en/services-information/news/2025/01/new-regulations-for-charcoal-transport.html | 2026-10-11 | diperiksa | AR, BR | Pengapalan arang (termasuk tempurung kelapa & briket) lewat laut | Wajib deklarasi barang berbahaya kelas 4.2, kemasan UN, label/plakat | Teks IMDG resmi (IMO) belum dibaca; sumber = pemberitahuan pelayaran. |

## Metode uji

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-007 | ISO 3376:2020 Leather — tarik & mulur | ISO (IULTCS/IUP 6) · 2020 | https://www.iso.org/standard/75173.html | 2026-10-11 | diperiksa | BL | Semua jenis leather (kulit) | Kuat tarik, mulur pada beban tertentu & pada gaya maksimum | Kesesuaian untuk bioleather belum divalidasi. |
| GS-008 | ISO 2589:2016 Leather — tebal | ISO (IULTCS/IUP 4) · 2016 | https://www.iso.org/standard/68859.html | 2026-10-11 | diperiksa | BL | Semua jenis leather | Tebal | Kesesuaian untuk bioleather belum divalidasi. |
| GS-009 | ISO 3377-2:2025 Leather — sobek tepi ganda | ISO (IULTCS/IUP 8) · 2025 | https://www.iso.org/standard/89399.html | 2026-10-11 | diperiksa | BL | Semua jenis leather | Beban sobek (Baumann) | Kesesuaian untuk bioleather belum divalidasi. |
| GS-019 | OIV-MA-VI-01 Wine vinegars — determination of total acidity | OIV (Resolusi OENO 52/2000) · 2000 | https://www.oiv.int/node/3882 | 2026-10-11 | diperiksa | CK | Cuka anggur (wine vinegar) | Keasaman total sebagai asam asetat (titrasi NaOH 0,5 M, fenolftalein): g/L = 3 × V untuk 10 mL sampel | Ruang lingkup cuka anggur — dipakai sebagai acuan cara titrasi, bukan standar produk cuka kelapa. |
| GS-022 | ASTM D882-26 Tensile Properties of Thin Plastic Sheeting | ASTM International (D20) · 2026 | https://store.astm.org/standards/d882 | 2026-10-11 | diperiksa | BL | Lembaran/film plastik tebal < 1,0 mm | Kuat tarik, modulus, mulur lembaran tipis | Untuk plastik; kandidat bila bioleather diperlakukan sebagai lembaran tipis — perlu justifikasi metode. |
| GS-024 | ASTM D1762-84(2021) Chemical Analysis of Wood Charcoal | ASTM International (D07) · 2021 | https://www.astm.org/d1762-84r21.html | 2026-10-11 | diperiksa | AR, BR | Arang kayu, bongkah & briket | Kadar air, zat terbang, abu | Ruang lingkup arang KAYU — penerapan ke tempurung kelapa perlu justifikasi. |
| GS-026 | ISO 18122:2022 Solid biofuels — Determination of ash content | ISO/TC 238 · 2022 | https://www.iso.org/obp/ui?_escaped_fragment_=iso%3Astd%3Aiso%3A18122%3Aed-2%3Av1%3Aen | 2026-10-11 | diperiksa | AR, BR | Semua bahan bakar padat biomassa | Kadar abu (suhu akhir standar 550 ± 10 °C) | Untuk biofuel padat; arang/briket perlu dicek kecocokan suhu abu dengan standar produk yang dipakai. |
| GS-027 | ISO 18125:2017 Solid biofuels — Determination of calorific value | ISO/TC 238 · 2017 | https://www.iso.org/obp/ui#iso:std:iso:18125:ed-1:v1:en | 2026-10-11 | diperiksa | AR, BR | Bahan bakar padat biomassa | Nilai kalor kotor (bom kalorimeter, volume tetap, 25 °C) | Status edisi terbaru belum dicek ulang. |
| GS-028 | ISO 18134-2:2024 Solid biofuels — Moisture content, oven dry method, Part 2: simplified | ISO/TC 238 · 2024 | https://www.iso.org/standard/86024.html | 2026-10-11 | diperiksa | AR, BR | Bahan bakar padat biomassa; kontrol produksi rutin | Kadar air total (basis basah) | Halaman edisi 2024 sendiri belum dibuka. |

## Panduan proses & higiene

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-011 | Codex CXC 1-1969 General Principles of Food Hygiene | FAO/WHO · 2022 | https://doi.org/10.4060/cc6125en | 2026-10-11 | diperiksa | KE, CK | Seluruh rantai pangan | GHP & HACCP (bahaya, CCP, verifikasi) | Pedoman umum; tidak menggantikan aturan nasional. |
| GS-018 | BAFS Technical Bulletin No. 09 — Ensuring the Safety and Quality of Copra | Bureau of Agriculture and Fisheries Standards (Filipina) · 2021 | https://bafs.da.gov.ph/wp-content/uploads/2025/04/TB-Copra_final.pdf | 2026-10-11 | diperiksa | KE | Kopra untuk minyak (rantai Filipina) | Bahaya (aflatoksin, PAH dari asap), mutu (KA, minyak, FFA, aflatoksin) per grade | Fokus kopra untuk minyak, bukan kopra edibel; tidak ditemukan dosis sulfur. |

## Mutu laboratorium

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-010 | ISO/IEC 17025:2017 Kompetensi lab pengujian & kalibrasi | ISO/CASCO · 2017 | https://www.iso.org/standard/66912.html | 2026-10-11 | diperiksa | KE, CK, BL, AR, BR | Laboratorium pengujian & kalibrasi | Kompetensi, ketidakberpihakan, operasi konsisten lab | Persyaratan lab, bukan desain eksperimen atau standar produk. |

## Riset primer

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-017 | Apriyanto dkk. 2024 — Innovative Techniques for High-Quality White Copra Production: The Role of Sulfur Smoke and Kubung Dryers (E3S Web of Conf. 593:03003) | E3S Web of Conferences · 2024 | https://doi.org/10.1051/e3sconf/202459303003 | 2026-10-11 | diperiksa | KE | Kopra putih, terowongan/kubung pengering | - | Deskriptif; tanpa jumlah kelapa per sesi & tanpa residu SO₂ → tidak bisa jadi dosis (DEC-048). |
| GS-023 | Eco-friendly production of leather-like material from bacterial cellulose and waste resources (BC dari air kelapa) | Journal of Cleaner Production · 2024 | https://www.sciencedirect.com/science/article/abs/pii/S0959652624031494 | 2026-10-11 | belum-diperiksa | BL | Bioleather selulosa bakteri dari air kelapa + tanin, minyak, gliserol, ampas kopi | - | Hanya cuplikan abstrak dari hasil pencarian; makalah belum dibuka; satu studi. |

## Panduan cara meneliti

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-012 | OECD Good Laboratory Practice | OECD · - | https://www.oecd.org/en/topics/sub-issues/testing-of-chemicals/good-laboratory-practice-and-compliance-monitoring.html | – | belum-diperiksa | KE, CK, BL, AR, BR | Studi non-klinis keselamatan yang diajukan ke otoritas | Belum dibuka ulang | Belum dibuka ulang. |
| GS-013 | NIST/SEMATECH e-Handbook — memilih rancangan eksperimen | NIST · - | https://www.itl.nist.gov/div898/handbook/pri/section3/pri3.htm | 2026-10-11 | diperiksa | KE, CK, BL, AR, BR | Rancangan eksperimen umum | Tujuan → variabel & level → rancangan; blok acak | Panduan umum. |

## Terminologi

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-021 | ISO 15115:2019 Leather — Vocabulary | ISO/TC 120 · 2019 | https://www.iso.org/standard/67424.html | 2026-10-11 | diperiksa | BL | Istilah industri kulit | Definisi istilah (termasuk 'leather') — isi definisi belum dibaca | Isi definisi belum dibaca; relevan untuk boleh/tidaknya memakai kata 'leather' — klasifikasi bioleather belum jelas. |

## Info akses standar

| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |
|---|---|---|---|---|---|---|---|---|---|
| GS-014 | FAQ Pesta Online BSN | BSN · - | https://pesta.bsn.go.id/faq | 2026-10-11 | diperiksa | KE, CK, BL, AR, BR | Cara memperoleh naskah SNI | - | Portal Akses SNI timeout saat dicek. |

## Belum ditemukan / klasifikasi belum jelas

- **Kopra edibel:** standar produk khusus "kopra edibel" belum ditemukan; dosis perlakuan sulfur resmi/primer belum ditemukan (DEC-048).
- **Cuka air kelapa:** belum jelas masuk SNI cuka fermentasi atau cuka makan; standar Codex hanya dari sumber sekunder.
- **Bioleather:** standar produk belum ditemukan; boleh/tidaknya disebut "leather" belum jelas (GS-021).
- **Arang/briket shisha:** standar khusus belum ditemukan; EN 1860-2 hanya untuk BBQ.
