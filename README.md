# AENDE CASHFLOW

Prototipe aplikasi laporan keuangan perusahaan untuk 5-10 user internal.

## Fitur

- Input transaksi pemasukan dan pengeluaran.
- Upload foto nota per item, tersimpan sebagai data transaksi lokal.
- Laporan pengeluaran, laporan pemasukan, dan laporan mingguan.
- Export PDF melalui fitur print browser.
- Backend Node.js ringan tanpa dependency eksternal.
- Sinkron otomatis ke Google Spreadsheet melalui Apps Script webhook.

## Menjalankan

```bash
npm start
```

Buka `http://localhost:4173`.

Jika Node sistem menolak dijalankan di Windows, pakai:

```powershell
.\start-local.ps1
```

## Mengaktifkan Google Spreadsheet

1. Buat Google Sheet dengan kolom:
   Tidak perlu membuat kolom manual. Script akan membuat header otomatis.
2. Buka Extensions > Apps Script.
3. Salin isi file `scripts/google-apps-script.js` ke Apps Script.
4. Klik Deploy > New deployment > Web app.
5. Pilih akses `Anyone` agar backend lokal bisa mengirim data.
6. Salin URL deployment yang berakhiran `/exec`.

Aktifkan URL webhook dengan salah satu cara berikut.

Cara paling mudah: buat file `config.local.json` dari contoh:

```json
{
  "googleSheetsWebhookUrl": "https://script.google.com/macros/s/URL_DEPLOYMENT_ANDA/exec"
}
```

Atau jalankan server dengan environment variable:

```bash
$env:GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/URL_DEPLOYMENT_ANDA/exec"
npm start
```

Foto nota akan diunggah ke folder Google Drive bernama `AENDE CASHFLOW - Nota`, lalu URL file masuk ke Google Sheet.
Server juga akan membaca balik data dari Google Sheet saat aplikasi dibuka, sehingga perubahan dari user lain bisa ikut tampil setelah refresh otomatis.

## Catatan produksi

Mode localhost cocok untuk prototipe. Agar 5-10 user bisa mengisi kapan saja dari perangkat berbeda, aplikasi perlu di-deploy ke hosting yang selalu aktif, misalnya Vercel/Render/Railway, atau dibuat versi Google Apps Script penuh.

## Deploy online dengan Render

1. Upload project ini ke GitHub.
2. Buka `https://render.com`.
3. Pilih New > Web Service.
4. Hubungkan repository project ini.
5. Gunakan pengaturan:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Tambahkan Environment Variable:
   - Key: `GOOGLE_SHEETS_WEBHOOK_URL`
   - Value: URL Apps Script `/exec`
7. Klik Deploy.

Setelah deploy selesai, Render akan memberi URL publik seperti `https://aende-cashflow.onrender.com`. URL itu bisa dibuka oleh 5-10 user dari perangkat berbeda.
