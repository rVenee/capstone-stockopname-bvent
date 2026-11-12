"""Foto barang: disimpan sebagai file di folder uploads/foto, nama berkas di kolom barang.gambar."""
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import Pengguna, pengguna_aktif
from ..helpers import ambil_barang
from ..izin import PENGELOLA
from ..schemas import BarangOut

router = APIRouter(tags=["foto"])

FORMAT = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
POLA_NAMA = re.compile(r"[0-9a-f]{32}\.(jpg|png|webp)")


def _folder() -> Path:
    return Path(settings.upload_dir) / "foto"


def _ekstensi(data: bytes) -> str | None:
    """Mengenali jenis gambar dari isi berkas (bukan dari nama atau klaim pengirim)."""
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def _hapus_berkas(nama: str | None):
    if nama and POLA_NAMA.fullmatch(nama):
        try:
            (_folder() / nama).unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/barang/{barang_id}/foto", response_model=BarangOut)
def unggah_foto(
    barang_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    u: Pengguna = Depends(PENGELOLA),
):
    batas = settings.maks_foto_mb * 1024 * 1024
    data = file.file.read(batas + 1)
    if len(data) > batas:
        raise HTTPException(413, f"Ukuran foto maksimal {settings.maks_foto_mb} MB.")
    ext = _ekstensi(data)
    if ext is None:
        raise HTTPException(415, "File bukan gambar yang didukung (JPEG, PNG, atau WebP).")

    lama = db.execute(
        text("SELECT gambar FROM barang WHERE id = :id AND perusahaan_id = :p AND aktif FOR UPDATE"),
        {"id": barang_id, "p": u.perusahaan_id},
    ).first()
    if not lama:
        raise HTTPException(404, "Barang tidak ditemukan")

    nama = f"{uuid.uuid4().hex}{ext}"
    _folder().mkdir(parents=True, exist_ok=True)
    (_folder() / nama).write_bytes(data)

    db.execute(
        text("UPDATE barang SET gambar = :g, diubah_pada = now() WHERE id = :id"),
        {"g": nama, "id": barang_id},
    )
    db.commit()
    _hapus_berkas(lama[0])
    return ambil_barang(db, u.perusahaan_id, barang_id)


@router.delete("/barang/{barang_id}/foto", response_model=BarangOut)
def hapus_foto(barang_id: int, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    lama = db.execute(
        text("SELECT gambar FROM barang WHERE id = :id AND perusahaan_id = :p AND aktif FOR UPDATE"),
        {"id": barang_id, "p": u.perusahaan_id},
    ).first()
    if not lama:
        raise HTTPException(404, "Barang tidak ditemukan")
    db.execute(
        text("UPDATE barang SET gambar = NULL, diubah_pada = now() WHERE id = :id"),
        {"id": barang_id},
    )
    db.commit()
    _hapus_berkas(lama[0])
    return ambil_barang(db, u.perusahaan_id, barang_id)


@router.get("/foto/{nama}")
def lihat_foto(nama: str, db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    """Foto hanya bisa dilihat oleh pengguna yang login dan hanya milik perusahaannya sendiri."""
    if not POLA_NAMA.fullmatch(nama):
        raise HTTPException(404, "Foto tidak ditemukan")
    ada = db.execute(
        text("SELECT 1 FROM barang WHERE gambar = :g AND perusahaan_id = :p"),
        {"g": nama, "p": u.perusahaan_id},
    ).first()
    path = _folder() / nama
    if not ada or not path.is_file():
        raise HTTPException(404, "Foto tidak ditemukan")
    return FileResponse(
        path,
        media_type=FORMAT["." + nama.rsplit(".", 1)[1]],
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )