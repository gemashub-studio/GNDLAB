-- DEC-144: menu baru "Daily Report R&D" (Pencatatan harian by Drive) ikut tabel bersama rnd_data (kolom daily_report).
-- Wajib diterapkan SEBELUM aplikasi yang menyertakan kolom ini di-deploy (sinkron memilih semua kolom secara eksplisit).
ALTER TABLE public.rnd_data ADD COLUMN IF NOT EXISTS daily_report jsonb;
ALTER TABLE public.rnd_data DROP CONSTRAINT IF EXISTS rnd_data_menu_check;
ALTER TABLE public.rnd_data ADD CONSTRAINT rnd_data_menu_check CHECK (menu IN (
  'pencatatan_data', 'riset_produk', 'eksperimen', 'catatan_harian', 'laporan_belanja', 'bahan_baku', 'media', 'draf_riset', 'progres_perlakuan', 'daily_report', 'penghapusan'
));
