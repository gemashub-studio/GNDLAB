-- DEC-095: menu baru "Upload Progres Perlakuan" ikut tabel bersama rnd_data (kolom progres_perlakuan).
ALTER TABLE public.rnd_data ADD COLUMN IF NOT EXISTS progres_perlakuan jsonb;
ALTER TABLE public.rnd_data DROP CONSTRAINT IF EXISTS rnd_data_menu_check;
ALTER TABLE public.rnd_data ADD CONSTRAINT rnd_data_menu_check CHECK (menu IN (
  'pencatatan_data', 'riset_produk', 'eksperimen', 'catatan_harian', 'laporan_belanja', 'bahan_baku', 'media', 'draf_riset', 'progres_perlakuan', 'penghapusan'
));
