import re
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Pengguna, pengguna_aktif
from ..helpers import (
    D, SELECT_BARANG, ambil_barang, catat_perubahan_stok, id_kategori, ke_barang,
)
from ..izin import PENGELOLA
from ..schemas import BarangIn, BarangOut

router = APIRouter(tags=["barang"])

# Satuan yang umum dipakai; ditawarkan di samping satuan yang sudah dipakai perusahaan
SATUAN_UMUM = [
    "pcs", "kg", "gram", "liter", "ml", "pack", "box", "botol",
    "bungkus", "tray", "lusin", "karton", "sak", "meter",
]


@router.get("/kategori", response_model=list[str])
def daftar_kategori(db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    rows = db.execute(
        text("SELECT nama FROM kategori WHERE perusahaan_id = :p ORDER BY nama"),
        {"p": u.perusahaan_id},
    ).scalars().all()
    return list(rows)


@router.get("/satuan", response_model=list[str])
def daftar_satuan(db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    dipakai = db.execute(
        text("SELECT DISTINCT satuan FROM barang WHERE perusahaan_id = :p AND aktif ORDER BY satuan"),
        {"p": u.perusahaan_id},
    ).scalars().all()
    return list(dict.fromkeys([*dipakai, *SATUAN_UMUM]))


@router.get("/barang", response_model=list[BarangOut])
def daftar_barang(
    q: str = "",
    kategori: str = "",
    db: Session = Depends(get_db),
    u: Pengguna = Depends(pengguna_aktif),
):
    sql = SELECT_BARANG + " WHERE b.perusahaan_id = :p AND b.aktif"
    params: dict = {"p": u.perusahaan_id}
    if q.strip():
        sql += " AND b.nama ILIKE :q"
        params["q"] = f"%{q.strip()}%"
    if kategori and kategori != "All":
        sql += " AND k.nama = :kat"
        params["kat"] = kategori
    sql += " ORDER BY b.id"
    rows = db.execute(text(sql), params).mappings().all()
    return [ke_barang(r) for r in rows]


@router.get("/barang/kode/{kode}", response_model=BarangOut)
def barang_by_kode(kode: str, db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    """Dipakai fitur scan. Nol di depan diabaikan (UPC-A 12 digit sama dengan EAN-13)."""
    n = re.sub(r"\D", "", kode).lstrip("0")
    if not n:
        raise HTTPException(404, "Barang tidak ditemukan")
    r = db.execute(
        text(
            SELECT_BARANG
            + " WHERE b.perusahaan_id = :p AND b.aktif"
            + " AND ltrim(regexp_replace(b.kode, '\\D', '', 'g'), '0') = :n"
        ),
        {"p": u.perusahaan_id, "n": n},
    ).mappings().first()
    if not r:
        raise HTTPException(404, "Barang tidak ditemukan")
    return ke_barang(r)


@router.get("/barang/{barang_id}", response_model=BarangOut)
def detail_barang(barang_id: int, db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    b = ambil_barang(db, u.perusahaan_id, barang_id)
    if not b:
        raise HTTPException(404, "Barang tidak ditemukan")
    return b


# Menambah, mengubah, dan menghapus barang: hanya Leader dan Admin (PENGELOLA)

@router.post("/barang", response_model=BarangOut, status_code=201)
def tambah_barang(data: BarangIn, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    pid = u.perusahaan_id
    kode = data.kode.strip()
    ada = db.execute(
        text("SELECT 1 FROM barang WHERE perusahaan_id = :p AND kode = :k"),
        {"p": pid, "k": kode},
    ).first()
    if ada:
        raise HTTPException(409, "Kode barang sudah dipakai")

    kid = id_kategori(db, pid, data.kategori)
    barang_id = db.execute(
        text(
            """
            INSERT INTO barang
              (perusahaan_id, kode, nama, kategori_id, lokasi, satuan, stok, stok_minimum, harga, emoji,
               pemasok, kedaluwarsa, jumlah_pesan_ulang)
            VALUES (:p, :kode, :nama, :kid, :lokasi, :satuan, :stok, :min, :harga, :emoji,
                    :pemasok, :exp, :pesan)
            RETURNING id
            """
        ),
        {
            "p": pid,
            "kode": kode,
            "nama": data.nama.strip(),
            "kid": kid,
            "lokasi": data.lokasi.strip(),
            "satuan": data.satuan.strip() or "pcs",
            "stok": D(data.stok),
            "min": D(data.stokMin),
            "harga": D(data.harga),
            "emoji": data.emoji,
            "pemasok": data.pemasok.strip(),
            "exp": data.kedaluwarsa,
            "pesan": D(data.jumlahPesanUlang) if data.jumlahPesanUlang is not None else None,
        },
    ).scalar()
    catat_perubahan_stok(db, pid, u.id, barang_id, Decimal(0), D(data.stok), "Stok awal")
    db.commit()
    return ambil_barang(db, pid, barang_id)


@router.put("/barang/{barang_id}", response_model=BarangOut)
def ubah_barang(
    barang_id: int,
    data: BarangIn,
    db: Session = Depends(get_db),
    u: Pengguna = Depends(PENGELOLA),
):
    pid = u.perusahaan_id
    lama = db.execute(
        text("SELECT stok FROM barang WHERE id = :id AND perusahaan_id = :p AND aktif FOR UPDATE"),
        {"id": barang_id, "p": pid},
    ).first()
    if not lama:
        raise HTTPException(404, "Barang tidak ditemukan")

    kode = data.kode.strip()
    dobel = db.execute(
        text("SELECT 1 FROM barang WHERE perusahaan_id = :p AND kode = :k AND id <> :id"),
        {"p": pid, "k": kode, "id": barang_id},
    ).first()
    if dobel:
        raise HTTPException(409, "Kode barang sudah dipakai")

    kid = id_kategori(db, pid, data.kategori)
    db.execute(
        text(
            """
            UPDATE barang
            SET kode = :kode, nama = :nama, kategori_id = :kid, lokasi = :lokasi,
                satuan = :satuan, stok = :stok, stok_minimum = :min, harga = :harga,
                emoji = :emoji, pemasok = :pemasok, kedaluwarsa = :exp,
                jumlah_pesan_ulang = :pesan, diubah_pada = now()
            WHERE id = :id
            """
        ),
        {
            "id": barang_id,
            "kode": kode,
            "nama": data.nama.strip(),
            "kid": kid,
            "lokasi": data.lokasi.strip(),
            "satuan": data.satuan.strip() or "pcs",
            "stok": D(data.stok),
            "min": D(data.stokMin),
            "harga": D(data.harga),
            "emoji": data.emoji,
            "pemasok": data.pemasok.strip(),
            "exp": data.kedaluwarsa,
            "pesan": D(data.jumlahPesanUlang) if data.jumlahPesanUlang is not None else None,
        },
    )
    catat_perubahan_stok(
        db, pid, u.id, barang_id, lama[0], D(data.stok), "Koreksi stok dari edit barang"
    )
    db.commit()
    return ambil_barang(db, pid, barang_id)


@router.delete("/barang/{barang_id}", status_code=204)
def hapus_barang(barang_id: int, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    """Penghapusan lunak: barang dinonaktifkan agar riwayatnya tetap utuh.
    Kodenya diberi akhiran supaya kode yang sama bisa dipakai barang baru."""
    hasil = db.execute(
        text(
            """
            UPDATE barang
            SET aktif = FALSE, kode = kode || '#hapus' || CAST(id AS TEXT), diubah_pada = now()
            WHERE id = :id AND perusahaan_id = :p AND aktif
            """
        ),
        {"id": barang_id, "p": u.perusahaan_id},
    )
    if hasil.rowcount == 0:
        raise HTTPException(404, "Barang tidak ditemukan")
    db.commit()
    return Response(status_code=204)