"""Pembagian akses berdasarkan peran. Backend adalah penentu akhir, bukan tampilan aplikasi."""
from fastapi import Depends, HTTPException

from .deps import Pengguna, pengguna_aktif

LEADER = "leader"
ADMIN = "admin"
STAFF = "staff"


def butuh_peran(*diizinkan: str):
    """Membuat dependency yang menolak (403) pengguna di luar peran yang diizinkan."""

    def cek(u: Pengguna = Depends(pengguna_aktif)) -> Pengguna:
        if u.peran not in diizinkan:
            raise HTTPException(403, "Anda tidak memiliki akses untuk tindakan ini.")
        return u

    return cek


# Leader dan Admin mengelola data; hanya Leader untuk tindakan paling berisiko
PENGELOLA = butuh_peran(LEADER, ADMIN)
HANYA_LEADER = butuh_peran(LEADER)