from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Pengguna, muat_pengguna, pengguna_aktif
from ..schemas import LoginIn, LoginOut, ProfilIn, UserOut
from ..security import buat_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _ke_user(p: Pengguna) -> UserOut:
    return UserOut(
        id=str(p.id), nama=p.nama, email=p.email,
        telepon=p.telepon, peran=p.peran, perusahaan=p.perusahaan,
    )


def _cek_login(db: Session, email: str, password: str, kode: str) -> int:
    r = db.execute(
        text(
            """
            SELECT u.id, u.password_hash, p.kode
            FROM pengguna u
            JOIN perusahaan p ON p.id = u.perusahaan_id
            WHERE lower(u.email) = lower(:e) AND u.aktif
            """
        ),
        {"e": email.strip()},
    ).mappings().first()
    if not r or not verify_password(password, r["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    if not kode.strip():
        raise HTTPException(401, "Kode perusahaan wajib diisi")
    if kode.strip().upper() != r["kode"].upper():
        raise HTTPException(401, "Kode perusahaan tidak sesuai")
    return r["id"]


@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Dipakai aplikasi: menerima JSON, mengembalikan token dan data pengguna."""
    uid = _cek_login(db, data.email, data.password, data.kodePerusahaan)
    return LoginOut(token=buat_token(uid), user=_ke_user(muat_pengguna(db, uid)))


@router.post("/token")
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Khusus tombol Authorize di halaman /docs.
    username = email, password = password, client_id = kode perusahaan."""
    uid = _cek_login(db, form.username, form.password, form.client_id or "")
    return {"access_token": buat_token(uid), "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def saya(u: Pengguna = Depends(pengguna_aktif)):
    return _ke_user(u)


@router.put("/me", response_model=UserOut)
def ubah_profil(data: ProfilIn, db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    if not data.nama.strip():
        raise HTTPException(422, "Nama tidak boleh kosong")
    if "@" not in data.email:
        raise HTTPException(422, "Email tidak valid")
    if data.passwordBaru and len(data.passwordBaru) < 6:
        raise HTTPException(422, "Password baru minimal 6 karakter")

    dobel = db.execute(
        text("SELECT 1 FROM pengguna WHERE lower(email) = lower(:e) AND id <> :id"),
        {"e": data.email.strip(), "id": u.id},
    ).first()
    if dobel:
        raise HTTPException(409, "Email sudah dipakai")

    db.execute(
        text(
            """
            UPDATE pengguna
            SET nama = :nama, email = :email, telepon = :telp,
                password_hash = COALESCE(:ph, password_hash)
            WHERE id = :id
            """
        ),
        {
            "id": u.id,
            "nama": data.nama.strip(),
            "email": data.email.strip(),
            "telp": data.telepon.strip(),
            "ph": hash_password(data.passwordBaru) if data.passwordBaru else None,
        },
    )
    db.commit()
    return _ke_user(muat_pengguna(db, u.id))