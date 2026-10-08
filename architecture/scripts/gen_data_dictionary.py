#!/usr/bin/env python3
"""gen_data_dictionary.py — Bangkitkan 03-data/data_dictionary.md.
Bagian 1-2 diambil dari scripts/_data_dictionary_header.md (edit di sana),
bagian 3 (katalog parameter) dibangkitkan dari dataset dengan aturan seed yang sama."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from seed_from_dataset import ranges, unit_for, norm_key  # noqa: E402

d = json.loads((ROOT / "00-research/data/coconut_inventory_dataset.json").read_text(encoding="utf-8"))
L = [(ROOT / "scripts/_data_dictionary_header.md").read_text(encoding="utf-8").rstrip() + "\n",
     f"## 3. Katalog Parameter (dibangkitkan dari dataset v{d['meta']['version']})\n",
     "> Dibangkitkan oleh `scripts/gen_data_dictionary.py` dengan aturan yang sama dengan "
     "`scripts/seed_from_dataset.py`. Nilai dalam satuan SI hasil konversi. Jangan edit manual."]
n = 0
for cm in d["commodities"]:
    L.append(f"\n### `{cm['id']}` — {cm['name_id']}\n\n| key | unit | min | typ | max | keyakinan |\n|---|---|---|---|---|---|")
    for path, r, c in ranges(cm):
        if path.startswith(("packaging", "container_benchmarks")):
            continue
        unit, f = unit_for(path)
        key = f"bulk_density[{path.split('.', 1)[1]}]" if path.startswith("bulk_density_kg_m3.") else norm_key(path)
        L.append(f"| `{key}` | {unit} | {r['min']*f:.6g} | {r['typ']*f:.6g} | {r['max']*f:.6g} | {c or 'C'} |")
        n += 1
(ROOT / "03-data/data_dictionary.md").write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"data_dictionary.md: {n} parameter")
