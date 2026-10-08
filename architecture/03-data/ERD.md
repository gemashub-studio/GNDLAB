---
doc: ERD
title: Entity Relationship Design — gemasSTUDIO
version: 1.0.0
date: 2026-10-08
related: [schema.sql, data_dictionary.md, ../02-architecture/adr/ADR-002-versioned-dataset.md]
---

# ERD — Entity Relationship Design

## 1. Diagram

```mermaid
erDiagram
  DATASET_VERSION ||--o{ COMMODITY : "berisi"
  DATASET_VERSION ||--o{ CONTAINER_TYPE : "berisi"
  DATASET_VERSION ||--o{ SOURCE : "mengutip"
  COMMODITY ||--o{ COMMODITY_FORM : "punya bentuk"
  COMMODITY_FORM ||--o{ PARAMETER : "punya"
  COMMODITY_FORM ||--o{ PACKAGING_TYPE : "dikemas dalam"
  COMMODITY_FORM ||--o{ CONTAINER_BENCHMARK : "punya benchmark"
  CONTAINER_TYPE ||--o{ CONTAINER_BENCHMARK : "untuk"
  PARAMETER }o--o{ SOURCE : "PARAMETER_SOURCE"
  CONTAINER_BENCHMARK }o--o{ SOURCE : "BENCHMARK_SOURCE"

  APP_USER ||--o{ WAREHOUSE : "memiliki"
  APP_USER ||--o{ SCENARIO : "membuat"
  WAREHOUSE ||--o{ STORAGE_ZONE : "dibagi"
  SCENARIO }o--|| DATASET_VERSION : "dihitung dengan"
  SCENARIO }o--|| COMMODITY_FORM : "untuk"
  SCENARIO }o--o| CONTAINER_TYPE : "target container"
  SCENARIO }o--o| STORAGE_ZONE : "target gudang"
  SCENARIO ||--o{ SCENARIO_OVERRIDE : "mengganti"
  SCENARIO_OVERRIDE }o--|| PARAMETER : "mengganti nilai"
  SCENARIO ||--o{ CALC_RESULT : "menghasilkan"

  APP_USER ||--o{ MEASUREMENT : "mencatat"
  MEASUREMENT }o--|| COMMODITY_FORM : "mengukur"
  MEASUREMENT }o--|| PARAMETER : "mengukur parameter"
  CALIBRATION_PROPOSAL }o--|| PARAMETER : "mengusulkan nilai"
  CALIBRATION_PROPOSAL ||--o{ MEASUREMENT : "berdasar (PROPOSAL_MEASUREMENT)"
  APP_USER ||--o{ AUDIT_LOG : "melakukan"

  DATASET_VERSION {
    uuid id PK
    string semver UK
    enum status "DRAFT|PUBLISHED|DEPRECATED"
    uuid parent_version_id FK
    timestamptz published_at
    text changelog
  }
  COMMODITY {
    uuid id PK
    uuid dataset_version_id FK
    string code "kelapa_jambul..."
    string name_id
    string name_en
    enum unit_type "piece|bulk"
  }
  COMMODITY_FORM {
    uuid id PK
    uuid commodity_id FK
    string code "loose|bagged|halves_loose|halves_nested|lumps|raw_halves|loose_bulk|bagged_jute|loose_cups"
    enum shape "prolate_ellipsoid_with_tuft|hemispherical_cap_shell|irregular_curved_slab|hemispherical_cup_or_half_slab|bulk"
    enum calc_mode_default "BULK|PIECE|PACKAGE"
    boolean nestable
  }
  PARAMETER {
    uuid id PK
    uuid commodity_form_id FK
    string key "mass_per_unit|bulk_density|..."
    enum unit "m|kg|m3|kg_m3|fraction|pct|count"
    numeric v_min
    numeric v_typ
    numeric v_max
    enum confidence "A|B|C"
    text note
  }
  SOURCE {
    uuid id PK
    uuid dataset_version_id FK
    string code "S01..S24"
    text title
    text url
    enum grade "A|B|C"
    date accessed_at
  }
  CONTAINER_TYPE {
    uuid id PK
    uuid dataset_version_id FK
    string code "20GP|40GP|40HC|CUSTOM"
    numeric inner_l_m
    numeric inner_w_m
    numeric inner_h_m
    numeric payload_kg
    boolean is_custom
  }
  PACKAGING_TYPE {
    uuid id PK
    uuid commodity_form_id FK
    string code "PP_net_bag|PP_woven_bag|jumbo_bag|jute_bag|loose"
    integer pcs_per_pack
    numeric net_kg_min
    numeric net_kg_typ
    numeric net_kg_max
    numeric dim_l_m
    numeric dim_w_m
    numeric dim_h_m
    boolean deformable
  }
  CONTAINER_BENCHMARK {
    uuid id PK
    uuid commodity_form_id FK
    uuid container_type_id FK
    numeric pcs_min
    numeric pcs_max
    numeric packs_min
    numeric packs_max
    numeric net_t_min
    numeric net_t_max
    boolean conservative
  }
  APP_USER {
    uuid id PK
    string email UK
    enum role "viewer|editor|data_admin"
  }
  WAREHOUSE {
    uuid id PK
    uuid owner_id FK
    string name
    numeric length_m
    numeric width_m
    numeric clear_height_m
    numeric floor_load_kg_m2
  }
  STORAGE_ZONE {
    uuid id PK
    uuid warehouse_id FK
    string name
    numeric length_m
    numeric width_m
    numeric max_stack_h_m
    numeric floor_util
    boolean ventilated
  }
  SCENARIO {
    uuid id PK
    uuid user_id FK
    uuid dataset_version_id FK
    uuid commodity_form_id FK
    uuid container_type_id FK
    uuid storage_zone_id FK
    enum calc_kind "CONTAINER|WAREHOUSE|CONVERT"
    enum calc_mode "BULK|PIECE|PACKAGE"
    jsonb input
    string share_slug UK
    timestamptz created_at
  }
  SCENARIO_OVERRIDE {
    uuid id PK
    uuid scenario_id FK
    uuid parameter_id FK
    numeric v_min
    numeric v_typ
    numeric v_max
    text reason
  }
  CALC_RESULT {
    uuid id PK
    uuid scenario_id FK
    string engine_version
    enum binding "VOLUME|WEIGHT|NONE"
    jsonb result_min
    jsonb result_typ
    jsonb result_max
    jsonb warnings
    jsonb trace
    timestamptz computed_at
  }
  MEASUREMENT {
    uuid id PK
    uuid user_id FK
    uuid commodity_form_id FK
    uuid parameter_id FK
    numeric value
    enum unit
    string method "timbang|jangka_sorong|ember_1m3|drum"
    string location
    string lot_ref
    timestamptz measured_at
  }
  CALIBRATION_PROPOSAL {
    uuid id PK
    uuid parameter_id FK
    numeric proposed_min
    numeric proposed_typ
    numeric proposed_max
    integer sample_n
    enum status "PENDING|APPROVED|REJECTED"
    uuid reviewed_by FK
    uuid resulting_version_id FK
  }
  AUDIT_LOG {
    bigint id PK
    uuid actor_id FK
    string entity
    uuid entity_id
    enum action "CREATE|UPDATE|DELETE|PUBLISH|APPROVE|REJECT"
    jsonb before
    jsonb after
    timestamptz at
  }
```

