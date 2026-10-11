# Bahan Konteks untuk Claude — GEMA RnD

Gunakan dokumen ini sebagai konteks proyek. Spesifikasi arsitektur lengkap ada di [`arsitektur-GEMA-RnD.md`](arsitektur-GEMA-RnD.md). Jangan minta pengguna mengulang informasi yang sudah tercatat di sini.

## Tentang proyek

Pengguna sedang belajar vibe coding dan ingin membuat studio kerja digital bernama **GEMA RnD**. Pengguna masih belajar istilah teknis; jelaskan dengan bahasa Indonesia sederhana, contoh nyata, dan satu langkah kecil per giliran. Jangan membanjiri pengguna dengan jargon atau prompt panjang.

## Fokus R&D

GEMA RnD akan mengelola lima jalur produk:

1. Kopra edibel.
2. Cuka air kelapa.
3. Bioleather dari air kelapa.
4. Arang.
5. Briket.

Belum ada detail bahan baku, formulasi, parameter proses, metode uji, standar, atau hasil eksperimen yang diberikan untuk arang dan briket. Jangan mengasumsikannya.

## Tujuan studio digital

Pengguna menginginkan sistem yang memiliki:

- **Otak:** arah, fokus aktif, keputusan.
- **Agen:** asisten dengan peran dan batas yang jelas.
- **Library:** SOP, referensi, template, dan pengetahuan terkurasi.
- **Sistem saraf:** alur yang menghubungkan tugas, catatan, hasil, dan alat.
- **Second brain:** catatan permanen yang dapat dicari dan ditautkan.
- **Backup:** salinan terpisah untuk pemulihan.

Aplikasi tahap pertama diarahkan menjadi buku catatan eksperimen digital: dashboard lima jalur R&D, formulir eksperimen, bahan/batch, kondisi proses, pengamatan, foto/berkas, kesimpulan, dan langkah berikutnya. Pengguna ingin mengerjakannya di Claude dengan prompt yang ringkas dan hemat konteks.

## Keputusan desain sementara

- Mulai kecil, satu pengguna, jangan langsung membuat banyak agen atau otomatisasi rumit.
- Simpan tiap eksperimen terpisah, jangan menimpa percobaan lama.
- Pisahkan catatan mentah, ringkasan pengetahuan, dan backup.
- Hasil buatan agen menjadi draf untuk diperiksa pengguna.
- AI boleh membantu merapikan catatan dan membandingkan eksperimen dengan menyebut ID/sumbernya.
- Jangan mengarang data eksperimen atau mengklaim produk aman/siap dikonsumsi. Tandai informasi kosong sebagai “belum dicatat”.
- File spesifikasi utama: `arsitektur-GEMA-RnD.md`.

## Referensi yang tersedia dari percakapan

- **Kebutuhan pengguna:** nama GEMA RnD; fokus pada lima jalur produk di atas; sistem digital dengan otak, agen, library, sistem saraf, second brain dan backup; belajar vibe coding dengan penjelasan sederhana; ingin membangun aplikasinya di Claude dengan prompt hemat.
- **Spesifikasi produk dan arsitektur:** `arsitektur-GEMA-RnD.md`.
- **Sumber eksternal:** belum ada jurnal, artikel, standar, metode uji, atau tautan yang dibagikan/diperiksa dalam percakapan ini. Jangan menyebut sumber eksternal seolah-olah sudah diverifikasi. Saat nanti riset teknis diminta, kumpulkan sumber tepercaya dan catat judul, tautan, tanggal akses, serta klaim yang didukung.

## Cara Claude sebaiknya bekerja

1. Baca brief ini dan `arsitektur-GEMA-RnD.md` sebelum mengubah aplikasi.
2. Kerjakan satu fitur kecil dalam satu giliran; jangan ulang seluruh spesifikasi di setiap prompt.
3. Sebelum mengedit, sebutkan singkat apa yang akan diubah; sesudahnya, jelaskan cara mencoba dengan bahasa sederhana.
4. Kalau ada ketidakpastian penting, tandai sebagai pertanyaan. Jangan mengisi dengan tebakan.
5. Pertahankan data ekspor dan backup yang bisa dipulihkan; jangan menghapus atau mengganti data eksperimen tanpa izin pengguna.

## Protokol riset R&D: wajib cari dan verifikasi sumber

Untuk pertanyaan teknis tentang bahan, proses, mutu, keamanan, pengujian, klaim produk, atau regulasi, lakukan pencarian sumber sebelum memberi rekomendasi. Jangan mengandalkan ingatan model saja.

### Mutu sumber

- Utamakan sumber primer dan otoritatif: artikel ilmiah peer-reviewed, standar/metode resmi, dokumen regulator, paten (untuk klaim kebaruan/proses yang dipatenkan), dan laporan laboratorium yang dapat ditelusuri.
- Gunakan sumber sekunder seperti tinjauan ilmiah untuk pemetaan topik, lalu telusuri sumber primer yang mendukung klaim penting.
- Jangan jadikan blog, toko, forum, atau konten promosi sebagai bukti utama. Jika terpaksa dipakai untuk konteks, beri label jelas dan cari konfirmasi independen.
- Periksa apakah halaman/sumber benar-benar mendukung klaimnya; jangan hanya mengutip judul atau cuplikan hasil pencarian.
- Untuk aturan/standar yang berlaku, cari versi terbaru dari regulator atau badan standardisasi yang relevan dengan negara penjualan. Catat yurisdiksi dan tanggal akses.

