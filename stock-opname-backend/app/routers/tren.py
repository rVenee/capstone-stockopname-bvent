from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..analisis import analisis, muat_deret, rekomendasi
from ..database import get_db
from ..deps import Pengguna, pengguna_aktif
from ..helpers import ambil_barang, semua_barang
from ..schemas import AnalisisOut, RingkasanOut, SaranOut

router = APIRouter(tags=["tren"])


@router.get("/tren", response_model=RingkasanOut)
def ringkasan(
    hari: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    u: Pengguna = Depends(pengguna_aktif),
):
    barang = semua_barang(db, u.perusahaan_id)
    penjualan, perubahan = muat_deret(db, u.perusahaan_id)
    daftar = [
        analisis(b, penjualan[int(b.id)], perubahan[int(b.id)], hari, detail=False) for b in barang
    ]
    return RingkasanOut(
        akanHabis=sum(1 for a in daftar if a.hariHabis is not None and a.hariHabis < 7),
        menipis=sum(1 for a in daftar if a.status.urut <= 1),
        total=len(daftar),
        daftar=daftar,
    )


@router.get("/tren/{barang_id}", response_model=AnalisisOut)
def tren_barang(
    barang_id: int,
    hari: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    u: Pengguna = Depends(pengguna_aktif),
):
    b = ambil_barang(db, u.perusahaan_id, barang_id)
    if not b:
        raise HTTPException(404, "Barang tidak ditemukan")
    penjualan, perubahan = muat_deret(db, u.perusahaan_id)
    return analisis(b, penjualan[barang_id], perubahan[barang_id], hari, detail=True)


@router.get("/rekomendasi", response_model=list[SaranOut])
def saran_restock(
    hari: int = Query(30, ge=1, le=30),
    db: Session = Depends(get_db),
    u: Pengguna = Depends(pengguna_aktif),
):
    barang = semua_barang(db, u.perusahaan_id)
    penjualan, perubahan = muat_deret(db, u.perusahaan_id)
    return rekomendasi(barang, penjualan, perubahan, hari)