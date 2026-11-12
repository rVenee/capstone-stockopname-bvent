-- ============================================================
--  Foto profil pengguna (nama berkas disimpan di kolom ini)
--  Aman dijalankan berulang kali.
-- ============================================================
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS foto TEXT;