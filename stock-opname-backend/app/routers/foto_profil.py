"""Foto profil pengguna: disimpan di uploads/profil, nama berkasnya di kolom pengguna.foto."""
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import Pengguna, pengguna_aktif

router = APIRouter(prefix="/profil", tags=["profil"])

FORMAT = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
POLA_NAMA = re.compile(r"[0-9a-f]{32}\.(jpg|png|webp)")


class FotoOut(BaseModel):
    nama: str | None = None


def _folder() -> Path:
    return Path(settings.upload_dir) / "profil"


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


@router.get("/foto", response_model=FotoOut)
def foto_saya(db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    nama = db.execute(text("SELECT foto FROM pengguna WHERE id = :id"), {"id": u.id}).scalar()
    return FotoOut(nama=nama)


@router.post("/foto", response_model=FotoOut)
def unggah_foto_saya(
    file: UploadFile = File(...), db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)
):
    batas = settings.maks_foto_mb * 1024 * 1024
    data = file.file.read(batas + 1)
    if len(data) > batas:
        raise HTTPException(413, f"Ukuran foto maksimal {settings.maks_foto_mb} MB.")
    ext = _ekstensi(data)
    if ext is None:
        raise HTTPException(415, "File bukan gambar yang didukung (JPEG, PNG, atau WebP).")

    lama = db.execute(text("SELECT foto FROM pengguna WHERE id = :id FOR UPDATE"), {"id": u.id}).scalar()
    nama = f"{uuid.uuid4().hex}{ext}"
    _folder().mkdir(parents=True, exist_ok=True)
    (_folder() / nama).write_bytes(data)
    db.execute(text("UPDATE pengguna SET foto = :f WHERE id = :id"), {"f": nama, "id": u.id})
    db.commit()
    _hapus_berkas(lama)
    return FotoOut(nama=nama)


@router.delete("/foto", response_model=FotoOut)
def hapus_foto_saya(db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    lama = db.execute(text("SELECT foto FROM pengguna WHERE id = :id FOR UPDATE"), {"id": u.id}).scalar()
    db.execute(text("UPDATE pengguna SET foto = NULL WHERE id = :id"), {"id": u.id})
    db.commit()
    _hapus_berkas(lama)
    return FotoOut(nama=None)


@router.get("/foto/{nama}")
def lihat_foto(nama: str, db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    """Foto hanya bisa dilihat pengguna yang login, dan hanya milik rekan satu perusahaan."""
    if not POLA_NAMA.fullmatch(nama):
        raise HTTPException(404, "Foto tidak ditemukan")
    ada = db.execute(
        text("SELECT 1 FROM pengguna WHERE foto = :f AND perusahaan_id = :p"),
        {"f": nama, "p": u.perusahaan_id},
    ).first()
    path = _folder() / nama
    if not ada or not path.is_file():
        raise HTTPException(404, "Foto tidak ditemukan")
    return FileResponse(
        path,
        media_type=FORMAT["." + nama.rsplit(".", 1)[1]],
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )