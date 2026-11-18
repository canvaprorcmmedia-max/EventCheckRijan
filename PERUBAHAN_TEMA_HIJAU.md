# Perubahan identitas visual EventCheckRijan

- Logo resmi Riyadlul Jannah disimpan di `public/rijan-logo.png` dan ditampilkan pada sidebar Admin, header Petugas, halaman Login, serta Portal Undangan.
- Tema antarmuka utama diselaraskan ke hijau lembaga: hijau utama `#008B5A`, hijau gelap `#155B3B`, hijau tua `#10452F`, aksen toska `#379789`, dan latar hijau muda `#F3F8F4`.
- Tombol utama, navigasi aktif, panel petugas, statistik, elemen check-in, dan portal pencarian memakai palet hijau.
- Logo tambahan per event yang sudah tersimpan di `event_branding_assets` ditampilkan pada bagian acara terpilih di dashboard Petugas.
- Portal menggunakan tema hijau konsisten, sementara identitas/logo resmi tetap tampil.
- Tidak ada perubahan pada data tamu, invitation_code, invite_token, riwayat check-in, konfigurasi Supabase, maupun rewrite Vercel.

## Catatan verifikasi
TypeScript `tsc -b` berhasil dijalankan. Tahap bundling Vite belum dapat dijalankan pada lingkungan penyusunan karena executable Vite tidak tersedia/utuh setelah proses ekstraksi dependensi. Jalankan `npm.cmd run build` di komputer Windows pada folder proyek sebelum deploy.
