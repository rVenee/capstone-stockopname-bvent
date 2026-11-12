"""Ekspor data ke CSV / Excel (semua peran boleh)."""
import re
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..berkas import buat_berkas
from ..database import get_db
from ..deps import Pengguna, pengguna_aktif

router = APIRouter(prefix="/ekspor", tags=["ekspor"])


class TabelIn(BaseModel):
    nama: str = Field(default="data", max_length=80)
    kepala: list[str] = Field(max_length=50)
    baris: list[list[str | float | int | None]] = Field(max_length=20000)
    format: Literal["csv", "xlsx"] = "xlsx"


@router.post("/tabel")
def ekspor_tabel(data: TabelIn, u: Pengguna = Depends(pengguna_aktif)):
    """Membuat berkas Excel/CSV dari tabel yang dikirim aplikasi (mis. hasil Rekomendasi Restock)."""
    nama = re.sub(r"[^A-Za-z0-9_-]", "-", data.nama).strip("-")[:60] or "data"
    return buat_berkas(nama, data.kepala, data.baris, data.format)


@router.get("/{jenis}")
def ekspor(
    jenis: Literal["barang", "transaksi", "opname"],
    format: Literal["csv", "xlsx"] = "csv",
    pemisah: str = Query(",", max_length=1),
    db: Session = Depends(get_db),
    u: Pengguna = Depends(pengguna_aktif),
):
    pid = u.perusahaan_id
    if jenis == "barang":
        kepala = ["Kode", "Nama", "Kategori", "Lokasi", "Satuan", "Stok", "Stok Minimum", "Harga",
                  "Pemasok", "Kedaluwarsa"]
        rows = db.execute(
            text(
                """
                SELECT b.kode, b.nama, COALESCE(k.nama, 'Lainnya'), COALESCE(b.lokasi, ''), b.satuan, b.stok,
                       b.stok_minimum, b.harga, COALESCE(b.pemasok, ''), b.kedaluwarsa
                FROM barang b LEFT JOIN kategori k ON k.id = b.kategori_id
                WHERE b.perusahaan_id = :p AND b.aktif ORDER BY b.id
                """
            ),
            {"p": pid},
        ).all()
    elif jenis == "transaksi":
        kepala = ["Waktu", "Kode", "Barang", "Jenis", "Jumlah", "Perubahan", "Stok Sebelum", "Stok Sesudah",
                  "Catatan", "Dicatat Oleh", "Sumber"]
        rows = db.execute(
            text(
                """
                SELECT t.waktu AT TIME ZONE 'Asia/Jakarta', b.kode, b.nama, t.jenis, t.jumlah, t.perubahan,
                       t.stok_sebelum, t.stok_sesudah, COALESCE(t.catatan, ''), COALESCE(u.nama, ''), t.sumber
                FROM transaksi t JOIN barang b ON b.id = t.barang_id
                LEFT JOIN pengguna u ON u.id = t.pengguna_id
                WHERE t.perusahaan_id = :p ORDER BY t.waktu DESC, t.id DESC LIMIT 200000
                """
            ),
            {"p": pid},
        ).all()
    else:
        kepala = ["Tanggal", "Kode", "Barang", "Stok Sistem", "Stok Fisik", "Selisih", "Catatan Sesi"]
        rows = db.execute(
            text(
                """
                SELECT (s.diterapkan_pada AT TIME ZONE 'Asia/Jakarta')::date, b.kode, b.nama,
                       i.stok_sistem, i.stok_fisik, i.selisih, COALESCE(s.catatan, '')
                FROM opname_sesi s
                JOIN opname_item i ON i.opname_sesi_id = s.id
                JOIN barang b ON b.id = i.barang_id
                WHERE s.perusahaan_id = :p AND s.status = 'selesai'
                ORDER BY s.diterapkan_pada DESC, b.nama
                """
            ),
            {"p": pid},
        ).all()
    return buat_berkas(jenis, kepala, [list(r) for r in rows], format, pemisah if pemisah in ",;\t|" else ",")