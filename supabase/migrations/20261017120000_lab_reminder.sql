-- DEC-093: pengingat email tiap jam bila masih ada Pencatatan Data yang belum lengkap.
-- Catatan jalannya pengingat (server/service role saja).
CREATE TABLE IF NOT EXISTS public.lab_reminder_runs (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at  timestamptz NOT NULL DEFAULT now(),
  pending int NOT NULL DEFAULT 0,
  sent    int NOT NULL DEFAULT 0
);
ALTER TABLE public.lab_reminder_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lab_reminder_runs FROM anon, authenticated;

-- Penjadwal: setiap jam (menit ke-0) Supabase memanggil endpoint pengingat di Vercel.
-- Endpoint sendiri membatasi maks. sekali per 55 menit, jadi aman bila terpanggil ganda.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gnd-lab-reminder';
  PERFORM cron.schedule(
    'gnd-lab-reminder',
    '0 * * * *',
    $cmd$ SELECT net.http_post(url := 'https://gemasstudio.vercel.app/api/lab-reminder', body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 30000); $cmd$
  );
END $$;
