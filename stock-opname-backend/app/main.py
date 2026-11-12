from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import SessionLocal, get_db
from .routers import auth, barang, ekspor, foto, impor, opname, pengguna, transaksi, tren, reset, foto_profil
from .security import hash_password

# Password akun uji dari data awal (hanya untuk pengembangan!)
PASSWORD_DEMO = {
    "rahmat@jayaabadi.com": "admin123",
    "leader@jayaabadi.com": "leader123",
    "staff@jayaabadi.com": "staff123",
    "staff2@jayaabadi.com": "staff123",
    "owner@tokomaju.com": "maju123",
    "admin@tokomaju.com": "maju123",
}
PASSWORD_BAWAAN = "admin123"


def siapkan_password_demo():
    """Akun dari data awal belum punya password. Isi dengan password demo."""
    with SessionLocal() as db:
        ids = db.execute(
            text("SELECT id, email FROM pengguna WHERE password_hash = 'BELUM_DIISI'")
        ).all()
        for uid, email in ids:
            sandi = PASSWORD_DEMO.get(email.lower(), PASSWORD_BAWAAN)
            db.execute(
                text("UPDATE pengguna SET password_hash = :h WHERE id = :id"),
                {"h": hash_password(sandi), "id": uid},
            )
            print(f"[demo] Password akun {email} diatur ke '{sandi}'")
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    siapkan_password_demo()
    yield


app = FastAPI(title="Stock Opname API", lifespan=lifespan)

# Mengizinkan akses dari mana saja (cukup untuk tahap pengembangan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

app.include_router(auth.router)
app.include_router(barang.router)
app.include_router(foto.router)
app.include_router(transaksi.router)
app.include_router(opname.router)
app.include_router(tren.router)
app.include_router(pengguna.router)
app.include_router(impor.router)
app.include_router(ekspor.router)
app.include_router(reset.router)
app.include_router(foto_profil.router)

@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "terhubung"}