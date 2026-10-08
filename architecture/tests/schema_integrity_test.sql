-- =====================================================================
-- schema_integrity_test.sql — uji aturan integritas IR-01..IR-08
-- Jalankan pada DB kosong SETELAH schema.sql.
-- Setiap blok DO mencetak PASS/FAIL via RAISE NOTICE; FAIL juga RAISE EXCEPTION.
-- =====================================================================
\set ON_ERROR_STOP on

-- Seed minimal
INSERT INTO app_user (id, email, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1','admin@example.com','data_admin'),
  ('00000000-0000-0000-0000-0000000000a2','user@example.com','editor');
INSERT INTO dataset_version (id, semver) VALUES ('00000000-0000-0000-0000-0000000000d1','1.0.2');
INSERT INTO commodity (id, dataset_version_id, code, name_id, unit_type)
  VALUES ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1','kelapa_jambul','Kelapa tua jambul','piece');
INSERT INTO commodity_form (id, commodity_id, code, shape, calc_mode_default)
  VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1','default','prolate_ellipsoid_with_tuft','PACKAGE');
INSERT INTO parameter (id, commodity_form_id, key, unit, v_min, v_typ, v_max, confidence)
  VALUES ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f1','mass_per_unit','kg',0.45,0.575,0.85,'B');
INSERT INTO container_type (id, dataset_version_id, code, name, inner_l_m, inner_w_m, inner_h_m, payload_kg)
  VALUES ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000d1','20GP','20ft GP',5.898,2.352,2.393,28200);

-- Helper: harap gagal
CREATE OR REPLACE FUNCTION expect_fail(label text, stmt text) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'PASS  % (ditolak: %)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL  % — pernyataan seharusnya ditolak', label;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expect_ok(label text, stmt text) RETURNS void AS $$
BEGIN
  EXECUTE stmt;
  RAISE NOTICE 'PASS  %', label;
END $$ LANGUAGE plpgsql;

-- IR-01 rentang
SELECT expect_fail('IR-01 parameter min>typ',
  $q$INSERT INTO parameter (commodity_form_id,key,unit,v_min,v_typ,v_max,confidence)
     VALUES ('00000000-0000-0000-0000-0000000000f1','x','kg',2,1,3,'C')$q$);
SELECT expect_fail('IR-01 parameter min<=0',
  $q$INSERT INTO parameter (commodity_form_id,key,unit,v_min,v_typ,v_max,confidence)
     VALUES ('00000000-0000-0000-0000-0000000000f1','y','kg',0,1,3,'C')$q$);
SELECT expect_fail('IR-01 fraksi > 1',
  $q$INSERT INTO parameter (commodity_form_id,key,unit,v_min,v_typ,v_max,confidence)
     VALUES ('00000000-0000-0000-0000-0000000000f1','pf','fraction',0.4,0.5,1.2,'C')$q$);

-- IR-04 key unik per form
SELECT expect_fail('IR-04 key duplikat',
  $q$INSERT INTO parameter (commodity_form_id,key,unit,v_min,v_typ,v_max,confidence)
     VALUES ('00000000-0000-0000-0000-0000000000f1','mass_per_unit','kg',0.4,0.5,0.6,'C')$q$);

-- Versi tidak boleh aktif bila belum PUBLISHED
SELECT expect_fail('IR-03 aktif tapi DRAFT',
  $q$UPDATE dataset_version SET is_active = true WHERE semver = '1.0.2'$q$);

-- Skenario + override
INSERT INTO scenario (id, user_id, dataset_version_id, commodity_form_id, container_type_id, calc_kind, calc_mode)
  VALUES ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1',
          '00000000-0000-0000-0000-0000000000b1','CONTAINER','PACKAGE');
