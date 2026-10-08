-- =====================================================================
-- schema.sql — Coco Inventory Calculator (PostgreSQL 16)
-- Versi skema : 1.0.0   |   Tanggal: 2026-10-08
-- Sumber desain: ERD.md (aturan integritas IR-01..IR-08)
-- Satuan internal SI (ADR-004): m, kg, m3, kg/m3, fraksi 0-1
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------- ENUM ----------
CREATE TYPE dataset_status   AS ENUM ('DRAFT','PUBLISHED','DEPRECATED');
CREATE TYPE unit_type        AS ENUM ('piece','bulk');
CREATE TYPE shape_type       AS ENUM ('prolate_ellipsoid_with_tuft','hemispherical_cap_shell',
                                      'irregular_curved_slab','hemispherical_cup_or_half_slab','bulk');
CREATE TYPE calc_mode        AS ENUM ('BULK','PIECE','PACKAGE');
CREATE TYPE param_unit       AS ENUM ('m','kg','m3','kg_m3','fraction','pct','count');
CREATE TYPE confidence_grade AS ENUM ('A','B','C');
CREATE TYPE user_role        AS ENUM ('viewer','editor','data_admin');
CREATE TYPE calc_kind        AS ENUM ('CONTAINER','WAREHOUSE','CONVERT');
CREATE TYPE binding_kind     AS ENUM ('VOLUME','WEIGHT','NONE');
CREATE TYPE proposal_status  AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE audit_action     AS ENUM ('CREATE','UPDATE','DELETE','PUBLISH','APPROVE','REJECT');

