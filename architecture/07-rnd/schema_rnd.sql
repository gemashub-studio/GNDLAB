-- =====================================================================
-- schema_rnd.sql — Modul R&D Lab gemasSTUDIO (PostgreSQL 16)
-- Versi 1.0.0 · 2026-10-08 · Jalankan SETELAH 03-data/schema.sql
-- Prinsip: parameter didefinisikan sebagai DATA (rnd_param_def), bukan kolom,
-- sehingga parameter dari owner tinggal di-INSERT tanpa migrasi skema.
-- =====================================================================

CREATE TYPE rnd_data_type    AS ENUM ('number','text','choice','boolean');
CREATE TYPE rnd_batch_status AS ENUM ('PLANNED','RUNNING','DONE','FAILED','CANCELLED');

-- Produk turunan
CREATE TABLE rnd_product (
  code        text PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),   -- KE, KA, BL, CK
  name        text NOT NULL,
  description text
);

-- Tahap proses per produk (template, bisa diubah owner)
CREATE TABLE rnd_stage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code  text NOT NULL REFERENCES rnd_product(code) ON DELETE CASCADE,
  seq           integer NOT NULL CHECK (seq > 0),
  name          text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  UNIQUE (product_code, seq)
);

-- Definisi parameter (diisi dari daftar parameter owner)
CREATE TABLE rnd_param_def (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code  text NOT NULL REFERENCES rnd_product(code) ON DELETE CASCADE,
  stage_id      uuid REFERENCES rnd_stage(id) ON DELETE SET NULL,   -- NULL = berlaku semua tahap
  group_name    text NOT NULL,                                     -- mis. BAHAN BAKU / PROSES / HASIL-QC
  key           text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label         text NOT NULL,
  unit          text,                                              -- bebas: %, °C, pH, mm, g, MPa ...
  data_type     rnd_data_type NOT NULL,
  choices       jsonb,                                             -- untuk 'choice': ["A","B"]
  target_min    numeric,
  target_max    numeric,
  decimals      integer NOT NULL DEFAULT 2 CHECK (decimals BETWEEN 0 AND 6),
  required      boolean NOT NULL DEFAULT false,
  def_version   integer NOT NULL DEFAULT 1 CHECK (def_version > 0),
  active        boolean NOT NULL DEFAULT true,
  UNIQUE (product_code, key, def_version),
  -- NULL di CHECK dianggap lulus, jadi tulis eksplisit (ditemukan uji RI: choice tanpa pilihan sempat lolos)
  CHECK (CASE WHEN data_type = 'choice'
              THEN choices IS NOT NULL AND jsonb_typeof(choices) = 'array' AND jsonb_array_length(choices) > 0
              ELSE choices IS NULL END),
  CHECK (data_type = 'number' OR (target_min IS NULL AND target_max IS NULL)),
  CHECK (target_min IS NULL OR target_max IS NULL OR target_min <= target_max)
);

-- Batch percobaan
CREATE TABLE rnd_batch (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{2}-\d{4}-\d{3}$'),  -- KE-2610-001 (produk-YYMM-urut)
  product_code   text NOT NULL REFERENCES rnd_product(code),
  started_on     date NOT NULL,
  ended_on       date,
  operator       text,
  raw_lot        text,
  current_stage  uuid REFERENCES rnd_stage(id),
  status         rnd_batch_status NOT NULL DEFAULT 'PLANNED',
  observation    text,
  parent_batch   uuid REFERENCES rnd_batch(id),                    -- turunan/ulangan dari batch lain
  created_by     uuid REFERENCES app_user(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (substring(code from 1 for 2) = product_code),
  CHECK (ended_on IS NULL OR ended_on >= started_on),
  CHECK (status NOT IN ('DONE','FAILED') OR ended_on IS NOT NULL)
);

-- Nilai parameter yang diukur
CREATE TABLE rnd_measurement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid NOT NULL REFERENCES rnd_batch(id) ON DELETE CASCADE,
  param_def_id  uuid NOT NULL REFERENCES rnd_param_def(id),
  stage_id      uuid REFERENCES rnd_stage(id),
  value_num     numeric,
  value_text    text,
  value_bool    boolean,
  out_of_spec   boolean,                     -- diisi trigger
  measured_at   timestamptz NOT NULL DEFAULT now(),
  measured_by   uuid REFERENCES app_user(id),
  note          text,
  CHECK (num_nonnulls(value_num, value_text, value_bool) = 1)
);
CREATE INDEX ix_rnd_meas_batch ON rnd_measurement (batch_id, param_def_id, measured_at);

CREATE TABLE rnd_attachment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL REFERENCES rnd_batch(id) ON DELETE CASCADE,
  stage_id    uuid REFERENCES rnd_stage(id),
  file_url    text NOT NULL,
  caption     text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- RI-01..RI-04: validasi nilai terhadap definisi parameter
