from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


# ----------------------------------------------------------- barang

class BarangIn(BaseModel):
    nama: str = Field(min_length=1)
    kode: str = Field(min_length=1)
    kategori: str = "Lainnya"
    lokasi: str = ""
    satuan: str = "pcs"
    stok: float = Field(default=0, ge=0)
    stokMin: float = Field(default=0, ge=0)
    harga: float = Field(default=0, ge=0)
    emoji: str = "📦"
    pemasok: str = ""
    kedaluwarsa: date | None = None
    jumlahPesanUlang: float | None = Field(default=None, ge=0)


class BarangOut(BaseModel):
    id: str
    nama: str
    kode: str
    kategori: str
    lokasi: str
    satuan: str
    stok: float
    stokMin: float
    harga: float
    emoji: str
    gambar: str | None = None
    pemasok: str = ""
    kedaluwarsa: date | None = None
    jumlahPesanUlang: float | None = None


# ----------------------------------------------------------- auth

class LoginIn(BaseModel):
    email: str
    password: str
    kodePerusahaan: str = ""


class UserOut(BaseModel):
    id: str
    nama: str
    email: str
    telepon: str
    peran: str
    perusahaan: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class ProfilIn(BaseModel):
    nama: str
    email: str
    telepon: str = ""
    passwordBaru: str | None = None


# ----------------------------------------------------------- transaksi

class TransaksiIn(BaseModel):
    barangId: int
    jenis: Literal["masuk", "keluar"]
    jumlah: float = Field(gt=0)
    catatan: str = ""


class TransaksiOut(BaseModel):
    id: str
    barangId: str
    nama: str
    emoji: str
    gambar: str | None = None
    satuan: str
    jenis: str
    jumlah: float
    stokSebelum: float | None = None  # kosong untuk riwayat hasil impor
    stokSesudah: float | None = None
    catatan: str
    waktu: int  # milidetik sejak 1970, sama seperti Date.now() di aplikasi
    oleh: str = ""


# ----------------------------------------------------------- opname

class DraftIn(BaseModel):
    fisik: float | None = Field(default=None, ge=0)


class TerapkanIn(BaseModel):
    catatan: str = ""


class DraftOut(BaseModel):
    nilai: dict[str, float]


class BarisOpname(BaseModel):
    barangId: str
    nama: str
    emoji: str
    satuan: str
    sistem: float
    fisik: float
    selisih: float


class SesiOut(BaseModel):
    id: str
    waktu: int
    catatan: str
    baris: list[BarisOpname]


# ----------------------------------------------------------- tren

class StatusOut(BaseModel):
    label: str
    variant: str
    urut: int


class TitikPrediksi(BaseModel):
    mid: float
    low: float
    high: float


class AnalisisOut(BaseModel):
    barang: BarangOut
    hari: int
    rata: float
    trenPersen: int
    hariHabis: float | None
    hariMin: float | None
    stokAkhir: float
    status: StatusOut
    riwayat: list[float] | None = None
    prediksi: list[TitikPrediksi] | None = None
    penjelasan: str | None = None


class RingkasanOut(BaseModel):
    akanHabis: int
    menipis: int
    total: int
    daftar: list[AnalisisOut]


class SaranOut(BaseModel):
    barang: BarangOut
    jumlah: float
    batas: str
    label: str
    variant: str
    alasan: str
    rata: float