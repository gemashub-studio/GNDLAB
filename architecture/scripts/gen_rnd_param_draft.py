"""Bangkitkan DRAF parameter R&D (format 07-rnd/parameter_template.csv) dari dataset formula.

Sumber angka: 00-research/data/coconut_formula_dataset.json (ADR-009). Skrip ini hanya memetakan
kunci dataset → definisi parameter; tidak ada angka target yang ditulis langsung di sini.
Hasil: 07-rnd/parameter_kora_draft.csv — DRAF untuk dikonfirmasi owner sebelum diimpor di M5.

Pemakaian:  python architecture/scripts/gen_rnd_param_draft.py [--check]
  --check : bangkitkan ke memori & bandingkan dengan berkas (gagal bila berbeda) — dipakai run_all_checks.
"""
import csv
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "00-research" / "data" / "coconut_formula_dataset.json"
OUT = ROOT / "07-rnd" / "parameter_kora_draft.csv"
HEADER = ["product_code", "stage_seq", "group_name", "key", "label", "unit", "data_type", "choices",
          "target_min", "target_max", "decimals", "required", "note"]

d = json.loads(DATA.read_text(encoding="utf-8"))
K, A, B, C, BL = d["kopra"], d["arang"], d["briket"], d["cuka"], d["bioleather"]
grades = {g["id"]: g for g in K["grades"]}
variants = {v["id"]: v for v in B["variants"]}
icc = next(s for s in A["standards"] if s["id"] == "icc")
sni = next(s for s in A["standards"] if s["id"] == "sni_1682")


def src(*ids):
    return "sumber " + ", ".join(ids)


rows = []


def num(code, stage, group, key, label, unit, lo=None, hi=None, dec=2, req=False, note=""):
    rows.append([code, stage, group, key, label, unit, "number", "", lo, hi, dec, req, note])


def choice(code, stage, group, key, label, options, req=False, note=""):
    rows.append([code, stage, group, key, label, "", "choice", ";".join(options), None, None, 0, req, note])


def text(code, stage, group, key, label, note=""):
    rows.append([code, stage, group, key, label, "", "text", "", None, None, 0, False, note])


def boolean(code, stage, group, key, label, req=False, note=""):
    rows.append([code, stage, group, key, label, "", "boolean", "", None, None, 0, req, note])


# ---------------------------------------------------------------- KE kopra edible (tahap 1–5 seed)
e = grades["edible"]
num("KE", 1, "BAHAN", "berat_awal_kg", "Berat kelapa awal", "kg", dec=2, req=True)
num("KE", 1, "BAHAN", "berat_per_butir_kg", "Berat per butir tanpa sabut", "kg", dec=3, note="Timbang 10 butir (K-09)")
choice("KE", 1, "BAHAN", "kematangan", "Kematangan", ["Tua penuh", "Diperam 2-4 minggu"], req=True)
num("KE", 2, "PROSES", "jeda_belah_jam", "Jeda belah ke pengering", "jam", hi=K["split_to_dryer_max_h"]["typ"], dec=2, req=True, note=src(*K["split_to_dryer_max_h"]["source_ids"]))
choice("KE", 3, "PROSES", "metode_pengering", "Metode pengering", ["Greenhouse", "Greenhouse + belerang", "Rendam bisulfit + greenhouse", "Oven", "Jemur"], req=True)
num("KE", 3, "PROSES", "suhu_pengering_c", "Suhu pengering", "°C", hi=K["oven_max_temp_c"]["typ"], dec=1, note="Batas oven; " + src(*K["oven_max_temp_c"]["source_ids"]))
num("KE", 3, "PROSES", "ka_24_jam_pct", "Kadar air jam ke-24", "%", hi=K["alarm_moisture_24h_max_pct"]["typ"], dec=1)
num("KE", 3, "PROSES", "ka_48_jam_pct", "Kadar air jam ke-48", "%", hi=K["alarm_moisture_48h_max_pct"]["typ"], dec=1, req=True)
num("KE", 3, "PROSES", "malam_belerang", "Malam perlakuan sulfur", "malam", dec=0, note="Dicatat apa adanya; dosis/jadwal belum ditetapkan (DEC-048)")
num("KE", 3, "PROSES", "sulfur_dipakai_g", "Jumlah sulfur dipakai", "g", dec=1, note="Catat manual apa adanya; aplikasi tidak menghitung dosis (DEC-048)")
num("KE", 5, "HASIL / QC", "ka_akhir_pct", "Kadar air akhir", "%", lo=K["min_final_moisture_pct"]["typ"], hi=e["moisture_max_pct"], dec=1, req=True, note=src(*e["source_ids"]))
choice("KE", 5, "HASIL / QC", "warna", "Warna", ["Putih bersih", "Putih kekuningan", "Kecoklatan"], req=True)
num("KE", 5, "HASIL / QC", "jamur_pct", "Potong berjamur", "%", hi=e["mould_max_pct"], dec=1, req=True)
num("KE", 5, "HASIL / QC", "ffa_pct", "FFA (lab)", "%", hi=e["ffa_max_pct"], dec=2)
num("KE", 5, "HASIL / QC", "minyak_pct", "Kadar minyak (lab)", "%", lo=e["oil_min_pct"], dec=1)
num("KE", 5, "HASIL / QC", "aflatoksin_ppb", "Aflatoksin (lab)", "ppb", hi=e["aflatoxin_max_ppb"], dec=1)
num("KE", 5, "HASIL / QC", "so2_mg_kg", "Residu SO2 (lab)", "mg/kg", hi=K["sulfur"]["residue_limits"][0]["max_mg_kg"], dec=1, note="Batas UE kelapa kering = produk akhir, bukan dosis; uji lab bila ada perlakuan sulfur. " + src(*K["sulfur"]["residue_limits"][0]["source_ids"]))
num("KE", 5, "HASIL / QC", "rendemen_pct", "Rendemen berat akhir/awal", "%", dec=1)

