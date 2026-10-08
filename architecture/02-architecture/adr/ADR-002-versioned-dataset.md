# ADR-002: Dataset referensi terversi, immutable, dengan override per skenario

- **Status:** Accepted
- **Tanggal:** 2026-10-08
- **Terkait:** AR-02, AR-06, FR-11, NFR-05

## Konteks
Banyak parameter masih berkeyakinan C dan akan dikalibrasi dari sampling lapangan. Skenario lama harus tetap bisa direproduksi dengan angka yang sama walau dataset diperbarui.

## Keputusan
1. Dataset JSON (`00-research/data`) adalah **sumber kebenaran awal**, di-seed ke tabel `DATASET_VERSION` + `PARAMETER`.
2. Setiap versi **immutable** setelah status `PUBLISHED`. Perubahan = versi baru (SemVer: patch = koreksi nilai, minor = parameter baru, major = perubahan skema).
3. Skenario menyimpan `dataset_version_id` + `SCENARIO_OVERRIDE` sendiri; tidak pernah mengubah dataset.
4. Kalibrasi lapangan masuk sebagai `CALIBRATION_PROPOSAL` → disetujui `data_admin` → membentuk versi baru.
5. Setiap transisi tercatat di `AUDIT_LOG` dan `logs/CHANGELOG.md`.

## Konsekuensi
- (+) Reproducible; audit lengkap.
- (−) Penyimpanan bertambah per versi (kecil: < 50 KB/versi).