-- ---------- PENGGUNA ----------
CREATE TABLE app_user (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'viewer',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- DATA REFERENSI (terversi, ADR-002) ----------
CREATE TABLE dataset_version (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semver             text NOT NULL UNIQUE CHECK (semver ~ '^\d+\.\d+\.\d+$'),
  status             dataset_status NOT NULL DEFAULT 'DRAFT',
  is_active          boolean NOT NULL DEFAULT false,
  parent_version_id  uuid REFERENCES dataset_version(id),
  published_at       timestamptz,
  changelog          text,
  CHECK (NOT is_active OR status = 'PUBLISHED'),
  CHECK ((status = 'DRAFT') = (published_at IS NULL))
);
-- IR-03: hanya satu versi aktif
CREATE UNIQUE INDEX ux_dataset_single_active ON dataset_version (is_active) WHERE is_active;

CREATE TABLE source (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id  uuid NOT NULL REFERENCES dataset_version(id) ON DELETE CASCADE,
  code                text NOT NULL,
  title               text NOT NULL,
  url                 text NOT NULL CHECK (url ~ '^https?://'),
  grade               confidence_grade NOT NULL,
  accessed_at         date,
  UNIQUE (dataset_version_id, code)
);

CREATE TABLE commodity (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id  uuid NOT NULL REFERENCES dataset_version(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name_id             text NOT NULL,
  name_en             text,
  unit_type           unit_type NOT NULL,
  description         text,
  UNIQUE (dataset_version_id, code)
);

CREATE TABLE commodity_form (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id       uuid NOT NULL REFERENCES commodity(id) ON DELETE CASCADE,
  code               text NOT NULL,
  shape              shape_type NOT NULL,
  calc_mode_default  calc_mode NOT NULL,
  nestable           boolean NOT NULL DEFAULT false,
  UNIQUE (commodity_id, code)
);

CREATE TABLE parameter (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_form_id  uuid NOT NULL REFERENCES commodity_form(id) ON DELETE CASCADE,
  key                text NOT NULL,
  unit               param_unit NOT NULL,
  v_min              numeric NOT NULL,
  v_typ              numeric NOT NULL,
  v_max              numeric NOT NULL,
  confidence         confidence_grade NOT NULL,
  note               text,
  UNIQUE (commodity_form_id, key),                              -- IR-04
  CONSTRAINT ck_param_range CHECK (v_min > 0 AND v_min <= v_typ AND v_typ <= v_max),  -- IR-01
  CONSTRAINT ck_param_fraction CHECK (unit <> 'fraction' OR v_max <= 1)
);

CREATE TABLE parameter_source (
  parameter_id  uuid NOT NULL REFERENCES parameter(id) ON DELETE CASCADE,
  source_id     uuid NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  PRIMARY KEY (parameter_id, source_id)
);

CREATE TABLE container_type (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version_id  uuid REFERENCES dataset_version(id) ON DELETE CASCADE,  -- NULL untuk custom milik user
  owner_id            uuid REFERENCES app_user(id),
  code                text NOT NULL,
  name                text NOT NULL,
  inner_l_m           numeric NOT NULL CHECK (inner_l_m > 0),
  inner_w_m           numeric NOT NULL CHECK (inner_w_m > 0),
  inner_h_m           numeric NOT NULL CHECK (inner_h_m > 0),
  payload_kg          numeric NOT NULL CHECK (payload_kg > 0),
  is_custom           boolean NOT NULL DEFAULT false,
  confidence          confidence_grade NOT NULL DEFAULT 'B',
  CHECK (is_custom = (dataset_version_id IS NULL)),
  CHECK (NOT is_custom OR owner_id IS NOT NULL)
);
CREATE UNIQUE INDEX ux_container_ref_code ON container_type (dataset_version_id, code) WHERE NOT is_custom;

CREATE TABLE packaging_type (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_form_id  uuid NOT NULL REFERENCES commodity_form(id) ON DELETE CASCADE,
  code               text NOT NULL,
  pcs_per_pack       integer CHECK (pcs_per_pack IS NULL OR pcs_per_pack > 0),
  net_kg_min         numeric NOT NULL,
  net_kg_typ         numeric NOT NULL,
  net_kg_max         numeric NOT NULL,
  dim_l_m            numeric CHECK (dim_l_m IS NULL OR dim_l_m > 0),
  dim_w_m            numeric CHECK (dim_w_m IS NULL OR dim_w_m > 0),
  dim_h_m            numeric CHECK (dim_h_m IS NULL OR dim_h_m > 0),
  deformable         boolean NOT NULL DEFAULT true,
  dims_confidence    confidence_grade,
  UNIQUE (commodity_form_id, code),
  CHECK (net_kg_min > 0 AND net_kg_min <= net_kg_typ AND net_kg_typ <= net_kg_max)
);

CREATE TABLE container_benchmark (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_form_id  uuid NOT NULL REFERENCES commodity_form(id) ON DELETE CASCADE,
  container_type_id  uuid NOT NULL REFERENCES container_type(id) ON DELETE CASCADE,
  pcs_min    numeric, pcs_max    numeric,
  packs_min  numeric, packs_max  numeric,
  net_t_min  numeric, net_t_max  numeric,
  conservative boolean NOT NULL DEFAULT false,
  note        text,
  CHECK (pcs_min   IS NULL OR pcs_min   <= pcs_max),
  CHECK (packs_min IS NULL OR packs_min <= packs_max),
  CHECK (net_t_min IS NULL OR net_t_min <= net_t_max),
  CHECK (COALESCE(pcs_min, packs_min, net_t_min) IS NOT NULL)
);

CREATE TABLE benchmark_source (
  benchmark_id  uuid NOT NULL REFERENCES container_benchmark(id) ON DELETE CASCADE,
  source_id     uuid NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  PRIMARY KEY (benchmark_id, source_id)
);

-- ---------- GUDANG ----------
CREATE TABLE warehouse (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES app_user(id),
  name              text NOT NULL,
  length_m          numeric NOT NULL CHECK (length_m > 0),
  width_m           numeric NOT NULL CHECK (width_m > 0),
  clear_height_m    numeric NOT NULL CHECK (clear_height_m > 0),
  floor_load_kg_m2  numeric CHECK (floor_load_kg_m2 IS NULL OR floor_load_kg_m2 > 0)
);

CREATE TABLE storage_zone (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id   uuid NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  name           text NOT NULL,
  length_m       numeric NOT NULL CHECK (length_m > 0),
  width_m        numeric NOT NULL CHECK (width_m > 0),
  max_stack_h_m  numeric NOT NULL CHECK (max_stack_h_m > 0),
  floor_util     numeric NOT NULL DEFAULT 0.65 CHECK (floor_util > 0 AND floor_util <= 1),
  ventilated     boolean NOT NULL DEFAULT false
);

-- ---------- SKENARIO & HASIL ----------
CREATE TABLE scenario (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES app_user(id),
  dataset_version_id  uuid NOT NULL REFERENCES dataset_version(id),
  commodity_form_id   uuid NOT NULL REFERENCES commodity_form(id),
  container_type_id   uuid REFERENCES container_type(id),
  storage_zone_id     uuid REFERENCES storage_zone(id),
  calc_kind           calc_kind NOT NULL,
  calc_mode           calc_mode NOT NULL,
  input               jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_slug          text UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (calc_kind <> 'CONTAINER' OR container_type_id IS NOT NULL)
);

CREATE TABLE scenario_override (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id   uuid NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  parameter_id  uuid NOT NULL REFERENCES parameter(id),
  v_min numeric NOT NULL, v_typ numeric NOT NULL, v_max numeric NOT NULL,
  reason        text,
  UNIQUE (scenario_id, parameter_id),
  CHECK (v_min > 0 AND v_min <= v_typ AND v_typ <= v_max)       -- IR-01
);

CREATE TABLE calc_result (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     uuid NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  engine_version  text NOT NULL,
  binding         binding_kind NOT NULL,
  result_min      jsonb NOT NULL,
  result_typ      jsonb NOT NULL,
  result_max      jsonb NOT NULL,
  warnings        jsonb NOT NULL DEFAULT '[]'::jsonb,
  trace           jsonb NOT NULL,
  computed_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- DATA LAPANGAN & KALIBRASI ----------
CREATE TABLE measurement (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES app_user(id),
  commodity_form_id  uuid NOT NULL REFERENCES commodity_form(id),
  parameter_id       uuid NOT NULL REFERENCES parameter(id),
  value              numeric NOT NULL CHECK (value > 0),
  unit               param_unit NOT NULL,
  method             text NOT NULL CHECK (method IN ('timbang','jangka_sorong','meteran','ember_1m3','drum','moisture_meter','realisasi_stuffing')),
  location           text,
  lot_ref            text,
  measured_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calibration_proposal (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id          uuid NOT NULL REFERENCES parameter(id),
  proposed_min numeric NOT NULL, proposed_typ numeric NOT NULL, proposed_max numeric NOT NULL,
  sample_n              integer NOT NULL CHECK (sample_n > 0),
  status                proposal_status NOT NULL DEFAULT 'PENDING',
  reviewed_by           uuid REFERENCES app_user(id),
  resulting_version_id  uuid REFERENCES dataset_version(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (proposed_min > 0 AND proposed_min <= proposed_typ AND proposed_typ <= proposed_max),
  CHECK (status <> 'APPROVED' OR (sample_n >= 10 AND reviewed_by IS NOT NULL))   -- IR-07
);

CREATE TABLE proposal_measurement (
  proposal_id     uuid NOT NULL REFERENCES calibration_proposal(id) ON DELETE CASCADE,
  measurement_id  uuid NOT NULL REFERENCES measurement(id),
  PRIMARY KEY (proposal_id, measurement_id)
);

-- ---------- AUDIT (IR-08) ----------
CREATE TABLE audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id   uuid REFERENCES app_user(id),
  entity     text NOT NULL,
  entity_id  uuid,
  action     audit_action NOT NULL,
  before     jsonb,
  after      jsonb,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit_log (entity, entity_id, at DESC);

-- ---------- TRIGGER ----------
-- IR-02: anak dari versi PUBLISHED tidak boleh diubah
CREATE OR REPLACE FUNCTION forbid_published_mutation() RETURNS trigger AS $$
DECLARE
  v_status dataset_status;
  v_row    record;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  IF TG_TABLE_NAME = 'parameter' THEN
    SELECT dv.status INTO v_status
    FROM commodity_form f
    JOIN commodity c        ON c.id = f.commodity_id
    JOIN dataset_version dv ON dv.id = c.dataset_version_id
    WHERE f.id = v_row.commodity_form_id;
  ELSIF TG_TABLE_NAME = 'commodity' THEN
    SELECT dv.status INTO v_status
    FROM dataset_version dv WHERE dv.id = v_row.dataset_version_id;
  END IF;

  IF v_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'IR-02: dataset version is PUBLISHED and immutable (table %)', TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parameter_immutable BEFORE INSERT OR UPDATE OR DELETE ON parameter
  FOR EACH ROW EXECUTE FUNCTION forbid_published_mutation();
CREATE TRIGGER trg_commodity_immutable BEFORE INSERT OR UPDATE OR DELETE ON commodity
  FOR EACH ROW EXECUTE FUNCTION forbid_published_mutation();

-- IR-05: override harus milik form skenario
CREATE OR REPLACE FUNCTION check_override_form() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM scenario s JOIN parameter p ON p.commodity_form_id = s.commodity_form_id
    WHERE s.id = NEW.scenario_id AND p.id = NEW.parameter_id) THEN
    RAISE EXCEPTION 'IR-05: parameter % is not part of the scenario commodity form', NEW.parameter_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_override_form BEFORE INSERT OR UPDATE ON scenario_override
  FOR EACH ROW EXECUTE FUNCTION check_override_form();

-- IR-08: audit generik untuk data referensi & proposal
CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger AS $$
DECLARE
  v_actor uuid := NULLIF(current_setting('app.actor_id', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (actor_id, entity, entity_id, action, before, after)
    VALUES (v_actor, TG_TABLE_NAME, NEW.id, 'CREATE', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (actor_id, entity, entity_id, action, before, after)
    VALUES (v_actor, TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO audit_log (actor_id, entity, entity_id, action, before, after)
    VALUES (v_actor, TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_dataset_version AFTER INSERT OR UPDATE OR DELETE ON dataset_version
  FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit_parameter AFTER INSERT OR UPDATE OR DELETE ON parameter
  FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit_proposal AFTER INSERT OR UPDATE OR DELETE ON calibration_proposal
  FOR EACH ROW EXECUTE FUNCTION audit_row();
