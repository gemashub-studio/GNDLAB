-- GnD Lab: sinkron data antar perangkat (DEC-085).
-- * lab_members  : daftar email yang boleh membuka data lab (login lewat email link).
-- * lab_docs     : satu baris per catatan lab (eksperimen, catatan harian, riset, media, draf, laporan belanja,
--                  bahan baku, pencatatan data, nisan penghapusan). Foto/video TIDAK di sini — hanya rujukan "sbblob:".
-- * bucket lab-blobs (privat): foto/video, nama file = SHA-256 isinya (sama isi → sekali unggah).
-- Semua akses lewat RLS: hanya pengguna login yang emailnya ada di lab_members.

CREATE TABLE public.lab_members (
  email    text PRIMARY KEY CHECK (email = lower(email)),
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_lab_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.lab_members m WHERE m.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
REVOKE ALL ON FUNCTION public.is_lab_member() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_lab_member() TO authenticated;

-- anggota hanya bisa melihat barisnya sendiri (untuk cek "apakah saya anggota")
CREATE POLICY lab_members_self ON public.lab_members FOR SELECT TO authenticated
  USING (email = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE TABLE public.lab_docs (
  kind       text NOT NULL CHECK (kind IN ('experiment','entry','protocol','media','draft','belanja','bahan','catat','tomb')),
  id         text NOT NULL,
  data       jsonb,
  -- versi dokumen dari perangkat (updatedAt / createdAt / waktu nisan)
  rev        text NOT NULL,
  deleted    boolean NOT NULL DEFAULT false,
  updated_by text NOT NULL DEFAULT '',
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);
CREATE INDEX ix_lab_docs_synced_at ON public.lab_docs (synced_at);
ALTER TABLE public.lab_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_docs_members ON public.lab_docs FOR ALL TO authenticated
  USING (public.is_lab_member()) WITH CHECK (public.is_lab_member());

CREATE OR REPLACE FUNCTION public.lab_docs_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.synced_at := clock_timestamp();
  NEW.updated_by := lower(coalesce(auth.jwt() ->> 'email', NEW.updated_by));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lab_docs_touch BEFORE INSERT OR UPDATE ON public.lab_docs
  FOR EACH ROW EXECUTE FUNCTION public.lab_docs_touch();

GRANT SELECT, INSERT, UPDATE ON public.lab_docs TO authenticated;
GRANT SELECT ON public.lab_members TO authenticated;

-- Pemilik (owner) sebagai anggota pertama. Tambah anggota lain lewat SQL Editor:
--   INSERT INTO public.lab_members (email) VALUES ('nama@contoh.com');
INSERT INTO public.lab_members (email) VALUES ('masciosa@gmail.com') ON CONFLICT DO NOTHING;

-- Penyimpanan foto/video (privat, maks. 50 MB per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('lab-blobs', 'lab-blobs', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY lab_blobs_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lab-blobs' AND public.is_lab_member());
CREATE POLICY lab_blobs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lab-blobs' AND public.is_lab_member());
