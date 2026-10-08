# ADR-004: Satuan internal SI; konversi hanya di lapisan presentasi

- **Status:** Accepted
- **Tanggal:** 2026-10-08
- **Terkait:** AR-04, NFR-07

## Konteks
Sumber data memakai cm, inch (keliling kelapa), g, kg, ton, m³/t (stowage factor), g/cm³. Kesalahan satuan adalah sumber bug paling umum di kalkulator logistik.

## Keputusan
- Engine hanya menerima & mengembalikan **m, kg, m³, kg/m³, fraksi (0–1)**.
- Dataset tetap memakai cm & g agar mudah dibaca manusia; **loader** mengonversi saat load (satu tempat).
- Stowage factor (m³/t) dikonversi: ρ = 1000 / SF.
- Tipe TypeScript bermerek (branded types: `Meters`, `Kg`, `M3`) mencegah pencampuran di compile time.
- Spek dagang "inch" untuk kelapa = **keliling**: D = C / π.

## Konsekuensi
- (+) Bug satuan tertangkap compiler.
- (−) Sedikit boilerplate konversi di UI.
