"""Bangkitkan architecture/07-rnd/library/sumber/sources.md dari apps/web/src/data/gemaSources.json.

Satu sumber kebenaran: JSON dibaca aplikasi (Library GEMA RnD); dokumen ini untuk dibaca manusia.
Jalankan: python architecture/scripts/gen_gema_sources.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
src = json.loads((ROOT / 'apps/web/src/data/gemaSources.json').read_text(encoding='utf-8'))
cats = src['categories']

HEAD = f"""# Library Sumber — GEMA RnD

> Dibangkitkan dari `../apps/web/src/data/gemaSources.json` oleh `scripts/gen_gema_sources.py` — **jangan edit manual**; ubah JSON lalu jalankan skrip. Uji unit memastikan keduanya sinkron.

Dicek: {src['checkedAt']}.

**Status pemeriksaan**
- `diperiksa` = halaman resmi dibuka sendiri pada tanggal akses (isi naskah bisa tetap belum dibaca — lihat kolom keterbatasan).
- `dilaporkan` = disebut sumber lain/penelusuran awal, belum bisa dikonfirmasi ulang.
- `belum-diperiksa` = belum dibuka.

**Penting:** "Berlaku" di katalog BSN = status dokumen, BUKAN bukti wajib diterapkan atau produk memenuhi standar. Batas residu (mis. SO₂) = syarat produk akhir, BUKAN dosis proses.

"""

lines = [HEAD]
for key, label in cats.items():
    rows = [s for s in src['sources'] if s['category'] == key]
    if not rows:
        continue
    lines.append(f"## {label}\n\n")
    lines.append('| source_id | Judul | Lembaga · tahun | URL | Akses | Status | Produk | Ruang lingkup | Parameter yang diatur | Keterbatasan |\n')
    lines.append('|---|---|---|---|---|---|---|---|---|---|\n')
    for s in rows:
        cells = [s['id'], s['title'], f"{s['org']} · {s['year']}", s['url'], s['accessed'] or '–', s['status'], ', '.join(s['products']), s['scope'], s['regulates'], s['limits']]
        lines.append('| ' + ' | '.join(c.replace('|', '/') for c in cells) + ' |\n')
    lines.append('\n')

lines.append('## Belum ditemukan / klasifikasi belum jelas\n\n')
lines.append('- **Kopra edibel:** standar produk khusus "kopra edibel" belum ditemukan; dosis perlakuan sulfur resmi/primer belum ditemukan (DEC-048).\n')
lines.append('- **Cuka air kelapa:** belum jelas masuk SNI cuka fermentasi atau cuka makan; standar Codex hanya dari sumber sekunder.\n')
lines.append('- **Bioleather:** standar produk belum ditemukan; boleh/tidaknya disebut "leather" belum jelas (GS-021).\n')
lines.append('- **Arang/briket shisha:** standar khusus belum ditemukan; EN 1860-2 hanya untuk BBQ.\n')

out = ROOT / 'architecture/07-rnd/library/sumber/sources.md'
out.write_text(''.join(lines), encoding='utf-8')
print(f'{out.relative_to(ROOT)}: {len(src["sources"])} sumber')
