#!/usr/bin/env python3
"""
seed_from_dataset.py — Membangkitkan 03-data/seed.sql dari dataset JSON.

Menerapkan pemetaan ERD.md §3 dan konversi satuan ADR-004 (cm->m, g->kg, cm3->m3).
Gagal (exit 1) bila menemukan rentang dengan satuan yang tidak dikenali,
sehingga tidak ada parameter yang "diam-diam" salah satuan.

Pemakaian:
  python3 scripts/seed_from_dataset.py            # tulis 03-data/seed.sql
  psql -d coco -f 03-data/schema.sql -f 03-data/seed.sql
"""
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "00-research" / "data" / "coconut_inventory_dataset.json"
OUT = ROOT / "03-data" / "seed.sql"
NS = uuid.UUID("6f1c2a1e-0000-4000-8000-c0c0a0000000")  # UUID deterministik -> seed idempoten

# Form per komoditas (ERD §3). bulk_density key -> (form_code, shape override?, calc_mode)
FORMS = {
    "kelapa_jambul": {"loose": ("loose_pile", "PIECE", False), "bagged": ("bagged_in_container", "PACKAGE", False)},
    "arang_batok_belah2": {
        "halves_loose": ("charcoal_halves_loose", "PIECE", True),
        "halves_nested": ("charcoal_halves_nested", "PIECE", True),
        "lumps": ("charcoal_broken_lumps", "BULK", False),
        "raw_halves": ("raw_halves_loose", "BULK", True),
    },
    "kopra_asalan": {"loose_bulk": ("loose_bulk", "BULK", False), "bagged_jute": ("bagged_jute", "BULK", False)},
    "kopra_edible": {"loose_cups": ("loose_cups", "BULK", False), "bagged": ("bagged_in_container", "PACKAGE", False)},
}
SHAPE_BULK_FORMS = {"lumps", "loose_bulk", "bagged_jute"}


def uid(*parts):
    return str(uuid.uuid5(NS, "/".join(parts)))


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(round(v, 9))
    return "'" + str(v).replace("'", "''") + "'"


def unit_for(path):
    """Return (param_unit, factor) atau None bila tidak dikenali."""
    p = path.lower()
    # urutan penting: fraksi diperiksa lebih dulu agar "..._mass_fraction" tidak terbaca sebagai massa
    if "fraction" in p or "shrinkage" in p:
        return "fraction", 1
    if "kg_m3" in p or "density" in p:
        return "kg_m3", 1
    if "cm3" in p:
        return "m3", 1e-6
    if "_cm" in p or p.endswith("cm") or "circumference" in p:
        return "m", 0.01
    if "mass" in p or p.endswith("_g") or "_g." in p or "per_nut_g" in p:
        return "kg", 0.001
    if "bag_net_kg" in p:
        return "kg", 1
    if "pct" in p:
        return "pct", 1
    if "fraction" in p or "shrinkage" in p:
        return "fraction", 1
    if "nuts_per_kg" in p:
        return "count", 1
    if "stack_height_m" in p or "pile_height_m" in p:
        return "m", 1
    if "stack_height_bags" in p:
        return "count", 1
    return None


def ranges(node, path="", conf=None):
    """Yield (path, range, confidence). Confidence diwarisi dari ancestor terdekat;
    nilai campuran seperti "A/C" diambil yang TERLEMAH (konservatif)."""
    if isinstance(node, dict):
        own = node.get("confidence")
        if isinstance(own, str):
            conf = max(own.split("/"))  # 'A' < 'B' < 'C' -> max = terlemah
        if {"min", "typ", "max"} <= node.keys() and all(isinstance(node[k], (int, float)) for k in ("min", "typ", "max")):
            yield path, node, conf
            return
        for k, v in node.items():
            yield from ranges(v, f"{path}.{k}" if path else k, conf)


UNIT_SUFFIXES = ("_kg_m3", "_cm3", "_cm", "_g", "_pct", "_kg")


