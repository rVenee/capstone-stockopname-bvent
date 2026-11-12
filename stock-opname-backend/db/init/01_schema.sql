-- ============================================================
--  Skema database Stock Opname (PostgreSQL)
-- ============================================================

CREATE TABLE perusahaan (
  id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode  TEXT NOT NULL UNIQUE,
  nama  TEXT NOT NULL
);

CREATE TABLE pengguna (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perusahaan_id  BIGINT NOT NULL REFERENCES perusahaan(id),
  nama           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  telepon        TEXT,
  peran          TEXT NOT NULL DEFAULT 'staff' CHECK (peran IN ('admin', 'staff')),
  aktif          BOOLEAN NOT NULL DEFAULT TRUE,
  dibuat_pada    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kategori (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perusahaan_id  BIGINT NOT NULL REFERENCES perusahaan(id),
  nama           TEXT NOT NULL,
  UNIQUE (perusahaan_id, nama)
);

CREATE TABLE barang (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perusahaan_id  BIGINT NOT NULL REFERENCES perusahaan(id),
  kode           TEXT NOT NULL,
  nama           TEXT NOT NULL,
  kategori_id    BIGINT REFERENCES kategori(id),
  lokasi         TEXT,
  satuan         TEXT NOT NULL DEFAULT 'pcs',
  stok           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stok >= 0),
  stok_minimum   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (stok_minimum >= 0),
  harga          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (harga >= 0),
  emoji          TEXT,
  gambar         TEXT,
  aktif          BOOLEAN NOT NULL DEFAULT TRUE,
  dibuat_pada    TIMESTAMPTZ NOT NULL DEFAULT now(),
  diubah_pada    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (perusahaan_id, kode)
);

CREATE TABLE opname_sesi (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perusahaan_id    BIGINT NOT NULL REFERENCES perusahaan(id),
  pengguna_id      BIGINT REFERENCES pengguna(id),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'selesai')),
  catatan          TEXT,
  dimulai_pada     TIMESTAMPTZ NOT NULL DEFAULT now(),
  diterapkan_pada  TIMESTAMPTZ
);

CREATE TABLE opname_item (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opname_sesi_id  BIGINT NOT NULL REFERENCES opname_sesi(id) ON DELETE CASCADE,
  barang_id       BIGINT NOT NULL REFERENCES barang(id),
  stok_sistem     NUMERIC(12,2) NOT NULL,
  stok_fisik      NUMERIC(12,2) NOT NULL CHECK (stok_fisik >= 0),
  selisih         NUMERIC(12,2) GENERATED ALWAYS AS (stok_fisik - stok_sistem) STORED,
  UNIQUE (opname_sesi_id, barang_id)
);

CREATE TABLE transaksi (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perusahaan_id   BIGINT NOT NULL REFERENCES perusahaan(id),
  barang_id       BIGINT NOT NULL REFERENCES barang(id),
  pengguna_id     BIGINT REFERENCES pengguna(id),
  jenis           TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar', 'opname')),
  jumlah          NUMERIC(12,2) NOT NULL CHECK (jumlah > 0),
  perubahan       NUMERIC(12,2) NOT NULL,
  stok_sebelum    NUMERIC(12,2) NOT NULL,
  stok_sesudah    NUMERIC(12,2) NOT NULL,
  catatan         TEXT,
  opname_sesi_id  BIGINT REFERENCES opname_sesi(id),
  waktu           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (stok_sesudah = stok_sebelum + perubahan),
  CHECK (
    (jenis = 'masuk'  AND perubahan > 0) OR
    (jenis = 'keluar' AND perubahan < 0) OR
    (jenis = 'opname')
  )
);

-- Indeks: supaya pencarian dan riwayat tetap cepat saat data banyak
CREATE INDEX idx_barang_kategori          ON barang (kategori_id);
CREATE INDEX idx_transaksi_barang_waktu   ON transaksi (barang_id, waktu DESC);
CREATE INDEX idx_transaksi_perusahaan_wkt ON transaksi (perusahaan_id, waktu DESC);
CREATE INDEX idx_opname_item_sesi         ON opname_item (opname_sesi_id);

-- Penjualan per hari per barang (dasar perhitungan tren dan rekomendasi)
CREATE VIEW penjualan_harian AS
SELECT perusahaan_id,
       barang_id,
       (waktu AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
       SUM(jumlah) AS terjual
FROM transaksi
WHERE jenis = 'keluar'
GROUP BY perusahaan_id, barang_id, (waktu AT TIME ZONE 'Asia/Jakarta')::date;

-- Keterangan dalam bahasa sehari-hari (nanti dipakai AI untuk memahami skema)
COMMENT ON TABLE  barang       IS 'Daftar barang di gudang beserta stok saat ini dan stok minimum';
COMMENT ON COLUMN barang.kode  IS 'Kode barcode barang, disimpan sebagai teks';
COMMENT ON COLUMN barang.stok  IS 'Jumlah stok barang saat ini';
COMMENT ON COLUMN barang.stok_minimum IS 'Batas stok minimum; di bawah ini barang perlu direstock';
COMMENT ON COLUMN barang.lokasi IS 'Lokasi rak penyimpanan barang';
COMMENT ON COLUMN barang.aktif IS 'FALSE berarti barang sudah tidak dipakai (dihapus lunak)';
COMMENT ON TABLE  transaksi    IS 'Riwayat pergerakan stok: barang masuk, barang keluar, dan penyesuaian opname';
COMMENT ON COLUMN transaksi.jenis IS 'masuk, keluar, atau opname';
COMMENT ON COLUMN transaksi.jumlah IS 'Jumlah barang yang bergerak (selalu positif)';
COMMENT ON COLUMN transaksi.perubahan IS 'Perubahan stok: positif untuk masuk, negatif untuk keluar';
COMMENT ON TABLE  opname_sesi  IS 'Satu sesi stock opname (penghitungan stok fisik)';
COMMENT ON TABLE  opname_item  IS 'Hasil hitung fisik per barang pada satu sesi opname';
COMMENT ON COLUMN opname_item.selisih IS 'Stok fisik dikurangi stok sistem';
COMMENT ON VIEW   penjualan_harian IS 'Total barang keluar per hari untuk tiap barang';