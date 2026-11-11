# EventCheckRijan — Branding Tahap 1

Tahap ini menyiapkan database dan penyimpanan logo. Belum mengubah tampilan aplikasi.

## Isi

- `organization_branding`: satu identitas/logo resmi lembaga untuk seluruh aplikasi.
- `event_branding`: palet warna terpisah untuk setiap event.
- `event_branding_assets`: banyak logo tambahan per event, beserta urutan dan pilihan tampil pada undangan/QR/laporan.
- Storage bucket `eventcheck-branding`: publik untuk menampilkan logo; hanya Admin Utama yang dapat mengunggah, mengganti, atau menghapus file.

## Langkah pemasangan

1. Buka Supabase Dashboard untuk project EventCheckRijan.
2. Pilih **SQL Editor**.
3. Buat query baru.
4. Buka file `supabase/migrations/20261111000100_branding_system.sql` dari paket ini.
5. Salin seluruh isinya ke SQL Editor.
6. Klik **Run** satu kali.
7. Pastikan hasil query berhasil tanpa error.

## Catatan keamanan

- Jangan menaruh `service_role` key di aplikasi frontend.
- Jangan mengunggah `.env.local` ke GitHub.
- Bucket hanya menerima JPG/JPEG, PNG, WEBP, dan SVG, maksimum 5 MB per file.
- Logo bersifat publik agar dapat tampil pada undangan publik. Hak upload, update, dan delete dibatasi untuk role Admin melalui `public.is_admin()` yang sudah digunakan oleh kebijakan keamanan proyek.
- Jangan menghapus tabel `profiles`, `events`, `event_staff`, `guests`, atau `check_ins`.

## Tahap berikutnya

Setelah SQL berhasil dijalankan, tahap berikutnya adalah membuat halaman Admin untuk mengunggah logo resmi lembaga dan mengelola logo tambahan serta warna tiap event. Kemudian branding diterapkan ke dashboard Admin/Petugas, kartu QR, undangan, dan laporan.
