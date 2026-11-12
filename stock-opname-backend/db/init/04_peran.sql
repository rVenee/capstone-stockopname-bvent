-- ============================================================
--  Peran pengguna (leader, admin, staff) dan akun uji
--  Aman dijalankan berulang kali.
-- ============================================================

-- Perluas daftar peran yang diizinkan: leader (pemilik/manajer), admin, staff
DO $$
DECLARE kendala TEXT;
BEGIN
  FOR kendala IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.pengguna'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%peran%'
  LOOP
    EXECUTE format('ALTER TABLE public.pengguna DROP CONSTRAINT %I', kendala);
  END LOOP;
END $$;

ALTER TABLE pengguna
  ADD CONSTRAINT pengguna_peran_check CHECK (peran IN ('leader', 'admin', 'staff'));

-- Perusahaan kedua yang masih kosong (untuk uji impor data dan uji pemisahan data)
INSERT INTO perusahaan (kode, nama) VALUES ('TKM001', 'Toko Maju Jaya')
ON CONFLICT (kode) DO NOTHING;

-- Akun uji. Password diisi otomatis oleh backend saat pertama kali dijalankan
-- (daftar password ada di app/main.py).
INSERT INTO pengguna (perusahaan_id, nama, email, password_hash, telepon, peran)
SELECT p.id, v.nama, v.email, 'BELUM_DIISI', v.telepon, v.peran
FROM (VALUES
  ('JYA112', 'Budi Santoso',  'leader@jayaabadi.com', '+6281200000001', 'leader'),
  ('JYA112', 'Siti Aminah',   'staff@jayaabadi.com',  '+6281200000002', 'staff'),
  ('JYA112', 'Dimas Pratama', 'staff2@jayaabadi.com', '+6281200000003', 'staff'),
  ('TKM001', 'Ratna Wijaya',  'owner@tokomaju.com',   '+6281300000001', 'leader'),
  ('TKM001', 'Agus Salim',    'admin@tokomaju.com',   '+6281300000002', 'admin')
) AS v(kode, nama, email, telepon, peran)
JOIN perusahaan p ON p.kode = v.kode
ON CONFLICT (email) DO NOTHING;