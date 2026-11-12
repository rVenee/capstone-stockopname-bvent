-- ============================================================
--  Impor data: catatan paket impor, dan penanda sumber transaksi
--  Aman dijalankan berulang kali.
-- ============================================================

CREATE TABLE IF NOT EXISTS impor_batch (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perusahaan_id    BIGINT NOT NULL REFERENCES perusahaan(id),
  pengguna_id      BIGINT REFERENCES pengguna(id),
  jenis            TEXT NOT NULL CHECK (jenis IN ('barang', 'riwayat', 'simulasi')),
  nama_file        TEXT NOT NULL,
  jumlah_baris     INTEGER NOT NULL DEFAULT 0,
  ringkasan        TEXT,
  dibuat_pada      TIMESTAMPTZ NOT NULL DEFAULT now(),
  dibatalkan_pada  TIMESTAMPTZ
);

-- 'app'   = pergerakan stok yang dicatat lewat aplikasi (membentuk rantai stok)
-- 'impor' = riwayat penjualan hasil impor: bahan tren dan analisis, tidak mengubah stok
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS sumber TEXT NOT NULL DEFAULT 'app'
  CHECK (sumber IN ('app', 'impor'));
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS impor_batch_id BIGINT REFERENCES impor_batch(id);

-- Riwayat impor tidak punya rantai stok sebelum/sesudah
ALTER TABLE transaksi ALTER COLUMN stok_sebelum DROP NOT NULL;
ALTER TABLE transaksi ALTER COLUMN stok_sesudah DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaksi_batch ON transaksi (impor_batch_id)
  WHERE impor_batch_id IS NOT NULL;