# ---------------------------------------------------------------- KA kopra asalan
a = grades["asalan"]
num("KA", 1, "BAHAN", "berat_awal_kg", "Berat kelapa awal", "kg", dec=2, req=True)
num("KA", 3, "PROSES", "durasi_asap_jam", "Durasi pengasapan", "jam", lo=K["smoke_min_h"]["typ"], dec=1, note=src(*K["smoke_min_h"]["source_ids"]))
num("KA", 6, "HASIL / QC", "ka_akhir_pct", "Kadar air akhir", "%", hi=a["moisture_max_pct"], dec=1, req=True, note=src(*a["source_ids"]))
num("KA", 6, "HASIL / QC", "ffa_pct", "FFA (lab)", "%", hi=a["ffa_max_pct"], dec=2)
num("KA", 6, "HASIL / QC", "minyak_pct", "Kadar minyak (lab)", "%", lo=a["oil_min_pct"], dec=1)
num("KA", 6, "HASIL / QC", "yield_asap_pct", "Yield kopra asap / daging", "%", dec=1)

# ---------------------------------------------------------------- CK cuka (tahap 1–7 seed)
num("CK", 1, "BAHAN", "volume_air_kelapa_l", "Volume air kelapa", "L", dec=2, req=True)
num("CK", 1, "BAHAN", "ph_air_kelapa", "pH air kelapa", "pH", lo=C["water_ph"]["min"], dec=2, req=True, note="Harus > 5")
num("CK", 1, "BAHAN", "brix_awal", "°Brix awal", "°Brix", dec=1, req=True)
num("CK", 2, "PROSES", "brix_must", "°Brix must", "°Brix", lo=C["must_brix"]["min"], hi=C["must_brix"]["max"], dec=1, req=True, note=src(*C["must_brix"]["source_ids"]))
num("CK", 2, "PROSES", "gula_kg", "Gula ditambah", "kg", dec=3, note="Neraca massa (FND-021)")
num("CK", 2, "PROSES", "ragi_g_l", "Dosis ragi", "g/L", lo=C["yeast_g_l"]["min"], hi=C["yeast_g_l"]["max"], dec=2)
num("CK", 2, "PROSES", "suhu_fermentasi_c", "Suhu fermentasi alkohol", "°C", lo=C["ferment_temp_c"]["min"], hi=C["ferment_temp_c"]["max"], dec=1)
choice("CK", 3, "PROSES", "metode_asetifikasi", "Metode asetifikasi", [m["name_id"] for m in C["methods"]], req=True, note=src(*sorted({i for m in C["methods"] for i in m["source_ids"]})))
num("CK", 3, "HASIL / QC", "hari_ke_4pct", "Waktu sampai asam ≥4%", "hari", dec=1, note="Indikator utama banding metode")
num("CK", 3, "PROSES", "starter_pct", "Starter cuka", "% v/v", lo=C["starter_pct"]["min"], hi=C["starter_pct"]["max"], dec=1)
num("CK", 3, "HASIL / QC", "naoh_ml", "Volume NaOH titrasi", "mL", dec=2)
num("CK", 3, "HASIL / QC", "naoh_n", "Normalitas NaOH", "N", dec=3, req=True, note="Wajib — rumus 0,06005×V hanya untuk 0,1 N & 10 mL (FND-022)")
num("CK", 3, "HASIL / QC", "sampel_ml", "Volume sampel cuka", "mL", dec=1, req=True)
num("CK", 3, "HASIL / QC", "asam_asetat_pct", "Asam asetat", "%", lo=C["acetic_min_pct"]["typ"], dec=2, req=True, note=src(*C["acetic_min_pct"]["source_ids"]))
num("CK", 7, "HASIL / QC", "sisa_alkohol_pct", "Sisa alkohol", "% v/v", hi=C["residual_alcohol_max_pct"]["typ"], dec=2, req=True)
num("CK", 7, "HASIL / QC", "rendemen_l_per_l", "Liter cuka per liter air kelapa", "L/L", dec=3, note="GAP — catat tiap batch")

