-- DEC-090: login username + password + OTP email (Resend), tabel users, dan data GnD Lab bersama (rnd_data).

-- 1) Pengguna aplikasi (id = auth.users.id). Username dipakai untuk login; email tetap di auth.users.
--    Tabel ini sudah dibuat owner di dashboard (kolom id & created_at) → disesuaikan, tidak dibuat ulang.
CREATE TABLE IF NOT EXISTS public.users (
  id         uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$
DECLARE
  id_type text;
  n bigint;
BEGIN
  SELECT data_type INTO id_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';
  SELECT count(*) INTO n FROM public.users;
  IF id_type IS DISTINCT FROM 'uuid' THEN
    IF n > 0 THEN
      RAISE EXCEPTION 'public.users berisi % baris dengan id bertipe % — tidak diubah otomatis', n, id_type;
    END IF;
    -- tabel kosong buatan dashboard (id int8 identity) → id uuid = id akun Supabase Auth
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN id DROP IDENTITY IF EXISTS';
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN id TYPE uuid USING gen_random_uuid()';
  END IF;
END $$;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.users ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_format;
ALTER TABLE public.users ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9][a-z0-9_.-]{2,29}$');
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username ON public.users (username);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_auth_fkey;
ALTER TABLE public.users ADD CONSTRAINT users_id_auth_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self ON public.users;
CREATE POLICY users_self ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
GRANT SELECT ON public.users TO authenticated;

-- 2) Kode OTP (hanya server/service role; tanpa policy = tertutup untuk anon & authenticated).
CREATE TABLE public.auth_otps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  purpose    text NOT NULL CHECK (purpose IN ('register', 'login')),
  code_hash  text NOT NULL,
  -- login: token sesi terenkripsi (AES-GCM) yang baru diserahkan setelah kode benar
  payload    text,
  expires_at timestamptz NOT NULL,
  attempts   int NOT NULL DEFAULT 0,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_auth_otps_email ON public.auth_otps (email, purpose, created_at DESC);
ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_otps FROM anon, authenticated;

-- 3) Data GnD Lab bersama: satu baris per catatan, satu kolom per menu. Semua pengguna yang login bisa
--    melihat & menambah (sesuai permintaan owner). Foto/video di bucket lab-blobs (rujukan "sbblob:").
CREATE TABLE public.rnd_data (
  menu            text NOT NULL CHECK (menu IN ('pencatatan_data', 'riset_produk', 'eksperimen', 'catatan_harian', 'laporan_belanja', 'bahan_baku', 'media', 'draf_riset', 'penghapusan')),
  id              text NOT NULL,
  -- Pencatatan Data
  data_awal       jsonb,
  data_akhir      jsonb,
  perlakuan       jsonb,
  progres_harian  jsonb,
  -- menu lain
  riset_produk    jsonb,
  eksperimen      jsonb,
  catatan_harian  jsonb,
  laporan_belanja jsonb,
  bahan_baku      jsonb,
  media           jsonb,
  draf_riset      jsonb,
  penghapusan     jsonb,
  rev             text NOT NULL,
  deleted         boolean NOT NULL DEFAULT false,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (menu, id)
);
CREATE INDEX ix_rnd_data_updated_at ON public.rnd_data (updated_at);
ALTER TABLE public.rnd_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY rnd_data_read ON public.rnd_data FOR SELECT TO authenticated USING (true);
CREATE POLICY rnd_data_insert ON public.rnd_data FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY rnd_data_update ON public.rnd_data FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.rnd_data TO authenticated;

CREATE OR REPLACE FUNCTION public.rnd_data_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rnd_data_touch BEFORE INSERT OR UPDATE ON public.rnd_data
  FOR EACH ROW EXECUTE FUNCTION public.rnd_data_touch();

-- 4) Foto/video: semua pengguna yang login (bukan lagi daftar anggota).
DROP POLICY IF EXISTS lab_blobs_read ON storage.objects;
DROP POLICY IF EXISTS lab_blobs_insert ON storage.objects;
CREATE POLICY lab_blobs_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lab-blobs');
CREATE POLICY lab_blobs_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lab-blobs');

-- 5) Pindahkan isi lab_docs (sinkron versi DEC-085) ke rnd_data. lab_docs dibiarkan (tidak dihapus).
INSERT INTO public.rnd_data (menu, id, rev, deleted, eksperimen, catatan_harian, riset_produk, media, draf_riset, laporan_belanja, bahan_baku, penghapusan)
SELECT
  CASE kind WHEN 'experiment' THEN 'eksperimen' WHEN 'entry' THEN 'catatan_harian' WHEN 'protocol' THEN 'riset_produk' WHEN 'media' THEN 'media'
            WHEN 'draft' THEN 'draf_riset' WHEN 'belanja' THEN 'laporan_belanja' WHEN 'bahan' THEN 'bahan_baku' ELSE 'penghapusan' END,
  id, rev, deleted,
  CASE WHEN kind = 'experiment' THEN data END,
  CASE WHEN kind = 'entry' THEN data END,
  CASE WHEN kind = 'protocol' THEN data END,
  CASE WHEN kind = 'media' THEN data END,
  CASE WHEN kind = 'draft' THEN data END,
  CASE WHEN kind = 'belanja' THEN data END,
  CASE WHEN kind = 'bahan' THEN data END,
  CASE WHEN kind = 'tomb' THEN data END
FROM public.lab_docs WHERE kind <> 'catat'
ON CONFLICT (menu, id) DO NOTHING;

INSERT INTO public.rnd_data (menu, id, rev, deleted, data_awal, data_akhir, perlakuan, progres_harian)
SELECT 'pencatatan_data', d.id, d.rev, d.deleted,
  CASE WHEN d.data IS NULL THEN NULL ELSE
    (d.data - 'rows' - 'finishedAt' - 'akhirSavedAt' - 'treatments' - 'progress')
    || jsonb_build_object('rows', COALESCE((SELECT jsonb_agg(r - 'beratAkhir' - 'tebalAkhir' - 'fotoAkhir' ORDER BY (r->>'no')::int) FROM jsonb_array_elements(d.data->'rows') r), '[]'::jsonb)) END,
  CASE WHEN d.data IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
    'finishedAt', d.data->'finishedAt', 'akhirSavedAt', d.data->'akhirSavedAt',
    'rows', COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('no', r->'no', 'beratAkhir', r->'beratAkhir', 'tebalAkhir', r->'tebalAkhir', 'fotoAkhir', r->'fotoAkhir')) ORDER BY (r->>'no')::int) FROM jsonb_array_elements(d.data->'rows') r), '[]'::jsonb))) END,
  d.data->'treatments',
  d.data->'progress'
FROM public.lab_docs d WHERE d.kind = 'catat'
ON CONFLICT (menu, id) DO NOTHING;

-- 6) Cari id akun dari email — HANYA untuk server (service role), tidak bisa dipanggil anon/authenticated.
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, public AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;