SELECT expect_ok('IR-05 override form benar',
  $q$INSERT INTO scenario_override (scenario_id, parameter_id, v_min, v_typ, v_max, reason)
     VALUES ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-0000000000e1',0.5,0.6,0.7,'sampling lot A')$q$);

-- Parameter dari form lain -> harus ditolak
INSERT INTO commodity (id, dataset_version_id, code, name_id, unit_type)
  VALUES ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','kopra_edible','Kopra edible','bulk');
INSERT INTO commodity_form (id, commodity_id, code, shape, calc_mode_default)
  VALUES ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000c2','bagged','hemispherical_cup_or_half_slab','PACKAGE');
INSERT INTO parameter (id, commodity_form_id, key, unit, v_min, v_typ, v_max, confidence)
  VALUES ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000f2','bulk_density','kg_m3',300,320,355,'B');
SELECT expect_fail('IR-05 override form salah',
  $q$INSERT INTO scenario_override (scenario_id, parameter_id, v_min, v_typ, v_max)
     VALUES ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-0000000000e2',300,320,355)$q$);

-- Skenario CONTAINER tanpa container -> ditolak
SELECT expect_fail('SCENARIO container wajib',
  $q$INSERT INTO scenario (dataset_version_id, commodity_form_id, calc_kind, calc_mode)
     VALUES ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','CONTAINER','PACKAGE')$q$);

-- IR-07 proposal approved wajib n>=10 & reviewer
SELECT expect_fail('IR-07 approved n<10',
  $q$INSERT INTO calibration_proposal (parameter_id, proposed_min, proposed_typ, proposed_max, sample_n, status, reviewed_by)
     VALUES ('00000000-0000-0000-0000-0000000000e1',0.5,0.6,0.7,5,'APPROVED','00000000-0000-0000-0000-0000000000a1')$q$);
SELECT expect_fail('IR-07 approved tanpa reviewer',
  $q$INSERT INTO calibration_proposal (parameter_id, proposed_min, proposed_typ, proposed_max, sample_n, status)
     VALUES ('00000000-0000-0000-0000-0000000000e1',0.5,0.6,0.7,12,'APPROVED')$q$);
SELECT expect_ok('IR-07 approved valid',
  $q$INSERT INTO calibration_proposal (parameter_id, proposed_min, proposed_typ, proposed_max, sample_n, status, reviewed_by)
     VALUES ('00000000-0000-0000-0000-0000000000e1',0.5,0.6,0.7,12,'APPROVED','00000000-0000-0000-0000-0000000000a1')$q$);

-- Publikasi versi lalu uji IR-02 (immutable) & IR-03 (single active)
UPDATE dataset_version SET status='PUBLISHED', published_at=now(), is_active=true
  WHERE id='00000000-0000-0000-0000-0000000000d1';
SELECT expect_fail('IR-02 update parameter versi PUBLISHED',
  $q$UPDATE parameter SET v_typ = 0.6 WHERE id = '00000000-0000-0000-0000-0000000000e1'$q$);
SELECT expect_fail('IR-02 insert commodity ke versi PUBLISHED',
  $q$INSERT INTO commodity (dataset_version_id, code, name_id, unit_type)
     VALUES ('00000000-0000-0000-0000-0000000000d1','baru','Baru','bulk')$q$);
SELECT expect_fail('IR-02 delete parameter versi PUBLISHED',
  $q$DELETE FROM parameter WHERE id = '00000000-0000-0000-0000-0000000000e1'$q$);

INSERT INTO dataset_version (id, semver, parent_version_id) VALUES
  ('00000000-0000-0000-0000-0000000000d2','1.1.0','00000000-0000-0000-0000-0000000000d1');
UPDATE dataset_version SET status='PUBLISHED', published_at=now() WHERE id='00000000-0000-0000-0000-0000000000d2';
SELECT expect_fail('IR-03 dua versi aktif',
  $q$UPDATE dataset_version SET is_active = true WHERE id = '00000000-0000-0000-0000-0000000000d2'$q$);
SELECT expect_fail('IR-03 semver tidak valid',
  $q$INSERT INTO dataset_version (semver) VALUES ('v1.2')$q$);

-- IR-08 audit tercatat
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM audit_log WHERE entity IN ('parameter','dataset_version','calibration_proposal');
  IF n >= 6 THEN RAISE NOTICE 'PASS  IR-08 audit_log terisi (% baris)', n;
  ELSE RAISE EXCEPTION 'FAIL  IR-08 audit_log hanya % baris', n; END IF;
END $$;

-- Container custom wajib owner
SELECT expect_fail('CONTAINER custom tanpa owner',
  $q$INSERT INTO container_type (code,name,inner_l_m,inner_w_m,inner_h_m,payload_kg,is_custom)
     VALUES ('X','Truk',4,2,2,8000,true)$q$);

DO $$ BEGIN RAISE NOTICE 'SELESAI: semua uji integritas lulus'; END $$;
