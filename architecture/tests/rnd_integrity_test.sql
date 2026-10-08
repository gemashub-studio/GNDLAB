-- =====================================================================
-- rnd_integrity_test.sql — uji aturan modul R&D (RI-01..RI-04 + CHECK)
-- Jalankan pada DB kosong SETELAH 03-data/schema.sql dan 07-rnd/schema_rnd.sql.
-- Parameter di sini hanya PARAMETER UJI (param_uji_*), bukan parameter produk sungguhan.
-- =====================================================================
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION rexpect_fail(label text, stmt text) RETURNS void AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN others THEN RAISE NOTICE 'PASS  % (ditolak: %)', label, SQLERRM; RETURN; END;
  RAISE EXCEPTION 'FAIL  % — seharusnya ditolak', label;
END $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION rexpect_ok(label text, stmt text) RETURNS void AS $$
BEGIN EXECUTE stmt; RAISE NOTICE 'PASS  %', label; END $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF (SELECT count(*) FROM rnd_product) = 4 AND (SELECT count(*) FROM rnd_stage) = 26
  THEN RAISE NOTICE 'PASS  seed 4 produk & 26 tahap';
  ELSE RAISE EXCEPTION 'FAIL  seed produk/tahap'; END IF;
END $$;

-- Definisi parameter uji
INSERT INTO rnd_param_def (id, product_code, group_name, key, label, unit, data_type, target_min, target_max, required)
VALUES ('00000000-0000-0000-0000-00000000aa01','KE','HASIL / QC','param_uji_angka','Param uji angka','%','number',4,6,true);
INSERT INTO rnd_param_def (id, product_code, group_name, key, label, data_type, choices)
VALUES ('00000000-0000-0000-0000-00000000aa02','KE','HASIL / QC','param_uji_pilihan','Param uji pilihan','choice','["A","B"]');
INSERT INTO rnd_param_def (id, product_code, group_name, key, label, unit, data_type)
VALUES ('00000000-0000-0000-0000-00000000aa03','CK','FERMENTASI','param_uji_ck','Param uji CK','pH','number');

SELECT rexpect_fail('CHECK choice tanpa pilihan',
 $q$INSERT INTO rnd_param_def (product_code,group_name,key,label,data_type) VALUES ('KE','X','p_x','X','choice')$q$);
SELECT rexpect_fail('CHECK target pada tipe teks',
 $q$INSERT INTO rnd_param_def (product_code,group_name,key,label,data_type,target_min) VALUES ('KE','X','p_y','Y','text',1)$q$);
SELECT rexpect_fail('CHECK target_min > target_max',
 $q$INSERT INTO rnd_param_def (product_code,group_name,key,label,data_type,target_min,target_max) VALUES ('KE','X','p_z','Z','number',9,1)$q$);
SELECT rexpect_fail('CHECK key format',
 $q$INSERT INTO rnd_param_def (product_code,group_name,key,label,data_type) VALUES ('KE','X','Kadar Air','K','number')$q$);

-- Batch
SELECT rexpect_ok('Batch valid KE-2610-001',
 $q$INSERT INTO rnd_batch (id, code, product_code, started_on) VALUES ('00000000-0000-0000-0000-00000000bb01','KE-2610-001','KE','2026-10-08')$q$);
SELECT rexpect_fail('Kode batch format salah',
 $q$INSERT INTO rnd_batch (code, product_code, started_on) VALUES ('KE-26-1','KE','2026-10-08')$q$);
SELECT rexpect_fail('Prefix kode ≠ produk',
 $q$INSERT INTO rnd_batch (code, product_code, started_on) VALUES ('BL-2610-001','KE','2026-10-08')$q$);
SELECT rexpect_fail('DONE tanpa tanggal selesai',
 $q$INSERT INTO rnd_batch (code, product_code, started_on, status) VALUES ('KE-2610-002','KE','2026-10-08','DONE')$q$);
SELECT rexpect_fail('Tanggal selesai < mulai',
 $q$INSERT INTO rnd_batch (code, product_code, started_on, ended_on) VALUES ('KE-2610-003','KE','2026-10-08','2026-10-01')$q$);

-- Pengukuran
SELECT rexpect_ok('Ukur angka dalam target',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_num) VALUES ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa01',5)$q$);
SELECT rexpect_ok('Ukur angka di luar target',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_num) VALUES ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa01',7.5)$q$);
DO $$ BEGIN
  IF (SELECT array_agg(out_of_spec ORDER BY value_num) FROM rnd_measurement) = ARRAY[false,true]
  THEN RAISE NOTICE 'PASS  out_of_spec dihitung (5 → false, 7,5 → true)';
  ELSE RAISE EXCEPTION 'FAIL  out_of_spec'; END IF;
END $$;
SELECT rexpect_fail('RI-01 parameter produk lain',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_num) VALUES ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa03',3.1)$q$);
SELECT rexpect_fail('RI-02 tipe nilai salah',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_text) VALUES ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa01','lima')$q$);
SELECT rexpect_fail('RI-03 pilihan tidak valid',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_text) VALUES ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa02','C')$q$);
SELECT rexpect_ok('RI-03 pilihan valid',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_text) VALUES ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa02','B')$q$);
SELECT rexpect_fail('RI-04 tahap produk lain',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_num, stage_id)
    SELECT '00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa01',5, id FROM rnd_stage WHERE product_code='CK' AND seq=1$q$);
SELECT rexpect_fail('Dua nilai sekaligus',
 $q$INSERT INTO rnd_measurement (batch_id, param_def_id, value_num, value_text) VALUES ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-00000000aa01',5,'5')$q$);

DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM rnd_batch_summary WHERE code = 'KE-2610-001';
  IF r.n_measurements = 3 AND r.n_out_of_spec = 1 AND r.n_required_params = 1
  THEN RAISE NOTICE 'PASS  view rnd_batch_summary (3 ukur, 1 out-of-spec, 1 wajib)';
  ELSE RAISE EXCEPTION 'FAIL  view summary: %', r; END IF;
END $$;

DO $$ BEGIN
  IF (SELECT count(*) FROM audit_log WHERE entity IN ('rnd_param_def','rnd_batch')) >= 4
  THEN RAISE NOTICE 'PASS  audit R&D tercatat';
  ELSE RAISE EXCEPTION 'FAIL  audit R&D'; END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'SELESAI: semua uji R&D lulus'; END $$;
