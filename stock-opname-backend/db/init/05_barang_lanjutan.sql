-- ============================================================
--  Kolom tambahan barang (pemasok, kedaluwarsa, jumlah pesan ulang)
--  Foto memakai kolom "gambar" yang sudah ada. Aman dijalankan berulang kali.
-- ============================================================
ALTER TABLE barang ADD COLUMN IF NOT EXISTS pemasok TEXT;
ALTER TABLE barang ADD COLUMN IF NOT EXISTS kedaluwarsa DATE;
ALTER TABLE barang ADD COLUMN IF NOT EXISTS jumlah_pesan_ulang NUMERIC(12,2)
  CHECK (jumlah_pesan_ulang IS NULL OR jumlah_pesan_ulang >= 0);