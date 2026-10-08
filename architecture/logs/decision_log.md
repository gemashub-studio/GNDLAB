# Decision Log

Indeks keputusan. Keputusan arsitektur berbobot didokumentasikan penuh sebagai ADR di `02-architecture/adr/`.

| ID | Tanggal | Keputusan | Alasan singkat | Dokumen |
|---|---|---|---|---|
| DEC-001 | 2026-10-08 | Satu engine TS murni untuk client & server | Offline + konsistensi angka | ADR-001 |
| DEC-002 | 2026-10-08 | Dataset terversi & immutable; override per skenario; kalibrasi via proposal | Reproducible & audit | ADR-002 |
| DEC-003 | 2026-10-08 | Nilai = rentang {min,typ,max}; min/max via evaluasi sudut 2^k | Variasi komoditas alami | ADR-003, calc_spec §2 |
| DEC-004 | 2026-10-08 | Satuan internal SI, branded types | Cegah bug satuan | ADR-004 |
| DEC-005 | 2026-10-08 | Model muat densitas efektif + grid kemasan | Akurat empiris, cepat | ADR-005 |
| DEC-006 | 2026-10-08 | Spek dagang "12–14 inch" kelapa ditafsirkan sebagai **keliling** | π·D (D 9,5 cm) = 29,8 cm ≈ 12 inch; tafsiran diameter (30–36 cm) tidak masuk akal untuk kelapa tanpa sabut | dataset `circumference_cm`, validator `jambul.circumference` |
| DEC-007 | 2026-10-08 | Benchmark 10–11 rb butir/20ft dipertahankan sebagai **skenario konservatif**, bukan dihapus | Satu sumber menyimpang ~50%; bisa jadi reefer/palet/butir besar | dataset, WARN di validation_log |
| DEC-008 | 2026-10-08 | Keyakinan campuran ("A/C") dihitung sebagai yang terlemah | Prinsip konservatif | validator & seed |
| DEC-009 | 2026-10-08 | Arang belah 2 dimodelkan 4 form: halves_loose, halves_nested, lumps, raw_halves | Densitas berbeda hingga 4× antar bentuk | ERD §3 |
| DEC-011 | 2026-10-08 | Nama aplikasi **gemasSTUDIO** | Keputusan owner | HANDOFF §6 |
| DEC-012 | 2026-10-08 | Gaya visual "Punk Skate Lab" (tanpa radius, garis 3px, bayangan keras, aksen #C6F135/#FF5A1F) menggantikan arah awal bernuansa kelapa lembut | Permintaan owner: lebih punk/skate, seperti lab | `06-design/design_spec.md` |
| DEC-013 | 2026-10-08 | Parameter R&D disimpan sebagai data (`rnd_param_def`, ber-versi), bukan kolom | Parameter dari owner menyusul & akan berubah; tanpa migrasi | `07-rnd/schema_rnd.sql` |
| DEC-014 | 2026-10-08 | Tahap proses R&D = template umum industri, wajib dikonfirmasi owner | Belum ada SOP owner | `07-rnd/PRD_RnD.md` §6 |
| DEC-010 | 2026-10-08 | Kelapa jambul 2 form: loose (483) & bagged (385) | Densitas lab ≠ densitas efektif container | ERD §3, ISS-004 |
