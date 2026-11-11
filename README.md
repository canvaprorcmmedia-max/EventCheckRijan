# EventCheckRijan

Prototype awal aplikasi manajemen tamu dan kehadiran event menggunakan React, TypeScript, Vite, Tailwind CSS v4, dan Lucide React.

## Fitur yang sudah tersedia dalam prototype
- Dashboard ringkasan kehadiran dengan data contoh.
- Navigasi Dashboard, Check-in, Data Tamu, Laporan, Event, dan Pengaturan.
- Pencarian tamu berdasarkan nama atau kode undangan.
- Check-in manual dan pencegahan check-in ganda pada sisi tampilan.
- Pendaftaran tamu undangan dari dashboard admin (status awal: belum hadir).
- Pembuatan link undangan pribadi dan QR Code untuk setiap tamu.
- Halaman undangan publik di `/undangan/<token>` tanpa login dashboard.
- Admin dapat membuka QR/link undangan dari tabel Data Tamu.
- Tampilan responsif untuk desktop dan perangkat mobile.

## Catatan penting
Ini masih **prototype frontend**. Data disimpan sementara di state aplikasi dan akan kembali ke data contoh saat halaman dimuat ulang. Ini masih **prototype frontend**. Data tamu tahap demo disimpan di localStorage browser yang sama agar tetap ada setelah refresh. Data ini belum tersinkron antarperangkat dan tidak menggantikan database online. Link undangan dan QR pada tahap ini hanya berjalan pada data demo lokal; agar link dapat dibuka dari HP lain, aplikasi harus di-deploy dan data perlu disimpan di database online. Login admin/petugas, otorisasi peran, database Supabase, sinkronisasi real-time, pemindai kamera, impor XLSX/CSV, dan ekspor laporan belum dihubungkan. Jangan gunakan data contoh ini sebagai sistem absensi produksi.

## Persyaratan
- Node.js 20.19+ atau 22.12+ disarankan.
- npm tersedia. Di Windows PowerShell, gunakan `npm.cmd` jika `npm` diblokir Execution Policy.

## Menjalankan di VS Code
1. Ekstrak ZIP.
2. Buka folder `EventCheckRijan` melalui VS Code (File > Open Folder).
3. Buka Terminal > New Terminal.
4. Jalankan:

```powershell
npm.cmd install
npm.cmd run dev
```

5. Buka alamat yang muncul, biasanya `http://localhost:5173`.

## Membuat build
```powershell
npm.cmd run build
```

## Struktur folder
```text
EventCheckRijan/
├── public/
├── src/
│   ├── components/
│   ├── data/
│   ├── types/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

## Rencana tahap berikutnya
1. Autentikasi Supabase untuk akun admin dan petugas.
2. Database multi-event, kategori, tamu, attendance, dan audit log.
3. Kebijakan keamanan Row Level Security (RLS).
4. QR token dan pemindaian kamera.
5. Impor Excel (.xlsx) dan CSV dengan validasi kolom serta pratinjau.
6. Laporan dan ekspor Excel.
7. Uji multi-perangkat dan deployment.


## Uji fitur undangan pada tahap 1
1. Jalankan `npm.cmd install` (diperlukan paket `qrcode.react`).
2. Jalankan `npm.cmd run dev`.
3. Buka **Data Tamu**, lalu tekan **Undangan / QR** pada salah satu tamu.
4. Coba buka halaman undangan lewat path `/undangan/rijan-a8f3k2m9` (untuk tamu contoh pertama).
5. Tambahkan tamu baru. Status awalnya **Belum hadir**, bukan langsung check-in.

Catatan: tahap ini belum membuat tautan publik lintas perangkat yang permanen. Tahap Supabase dan deployment diperlukan untuk penggunaan acara sesungguhnya.
