#!/usr/bin/env bash
# run_all_checks.sh — Jalankan SEMUA validasi folder architecture/.
#   1. Validasi dataset (skema, rentang, uji silang, benchmark) -> logs/validation_log.md
#   2. Bangkitkan ulang seed.sql & data_dictionary.md
#   3. (Bila PostgreSQL tersedia) muat schema.sql + uji integritas + muat seed.sql
#   4. Cek tautan antar-dokumen
# Variabel opsional: PGURL (mis. postgresql://postgres@localhost:5432/postgres)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0

# Windows (Git Bash) sering hanya punya "python" atau "py"
if command -v python3 >/dev/null 2>&1 && python3 -c "import sys" >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
elif command -v py >/dev/null 2>&1; then PY="py -3"
else echo "Python 3 tidak ditemukan. Pasang dari python.org lalu ulangi."; exit 1; fi
export PYTHONIOENCODING=utf-8

echo "== 1. Validasi dataset =="
$PY scripts/validate_dataset.py || fail=1

echo; echo "== 2. Bangkitkan seed & kamus data =="
$PY scripts/seed_from_dataset.py || fail=1
$PY scripts/gen_data_dictionary.py || fail=1
# Draf parameter R&D (Fase F, ADR-009) harus sinkron dengan dataset formula.
$PY scripts/gen_rnd_param_draft.py --check || fail=1

echo; echo "== 3. Uji database =="
if [ -n "${PGURL:-}" ] && command -v psql >/dev/null; then
  # Alamat DB lewat -d: psql di Windows tidak mempermutasi argumen, jadi opsi setelah
  # argumen posisi diabaikan (ISS-018).
  for db in coco_ci_integrity coco_ci_seed coco_ci_rnd; do
    psql -d "$PGURL" -qc "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db" || fail=1
  done
  base="${PGURL%/*}"
  # Baris FAIL dari uji SQL juga menggagalkan skrip, bukan hanya error psql.
  run_sql_test() {
    local out
    out=$(psql -d "$1" -v ON_ERROR_STOP=1 -q "${@:2}" 2>&1) || fail=1
    printf '%s\n' "$out" | grep -E "PASS|FAIL|SELESAI|ERROR" | sed 's/.*NOTICE:  //' || true
    if printf '%s\n' "$out" | grep -qE "FAIL|ERROR"; then fail=1; fi
  }
  run_sql_test "$base/coco_ci_integrity" -f 03-data/schema.sql -f tests/schema_integrity_test.sql
  psql -d "$base/coco_ci_seed" -v ON_ERROR_STOP=1 -q -f 03-data/schema.sql -f 03-data/seed.sql && echo "seed.sql termuat OK" || fail=1
  run_sql_test "$base/coco_ci_rnd" -f 03-data/schema.sql -f 07-rnd/schema_rnd.sql -f tests/rnd_integrity_test.sql
else
  echo "Lewati (set PGURL dan pastikan psql tersedia untuk menjalankan uji DB)"
fi

echo; echo "== 4. Cek tautan dokumen =="
$PY - <<'PY' || fail=1
import re, pathlib, sys
root = pathlib.Path(".")
bad = []
for md in root.rglob("*.md"):
    if md.name.startswith("_"):  # template: tautannya relatif ke folder tujuan
        continue
    text = md.read_text(encoding="utf-8")
    for m in re.finditer(r"`((?:\.\./|\./)?[\w\-./]+\.(?:md|sql|json|py|csv|sh))`", text):
        ref = m.group(1)
        cands = [(md.parent / ref), (root / ref)] + [d / ref for d in root.iterdir() if d.is_dir()]
        if not any(c.resolve().exists() for c in cands):
            bad.append(f"{md}: {ref}")
    for m in re.finditer(r"related: \[([^\]]+)\]", text):
        for ref in [r.strip() for r in m.group(1).split(",")]:
            if ref.endswith("/"):
                ref = ref.rstrip("/")
            if not (md.parent / ref).resolve().exists():
                bad.append(f"{md}: related {ref}")
if bad:
    print("Tautan rusak:\n  " + "\n  ".join(sorted(set(bad))))
    sys.exit(1)
print("Semua tautan file valid")
PY

echo
if [ $fail -eq 0 ]; then echo "SEMUA CEK LULUS"; else echo "ADA CEK GAGAL"; exit 1; fi
