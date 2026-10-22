# Bvent – Sistem Stock Opname Berbasis AI

Capstone Project · **Kelompok 8** · Kelas 7B · Semester Ganjil 2026/2027

Aplikasi mobile manajemen inventaris untuk UMKM yang memungkinkan admin atau staf gudang
bertanya tentang stok dengan **bahasa sehari-hari** (Text-to-SQL) dan
memperoleh **prediksi tren serta rekomendasi restock** berbasis data transaksi dan LLM.

## Masalah yang diselesaikan

Admin atau staf gudang UMKM sulit memperoleh informasi stok dan rekomendasi restock secara cepat
dan akurat karena tanpa alat bantu prediksi tren.
Akibatnya keputusan restock sering terlambat atau tidak berbasis data, sehingga rawan overstock
maupun stockout.

## Fitur utama

| Fitur | Deskripsi | Status |
|---|---|---|
| Daftar Barang | Data master barang (nama, kategori, lokasi, satuan, stok minimum) dan status stok | Setup awal |
| Transaksi & Riwayat Stok | Pencatatan stok masuk/keluar dan riwayat transaksi | Setup awal |
| Stock Opname | Perhitungan stok fisik vs stok sistem beserta selisihnya | Setup awal |
| Chat dengan AI (Text-to-SQL) | Pertanyaan bahasa natural diubah menjadi query SQL read-only yang aman | Setup awal |
| Tren & Prediksi | Prediksi permintaan dan proyeksi stok per barang | Setup awal |
| Rekomendasi Restock | Produk, jumlah, waktu, dan alasan restock | Setup awal |
| Event/Musim | Input event atau musim yang memengaruhi permintaan | Setup awal |

> Kolom *Status* diperbarui setiap minggu (Setup awal, Dikerjakan, Selesai, Diuji).

## Arsitektur

```
Aplikasi Mobile (Expo / React Native)
        │  REST API
        ├──────────────► backend/      (FastAPI, :8000)  ── barang, transaksi, opname, login, NLQ
        │                      │
        └──────────────► forecasting/  (FastAPI, :8001)  ── tren, rekomendasi, event
                               │
                    PostgreSQL (satu database bersama)
                               │
             LLM (Ollama / API) ◄── dipakai oleh NLQ dan penjelasan rekomendasi
```

## Struktur repositori

```
capstone-stockopname-bvent/
├── frontend/       Aplikasi mobile (Verdian)
├── backend/        API inti, database, dan Text-to-SQL (Ananda)
├── forecasting/    Layanan prediksi tren dan rekomendasi restock (Rahmat)
├── docs/           Dokumentasi
└── README.md
```

## Tim

| Nama | NPM | Peran | Folder | Branch |
|---|---|---|---|---|
| Verdian Ramadhan | 233510315 | Frontend / UI-UX, integrasi API | `frontend/` | `feature/frontend-verdian` |
| Ananda Latief | 233510625 | Backend, database, Text-to-SQL | `backend/` | `feature/backend-ananda` |
| Rahmat Firman Syaputra | 233510773 | Prediksi tren dan rekomendasi restock | `forecasting/` | `feature/forecasting-rahmat` |

## Teknologi

| Bagian | Teknologi |
|---|---|
| Aplikasi mobile | React Native (Expo, expo-router), TypeScript, react-native-svg |
| Backend | Python, FastAPI, SQLAlchemy, sqlglot (validasi SQL), LangChain, ChromaDB |
| Prediksi | Python, pandas, AutoGluon TimeSeries |
| Database | PostgreSQL |
| LLM | Open-source via Ollama (mis. Qwen2.5) atau API LLM |
| Deployment | Docker Compose |

# Dokumentasi

- Link Design awal di Figma : https://www.figma.com/design/SdDKmsdYB6VObGEflD4Rp5/Project-Capstone?node-id=0-1&t=j4dBvPluHxCe9Oln-1