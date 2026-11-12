-- ============================================================
--  Jejak perubahan transaksi: siapa mengubah atau menghapus, kapan, dan isi lamanya.
--  Aman dijalankan berulang kali.
-- ============================================================

CREATE TABLE IF NOT EXISTS transaksi_log (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perusahaan_id  BIGINT NOT NULL REFERENCES perusahaan(id),
  transaksi_id   BIGINT NOT NULL,
  barang_id      BIGINT,
  aksi           TEXT NOT NULL CHECK (aksi IN ('ubah', 'hapus')),
  pengguna_id    BIGINT REFERENCES pengguna(id),
  waktu          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sebelum        JSONB NOT NULL,
  sesudah        JSONB
);

CREATE INDEX IF NOT EXISTS idx_transaksi_log_transaksi ON transaksi_log (transaksi_id);