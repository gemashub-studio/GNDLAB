#!/usr/bin/env python3
"""
validate_dataset.py — Validator dataset komoditas kelapa.

Menjalankan 4 kelompok uji:
  1. SCHEMA   : field wajib ada, tipe benar, unit konsisten
  2. RANGE    : setiap {min, typ, max} memenuhi min <= typ <= max dan > 0
  3. CROSS    : nilai turunan cocok dengan rumusnya (toleransi 10%)
  4. BENCH    : hasil kalkulasi vs benchmark container dari sumber dagang

Output:
  - stdout ringkas
  - logs/validation_log.md  (laporan lengkap, ditimpa tiap run)
  - tests/fixtures/golden_cases.json (kasus uji acuan untuk engine kalkulator)

Exit code: 0 bila tidak ada FAIL, 1 bila ada FAIL.

Pemakaian:
  python3 scripts/validate_dataset.py [path/dataset.json]
"""
import json
import math
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATASET = ROOT / "00-research" / "data" / "coconut_inventory_dataset.json"
LOG_PATH = ROOT / "logs" / "validation_log.md"
GOLDEN_PATH = ROOT / "tests" / "fixtures" / "golden_cases.json"
TOL = 0.10  # toleransi uji silang 10 %
WIB = timezone(timedelta(hours=7))

results = []  # (status, group, check_id, message)


def rec(status, group, cid, msg):
    results.append((status, group, cid, msg))


def is_range(v):
    return isinstance(v, dict) and {"min", "typ", "max"} <= set(v.keys())


