"""Membuat toko (perusahaan) baru beserta akun Leader-nya.

Cara pakai (di terminal backend, folder stock-opname-backend, .venv aktif, Docker menyala):
    python buat_toko.py
"""
import getpass
import re
import sys

from sqlalchemy import text

from app.database import SessionLocal
from app.security import hash_password


def tanya(label: str, wajib: bool = True, rahasia: bool = False) -> str:
    while True:
        if rahasia and sys.stdin.isatty():
            nilai = getpass.getpass(f"{label}: ").strip()
        else:
            nilai = input(f"{label}: ").strip()
        if nilai or not wajib:
            return nilai
        print("  Wajib diisi.")


print("=== Buat toko baru + akun Leader ===")
kode = tanya("Kode toko/Gudang (3-12 huruf/angka, mis. TKB002)").upper()
if not re.fullmatch(r"[A-Z0-9]{3,12}", kode):
    sys.exit("Kode toko hanya boleh huruf dan angka, 3 sampai 12 karakter.")
nama_toko = tanya("Nama toko")
nama = tanya("Nama Leader (pemilik)")
email = tanya("Email Leader").lower()
if "@" not in email:
    sys.exit("Email tidak valid.")
telepon = tanya("No. telepon (boleh kosong)", wajib=False)
sandi = tanya("Password Leader (minimal 6 karakter)", rahasia=True)
if len(sandi) < 6:
    sys.exit("Password minimal 6 karakter.")

with SessionLocal() as db:
    if db.execute(text("SELECT 1 FROM perusahaan WHERE upper(kode) = :k"), {"k": kode}).first():
        sys.exit(f"Kode toko {kode} sudah dipakai.")
    if db.execute(text("SELECT 1 FROM pengguna WHERE lower(email) = :e"), {"e": email}).first():
        sys.exit(f"Email {email} sudah terdaftar.")
    pid = db.execute(
        text("INSERT INTO perusahaan (kode, nama) VALUES (:k, :n) RETURNING id"), {"k": kode, "n": nama_toko}
    ).scalar()
    db.execute(
        text(
            """
            INSERT INTO pengguna (perusahaan_id, nama, email, password_hash, telepon, peran)
            VALUES (:p, :n, :e, :h, :t, 'leader')
            """
        ),
        {"p": pid, "n": nama, "e": email, "h": hash_password(sandi), "t": telepon},
    )
    db.commit()

print("\nBerhasil. Login di aplikasi dengan:")
print(f"  Email           : {email}")
print(f"  Password        : (yang barusan kamu ketik)")
print(f"  Kode perusahaan : {kode}")