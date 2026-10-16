-- Pengerasan keamanan sesuai Supabase security advisor (DEC-085).
-- 1) View ringkasan R&D memakai hak PEMANGGIL (bukan pembuat) agar RLS tabel di bawahnya tetap berlaku.
ALTER VIEW public.rnd_batch_summary SET (security_invoker = on);

-- 2) search_path tetap untuk fungsi trigger skema inti/R&D (sumber: architecture/03-data & 07-rnd; isi fungsi tidak diubah).
ALTER FUNCTION public.forbid_published_mutation() SET search_path = public;
ALTER FUNCTION public.check_override_form() SET search_path = public;
ALTER FUNCTION public.audit_row() SET search_path = public;
ALTER FUNCTION public.rnd_check_measurement() SET search_path = public;

-- 3) Fungsi bawaan proyek (auto-enable RLS) tidak perlu bisa dipanggil lewat REST API.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable') THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
