# ADR-003: Semua nilai fisik direpresentasikan sebagai rentang {min, typ, max}

- **Status:** Accepted
- **Tanggal:** 2026-10-08
- **Terkait:** AR-03, FR-08, FR-12, US-07

## Konteks
Komoditas alami sangat bervariasi (berat kelapa jambul 450–850 g; densitas arang belah 2 lepas 50–155 kg/m³). Satu angka tunggal menyesatkan pengambil keputusan muat.

## Opsi
| Opsi | Catatan |
|---|---|
| A. Satu nilai | Sederhana, menyesatkan |
| **B. Triplet min/typ/max + aturan kombinasi deterministik** | Mudah dipahami, cepat |
| C. Distribusi statistik penuh (mean, sd) | Butuh data yang belum ada |

## Keputusan
**Opsi B** sebagai default; **Monte Carlo** (distribusi segitiga dari triplet, seed tetap) sebagai mode opsional (FR-12). Aturan kombinasi "kasus terburuk/terbaik" dijabarkan di `calculation_spec.md §2` (contoh: kapasitas butir minimum = densitas efektif min ÷ massa butir maks).

## Konsekuensi
- (+) Pengguna melihat ketidakpastian secara eksplisit.
- (−) Rentang worst/best bisa lebar; UI menonjolkan `typ` dan menampilkan min–max sebagai pita.
- Saat sampling n ≥ 30 tersedia, bisa naik ke Opsi C tanpa mengubah API (field tambahan `sd`).