# ---------------------------------------------------------------- BL bioleather (tahap 1–8 seed)
num("BL", 1, "BAHAN", "volume_media_l", "Volume media", "L", dec=2, req=True)
num("BL", 1, "BAHAN", "gula_g_l", "Gula", "g/L", lo=BL["sucrose_g_l"]["min"], hi=BL["sucrose_g_l"]["max"], dec=1)
num("BL", 1, "BAHAN", "ph_media", "pH media", "pH", lo=BL["ph"]["min"], hi=BL["ph"]["max"], dec=2, req=True)
num("BL", 2, "PROSES", "starter_pct", "Starter K. xylinus", "% v/v", lo=BL["starter_pct"]["min"], hi=BL["starter_pct"]["max"], dec=1)
choice("BL", 2, "BAHAN", "asal_starter", "Asal starter", ["Kultur khusus", "Mother cuka (BLT-M)"], req=True)
choice("BL", 3, "PROSES", "metode_kultur", "Metode kultur", [m["name_id"] for m in BL["culture_methods"]], req=True)
num("BL", 3, "PROSES", "kedalaman_cm", "Kedalaman cairan baki", "cm", dec=1, note="GAP — uji 3/5/8 cm")
num("BL", 3, "PROSES", "tebal_basah_mm", "Tebal lembar basah", "mm", lo=BL["target_wet_thickness_mm"]["min"], hi=BL["target_wet_thickness_mm"]["max"], dec=1)
num("BL", 4, "HASIL / QC", "berat_basah_g", "Berat basah", "g", dec=1)
num("BL", 5, "PROSES", "naoh_m", "Molaritas NaOH", "M", hi=BL["naoh_m"]["typ"], dec=3, req=True)
num("BL", 6, "PROSES", "gliserol_pct", "Gliserol", "%", dec=1)
choice("BL", 6, "PROSES", "resep_plastisasi", "Resep plastisasi", [m["name_id"] for m in BL["plasticizers"]], req=True)
choice("BL", 6, "PROSES", "pewarna", "Pewarna alami", ["Tanpa"] + [m["name_id"] for m in BL["dyes"]])
choice("BL", 7, "PROSES", "finishing", "Finishing tahan air", ["Tanpa"] + [m["name_id"] for m in BL["finishes"]])
num("BL", 7, "PROSES", "takaran_oles_g_m2", "Takaran oles finishing", "g/m²", dec=1, note="GAP — timbang sebelum & sesudah oles")
num("BL", 7, "HASIL / QC", "berat_kering_g", "Berat kering", "g", dec=2)
num("BL", 8, "HASIL / QC", "kuat_tarik_mpa", "Kuat tarik (ISO 3376)", "MPa", lo=BL["tensile_min_mpa"]["typ"], dec=2)
num("BL", 8, "HASIL / QC", "uji_lipat", "Uji lipat 180°", "kali", lo=BL["fold_min"]["typ"], dec=0)

