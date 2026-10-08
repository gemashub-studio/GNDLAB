# Register Asumsi

Setiap asumsi berkeyakinan C yang memengaruhi hasil kalkulasi. **Prioritas** = dampak ke keputusan muat × ketidakpastian. Tutup asumsi dengan sampling (lihat `field_verification_log.md`) lalu ajukan `CALIBRATION_PROPOSAL`.

Baseline otomatis (v1.0.4): 45 parameter unik — A=6 · B=9 · **C=30** (`validation_log.md` → `confidence_profile`).

| ID | Parameter | Nilai (min/typ/max) | Dasar asumsi | Dampak bila salah | Prioritas | Cara verifikasi | Status |
|---|---|---|---|---|---|---|---|
| ASM-01 | `arang_batok_belah2.bulk_density.charcoal_halves_loose` | 50/85/155 kg/m³ | Turunan fisik: ρ_batok_mentah_belah (150/195/240, B) × yield (0,25/0,30/0,35) ÷ (1 − susut)³ — massa turun ~70%, volume keping hanya susut ~32%. Rumus diuji validator (`arang.halves_loose_density`) | Rentang sangat lebar (3×); kapasitas ton arang belah 2 bisa meleset > 50% | **Tinggi** | Isi kotak/ember volume terukur (≥ 0,2 m³), timbang, 5 ulangan | Terbuka |
| ASM-02 | `…charcoal_halves_nested` | 85/145/270 kg/m³ | Susun bersarang ~1,7× lebih padat dari lepas | Sama dengan ASM-01 | **Tinggi** | Susun bersarang dalam kotak, timbang, 5 ulangan | Terbuka |
| ASM-03 | `…nest_pitch` | 0,8/1,2/2,0 cm | Tebal dinding + celah | Jumlah keping per kolom | Sedang | Tumpuk 20 keping, ukur tinggi total | Terbuka |
| ASM-04 | `kelapa_jambul.geometry.body.*` | L 9–12,5 cm, D 8,5–11,5 cm | Data India (ICAR) dinaikkan untuk kelapa Dalam | Grid & simulasi 3D | Sedang | Jangka sorong 30 butir acak/lot | Terbuka |
| ASM-05 | `kelapa_jambul.tuft_extra_length` | 2/3/5 cm | Pengamatan visual umum | Bounding box | Rendah | Ukur 30 butir | Terbuka |
| ASM-06 | `kelapa_jambul.bulk_density.bagged_in_container` | 360/385/410 kg/m³ | Dihitung balik dari 22.500 butir × 0,57 kg / 33,2 m³ | Kapasitas butir/container | **Tinggi** | Catat realisasi stuffing (butir & karung per container) | Terbuka |
| ASM-07 | `kelapa_jambul.packaging.bag_dims_cm_filled` | 49×34×21 cm | Diturunkan balik dari 900–1000 karung/20GP | Grid kemasan & simulasi | Sedang | Ukur 10 karung terisi di tumpukan | Terbuka |
| ASM-08 | `arang.linear_shrinkage_on_carbonization` | 8/12/18 % | Literatur umum karbonisasi biomassa keras | Dimensi arang | Rendah | Ukur 20 batok sebelum & sesudah bakar | Terbuka |
| ASM-09 | `arang.mass_per_unit.raw_half_shell` & `charcoal_yield_mass_fraction` | 60/85/120 g; 0,25/0,30/0,35 | Tempurung 15–19% berat buah | Konversi batok → arang | Sedang | Timbang 30 keping sebelum & sesudah | Terbuka |
| ASM-10 | `kopra_asalan.geometry.piece.*`, `mass_per_piece` | 4–14 cm; 25–130 g | Daging ½ butir pecah 2–4 | Hanya visual; hitung massa pakai densitas | Rendah | Ukur & timbang 30 keping | Terbuka |
| ASM-11 | `kopra_edible.bulk_density.loose_cups` | 300/350/420 kg/m³ | Interpolasi dari angka dalam karung | Gudang curah edible | Sedang | Uji kotak volume | Terbuka |
| ASM-12 | Utilisasi volume `u` (arang lump 0,80; kopra karung 0,90) | – | Kalibrasi agar cocok benchmark arang 12–13 t | Semua mode A | Sedang | Realisasi stuffing | Terbuka |
| ASM-13 | Utilisasi lantai gudang `u_f` | 0,65 | Praktik umum gudang dengan lorong forklift/manual | Luas lantai | Sedang | Ukur zona aktual | Terbuka |
| ASM-14 | Tinggi tumpuk maks (jambul 1,8 m; kopra 2,5 m; edible 10 karung) | – | Praktik umum, keselamatan & ventilasi | Kapasitas gudang | Sedang | SOP gudang pengguna | Terbuka |
| ASM-16 | Dimensi karung arang 25 kg terisi | 64×45×21 cm | Volume isi 53 L + kalibrasi grid ke benchmark 12–13 t/20GP | Simulator & gudang arang | Sedang | Ukur 10 karung di tumpukan | Terbuka |
| ASM-17 | Dimensi karung kopra asalan 50 kg terisi | 88×55×27 cm | Volume isi 114 L (ρ 440) dalam karung datar 70×110 | Gudang kopra asalan | Sedang | Ukur 10 karung + catat realisasi stuffing | Terbuka |
| ASM-18 | Dimensi karung kopra edible 25 kg terisi | 79×53×18 cm | Volume isi 71 L + kalibrasi grid ke benchmark 10–11 t/20GP | Simulator & gudang edible | Sedang | Ukur 10 karung | Terbuka |
| ASM-19 | Dimensi jumbo bag arang 550 kg | 95×95×130 cm | Volume isi 1,16 m³ (ρ 475) | Gudang arang curah besar | Rendah | Ukur jumbo bag pemasok | Terbuka |
| ASM-15 | Payload container (20GP 28.200; 40GP 26.700; 40HC 26.500 kg) | – | Nilai tipikal; bervariasi per pemilik container & aturan jalan | Kasus WEIGHT-limited | Rendah | Cek CSC plate / booking | Terbuka |
