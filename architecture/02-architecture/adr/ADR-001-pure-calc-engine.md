# ADR-001: Engine kalkulasi sebagai paket TypeScript murni bersama

- **Status:** Accepted
- **Tanggal:** 2026-10-08
- **Terkait:** AR-01, NFR-01, NFR-03

## Konteks
Kalkulasi harus jalan offline di HP gudang (PWA) **dan** diverifikasi ulang di server saat skenario disimpan. Dua implementasi terpisah berisiko menghasilkan angka berbeda.

## Opsi
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| A. Engine hanya di server (API) | Satu sumber | Tidak offline; latensi |
| B. Engine di client + port terpisah di server (mis. Python) | Bahasa bebas | Dua kode → drift angka |
| **C. Satu paket TS murni dipakai client & server** | Satu sumber, offline, cepat | Terikat ekosistem JS |

## Keputusan
**Opsi C.** `packages/calc-engine` berisi fungsi murni (input → output, tanpa I/O, tanpa `Date.now()`, tanpa random kecuali seed eksplisit untuk Monte Carlo).

## Konsekuensi
- (+) Golden test tunggal menjaga client & server sekaligus.
- (+) Dapat di-run di Web Worker untuk Monte Carlo.
- (−) Validator Python (`scripts/validate_dataset.py`) tetap ada untuk pipeline data; golden cases yang dihasilkannya menjadi **kontrak** yang harus dipenuhi engine TS.
