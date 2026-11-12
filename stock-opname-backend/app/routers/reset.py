"""Reset data stok milik satu perusahaan. Khusus Leader, dengan konfirmasi mengetik kode perusahaan."""
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import Pengguna, pengguna_aktif

router = APIRouter(prefix="/data", tags=["data"])
POLA_FOTO = re.compile(r"[0-9a-f]{32}\.(jpg|png|webp)")


class ResetIn(BaseModel):
    konfirmasi: str


class ResetOut(BaseModel):
    barang: int
    transaksi: int
    sesiOpname: int


@router.post("/reset", response_model=ResetOut)
def reset_data(data: ResetIn, db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    """Menghapus SEMUA barang, kategori, transaksi, stock opname, dan riwayat impor perusahaan ini.
    Akun pengguna dan data perusahaan tidak ikut terhapus. Tidak bisa dibatalkan."""
    if u.peran != "leader":
        raise HTTPException(403, "Hanya Leader yang dapat mereset data.")
    pid = u.perusahaan_id
    kode = db.execute(text("SELECT kode FROM perusahaan WHERE id = :p"), {"p": pid}).scalar()
    if data.konfirmasi.strip().upper() != str(kode).upper():
        raise HTTPException(400, "Konfirmasi tidak cocok. Ketik kode perusahaan persis seperti yang tertera.")

    foto = [
        r[0]
        for r in db.execute(
            text("SELECT gambar FROM barang WHERE perusahaan_id = :p AND gambar IS NOT NULL"), {"p": pid}
        ).all()
    ]
    try:
        db.execute(text("DELETE FROM transaksi_log WHERE perusahaan_id = :p"), {"p": pid})
        n_trx = db.execute(text("DELETE FROM transaksi WHERE perusahaan_id = :p"), {"p": pid}).rowcount
        db.execute(
            text(
                "DELETE FROM opname_item WHERE opname_sesi_id IN "
                "(SELECT id FROM opname_sesi WHERE perusahaan_id = :p)"
            ),
            {"p": pid},
        )
        n_sesi = db.execute(text("DELETE FROM opname_sesi WHERE perusahaan_id = :p"), {"p": pid}).rowcount
        db.execute(text("DELETE FROM impor_batch WHERE perusahaan_id = :p"), {"p": pid})
        n_barang = db.execute(text("DELETE FROM barang WHERE perusahaan_id = :p"), {"p": pid}).rowcount
        db.execute(text("DELETE FROM kategori WHERE perusahaan_id = :p"), {"p": pid})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Reset dibatalkan: masih ada data lain yang terkait dengan barang. Tidak ada yang dihapus.")

    # Berkas foto dan berkas impor sementara milik perusahaan ini
    for nama in foto:
        if POLA_FOTO.fullmatch(nama):
            try:
                (Path(settings.upload_dir) / "foto" / nama).unlink(missing_ok=True)
            except OSError:
                pass
    impor = Path(settings.upload_dir) / "impor"
    if impor.exists():
        for f in impor.glob(f"{pid}-*"):
            try:
                f.unlink()
            except OSError:
                pass
    print(f"[reset] {u.email} mereset data perusahaan {kode}: {n_barang} barang, {n_trx} transaksi, {n_sesi} sesi opname")
    return ResetOut(barang=n_barang, transaksi=n_trx, sesiOpname=n_sesi)