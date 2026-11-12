-- ============================================================
--  Data awal (demo)
-- ============================================================

INSERT INTO perusahaan (kode, nama) VALUES ('JYA112', 'PT Jaya Abadi');

-- password_hash diisi nanti oleh backend saat fitur login dibuat
INSERT INTO pengguna (perusahaan_id, nama, email, password_hash, telepon, peran)
SELECT id, 'Rahmat Firman Syaputra', 'rahmat@jayaabadi.com', 'BELUM_DIISI', '+6281234567890', 'admin'
FROM perusahaan WHERE kode = 'JYA112';

INSERT INTO kategori (perusahaan_id, nama)
SELECT p.id, k.nama
FROM perusahaan p
CROSS JOIN (VALUES ('Makanan'), ('Minuman'), ('Peralatan'), ('Lainnya')) AS k(nama)
WHERE p.kode = 'JYA112';

INSERT INTO barang (perusahaan_id, kode, nama, kategori_id, lokasi, satuan, stok, stok_minimum, harga, emoji)
SELECT p.id, v.kode, v.nama, k.id, v.lokasi, v.satuan, v.stok, v.stok_min, v.harga, v.emoji
FROM perusahaan p
CROSS JOIN (VALUES
  (1, '123456789012', 'Beras',         'Makanan', 'Rak A-1', 'kg',    15, 20, 14000, '🍚'),
  (2, '987654321098', 'Susu 1000ml',   'Minuman', 'Rak A-2', 'pcs',   25, 20, 25000, '🥛'),
  (3, '123450987610', 'Telur',         'Makanan', 'Rak B-1', 'tray',  25, 10, 52000, '🥚'),
  (4, '123098457610', 'Minyak Goreng', 'Makanan', 'Rak B-2', 'liter', 15, 10, 18000, '🛢️'),
  (5, '899100100201', 'Mi Instan',     'Makanan', 'Rak C-1', 'pcs',    6, 10,  3500, '🍜'),
  (6, '899100100302', 'Gula',          'Makanan', 'Rak C-2', 'kg',     8, 15, 17000, '🍬'),
  (7, '899100100403', 'Teh Celup',     'Minuman', 'Rak A-3', 'pack',  30, 12,  9000, '🍵'),
  (8, '899100100504', 'Kopi Bubuk',    'Minuman', 'Rak A-3', 'pack',  14, 12, 22000, '☕')
) AS v(urut, kode, nama, kategori, lokasi, satuan, stok, stok_min, harga, emoji)
JOIN kategori k ON k.perusahaan_id = p.id AND k.nama = v.kategori
WHERE p.kode = 'JYA112'
ORDER BY v.urut;

-- Riwayat transaksi 30 hari terakhir.
-- Dibuat mundur dari stok sekarang, sehingga stok_sebelum/stok_sesudah selalu nyambung.
DO $$
DECLARE
  b        RECORD;
  k        INT;
  i        INT;
  base     DOUBLE PRECISION;
  g        DOUBLE PRECISION;
  x        DOUBLE PRECISION;
  noise    DOUBLE PRECISION;
  r2       DOUBLE PRECISION;
  jual     NUMERIC;
  masuk    NUMERIC;
  running  NUMERIC;
  t        TIMESTAMPTZ;
  pid      BIGINT;
BEGIN
  SELECT id INTO pid FROM pengguna ORDER BY id LIMIT 1;

  FOR b IN SELECT id, perusahaan_id, kode, stok FROM barang ORDER BY id LOOP
    running := b.stok;

    base := CASE b.kode
      WHEN '123456789012' THEN 2.0
      WHEN '987654321098' THEN 2.0
      WHEN '123450987610' THEN 0.45
      WHEN '123098457610' THEN 0.4
      WHEN '899100100201' THEN 1.0
      WHEN '899100100302' THEN 1.2
      ELSE 0.5
    END;
    g := CASE b.kode
      WHEN '123456789012' THEN 0.25
      WHEN '987654321098' THEN 0.2
      WHEN '123450987610' THEN 0.15
      ELSE 0.05
    END;

    FOR k IN 0..29 LOOP
      i := 29 - k;
      t := now() - make_interval(days => k)
                 - make_interval(mins => ((b.id * 37 + k * 53) % 600)::int);

      x := sin(b.id * 37 + i) * 43758.5453;
      noise := 0.7 + 0.6 * (x - floor(x));
      x := sin(b.id * 91 + i * 3.7) * 43758.5453;
      r2 := x - floor(x);
      jual := floor(base * (1 + g * ((i::DOUBLE PRECISION / 29.0) * 2 - 1)) * noise + r2);

      IF jual > 0 THEN
        INSERT INTO transaksi
          (perusahaan_id, barang_id, pengguna_id, jenis, jumlah, perubahan,
           stok_sebelum, stok_sesudah, catatan, waktu)
        VALUES
          (b.perusahaan_id, b.id, pid, 'keluar', jual, -jual,
           running + jual, running, 'Penjualan harian', t);
        running := running + jual;
      END IF;

      -- Barang masuk dari supplier kira-kira tiap 10 hari
      masuk := ceil(base * 10);
      IF (k + b.id) % 10 = 5 AND running >= masuk THEN
        INSERT INTO transaksi
          (perusahaan_id, barang_id, pengguna_id, jenis, jumlah, perubahan,
           stok_sebelum, stok_sesudah, catatan, waktu)
        VALUES
          (b.perusahaan_id, b.id, pid, 'masuk', masuk, masuk,
           running - masuk, running, 'Kiriman supplier', t - interval '2 hours');
        running := running - masuk;
      END IF;
    END LOOP;
  END LOOP;
END $$;