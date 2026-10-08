# brain/ — Otak Kedua gemasSTUDIO (lintas agent)

Memori proyek yang **dibaca & ditulis oleh semua agent** (Claude Code, subagent, Codex, Cursor, manusia).
Ini melengkapi — bukan menggantikan — `architecture/` (spesifikasi resmi) dan `architecture/logs/` (log formal).

| File | Isi | Kapan dibaca |
|---|---|---|
| [`plan.md`](plan.md) | Rencana M1–M5, status per fase, langkah berikutnya | Selalu, di awal sesi |
| [`findings.md`](findings.md) | Temuan teknis (FND-xxx): jebakan, keputusan kecil, perilaku tak terduga | Sebelum menyentuh engine/dataset/DB |
| [`domain.md`](domain.md) | Glosarium domain: inventory, muat container, kopra, arang, R&D batch | Saat butuh konteks bisnis |
| [`benchmark.md`](benchmark.md) | Benchmark produk/teknik (bukan angka data) + sumber | Saat merancang UI/fitur M2–M5 |
| [`environment.md`](environment.md) | Setup mesin Windows owner, perintah, masalah toolchain | Saat menjalankan perintah |
| [`sessions.md`](sessions.md) | Jurnal singkat per sesi (apa dikerjakan, apa tertunda) | Saat melanjutkan pekerjaan |

## Protokol (wajib untuk setiap agent)

1. **Baca** `plan.md` + `sessions.md` (entri terakhir) sebelum mulai.
2. **Tulis temuan** di `findings.md` begitu ditemukan (jangan menunggu akhir sesi). Format: `FND-NNN`, tanggal, ringkas, *Why*, *How to apply*.
3. Temuan yang menjadi keputusan arsitektur → juga `architecture/logs/decision_log.md` (+ ADR bila berbobot). Bug/risiko → `architecture/logs/risk_issue_log.md`.
4. Akhiri sesi dengan satu entri di `sessions.md` dan perbarui status di `plan.md`.
5. **Angka data tidak pernah ditulis di sini sebagai sumber.** Sumber angka satu-satunya: `architecture/00-research/data/coconut_inventory_dataset.json`.
6. Jangan menyimpan rahasia (password, token, URL DB berkredensial) di folder ini.
