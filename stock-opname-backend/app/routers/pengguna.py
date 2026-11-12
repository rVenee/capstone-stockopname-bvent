from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Pengguna
from ..izin import ADMIN, LEADER, PENGELOLA, STAFF
from ..security import hash_password

router = APIRouter(prefix="/pengguna", tags=["pengguna"])

Peran = Literal["leader", "admin", "staff"]


class PenggunaIn(BaseModel):
    nama: str = Field(min_length=1)
    email: str = Field(min_length=3)
    telepon: str = ""
    password: str = Field(min_length=6)
    peran: Peran = "staff"


class PenggunaUbah(BaseModel):
    nama: str = Field(min_length=1)
    email: str = Field(min_length=3)
    telepon: str = ""
    peran: Peran
    aktif: bool = True
    passwordBaru: str | None = None


class PenggunaOut(BaseModel):
    id: str
    nama: str
    email: str
    telepon: str
    peran: Peran
    aktif: bool
    bisaDiubah: bool


def boleh_kelola(pelaku: Pengguna, peran_target: str) -> bool:
    """Leader mengelola semua peran. Admin hanya mengelola Staff."""
    if pelaku.peran == LEADER:
        return True
    if pelaku.peran == ADMIN:
        return peran_target == STAFF
    return False


def _ke_out(r, pelaku: Pengguna) -> PenggunaOut:
    return PenggunaOut(
        id=str(r["id"]),
        nama=r["nama"],
        email=r["email"],
        telepon=r["telepon"],
        peran=r["peran"],
        aktif=r["aktif"],
        bisaDiubah=(r["id"] != pelaku.id) and boleh_kelola(pelaku, r["peran"]),
    )


SELECT_PENGGUNA = """
SELECT id, nama, email, COALESCE(telepon, '') AS telepon, peran, aktif
FROM pengguna
"""


def _ambil(db: Session, pid: int, uid: int):
    return db.execute(
        text(SELECT_PENGGUNA + " WHERE id = :id AND perusahaan_id = :p"),
        {"id": uid, "p": pid},
    ).mappings().first()


def _cek_email_unik(db: Session, email: str, kecuali_id: int | None = None):
    r = db.execute(
        text("SELECT 1 FROM pengguna WHERE lower(email) = lower(:e) AND id <> :id"),
        {"e": email.strip(), "id": kecuali_id or 0},
    ).first()
    if r:
        raise HTTPException(409, "Email sudah dipakai akun lain")


def _cek_email_valid(email: str):
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(422, "Email tidak valid")


@router.get("", response_model=list[PenggunaOut])
def daftar(db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    rows = db.execute(
        text(
            SELECT_PENGGUNA
            + " WHERE perusahaan_id = :p ORDER BY aktif DESC, "
            + "CASE peran WHEN 'leader' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, nama"
        ),
        {"p": u.perusahaan_id},
    ).mappings().all()
    return [_ke_out(r, u) for r in rows]


@router.post("", response_model=PenggunaOut, status_code=201)
def tambah(data: PenggunaIn, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    if not boleh_kelola(u, data.peran):
        raise HTTPException(403, "Admin hanya dapat membuat akun Staff.")
    _cek_email_valid(data.email)
    _cek_email_unik(db, data.email)

    uid = db.execute(
        text(
            """
            INSERT INTO pengguna (perusahaan_id, nama, email, password_hash, telepon, peran)
            VALUES (:p, :nama, :email, :ph, :telp, :peran)
            RETURNING id
            """
        ),
        {
            "p": u.perusahaan_id,
            "nama": data.nama.strip(),
            "email": data.email.strip(),
            "ph": hash_password(data.password),
            "telp": data.telepon.strip(),
            "peran": data.peran,
        },
    ).scalar()
    db.commit()
    return _ke_out(_ambil(db, u.perusahaan_id, uid), u)


@router.put("/{pengguna_id}", response_model=PenggunaOut)
def ubah(
    pengguna_id: int,
    data: PenggunaUbah,
    db: Session = Depends(get_db),
    u: Pengguna = Depends(PENGELOLA),
):
    target = _ambil(db, u.perusahaan_id, pengguna_id)
    if not target:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    if target["id"] == u.id:
        raise HTTPException(403, "Data akun sendiri diubah lewat menu Profil.")
    if not boleh_kelola(u, target["peran"]) or not boleh_kelola(u, data.peran):
        raise HTTPException(403, "Anda tidak berhak mengubah akun atau peran ini.")
    if data.passwordBaru and len(data.passwordBaru) < 6:
        raise HTTPException(422, "Password baru minimal 6 karakter")
    _cek_email_valid(data.email)
    _cek_email_unik(db, data.email, pengguna_id)

    db.execute(
        text(
            """
            UPDATE pengguna
            SET nama = :nama, email = :email, telepon = :telp, peran = :peran, aktif = :aktif,
                password_hash = COALESCE(:ph, password_hash)
            WHERE id = :id
            """
        ),
        {
            "id": pengguna_id,
            "nama": data.nama.strip(),
            "email": data.email.strip(),
            "telp": data.telepon.strip(),
            "peran": data.peran,
            "aktif": data.aktif,
            "ph": hash_password(data.passwordBaru) if data.passwordBaru else None,
        },
    )
    db.commit()
    return _ke_out(_ambil(db, u.perusahaan_id, pengguna_id), u)


@router.delete("/{pengguna_id}", status_code=204)
def nonaktifkan(pengguna_id: int, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    """Akun tidak dihapus permanen (riwayat transaksi masih mencatat namanya), hanya dinonaktifkan."""
    target = _ambil(db, u.perusahaan_id, pengguna_id)
    if not target:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    if target["id"] == u.id:
        raise HTTPException(403, "Akun sendiri tidak dapat dinonaktifkan.")
    if not boleh_kelola(u, target["peran"]):
        raise HTTPException(403, "Anda tidak berhak menonaktifkan akun ini.")
    db.execute(text("UPDATE pengguna SET aktif = FALSE WHERE id = :id"), {"id": pengguna_id})
    db.commit()
    return Response(status_code=204)