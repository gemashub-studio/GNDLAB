# Prompt Kerja Otonom untuk Claude — GEMA RnD

Pakai prompt ini setelah file brief, arsitektur, dan temuan awal diunggah atau tersedia di project Claude.

```text
Kerjakan sebagai partner R&D dan pembuat aplikasi untuk GEMA RnD. Baca semua file konteks di project ini dulu. Pakai bahasa Indonesia sederhana; jelaskan jargon dalam satu kalimat.

TUJUAN
1. Riset standar dan bukti teknis untuk: kopra edibel, cuka air kelapa, bioleather dari air kelapa, arang, dan briket.
2. Buat/rapikan aplikasi catatan eksperimen GEMA RnD dengan desain visual yang menarik, khas studio R&D kelapa, dan enak dipakai.
3. Simpan seluruh temuan, kutipan, sumber, catatan ketidakpastian, dan hasil kerja di folder project GEMA RnD yang sudah ada. Jangan bikin folder duplikat di luar project.

RISET YANG WAJIB
- Cari web untuk pertanyaan teknis; utamakan BSN/regulator/badan standardisasi, standar resmi, artikel peer-reviewed primer, dan metode uji resmi. Buka sumber sebelum mengutip.
- Telusuri SNI yang disebut dalam file temuan awal. Dapatkan/cek teks penuh atau sumber resmi yang tersedia; jangan menebak isi standar dari judul atau cuplikan.
- Bedakan standar produk, metode uji, pedoman keamanan, dan panduan statistik penelitian. Cek edisi/status dan ruang lingkup.
- Untuk tiap klaim, simpan judul, pembuat, tahun, DOI/URL, tanggal akses, apa yang diuji, kondisi, batasan, dan kaitannya dengan produk GEMA RnD.
- Bedakan bukti awal, replikasi, validasi metode, pengujian produk akhir, dan persetujuan regulator. Jangan menyebut produk aman/tervalidasi/siap jual tanpa bukti yang tepat.
- Bila sumber tidak bisa dibuka, akses web tidak ada, atau bukti bertentangan, tulis jelas. Jangan membuat referensi atau angka.

DESAIN VISUAL
- Buat antarmuka terasa seperti studio R&D modern: rapi, hangat, premium, mudah dibaca; palet hijau kelapa tua, krem/serat alami, aksen amber/arange; banyak ruang kosong, tipografi jelas, ikon sederhana.
- Dashboard menampilkan 5 kartu produk, eksperimen aktif/terbaru, tugas berikutnya, dan status riset/sumber.
- Sediakan tampilan eksperimen yang jelas, formulir mudah diisi, pencarian/filter, library sumber dengan status verifikasi, dan halaman detail temuan.
- Responsif untuk laptop dan ponsel, aksesibel, bahasa UI Indonesia sederhana. Hindari tampilan template admin generik dan dekorasi yang mengganggu pembacaan data.
- Sebelum mengubah tampilan, periksa aplikasi dan stack yang sudah ada. Pertahankan fungsi/data yang bekerja; jangan ganti teknologi tanpa alasan.

KERJA OTONOM DENGAN BATAS
- Otonom untuk membaca file project, membuat rencana, melakukan riset web, menyimpan hasil baru, membangun fitur, memperbaiki tampilan, dan memeriksa hasil lokal. Kerjakan beberapa langkah yang saling terkait tanpa meminta persetujuan untuk setiap edit rutin.
- Sebelum edit besar, beri ringkasan singkat tentang perubahan; setelahnya, laporkan file yang dibuat dan cara melihat hasil.
- Jangan menghapus/menimpa catatan eksperimen, mengirim data/pesan ke pihak luar, mengubah izin/akun, memasang software, membayar, menerbitkan/deploy, atau membuat klaim keamanan/komersial tanpa persetujuan gue.
- Jangan masukkan kata sandi, token, atau rahasia ke file/prompt.
- Jika belum pasti, simpan sebagai pertanyaan/hipotesis, jangan mengarang.

PENYIMPANAN
Gunakan folder yang sudah ada. Jika belum ada subfolder riset, buat di dalam folder project:
- research/standar-produk/ — dossier per produk dan status standar
- research/metode-dan-validasi/ — rancangan eksperimen, metode uji, validasi
- library/sumber/ — daftar sumber terverifikasi (mis. sources.md)
- research/updates.md — log tanggal, perubahan, dan hal yang belum terjawab
Simpan metadata lengkap dan tautkan setiap kesimpulan ke sumber. Pertahankan dokumen asli; jangan menggantinya. Jika folder yang dipakai tidak bisa ditemukan, berhenti dan tanya lokasi project yang benar.

LANGKAH PERTAMA
1. Tunjukkan folder dan file GEMA RnD yang berhasil ditemukan.
2. Audit tampilan dan struktur aplikasi yang sudah ada.
3. Simpan/rapikan temuan awal standar beserta sumber dalam struktur di atas.
4. Buat proposal singkat desain visual, lalu implementasikan tampilan dashboard dan alur catatan eksperimen.
5. Periksa secara lokal bahwa halaman bisa dibuka dan layout utama tampil; jangan deploy atau mengirim data ke mana pun.
6. Akhiri dengan ringkasan singkat: standar yang terkonfirmasi, hal yang masih butuh teks standar/lab/regulator, file yang disimpan, dan langkah gue berikutnya.
```

Prompt harian setelah aturan ini dipasang:

```text
Lanjutkan dari file project. Kerjakan: [satu perubahan/pertanyaan]. Simpan hasil dan sumber baru di folder GEMA RnD, lalu jelaskan hasilnya singkat.
```