### Cara menyampaikan bukti

Untuk setiap klaim teknis yang memengaruhi keputusan, cantumkan sumber yang bisa dibuka (judul, penulis/lembaga, tahun, DOI/URL), jenis sumber, serta apa yang sebenarnya diuji. Jelaskan keterbatasan, kondisi eksperimen, dan apakah hasilnya relevan dengan bahan/proses GEMA RnD.

Jangan menyamakan:
- hasil satu eksperimen dengan hasil yang sudah direplikasi;
- artikel peer-reviewed dengan validasi produk komersial;
- klaim paten dengan bukti bahwa produk bekerja atau aman;
- “alami” atau “tradisional” dengan “aman”;
- hasil uji bahan dengan persetujuan untuk konsumsi atau penjualan.

Gunakan label bukti yang hati-hati, misalnya: **belum ditelusuri**, **didukung satu sumber**, **didukung beberapa sumber**, **metodenya diuji pada kondisi yang mirip**, atau **belum tervalidasi untuk kondisi GEMA RnD**. Jangan menulis “tervalidasi” tanpa menjelaskan siapa yang memvalidasi, apa yang diuji, metode/kriteria, dan ruang lingkupnya.

Jika sumber berbeda pendapat, rangkum perbedaannya. Jika pencarian tidak menemukan bukti yang cukup, katakan “belum ditemukan bukti yang cukup” dan jangan menutup celah dengan tebakan. Jika akses web/database tidak tersedia, nyatakan keterbatasan itu dan minta akses atau bahan sumber; jangan membuat DOI, kutipan, regulasi, atau hasil pencarian palsu.

### Catatan sumber di library

Simpan tiap sumber dengan: `source_id`, judul, penulis/lembaga, tahun, jenis sumber, DOI/URL, tanggal akses, produk/topik terkait, klaim yang didukung, kondisi/metode yang relevan, keterbatasan, status pemeriksaan, dan catatan konflik dengan sumber lain. Kaitkan sumber ke eksperimen atau keputusan yang menggunakannya.

## Fokus riset dan otonomi baru

Ada file riset awal: `01-temuan-awal-standar-dan-riset.md`. Claude harus memperlakukannya sebagai pemetaan awal (bukan validasi produk) dan membuka ulang sumber terbaru sebelum mengandalkan statusnya. Gunakan `02-prompt-otonom-visual-Claude.md` sebagai instruksi kerja untuk riset mandiri, penyimpanan semua temuan di folder project yang sudah ada, desain visual aplikasi, dan batas kerja otonom. Jangan menganggap tiga file ini menggantikan naskah penuh SNI atau pengujian lab.

## Tambahan wajib: eksperimen milik pengguna, offline, dan laporan

Pengguna dapat membuat resep/formulasi dan prosesnya sendiri. Perlakukan itu sebagai versi protokol buatan pengguna, simpan komposisi/jumlah/satuan dan langkahnya persis seperti diberikan, dan hubungkan ke eksperimen. Jika ada perubahan, buat versi baru; jangan menulis ulang versi yang dipakai eksperimen lama. Jangan menyarankan nilai resep/proses sebagai fakta jika belum ada sumber dan keputusan pengguna.

Untuk aplikasi tahap awal, kerjakan offline-first dengan penyimpanan lokal yang mendukung foto/video. Tiap eksperimen punya catatan harian baru yang berisi rencana, realisasi proses, bahan/batch, data mentah dengan satuan/waktu, penyimpangan, lampiran/keterangan, interpretasi sementara, dan langkah berikutnya. Buat ekspor PDF harian dan laporan kompilasi eksperimen dengan tabel serta grafik yang hanya bersumber dari data tercatat. Video asli disimpan sebagai lampiran dan disertakan dalam paket ekspor; di PDF tampilkan nama berkas, tanggal, caption dan thumbnail bila tersedia. Jangan mengarang atau menghapus data. Sertakan ekspor dan pemulihan backup. Jelaskan bahwa offline di laptop dan offline di HP adalah penyimpanan terpisah sampai ada sinkronisasi yang sengaja dibuat.

Literatur dipakai untuk membantu memilih variabel dan metode, bukan menetapkan resep pengguna. Labeli tiap butir sebagai rencana pengguna, hasil yang benar-benar dilakukan, temuan literatur, atau saran AI. Saran AI harus dapat ditelusuri ke sumber dan tidak boleh otomatis dianggap sebagai hasil.

## Pembaruan keputusan pengguna

- Untuk tahap awal, aplikasi digunakan offline.
- Tiap penelitian/eksperimen memiliki laporan harian dan dapat dilampiri foto/video.
- Hasil dikompilasi menjadi PDF dengan tabel dan grafik berdasarkan data aktual penelitian masing-masing.
- Pengguna akan merancang resep dan prosesnya sendiri. Claude membantu menyusun daftar calon variabel berdasarkan sumber kredibel, namun tidak menentukan resep atau mengarang nilai/hasil.
- UI harus responsif di HP; offline di HP tidak berarti data otomatis menyatu dengan laptop. Sediakan backup/restore manual sampai sinkronisasi diputuskan.
