-- Keamanan Supabase (DEC-085): semua tabel inti & R&D di schema public diekspos lewat REST API Supabase.
-- RLS diaktifkan TANPA policy → anon/authenticated tidak bisa membaca/menulis; hanya server (service role / postgres).
-- Aplikasi web gemasSTUDIO belum memakai tabel ini lewat Supabase; akses publik bisa dibuka nanti dengan policy eksplisit.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