## 2. Aturan Integritas Kunci

| ID | Aturan | Penegakan |
|---|---|---|
| IR-01 | `v_min ≤ v_typ ≤ v_max` dan `v_min > 0` untuk setiap PARAMETER, SCENARIO_OVERRIDE, CALIBRATION_PROPOSAL | `CHECK` constraint |
| IR-02 | DATASET_VERSION berstatus `PUBLISHED` tidak boleh diubah anak-anaknya | Trigger `forbid_published_mutation` |
| IR-03 | Satu `semver` unik; hanya satu versi `PUBLISHED` boleh ditandai aktif | `UNIQUE`, partial unique index `is_active` |
| IR-04 | `(commodity_form_id, key)` unik per form | `UNIQUE` |
| IR-05 | SCENARIO_OVERRIDE.parameter harus milik form yang sama dengan skenario | Trigger `check_override_form` |
| IR-06 | CALC_RESULT hanya ditulis server (engine terverifikasi) | Hak akses: role aplikasi |
| IR-07 | CALIBRATION_PROPOSAL `APPROVED` wajib `sample_n ≥ 10` dan `reviewed_by` peran `data_admin` | `CHECK` + logika aplikasi |
| IR-08 | Semua perubahan entitas referensi & proposal tercatat di AUDIT_LOG | Trigger audit generik |

## 3. Pemetaan Dataset JSON → Tabel

| JSON path | Tabel.kolom |
|---|---|
| `meta.version` | `DATASET_VERSION.semver` |
| `containers[]` | `CONTAINER_TYPE` (cm → m) |
| `commodities[].id` | `COMMODITY.code` |
| `commodities[].geometry.shape` | `COMMODITY_FORM.shape` |
| `commodities[].bulk_density_kg_m3.<form>` | `COMMODITY_FORM.code = <form>` + `PARAMETER(key='bulk_density')` |
| `commodities[].mass_per_unit_g` | `PARAMETER(key='mass_per_unit', unit='kg')` (g → kg) |
| `commodities[].geometry.*_cm.*` | `PARAMETER(key='geometry.<nama tanpa sufiks satuan>', unit='m')` (cm → m) |
| rentang lain (`moisture_pct`, `yield.*`, `*_fraction`) | `PARAMETER` dengan unit `pct` / `count` / `fraction`; sufiks satuan dibuang dari key |

> Catatan normalisasi: parameter tingkat-komoditas (geometri, massa, kadar air) **direplikasi** ke setiap form komoditas tsb; hanya `bulk_density` yang spesifik per form. Implementasi acuan & bukti uji: `scripts/seed_from_dataset.py` → `seed.sql` dimuat bersih ke PostgreSQL 16 (102 parameter, 14 kemasan, 9 benchmark).
| `commodities[].packaging[]` | `PACKAGING_TYPE` |
| `commodities[].container_benchmarks[]` | `CONTAINER_BENCHMARK` + `BENCHMARK_SOURCE` |
| `sources[]` | `SOURCE` |

Form per komoditas (hasil normalisasi):

| Komoditas | COMMODITY_FORM.code | calc_mode_default |
|---|---|---|
| kelapa_jambul | `loose` (ρ tumpukan lepas 483), `bagged` (ρ efektif dalam karung di container 385) | PIECE / PACKAGE |
| arang_batok_belah2 | `halves_loose`, `halves_nested`, `lumps`, `raw_halves` | PIECE / PIECE / BULK / BULK |
| kopra_asalan | `loose_bulk`, `bagged_jute` | BULK |
| kopra_edible | `loose_cups`, `bagged` | BULK / PACKAGE |