CREATE OR REPLACE FUNCTION rnd_check_measurement() RETURNS trigger AS $$
DECLARE d rnd_param_def; b rnd_batch;
BEGIN
  SELECT * INTO d FROM rnd_param_def WHERE id = NEW.param_def_id;
  SELECT * INTO b FROM rnd_batch WHERE id = NEW.batch_id;
  IF d.product_code <> b.product_code THEN
    RAISE EXCEPTION 'RI-01: parameter % milik produk %, batch milik %', d.key, d.product_code, b.product_code;
  END IF;
  IF d.data_type = 'number' AND NEW.value_num IS NULL THEN
    RAISE EXCEPTION 'RI-02: parameter % butuh nilai angka', d.key;
  ELSIF d.data_type IN ('text','choice') AND NEW.value_text IS NULL THEN
    RAISE EXCEPTION 'RI-02: parameter % butuh nilai teks/pilihan', d.key;
  ELSIF d.data_type = 'boolean' AND NEW.value_bool IS NULL THEN
    RAISE EXCEPTION 'RI-02: parameter % butuh nilai ya/tidak', d.key;
  END IF;
  IF d.data_type = 'choice' AND NOT (d.choices ? NEW.value_text) THEN
    RAISE EXCEPTION 'RI-03: "%" bukan pilihan valid untuk %', NEW.value_text, d.key;
  END IF;
  IF NEW.stage_id IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM rnd_stage s WHERE s.id = NEW.stage_id AND s.product_code = b.product_code) THEN
    RAISE EXCEPTION 'RI-04: tahap bukan milik produk %', b.product_code;
  END IF;
  NEW.out_of_spec := CASE
    WHEN d.data_type <> 'number' THEN NULL
    WHEN d.target_min IS NOT NULL AND NEW.value_num < d.target_min THEN true
    WHEN d.target_max IS NOT NULL AND NEW.value_num > d.target_max THEN true
    WHEN d.target_min IS NULL AND d.target_max IS NULL THEN NULL
    ELSE false END;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rnd_measurement BEFORE INSERT OR UPDATE ON rnd_measurement
  FOR EACH ROW EXECUTE FUNCTION rnd_check_measurement();

-- Audit (pakai audit_row() dari schema.sql)
CREATE TRIGGER trg_audit_rnd_param_def AFTER INSERT OR UPDATE OR DELETE ON rnd_param_def
  FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit_rnd_batch AFTER INSERT OR UPDATE OR DELETE ON rnd_batch
  FOR EACH ROW EXECUTE FUNCTION audit_row();

-- Ringkasan batch untuk dashboard
CREATE VIEW rnd_batch_summary AS
SELECT b.code, b.product_code, b.status, b.started_on, b.ended_on,
       s.seq AS stage_seq, s.name AS stage_name,
       count(m.*)                                   AS n_measurements,
       count(*) FILTER (WHERE m.out_of_spec)        AS n_out_of_spec,
       (SELECT count(*) FROM rnd_param_def d WHERE d.product_code = b.product_code AND d.active AND d.required) AS n_required_params
FROM rnd_batch b
LEFT JOIN rnd_stage s ON s.id = b.current_stage
LEFT JOIN rnd_measurement m ON m.batch_id = b.id
GROUP BY b.id, s.seq, s.name;

-- ---------- SEED: produk & tahap template (parameter MENYUSUL dari owner) ----------
INSERT INTO rnd_product (code, name, description) VALUES
 ('KE','Kopra Edible','Kopra putih untuk konsumsi: kadar air rendah, bersih, tanpa bau asap'),
 ('KA','Kopra Asalan','Kopra mutu umum untuk minyak; dikeringkan dengan asap atau jemur'),
 ('BL','Bioleather','Lembaran selulosa hasil fermentasi air kelapa, diolah menjadi material mirip kulit'),
 ('CK','Cuka Kelapa','Cuka dari air kelapa/nira melalui fermentasi alkohol lalu asetat');

INSERT INTO rnd_stage (product_code, seq, name) VALUES
 ('KE',1,'Terima kelapa'),('KE',2,'Belah & buang air'),('KE',3,'Pengeringan'),('KE',4,'Cungkil & sortir'),('KE',5,'Kemas'),
 ('KA',1,'Terima kelapa'),('KA',2,'Belah'),('KA',3,'Asap / jemur'),('KA',4,'Cungkil'),('KA',5,'Kering lanjut'),('KA',6,'Karungkan'),
 ('BL',1,'Siapkan media'),('BL',2,'Inokulasi starter'),('BL',3,'Fermentasi lembaran'),('BL',4,'Panen & cuci'),('BL',5,'Pemurnian'),('BL',6,'Plastisasi'),('BL',7,'Pengeringan'),('BL',8,'Finishing'),
 ('CK',1,'Saring bahan'),('CK',2,'Fermentasi alkohol'),('CK',3,'Fermentasi asetat'),('CK',4,'Penuaan'),('CK',5,'Saring'),('CK',6,'Pasteurisasi'),('CK',7,'Botolkan');
