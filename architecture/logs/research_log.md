# Research Log

Catatan riset sumber data, urut sesuai pelaksanaan (semua pada 2026-10-08, sesi riset ±18:08–18:12 WIB). Kriteria grade: **A** jurnal/standar/otoritas kargo · **B** spesifikasi dagang (≥ 2 sumber konsisten) · **C** estimasi turunan.

| # | Urutan | Kueri / tindakan | Temuan kunci | Dipakai untuk | Sumber |
|---|---|---|---|---|---|
| R01 | 1 | "kelapa jambul ukuran diameter berat per butir ekspor" | Hasil umumnya berita harga/ekspor; tidak ada spek dimensi jambul resmi | Konfirmasi celah data lokal | – |
| R02 | 2 | "semi husked coconut dimensions weight container 20ft 40ft" | Berat 450–850 g/butir; 25 butir/karung ±14 kg; 900–1000 karung/20ft ≈ 22.500 butir; 1800–1950 karung/40ft; satu sumber 10–11 rb/20ft (menyimpang) | Massa, kemasan, benchmark jambul | S05–S08 |
| R03 | 3 | "coconut shell charcoal bulk density" | Densitas curah arang 400–550 kg/m³; tempurung 412 kg/m³ (jurnal); briket 920 kg/m³ (bukan lingkup) | Densitas arang lump | S10, S11 |
| R04 | 4 | "copra bulk density stowage" | Stowage factor 1,84–2,27 m³/t (curah), 2,27 m³/t karung goni 65 kg; BIMCO 500 kg/m³; kadar air aman 5–6% | Densitas & kadar air kopra | S15, S16 |
| R05 | 5 | "coconut physical properties polar equatorial diameter" | Kelapa tanpa sabut: panjang 99 mm, diameter 91,5/89,5 mm, sferisitas 0,90, ρ_true 998, ρ_bulk 483 kg/m³ | Geometri & φ jambul | S01, S02 |
| R06 | 6 | "SNI kopra mutu kadar air kopra putih edible" | SNI 01-3946-1995 kopra putih: air maks 5%, minyak 60–65%, ALB maks 2%; kopra asap 15–22% air | Mutu kopra edible vs asalan | S17, S18 |
| R07 | 7 | "arang tempurung kelapa karung container" | Tidak ada angka muat spesifik; tempurung 15–19% berat buah | Konteks saja | – |
| R08 | 8 | "edible copra cups size packing container" | Ukuran 4–10 cm; karung 25/50 kg; 10–11 MT/20ft (karung 25 kg); MOQ 24–27 t/40ft; buyer "cup ≤ 9 cm" | Geometri & benchmark kopra edible | S19, S20 |
| R09 | 9 | "\"kelapa jambul\" berat kg diameter cm" | Kelapa tua utuh bersabut Ø 19,8–22,5 cm, 4,3–4,8 kg (Polije); genjah 1,5–2 kg | Batas atas sanity check (bukan jambul) | S03 |
| R10 | 10 | "coconut shell charcoal halves bulk density container" | Arang 12–13 t/20ft, 26 t/40HC (karung 25 kg); batok mentah belah 8–14 cm, 5–8 t/20ft, 10–16 t/40HC (volume-limited) | Benchmark arang & batok belah | S12–S14 |

| R11 | 11 | "ukuran karung 50 kg cm karung goni 25 kg ukuran" → baca halaman harga.web.id | 25 kg ≈ 45×75 / 56×90 cm; 50 kg ≈ 60×100 / 50×80; 80–100 kg ≈ 74×109, 70–75×110–115; 500 kg ≈ 120×180 | Ukuran karung datar | S23 |
| R12 | 12 | "jumbo bag FIBC standard size 90x90x100" | Jumbo bag standar 90×90×90 / 90×90×100 cm, 1000 kg (umumnya untuk material lebih padat) | Jumbo bag arang | S24 |

## Celah Data yang Tercatat
1. **Tidak ada data publik terukur** untuk densitas arang batok **utuh belah 2** (lepas maupun bersarang) → estimasi C (lihat ASM-01, ASM-02).
2. Dimensi & massa spesifik **kelapa Dalam Indonesia** bentuk jambul belum ada di literatur yang ditemukan; dipakai data India/Filipina + koreksi naik (ASM-04).
3. Kopra asalan tidak punya benchmark muat container dari pasar (golden `asalan_bagged_20GP` bertanda "perlu data lapangan").
