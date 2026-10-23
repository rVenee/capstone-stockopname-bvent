# Frontend – Aplikasi Mobile Bvent

Aplikasi mobile (Android) untuk manajemen stok, chat dengan AI, serta tren dan prediksi.

## Teknologi

- React Native dengan **Expo** dan **expo-router** (navigasi berbasis file)
- TypeScript
- react-native-svg (grafik tren dan prediksi)
- expo-camera (scanner barcode)
- Poppins (via `@expo-google-fonts/poppins`)

Versi library mengikuti `package.json` dan `package-lock.json`.

## Prasyarat

- Node.js dan npm (cek dengan `node -v` dan `npm -v`)
- Emulator Android atau perangkat Android. Cara membuka aplikasi untuk versi Expo yang dipakai
  mengikuti dokumentasi Expo.

## Menjalankan

```bash
npm ci
npx expo start
```

Gunakan `npm ci` (bukan `npm install`) agar versi persis sama dengan `package-lock.json`.

Cek tipe TypeScript:

```bash
npx tsc --noEmit
```

## Layar yang tersedia

| Kelompok | Layar |
|---|---|
| Awal | Login, Home |
| Stok | Daftar Barang, Detail Barang, Form Tambah/Edit Barang, Scan Barcode |
| Transaksi | Transaksi Stok (masuk/keluar), Riwayat Stok |
| Stock Opname | Daftar Sesi, Hitung Barang, Ringkasan Selisih |
| AI | Chat dengan AI, Tren & Prediksi, Detail Tren per Barang, Rekomendasi Restock |
| Akun | Profil, Edit Profil |

Navigasi bawah berisi tiga tab: Home, Scan, dan Profil. Layar lain dibuka dari menu di Home, dan akan ada update kedepannya.

## Struktur folder

```
src/
├── app/          Layar dan rute (expo-router); (tabs)/ berisi layar utama
├── components/   Komponen UI yang dipakai ulang (kartu, tombol, badge, grafik, scanner, dan lainnya)
├── constants/    Tema: warna, font, radius, bayangan
├── data/         Tipe data, data tiruan, dan state (BarangContext, UserContext)
├── services/     Layanan (chatService untuk Chat AI)
└── api/          Klien API ke backend (akan ditambahkan)
```

## Catatan

- Aplikasi ditargetkan untuk **platform mobile (Android)**, nantinya akan diupdate agar bisa di IOS juga.
- Sementara ini data masih **tiruan** (disimpan di memori, di `src/data/`), dan jawaban Chat AI serta
  perhitungan tren masih simulasi (`src/services/chatService.ts` dan `src/data/tren.ts`).
  Semuanya akan diganti dengan panggilan ke backend (`backend/` di port 8000 dan `forecasting/` di
  port 8001).