def walk_ranges(node, path=""):
    """Yield (path, range_dict) untuk setiap objek {min,typ,max}."""
    if is_range(node):
        yield path, node
    if isinstance(node, dict):
        for k, v in node.items():
            yield from walk_ranges(v, f"{path}.{k}" if path else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk_ranges(v, f"{path}[{i}]")


def close(actual, expected, tol=TOL):
    if expected == 0:
        return actual == 0
    return abs(actual - expected) / abs(expected) <= tol


def within(x, r, tol=TOL):
    return r["min"] * (1 - tol) <= x <= r["max"] * (1 + tol)


# ----------------------------------------------------------------- 1. SCHEMA
def check_schema(d):
    for key in ("meta", "containers", "commodities", "sources"):
        if key in d:
            rec("PASS", "SCHEMA", f"root.{key}", "ada")
        else:
            rec("FAIL", "SCHEMA", f"root.{key}", "field root wajib hilang")

    src_ids = {s["id"] for s in d.get("sources", [])}
    for s in d.get("sources", []):
        ok = s.get("url", "").startswith("http") and s.get("grade") in ("A", "B", "C")
        rec("PASS" if ok else "FAIL", "SCHEMA", f"source.{s.get('id')}",
            "url & grade valid" if ok else "url/grade tidak valid")

    for c in d.get("containers", []):
        L, W, H = (c["inner_cm"][k] for k in ("L", "W", "H"))
        vol = L * W * H / 1e6
        ok = close(vol, c["volume_m3"], 0.02)
        rec("PASS" if ok else "FAIL", "SCHEMA", f"container.{c['id']}.volume",
            f"L*W*H = {vol:.2f} m3 vs tercatat {c['volume_m3']} m3")

    ids = set()
    for cm in d.get("commodities", []):
        cid = cm.get("id")
        if cid in ids:
            rec("FAIL", "SCHEMA", f"commodity.{cid}", "id duplikat")
        ids.add(cid)
        for f in ("name_id", "unit_type", "geometry", "bulk_density_kg_m3", "packaging"):
            rec("PASS" if f in cm else "FAIL", "SCHEMA", f"commodity.{cid}.{f}",
                "ada" if f in cm else "field wajib hilang")
        if cm.get("unit_type") not in ("piece", "bulk"):
            rec("FAIL", "SCHEMA", f"commodity.{cid}.unit_type", "harus 'piece' atau 'bulk'")
        for b in cm.get("container_benchmarks", []):
            for sid in b.get("source_ids", []):
                if sid not in src_ids:
                    rec("FAIL", "SCHEMA", f"commodity.{cid}.benchmark", f"source_id {sid} tidak terdaftar")


# ------------------------------------------------------------------ 2. RANGE
def check_ranges(d):
    n = 0
    for path, r in walk_ranges(d["commodities"]):
        n += 1
        lo, ty, hi = r["min"], r["typ"], r["max"]
        if not all(isinstance(x, (int, float)) for x in (lo, ty, hi)):
            rec("FAIL", "RANGE", path, "nilai bukan angka")
        elif not (0 < lo <= ty <= hi):
            rec("FAIL", "RANGE", path, f"melanggar 0 < min <= typ <= max ({lo}, {ty}, {hi})")
    rec("PASS", "RANGE", "all", f"{n} objek range diperiksa")

    # Profil keyakinan (dipakai metrik PRD §8): confidence diwarisi dari ancestor terdekat,
    # nilai campuran "A/C" diambil yang terlemah.
    def walk(node, path="", conf=None):
        if isinstance(node, dict):
            own = node.get("confidence")
            if isinstance(own, str):
                conf = max(own.split("/"))
            if is_range(node) and all(isinstance(node[k], (int, float)) for k in ("min", "typ", "max")):
                yield path, conf or "C"
                return
            for k, v in node.items():
                if k in ("packaging", "container_benchmarks"):
                    continue
                yield from walk(v, f"{path}.{k}" if path else k, conf)
    prof = {"A": 0, "B": 0, "C": 0}
    for cm in d["commodities"]:
        for _, c in walk(cm):
            prof[c] += 1
    rec("INFO", "RANGE", "confidence_profile",
        f"{sum(prof.values())} parameter unik: A={prof['A']} · B={prof['B']} · C={prof['C']} (C wajib diverifikasi lapangan)")


# ------------------------------------------------------------------ 3. CROSS
def by_id(d, cid):
    return next(c for c in d["commodities"] if c["id"] == cid)


def ellipsoid_cm3(L, D):
    return math.pi / 6 * L * D * D


def check_cross(d):
    # --- kelapa jambul
    kj = by_id(d, "kelapa_jambul")
    g = kj["geometry"]
    for k in ("min", "typ", "max"):
        v = ellipsoid_cm3(g["body_cm"]["length_polar"][k], g["body_cm"]["diameter_equatorial"][k])
        tgt = g["solid_volume_cm3"][k]
        rec("PASS" if close(v, tgt) else "FAIL", "CROSS", f"jambul.solid_volume.{k}",
            f"(pi/6)L*D^2 = {v:.0f} cm3 vs tercatat {tgt}")
    for k in ("min", "typ", "max"):
        bb = g["body_cm"]["length_polar"][k] + g["tuft_extra_length_cm"][k]
        tgt = g["bounding_box_cm"]["L"][k]
        rec("PASS" if close(bb, tgt) else "FAIL", "CROSS", f"jambul.bbox_L.{k}",
            f"L_body + tuft = {bb:.1f} cm vs tercatat {tgt}")
    m_calc = g["solid_volume_cm3"]["typ"] * kj["true_density_kg_m3"]["typ"] / 1000
    rec("PASS" if close(m_calc, kj["mass_per_unit_g"]["typ"], 0.15) else "WARN", "CROSS", "jambul.mass_from_volume",
        f"V*rho = {m_calc:.0f} g vs massa typ {kj['mass_per_unit_g']['typ']} g (tol 15%; sisa sabut menambah massa)")
    circ = math.pi * g["body_cm"]["diameter_equatorial"]["typ"]
    rec("PASS" if within(circ, g["circumference_cm"]) else "FAIL", "CROSS", "jambul.circumference",
        f"pi*D = {circ:.1f} cm, rentang {g['circumference_cm']['min']}-{g['circumference_cm']['max']}")
    pf = kj["bulk_density_kg_m3"]["loose_pile"]["typ"] / kj["true_density_kg_m3"]["typ"]
    rec("PASS" if close(pf, kj["packing_fraction_random"]["typ"], 0.05) else "FAIL", "CROSS", "jambul.packing_fraction",
        f"rho_bulk/rho_true = {pf:.3f} vs tercatat {kj['packing_fraction_random']['typ']}")
    bag = kj["packaging"][0]
    bag_kg = bag["pcs_per_bag"] * kj["mass_per_unit_g"]["typ"] / 1000
    rec("PASS" if close(bag_kg, bag["bag_net_kg"]["typ"]) else "FAIL", "CROSS", "jambul.bag_mass",
        f"{bag['pcs_per_bag']} x {kj['mass_per_unit_g']['typ']} g = {bag_kg:.2f} kg vs tercatat {bag['bag_net_kg']['typ']}")

    # --- arang batok belah 2
    ab = by_id(d, "arang_batok_belah2")
    g = ab["geometry"]
    s = g["linear_shrinkage_on_carbonization"]
    for dim in ("rim_diameter", "depth", "wall_thickness"):
        raw, ch = g["raw_half_shell_cm"][dim], g["charcoal_half_cm"][dim]
        exp = {"min": raw["min"] * (1 - s["max"]), "typ": raw["typ"] * (1 - s["typ"]), "max": raw["max"] * (1 - s["min"])}
        for k in ("min", "typ", "max"):
            rec("PASS" if close(ch[k], exp[k]) else "FAIL", "CROSS", f"arang.{dim}.{k}",
                f"raw*(1-shrink) = {exp[k]:.2f} cm vs tercatat {ch[k]}")
    y = ab["charcoal_yield_mass_fraction"]
    mr, mc = ab["mass_per_unit_g"]["raw_half_shell"], ab["mass_per_unit_g"]["charcoal_half"]
    exp = {"min": mr["min"] * y["min"], "typ": mr["typ"] * y["typ"], "max": mr["max"] * y["max"]}
    for k in ("min", "typ", "max"):
        rec("PASS" if close(mc[k], exp[k]) else "FAIL", "CROSS", f"arang.mass_charcoal.{k}",
            f"m_raw*yield = {exp[k]:.1f} g vs tercatat {mc[k]}")
    # densitas arang belah 2 lepas = rho_batok_mentah * yield / (1 - susut)^3  (massa turun, volume susut 3D)
    raw_bd, loose = ab["bulk_density_kg_m3"]["raw_halves_loose"], ab["bulk_density_kg_m3"]["charcoal_halves_loose"]
    exp = {"min": raw_bd["min"] * y["min"] / (1 - s["min"]) ** 3,
           "typ": raw_bd["typ"] * y["typ"] / (1 - s["typ"]) ** 3,
           "max": raw_bd["max"] * y["max"] / (1 - s["max"]) ** 3}
    for k in ("min", "typ", "max"):
        rec("PASS" if close(loose[k], exp[k]) else "FAIL", "CROSS", f"arang.halves_loose_density.{k}",
            f"rho_raw*yield/(1-s)^3 = {exp[k]:.0f} kg/m3 vs tercatat {loose[k]}")
    bb = g["bounding_box_cm"]
    ok = close(bb["L"], g["charcoal_half_cm"]["rim_diameter"]["typ"]) and close(bb["H"], g["charcoal_half_cm"]["depth"]["typ"])
    rec("PASS" if ok else "FAIL", "CROSS", "arang.bounding_box", f"bbox {bb} vs dimensi typ arang")
    bd = ab["bulk_density_kg_m3"]
    ok = bd["charcoal_halves_loose"]["typ"] < bd["charcoal_halves_nested"]["typ"] < bd["charcoal_broken_lumps"]["typ"]
    rec("PASS" if ok else "FAIL", "CROSS", "arang.density_order", "loose < nested < lump (logika fisik)")

    # --- kopra asalan
    ka = by_id(d, "kopra_asalan")
    y = ka["yield"]
    for k, kk in (("min", "max"), ("typ", "typ"), ("max", "min")):
        exp = 1000 / y["nuts_per_kg_copra"][kk]
        rec("PASS" if close(y["copra_per_nut_g"][k], exp) else "FAIL", "CROSS", f"asalan.copra_per_nut.{k}",
            f"1000/nuts_per_kg = {exp:.0f} g vs tercatat {y['copra_per_nut_g'][k]}")
    lb = ka["bulk_density_kg_m3"]["loose_bulk"]
    for k, sf in (("min", 2.27), ("max", 1.84)):
        exp = 1000 / sf
        rec("PASS" if close(lb[k], exp, 0.03) else "FAIL", "CROSS", f"asalan.stowage.{k}",
            f"1000/SF {sf} = {exp:.0f} kg/m3 vs tercatat {lb[k]}")

    # --- kopra edible vs asalan
    ke = by_id(d, "kopra_edible")
    ok = ke["moisture_pct"]["max"] <= 6 and ka["moisture_pct"]["typ"] > ke["moisture_pct"]["max"]
    rec("PASS" if ok else "FAIL", "CROSS", "edible.moisture_vs_standard",
        f"edible max {ke['moisture_pct']['max']}% <= 6% (SNI/APCC) dan asalan typ {ka['moisture_pct']['typ']}% lebih basah")


# ------------------------------------------------------------------ 4. BENCH
def container_fill(cont, rho_eff, util=1.0):
    """Massa muat (kg) = min(payload, volume*util*rho). Return (kg, binding)."""
    by_vol = cont["volume_m3"] * util * rho_eff
    if by_vol <= cont["payload_kg"]:
        return by_vol, "VOLUME"
    return cont["payload_kg"], "WEIGHT"


def check_bench(d):
    C = {c["id"]: c for c in d["containers"]}
    golden = []

    # jambul: bagged_in_container -> butir
    kj = by_id(d, "kelapa_jambul")
    rho = kj["bulk_density_kg_m3"]["bagged_in_container"]["typ"]
    m = kj["mass_per_unit_g"]["typ"] / 1000
    for b in kj["container_benchmarks"]:
        kg, bind = container_fill(C[b["container"]], rho)
        pcs = kg / m
        p = b["pcs"]
        lo, hi = (p["min"], p["max"]) if isinstance(p, dict) else (p, p)
        conservative = "konservatif" in b.get("note", "")
        ok = lo * (1 - TOL) <= pcs <= hi * (1 + TOL)
        status = "PASS" if ok else ("WARN" if conservative else "FAIL")
        rec(status, "BENCH", f"jambul.{b['container']}.{lo}",
            f"hitung {pcs:,.0f} butir ({bind}-limited) vs benchmark {lo:,}-{hi:,}"
            + (" — skenario konservatif, selisih diharapkan" if conservative and not ok else ""))
        if not conservative:
            golden.append({"case": f"jambul_{b['container']}", "commodity": "kelapa_jambul", "container": b["container"],
                           "rho_eff_kg_m3": rho, "unit_mass_g": kj["mass_per_unit_g"]["typ"],
                           "expect_pcs": round(pcs), "expect_binding": bind, "accept_range": [lo, hi]})

    # arang lump: benchmark ton
    ab = by_id(d, "arang_batok_belah2")
    for b in ab["container_benchmarks"]:
        form = b["form"]
        is_charcoal = form.startswith("arang")  # "batok mentah belah (bukan arang)" != arang
        key = "charcoal_broken_lumps" if is_charcoal else "raw_halves_loose"
        # arang lump dimuat dalam karung -> utilisasi volume ~0.80
        util = 0.80 if is_charcoal else 1.0
        rho = ab["bulk_density_kg_m3"][key]["typ"]
        kg, bind = container_fill(C[b["container"]], rho, util)
        t = b["net_t"]
        lo, hi = (t["min"], t["max"]) if isinstance(t, dict) else (t, t)
        ok = lo * (1 - TOL) <= kg / 1000 <= hi * (1 + TOL)
        rec("PASS" if ok else "FAIL", "BENCH", f"arang.{b['container']}.{key}",
            f"hitung {kg/1000:.1f} t ({bind}-limited, util {util}) vs benchmark {lo}-{hi} t")
        golden.append({"case": f"arang_{key}_{b['container']}", "commodity": "arang_batok_belah2", "form": key,
                       "container": b["container"], "rho_eff_kg_m3": rho, "volume_util": util,
                       "expect_t": round(kg / 1000, 2), "expect_binding": bind, "accept_range_t": [lo, hi]})

    # kopra edible
    ke = by_id(d, "kopra_edible")
    rho = ke["bulk_density_kg_m3"]["bagged_in_container"]["typ"]
    for b in ke["container_benchmarks"]:
        kg, bind = container_fill(C[b["container"]], rho)
        t = b["net_t"]
        ok = t["min"] * (1 - TOL) <= kg / 1000 <= t["max"] * (1 + TOL)
        rec("PASS" if ok else "FAIL", "BENCH", f"edible.{b['container']}",
            f"hitung {kg/1000:.1f} t ({bind}-limited) vs benchmark {t['min']}-{t['max']} t")
        golden.append({"case": f"edible_{b['container']}", "commodity": "kopra_edible", "container": b["container"],
                       "rho_eff_kg_m3": rho, "expect_t": round(kg / 1000, 2), "expect_binding": bind,
                       "accept_range_t": [t["min"], t["max"]]})

    # kopra asalan curah dalam 20GP (tanpa benchmark dagang; acuan stowage factor)
    ka = by_id(d, "kopra_asalan")
    rho = ka["bulk_density_kg_m3"]["bagged_jute"]["typ"]
    kg, bind = container_fill(C["20GP"], rho, 0.90)
    golden.append({"case": "asalan_bagged_20GP", "commodity": "kopra_asalan", "container": "20GP",
                   "rho_eff_kg_m3": rho, "volume_util": 0.90, "expect_t": round(kg / 1000, 2), "expect_binding": bind,
                   "accept_range_t": None, "note": "Tanpa benchmark dagang langsung; diturunkan dari stowage factor TIS-GDV"})
    rec("INFO", "BENCH", "asalan.20GP", f"prediksi {kg/1000:.1f} t ({bind}-limited) — belum ada benchmark, perlu data lapangan")

    # jambul: grid fit karung vs benchmark jumlah karung
    bd = kj["packaging"][0]["bag_dims_cm_filled"]
    bag_dims = (bd["L"], bd["W"], bd["H"])
    for b in kj["container_benchmarks"]:
        if "bags" not in b:
            continue
        n = best_grid(C[b["container"]]["inner_cm"], bag_dims)
        lo, hi = b["bags"]["min"], b["bags"]["max"]
        ok = lo * (1 - TOL) <= n <= hi * (1 + TOL)
        rec("PASS" if ok else "FAIL", "BENCH", f"jambul.bag_grid.{b['container']}",
            f"grid fit karung {bag_dims} cm = {n} karung vs benchmark {lo}-{hi}")

    # semua kemasan: (a) dimensi terisi tersedia, (b) volume kotak >= volume isi (berat/densitas),
    # (c) volume kotak <= kapasitas kantong datar (rumus kantong bantal) +10%,
    # (d) bila komoditas punya benchmark ton: grid-fit x berat karung (dibatasi payload) cocok benchmark
    def pillow_l(w_cm, l_cm):
        w, h = w_cm / 100, l_cm / 100
        return w ** 3 * (h / (math.pi * w) - 0.142 * (1 - 10 ** (-h / w))) * 1000
    for cm in d["commodities"]:
        for pk in cm["packaging"]:
            if "bag_net_kg" not in pk:
                continue
            tag = f"{cm['id']}.{pk['type']}"
            dims = pk.get("bag_dims_cm_filled")
            if not dims:
                rec("FAIL", "BENCH", f"pack.{tag}.dims", "dimensi karung terisi belum ada")
                continue
            box = (dims["L"], dims["W"], dims["H"])
            box_l = box[0] * box[1] * box[2] / 1000
            ref = pk.get("density_ref")
            if ref:
                need = pk["bag_net_kg"]["typ"] / cm["bulk_density_kg_m3"][ref]["typ"] * 1000
                rec("PASS" if box_l >= need * (1 - TOL) else "FAIL", "BENCH", f"pack.{tag}.holds_content",
                    f"kotak {box_l:.0f} L vs isi {pk['bag_net_kg']['typ']} kg / rho[{ref}] = {need:.0f} L")
            flat = pk.get("bag_flat_cm")
            if flat:
                cap = pillow_l(flat["W"], flat["L"])
                rec("PASS" if box_l <= cap * (1 + TOL) else "FAIL", "BENCH", f"pack.{tag}.fits_flat_bag",
                    f"kotak {box_l:.0f} L vs kapasitas kantong datar {flat['W']}x{flat['L']} cm = {cap:.0f} L")
            if pk is cm["packaging"][0] and ref:
                for b in cm.get("container_benchmarks", []):
                    t = b.get("net_t")
                    form = b.get("form", "")
                    if t is None or (form and not form.startswith("arang")):
                        continue
                    n = best_grid(C[b["container"]]["inner_cm"], box)
                    kg = min(n * pk["bag_net_kg"]["typ"], C[b["container"]]["payload_kg"])
                    lo, hi = (t["min"], t["max"]) if isinstance(t, dict) else (t, t)
                    ok = lo * (1 - TOL) <= kg / 1000 <= hi * (1 + TOL)
                    rec("PASS" if ok else "FAIL", "BENCH", f"pack.{tag}.grid.{b['container']}",
                        f"{n} karung x {pk['bag_net_kg']['typ']} kg = {kg/1000:.1f} t vs benchmark {lo}-{hi} t")

    # kasus formula dasar (tidak tergantung benchmark)
    golden += [
        {"case": "moisture_correction", "formula": "M2 = M1*(1-w1)/(1-w2)", "input": {"M1_kg": 1000, "w1": 0.15, "w2": 0.06},
         "expect": {"M2_kg": round(1000 * 0.85 / 0.94, 2)}},
        {"case": "nested_stack_count", "formula": "n = floor((H - h_cup)/pitch) + 1",
         "input": {"H_cm": 100, "h_cup_cm": 4.4, "pitch_cm": 1.2}, "expect": {"n": math.floor((100 - 4.4) / 1.2) + 1}},
        {"case": "grid_fit_bags_20GP", "formula": "floor(L/l)*floor(W/w)*floor(H/h) (orientasi terbaik)",
         "input": {"container": "20GP", "bag_cm": {"l": bag_dims[0], "w": bag_dims[1], "h": bag_dims[2]}},
         "expect": {"bags": best_grid(C["20GP"]["inner_cm"], bag_dims)}},
    ]
    # golden grid-fit untuk karung arang 25 kg & kopra edible 25 kg (20GP & 40HC)
    for cid in ("arang_batok_belah2", "kopra_edible"):
        pk = by_id(d, cid)["packaging"][0]
        bd2 = pk["bag_dims_cm_filled"]
        box = (bd2["L"], bd2["W"], bd2["H"])
        for cont in ("20GP", "40HC"):
            n = best_grid(C[cont]["inner_cm"], box)
            kg = min(n * pk["bag_net_kg"]["typ"], C[cont]["payload_kg"])
            golden.append({"case": f"grid_fit_{cid}_bag_{cont}", "formula": "grid-fit karung, berat dibatasi payload",
                           "input": {"container": cont, "bag_cm": {"l": box[0], "w": box[1], "h": box[2]},
                                     "bag_net_kg": pk["bag_net_kg"]["typ"]},
                           "expect": {"bags_geom": n, "load_t": round(kg / 1000, 2),
                                      "binding": "WEIGHT" if n * pk["bag_net_kg"]["typ"] > C[cont]["payload_kg"] else "VOLUME"}})
    golden += [
        {"case": "warehouse_floor_area", "formula": "A = V/(h_stack*phi) / u_floor",
         "input": {"mass_kg": 50000, "rho_kg_m3": 500, "h_stack_m": 2.5, "u_floor": 0.65},
         "expect": {"A_m2": round(50000 / 500 / 2.5 / 0.65, 2)}},
    ]
    return golden


def best_grid(inner, box):
    from itertools import permutations
    L, W, H = inner["L"], inner["W"], inner["H"]
    return max(math.floor(L / a) * math.floor(W / b) * math.floor(H / c) for a, b, c in permutations(box))


# ------------------------------------------------------------------- report
def write_log(d, dataset_path):
    now = datetime.now(WIB).strftime("%Y-%m-%d %H:%M WIB")
    cnt = {s: sum(1 for r in results if r[0] == s) for s in ("PASS", "WARN", "FAIL", "INFO")}
    lines = [
        "# Validation Log — Dataset Komoditas Kelapa",
        "",
        "> File ini **dibuat otomatis** oleh `scripts/validate_dataset.py`. Jangan diedit manual.",
        "",
        f"- Waktu run: {now}",
        f"- Dataset: `{dataset_path.relative_to(ROOT)}` (versi {d['meta']['version']})",
        f"- Toleransi uji silang: {int(TOL*100)}%",
        f"- Ringkasan: **{cnt['PASS']} PASS · {cnt['WARN']} WARN · {cnt['FAIL']} FAIL · {cnt['INFO']} INFO**",
        f"- Status akhir: **{'LULUS' if cnt['FAIL'] == 0 else 'GAGAL'}**",
        "",
    ]
    for grp, title in (("SCHEMA", "1. Skema & integritas"), ("RANGE", "2. Konsistensi rentang min/typ/max"),
                       ("CROSS", "3. Uji silang rumus turunan"), ("BENCH", "4. Uji vs benchmark container")):
        lines += [f"## {title}", "", "| Status | Check | Keterangan |", "|---|---|---|"]
        for s, g, cid, msg in results:
            if g == grp:
                lines.append(f"| {s} | `{cid}` | {msg} |")
        lines.append("")
    LOG_PATH.write_text("\n".join(lines), encoding="utf-8")
    return cnt


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATASET
    d = json.loads(path.read_text(encoding="utf-8"))
    check_schema(d)
    check_ranges(d)
    check_cross(d)
    golden = check_bench(d)
    cnt = write_log(d, path.resolve())
    GOLDEN_PATH.write_text(json.dumps({"generated_from_version": d["meta"]["version"], "cases": golden},
                                      indent=2, ensure_ascii=False), encoding="utf-8")
    for s, g, cid, msg in results:
        if s in ("FAIL", "WARN"):
            print(f"[{s}] {g} {cid}: {msg}")
    print(f"\nPASS {cnt['PASS']} | WARN {cnt['WARN']} | FAIL {cnt['FAIL']} | INFO {cnt['INFO']}")
    print(f"log    -> {LOG_PATH.relative_to(ROOT)}")
    print(f"golden -> {GOLDEN_PATH.relative_to(ROOT)} ({len(golden)} kasus)")
    sys.exit(1 if cnt["FAIL"] else 0)


if __name__ == "__main__":
    main()