def norm_key(path):
    """Buang sufiks satuan dari setiap segmen path (satuan disimpan di kolom unit)."""
    segs = []
    for seg in path.split("."):
        for suf in UNIT_SUFFIXES:
            if seg.endswith(suf) and seg != suf.lstrip("_"):
                seg = seg[: -len(suf)]
                break
        segs.append(seg)
    return ".".join(segs)


def main():
    d = json.loads(DATASET.read_text(encoding="utf-8"))
    ver = d["meta"]["version"]
    dv = uid("dv", ver)
    out = [f"-- seed.sql — DIBANGKITKAN otomatis dari dataset v{ver}. Jangan edit manual.",
           "BEGIN;",
           f"INSERT INTO dataset_version (id, semver, changelog) VALUES ({q(dv)}, {q(ver)}, {q('Seed awal dari riset ' + d['meta']['compiled'])});"]
    src_ids = {}
    for s in d["sources"]:
        sid = uid("src", ver, s["id"])
        src_ids[s["id"]] = sid
        out.append(f"INSERT INTO source (id, dataset_version_id, code, title, url, grade, accessed_at) VALUES "
                   f"({q(sid)}, {q(dv)}, {q(s['id'])}, {q(s['title'])}, {q(s['url'])}, {q(s['grade'])}, {q(d['meta']['compiled'])});")
    cont_ids = {}
    for c in d["containers"]:
        cid = uid("cont", ver, c["id"])
        cont_ids[c["id"]] = cid
        i = c["inner_cm"]
        out.append(f"INSERT INTO container_type (id, dataset_version_id, code, name, inner_l_m, inner_w_m, inner_h_m, payload_kg, confidence) VALUES "
                   f"({q(cid)}, {q(dv)}, {q(c['id'])}, {q(c['name'])}, {q(i['L']/100)}, {q(i['W']/100)}, {q(i['H']/100)}, {q(c['payload_kg'])}, {q(c['confidence'])});")

    unknown, n_param, n_pack, n_bench = [], 0, 0, 0
    for cm in d["commodities"]:
        cmid = uid("cm", ver, cm["id"])
        out.append(f"INSERT INTO commodity (id, dataset_version_id, code, name_id, name_en, unit_type, description) VALUES "
                   f"({q(cmid)}, {q(dv)}, {q(cm['id'])}, {q(cm['name_id'])}, {q(cm.get('name_en'))}, {q(cm['unit_type'])}, {q(cm.get('description'))});")
        bd = cm["bulk_density_kg_m3"]
        for form_code, (bd_key, mode, nestable) in FORMS[cm["id"]].items():
            if bd_key not in bd:
                print(f"ERROR: {cm['id']}.{form_code} butuh bulk_density.{bd_key}", file=sys.stderr)
                sys.exit(1)
            fid = uid("form", ver, cm["id"], form_code)
            shape = "bulk" if form_code in SHAPE_BULK_FORMS else cm["geometry"]["shape"]
            out.append(f"INSERT INTO commodity_form (id, commodity_id, code, shape, calc_mode_default, nestable) VALUES "
                       f"({q(fid)}, {q(cmid)}, {q(form_code)}, {q(shape)}, {q(mode)}, {q(nestable)});")
            # parameter: semua rentang komoditas, kecuali bulk_density milik form lain
            for path, r, inherited_conf in ranges(cm):
                if path.startswith("bulk_density_kg_m3.") and path != f"bulk_density_kg_m3.{bd_key}":
                    continue
                if path.startswith("packaging") or path.startswith("container_benchmarks"):
                    continue
                key = "bulk_density" if path.startswith("bulk_density_kg_m3.") else norm_key(path)
                u = unit_for(path)
                if u is None:
                    unknown.append(f"{cm['id']}:{path}")
                    continue
                unit, f = u
                # pengaman: unit fraksi wajib 0..1, unit massa per-unit wajib < 50 kg
                if unit == "fraction" and r["max"] > 1:
                    unknown.append(f"{cm['id']}:{path} (fraksi > 1)")
                if unit == "kg" and "bag" not in path and r["max"] * f > 50:
                    unknown.append(f"{cm['id']}:{path} (massa per unit > 50 kg, cek satuan)")
                conf = inherited_conf or "C"  # tanpa label -> anggap estimasi (C)
                out.append(f"INSERT INTO parameter (id, commodity_form_id, key, unit, v_min, v_typ, v_max, confidence, note) VALUES "
                           f"({q(uid('p', ver, cm['id'], form_code, key))}, {q(fid)}, {q(key)}, {q(unit)}, "
                           f"{q(r['min']*f)}, {q(r['typ']*f)}, {q(r['max']*f)}, {q(conf)}, {q(r.get('note'))});")
                n_param += 1
            for i, pk in enumerate(cm["packaging"]):
                if "bag_net_kg" not in pk:
                    continue
                dims = pk.get("bag_dims_cm_filled") or {}
                out.append(f"INSERT INTO packaging_type (id, commodity_form_id, code, pcs_per_pack, net_kg_min, net_kg_typ, net_kg_max, "
                           f"dim_l_m, dim_w_m, dim_h_m, deformable, dims_confidence) VALUES "
                           f"({q(uid('pk', ver, cm['id'], form_code, str(i)))}, {q(fid)}, {q(pk['type'])}, {q(pk.get('pcs_per_bag'))}, "
                           f"{q(pk['bag_net_kg']['min'])}, {q(pk['bag_net_kg']['typ'])}, {q(pk['bag_net_kg']['max'])}, "
                           f"{q(dims['L']/100 if dims else None)}, {q(dims['W']/100 if dims else None)}, {q(dims['H']/100 if dims else None)}, "
                           f"true, {q(dims.get('confidence'))});")
                n_pack += 1
            for j, b in enumerate(cm.get("container_benchmarks", [])):
                # benchmark arang dipasang ke form yang sesuai
                if cm["id"] == "arang_batok_belah2":
                    want = "lumps" if b["form"].startswith("arang") else "raw_halves"
                    if form_code != want:
                        continue
                elif cm["id"] in ("kopra_edible", "kelapa_jambul") and form_code != "bagged":
                    continue

                def rng(k):
                    v = b.get(k)
                    if v is None:
                        return None, None
                    return (v["min"], v["max"]) if isinstance(v, dict) else (v, v)
                pmin, pmax = rng("pcs")
                kmin, kmax = rng("bags")
                tmin, tmax = rng("net_t")
                bid = uid("b", ver, cm["id"], form_code, str(j))
                out.append(f"INSERT INTO container_benchmark (id, commodity_form_id, container_type_id, pcs_min, pcs_max, packs_min, packs_max, "
                           f"net_t_min, net_t_max, conservative, note) VALUES ({q(bid)}, {q(fid)}, {q(cont_ids[b['container']])}, "
                           f"{q(pmin)}, {q(pmax)}, {q(kmin)}, {q(kmax)}, {q(tmin)}, {q(tmax)}, {q('konservatif' in b.get('note', ''))}, {q(b.get('note'))});")
                for sid in b["source_ids"]:
                    out.append(f"INSERT INTO benchmark_source (benchmark_id, source_id) VALUES ({q(bid)}, {q(src_ids[sid])});")
                n_bench += 1

    if unknown:
        print("ERROR: satuan tidak dikenali untuk:\n  " + "\n  ".join(unknown), file=sys.stderr)
        sys.exit(1)
    out += [f"UPDATE dataset_version SET status='PUBLISHED', published_at=now(), is_active=true WHERE id={q(dv)};", "COMMIT;"]
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"seed.sql: v{ver} | {len(d['sources'])} source | {len(d['containers'])} container | "
          f"{n_param} parameter | {n_pack} packaging | {n_bench} benchmark")


if __name__ == "__main__":
    main()
