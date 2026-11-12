from datetime import datetime
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from .schemas import BarangOut

SELECT_BARANG = """
SELECT b.id, b.kode, b.nama,
       COALESCE(k.nama, 'Lainnya') AS kategori,
       COALESCE(b.lokasi, '') AS lokasi,
       b.satuan, b.stok, b.stok_minimum, b.harga,
       COALESCE(b.emoji, '📦') AS emoji,
       b.gambar, COALESCE(b.pemasok, '') AS pemasok,
       b.kedaluwarsa, b.jumlah_pesan_ulang
FROM barang b
LEFT JOIN kategori k ON k.id = b.kategori_id
"""


def D(x) -> Decimal:
    return Decimal(str(x))


def angka(x) -> str:
    """15.00 -> '15', 2.50 -> '2.5' (untuk pesan ke pengguna)."""
    s = f"{Decimal(str(x)):f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


def ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def ke_barang(r) -> BarangOut:
    return BarangOut(
        id=str(r["id"]),
        nama=r["nama"],
        kode=r["kode"],
        kategori=r["kategori"],
        lokasi=r["lokasi"],
        satuan=r["satuan"],
        stok=float(r["stok"]),
        stokMin=float(r["stok_minimum"]),
        harga=float(r["harga"]),
        emoji=r["emoji"],
        gambar=r["gambar"],
        pemasok=r["pemasok"],
        kedaluwarsa=r["kedaluwarsa"],
        jumlahPesanUlang=float(r["jumlah_pesan_ulang"]) if r["jumlah_pesan_ulang"] is not None else None,
    )


def ambil_barang(db: Session, pid: int, barang_id: int) -> BarangOut | None:
    r = db.execute(
        text(SELECT_BARANG + " WHERE b.id = :id AND b.perusahaan_id = :p AND b.aktif"),
        {"id": barang_id, "p": pid},
    ).mappings().first()
    return ke_barang(r) if r else None


def semua_barang(db: Session, pid: int) -> list[BarangOut]:
    rows = db.execute(
        text(SELECT_BARANG + " WHERE b.perusahaan_id = :p AND b.aktif ORDER BY b.id"),
        {"p": pid},
    ).mappings().all()
    return [ke_barang(r) for r in rows]


def id_kategori(db: Session, pid: int, nama: str) -> int:
    nama = nama.strip() or "Lainnya"
    kid = db.execute(
        text("SELECT id FROM kategori WHERE perusahaan_id = :p AND nama = :n"),
        {"p": pid, "n": nama},
    ).scalar()
    if kid is None:
        kid = db.execute(
            text("INSERT INTO kategori (perusahaan_id, nama) VALUES (:p, :n) RETURNING id"),
            {"p": pid, "n": nama},
        ).scalar()
    return kid


def catat_perubahan_stok(
    db: Session, pid: int, uid: int, barang_id: int, sebelum: Decimal, sesudah: Decimal, catatan: str
):
    """Setiap perubahan stok harus ada jejaknya di tabel transaksi."""
    selisih = sesudah - sebelum
    if selisih == 0:
        return
    db.execute(
        text(
            """
            INSERT INTO transaksi
              (perusahaan_id, barang_id, pengguna_id, jenis, jumlah, perubahan,
               stok_sebelum, stok_sesudah, catatan)
            VALUES (:p, :b, :u, :j, :jml, :per, :sb, :sa, :c)
            """
        ),
        {
            "p": pid,
            "b": barang_id,
            "u": uid,
            "j": "masuk" if selisih > 0 else "keluar",
            "jml": abs(selisih),
            "per": selisih,
            "sb": sebelum,
            "sa": sesudah,
            "c": catatan,
        },
    )