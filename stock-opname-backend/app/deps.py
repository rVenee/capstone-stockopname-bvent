from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .security import baca_token

oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token")


@dataclass
class Pengguna:
    id: int
    perusahaan_id: int
    nama: str
    email: str
    telepon: str
    peran: str
    perusahaan: str


def muat_pengguna(db: Session, uid: int) -> Pengguna | None:
    r = db.execute(
        text(
            """
            SELECT u.id, u.perusahaan_id, u.nama, u.email,
                   COALESCE(u.telepon, '') AS telepon, u.peran,
                   p.nama || ' - ' || p.kode AS perusahaan
            FROM pengguna u
            JOIN perusahaan p ON p.id = u.perusahaan_id
            WHERE u.id = :id AND u.aktif
            """
        ),
        {"id": uid},
    ).mappings().first()
    return Pengguna(**r) if r else None


def pengguna_aktif(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> Pengguna:
    """Memastikan permintaan datang dari pengguna yang sudah login."""
    uid = baca_token(token)
    pengguna = muat_pengguna(db, uid) if uid is not None else None
    if pengguna is None:
        raise HTTPException(
            401, "Sesi tidak valid, silakan login lagi", headers={"WWW-Authenticate": "Bearer"}
        )
    return pengguna