# ---------------------------------------------------------------- AR arang (produk baru — tahap menunggu owner)
num("AR", "", "BAHAN", "ka_batok_pct", "Kadar air batok", "%", hi=A["shell_moisture_max_pct"]["typ"], dec=1, req=True)
num("AR", "", "BAHAN", "berat_batok_kg", "Berat batok masuk", "kg", dec=1, req=True)
choice("AR", "", "PROSES", "metode", "Metode karbonisasi", [m["name_id"].split(" (")[0] for m in A["methods"]], req=True)
num("AR", "", "PROSES", "suhu_reaktor_c", "Suhu reaktor", "°C", lo=A["reactor_temp_c"]["min"], hi=A["reactor_temp_c"]["max"], dec=0)
num("AR", "", "PROSES", "mati_hampa_jam", "Lama mati hampa", "jam", lo=min(m["cooling_h"]["min"] for m in A["methods"]), dec=1, req=True)
num("AR", "", "HASIL / QC", "berat_arang_kg", "Berat arang keluar", "kg", dec=1, req=True)
num("AR", "", "HASIL / QC", "rendemen_pct", "Rendemen", "%", lo=A["yield_target_3m_pct"]["typ"], dec=1, req=True, note="Target 3 bln; 6 bln ≥" + str(A["yield_target_6m_pct"]["typ"]))
num("AR", "", "HASIL / QC", "mentah_pct", "Arang mentah", "%", hi=A["raw_max_pct"]["typ"], dec=1)
num("AR", "", "HASIL / QC", "ka_pct", "Kadar air arang", "%", hi=sni["moisture_max_pct"], dec=1)
num("AR", "", "HASIL / QC", "abu_pct", "Kadar abu", "%", hi=sni["ash_max_pct"], dec=2)
num("AR", "", "HASIL / QC", "vm_pct", "Zat terbang", "%", hi=icc["vm_max_pct"], dec=1)
num("AR", "", "HASIL / QC", "fc_pct", "Karbon terikat", "%", lo=icc["fc_min_pct"], dec=1)
num("AR", "", "HASIL / QC", "weathering_hari", "Weathering", "hari", lo=A["weathering_days_export_min"], dec=0, note="Ekspor (IMDG SP 978)")
num("AR", "", "HASIL / QC", "suhu_packing_c", "Suhu saat packing", "°C", hi=A["packing_temp_max_c"], dec=1)

# ---------------------------------------------------------------- BS / BB / BC briket (produk baru)
for vid in ("shisha", "bbq", "custom"):
    v = variants[vid]
    code = v["rnd_code"]
    sp = v["spec"]
    num(code, "", "BAHAN", "perekat_pct", "Perekat tapioka", "%", lo=B["binder_pct"]["min"], hi=B["binder_pct"]["max"], dec=1, req=True, note=src(*B["binder_pct"]["source_ids"]))
    choice(code, "", "BAHAN", "fraksi_serbuk", "Fraksi serbuk arang", [f["name_id"] for f in A["fractions"] if f["id"] in ("powder", "mesh2")] + ["Campuran"], req=True)
    num(code, "", "PROSES", "ka_adonan_pct", "Kadar air adonan", "%", lo=B["dough_moisture_pct"]["min"], hi=B["dough_moisture_pct"]["max"], dec=1, req=True)
    num(code, "", "PROSES", "suhu_perekat_c", "Suhu gelatinisasi perekat", "°C", lo=B["gelatinization_min_c"]["typ"], dec=0)
    num(code, "", "PROSES", "aging_jam", "Aging adonan", "jam", dec=1)
    num(code, "", "PROSES", "suhu_oven_c", "Suhu oven", "°C", lo=B["oven_temp_c"]["min"], hi=B["oven_temp_c"]["max"], dec=0)
    num(code, "", "PROSES", "lama_oven_jam", "Lama oven", "jam", dec=1)
    num(code, "", "HASIL / QC", "densitas_g_cm3", "Densitas", "g/cm³", lo=v["density_g_cm3"]["min"], hi=v["density_g_cm3"]["max"], dec=2)
    if "moisture_max_pct" in sp:
        num(code, "", "HASIL / QC", "ka_akhir_pct", "Kadar air akhir", "%", hi=sp["moisture_max_pct"], dec=1, req=True)
    if "ash_max_pct" in sp:
        num(code, "", "HASIL / QC", "abu_pct", "Kadar abu", "%", hi=sp["ash_max_pct"], dec=2, req=True)
    if "vm_max_pct" in sp:
        num(code, "", "HASIL / QC", "vm_pct", "Zat terbang", "%", hi=sp["vm_max_pct"], dec=1)
    if "fc_min_pct" in sp:
        num(code, "", "HASIL / QC", "fc_pct", "Karbon terikat", "%", lo=sp["fc_min_pct"], dec=1)
    if "calorific_min_kcal_kg" in sp:
        num(code, "", "HASIL / QC", "kalor_kkal_kg", "Nilai kalor", "kkal/kg", lo=sp["calorific_min_kcal_kg"], dec=0)
    if "burn_min_min" in sp:
        num(code, "", "HASIL / QC", "waktu_bakar_menit", "Waktu bakar", "menit", lo=sp["burn_min_min"], dec=0)
    if "ignition_max_min" in sp:
        num(code, "", "HASIL / QC", "waktu_nyala_menit", "Waktu nyala", "menit", hi=sp["ignition_max_min"], dec=1)
    choice(code, "", "HASIL / QC", "warna_abu", "Warna abu bakar", ["Putih", "Abu-abu", "Coklat/hitam"], req=True)
    boolean(code, "", "HASIL / QC", "ada_percikan", "Ada percikan api")
    text(code, "", "HASIL / QC", "bau_bakar", "Bau saat dibakar")


# ---------------------------------------------------------------- validasi aturan rnd_param_def
KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")
seen = set()
for r in rows:
    code, _, _, key, _, _, dtype, choices, lo, hi, dec, _, _ = r
    assert re.fullmatch(r"[A-Z]{2}", code), r
    assert KEY_RE.match(key), f"key tidak valid: {key}"
    assert (code, key) not in seen, f"key ganda: {code}.{key}"
    seen.add((code, key))
    assert dtype in ("number", "text", "choice", "boolean"), r
    if dtype == "choice":
        assert choices, f"choice tanpa pilihan: {key}"
    if dtype != "number":
        assert lo is None and hi is None, f"target hanya untuk number: {key}"
    if lo is not None and hi is not None:
        assert lo <= hi, f"target_min > target_max: {key}"
    assert 0 <= dec <= 6


def fmt(v):
    if v is None or v == "":
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


buf = io.StringIO()
w = csv.writer(buf, lineterminator="\n")
w.writerow(HEADER)
for r in rows:
    w.writerow([fmt(x) for x in r])
content = buf.getvalue()

# Salinan untuk aplikasi (saran variabel di GEMA RnD Lab) — DATA, bukan hardcode; status draf.
JSON_OUT = ROOT.parent / "apps" / "web" / "src" / "data" / "rndParamDraft.json"
json_rows = [dict(zip(HEADER, [fmt(x) for x in r])) for r in rows]
json_content = json.dumps({"status": "draf — belum dikonfirmasi owner", "source": "architecture/07-rnd/parameter_kora_draft.csv", "params": json_rows}, ensure_ascii=False, indent=1) + "\n"

if "--check" in sys.argv:
    current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    current_json = JSON_OUT.read_text(encoding="utf-8") if JSON_OUT.exists() else ""
    if current != content or current_json != json_content:
        print("parameter_kora_draft.csv / rndParamDraft.json tidak sinkron dengan dataset formula — jalankan gen_rnd_param_draft.py")
        sys.exit(1)
    print(f"parameter_kora_draft.csv & rndParamDraft.json sinkron ({len(rows)} parameter)")
else:
    OUT.write_text(content, encoding="utf-8", newline="")
    JSON_OUT.write_text(json_content, encoding="utf-8", newline="")
    by = {}
    for r in rows:
        by[r[0]] = by.get(r[0], 0) + 1
    print(f"{OUT.relative_to(ROOT)}: {len(rows)} parameter " + ", ".join(f"{k} {v}" for k, v in by.items()))
