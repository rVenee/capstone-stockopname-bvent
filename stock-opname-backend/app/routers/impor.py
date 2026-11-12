"""Impor data dari CSV/Excel: baca berkas, pratinjau, terapkan, batalkan, dan template."""
import random
import re
import time
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import mesin_impor as mesin
from ..berkas import buat_berkas
from ..config import settings
from ..database import get_db
from ..deps import Pengguna, pengguna_aktif
from ..helpers import catat_perubahan_stok, id_kategori, ms
from ..izin import PENGELOLA

router = APIRouter(prefix="/impor", tags=["impor"])
WIB = ZoneInfo("Asia/Jakarta")
POLA_BERKAS = re.compile(r"^(\d+)-[0-9a-f]{32}\.(csv|txt|tsv|xlsx)$")


# ----------------------------------------------------------- model

class OpsiImpor(BaseModel):
    kurs: float = Field(default=1, gt=0)
    lewatiNonaktif: bool = True
    urutanTanggal: Literal["auto", "hari-bulan", "bulan-hari"] = "auto"
    jenisBawaan: Literal["masuk", "keluar"] = "keluar"
    simulasi: bool = False
    hariSimulasi: int = Field(default=30, ge=7, le=90)


class ImporIn(BaseModel):
    berkasId: str
    namaFile: str = "berkas"
    jenis: Literal["barang", "riwayat"]
    pemetaan: dict[str, str | None]
    opsi: OpsiImpor = OpsiImpor()


class BidangOut(BaseModel):
    key: str
    label: str
    wajib: bool


class BacaOut(BaseModel):
    berkasId: str
    nama: str
    jumlahBaris: int
    kolom: list[str]
    contoh: list[list[str]]
    jenisSaran: Literal["barang", "riwayat"]
    saran: dict[str, dict[str, str | None]]
    bidang: dict[str, list[BidangOut]]


class ErrorBaris(BaseModel):
    baris: int
    pesan: str


class HasilOut(BaseModel):
    jenis: str
    totalBaris: int
    valid: int
    baru: int
    diperbarui: int
    dilewati: int
    jumlahError: int
    error: list[ErrorBaris]
    peringatan: list[str]
    contoh: list[dict[str, Any]]
    simulasi: int = 0
    batchId: str | None = None


class BatchOut(BaseModel):
    id: str
    jenis: str
    namaFile: str
    jumlahBaris: int
    ringkasan: str
    dibuat: int
    dibatalkan: bool
    bisaDibatalkan: bool


# ----------------------------------------------------------- berkas sementara

def _folder() -> Path:
    return Path(settings.upload_dir) / "impor"


def _bersihkan():
    batas = time.time() - 24 * 3600
    if _folder().exists():
        for f in _folder().iterdir():
            try:
                if f.stat().st_mtime < batas:
                    f.unlink()
            except OSError:
                pass


def _path_berkas(berkas_id: str, pid: int) -> Path:
    m = POLA_BERKAS.fullmatch(berkas_id)
    if not m or int(m.group(1)) != pid or not (_folder() / berkas_id).is_file():
        raise HTTPException(404, "Berkas impor tidak ditemukan atau sudah kedaluwarsa. Pilih file lagi.")
    return _folder() / berkas_id


# ----------------------------------------------------------- baca berkas

@router.post("/baca", response_model=BacaOut)
def baca(file: UploadFile = File(...), u: Pengguna = Depends(PENGELOLA)):
    batas = settings.maks_impor_mb * 1024 * 1024
    data = file.file.read(batas + 1)
    if len(data) > batas:
        raise HTTPException(413, f"Ukuran file maksimal {settings.maks_impor_mb} MB.")
    nama = file.filename or "data"
    if data[:2] == b"PK":
        ext = ".xlsx"
    else:
        ext = Path(nama).suffix.lower()
        if ext not in (".csv", ".txt", ".tsv"):
            raise HTTPException(415, "Format file tidak didukung. Gunakan CSV atau Excel (.xlsx).")

    _bersihkan()
    _folder().mkdir(parents=True, exist_ok=True)
    berkas_id = f"{u.perusahaan_id}-{uuid.uuid4().hex}{ext}"
    path = _folder() / berkas_id
    path.write_bytes(data)
    try:
        kolom, baris = mesin.baca_berkas(path, settings.maks_baris_impor)
    except mesin.BerkasTidakValid as e:
        path.unlink(missing_ok=True)
        raise HTTPException(422, str(e))

    sb, sr = mesin.sarankan(kolom, "barang"), mesin.sarankan(kolom, "riwayat")
    # berkas riwayat: ada kolom tanggal + jumlah + kode/nama, tetapi tanpa kolom khas daftar barang
    riwayat = bool(sr["tanggal"] and sr["jumlah"] and (sr["kode"] or sr["nama"]) and not (sb["stokMin"] or sb["harga"]))
    return BacaOut(
        berkasId=berkas_id,
        nama=nama,
        jumlahBaris=len(baris),
        kolom=kolom,
        contoh=[[mesin.teks(c) for c in r] for r in baris[:5]],
        jenisSaran="riwayat" if riwayat else "barang",
        saran={"barang": sb, "riwayat": sr},
        bidang={j: [BidangOut(key=k, label=lb, wajib=w) for k, lb, w in b] for j, b in mesin.BIDANG.items()},
    )


# ----------------------------------------------------------- pratinjau & terapkan

def _cek_pemetaan(jenis: str, kolom: list[str], pemetaan: dict):
    for c in pemetaan.values():
        if c and c not in kolom:
            raise HTTPException(422, f"Kolom '{c}' tidak ada di file.")
    ada = {f for f, c in pemetaan.items() if c}
    butuh = [("kode", "Kode barang"), ("nama", "Nama barang")] if jenis == "barang" else [("tanggal", "Tanggal"), ("jumlah", "Jumlah")]
    for f, label in butuh:
        if f not in ada:
            raise HTTPException(422, f"Kolom untuk '{label}' wajib dipilih.")
    if jenis == "riwayat" and not ({"kode", "nama"} & ada):
        raise HTTPException(422, "Pilih kolom Kode barang atau Nama barang untuk mencocokkan barang.")


def _contoh(recs: list[dict]) -> list[dict]:
    hasil = []
    for r in recs[:5]:
        d = {}
        for k, v in r.items():
            if k.startswith("_"):
                continue
            d[k] = float(v) if isinstance(v, Decimal) else v.isoformat() if isinstance(v, date) else v
        hasil.append(d)
    return hasil


def _batch(db: Session, u: Pengguna, jenis: str, nama_file: str, baris: int, ringkasan: str) -> int:
    return db.execute(
        text(
            """
            INSERT INTO impor_batch (perusahaan_id, pengguna_id, jenis, nama_file, jumlah_baris, ringkasan)
            VALUES (:p, :u, :j, :n, :b, :r) RETURNING id
            """
        ),
        {"p": u.perusahaan_id, "u": u.id, "j": jenis, "n": nama_file[:200], "b": baris, "r": ringkasan},
    ).scalar()


def _sebar(kode: str, total: int, hari: int) -> list[int]:
    """Membagi total penjualan ke sejumlah hari secara acak-tapi-tetap (hasil sama untuk kode yang sama)."""
    rnd = random.Random(kode)
    bobot = [0.4 + rnd.random() for _ in range(hari)]
    s = sum(bobot)
    bagian = [int(total * b / s) for b in bobot]
    sisa = total - sum(bagian)
    for i in sorted(range(hari), key=lambda i: -bobot[i])[:sisa]:
        bagian[i] += 1
    return bagian


def _masukkan_transaksi(db: Session, rows: list[dict]):
    for i in range(0, len(rows), 3000):
        db.execute(
            text(
                """
                INSERT INTO transaksi
                  (perusahaan_id, barang_id, pengguna_id, jenis, jumlah, perubahan,
                   stok_sebelum, stok_sesudah, catatan, waktu, sumber, impor_batch_id)
                VALUES (:p, :b, :u, :j, :jml, :per, NULL, NULL, :c, :w, 'impor', :batch)
                """
            ),
            rows[i : i + 3000],
        )


KOLOM_DB = {
    "nama": "nama", "lokasi": "lokasi", "satuan": "satuan", "stok": "stok", "stokMin": "stok_minimum",
    "harga": "harga", "pemasok": "pemasok", "kedaluwarsa": "kedaluwarsa", "jumlahPesanUlang": "jumlah_pesan_ulang",
}


def _proses_barang(db, u, data: ImporIn, kolom, baris, terapkan: bool) -> HasilOut:
    pid, opsi = u.perusahaan_id, data.opsi
    ada = {
        r["kode"]: r
        for r in db.execute(text("SELECT id, kode, stok FROM barang WHERE perusahaan_id = :p AND aktif"), {"p": pid}).mappings()
    }
    olah = mesin.olah_barang(kolom, baris, data.pemetaan, opsi.kurs, opsi.lewatiNonaktif, opsi.urutanTanggal)
    baru = [r for r in olah.valid if r["kode"] not in ada]
    diperbarui = [r for r in olah.valid if r["kode"] in ada]
    n_sim = 0
    if opsi.simulasi and data.pemetaan.get("volume"):
        n_sim = sum(1 for r in olah.valid if r.get("volume") and r["volume"] >= 1)
    elif opsi.simulasi:
        olah.peringatan.append("Riwayat simulasi dilewati: kolom volume penjualan belum dipilih.")

    hasil = HasilOut(
        jenis="barang", totalBaris=len(baris), valid=len(olah.valid), baru=len(baru),
        diperbarui=len(diperbarui), dilewati=olah.dilewati, jumlahError=len(olah.error),
        error=[ErrorBaris(baris=b, pesan=p) for b, p in olah.error[:30]],
        peringatan=olah.peringatan, contoh=_contoh(olah.valid), simulasi=n_sim,
    )
    if not terapkan:
        return hasil
    if not olah.valid:
        raise HTTPException(422, "Tidak ada baris yang valid untuk diimpor.")

    kid_cache: dict[str, int] = {}

    def kid(nama: str) -> int:
        nama = (nama or "").strip() or "Lainnya"
        if nama not in kid_cache:
            kid_cache[nama] = id_kategori(db, pid, nama)
        return kid_cache[nama]

    ids: dict[str, int] = {}
    for rec in olah.valid:
        if rec["kode"] in ada:
            e = ada[rec["kode"]]
            ids[rec["kode"]] = e["id"]
            sets, par = ["diubah_pada = now()"], {"id": e["id"]}
            for f in rec["_set"]:
                if f == "kategori":
                    sets.append("kategori_id = :kid")
                    par["kid"] = kid(rec.get("kategori", ""))
                elif f in KOLOM_DB:
                    if f == "satuan" and not rec.get("satuan"):
                        continue
                    sets.append(f"{KOLOM_DB[f]} = :{f}")
                    par[f] = rec.get(f)
            db.execute(text(f"UPDATE barang SET {', '.join(sets)} WHERE id = :id"), par)
            if "stok" in rec["_set"] and rec["stok"] != e["stok"]:
                catat_perubahan_stok(db, pid, u.id, e["id"], e["stok"], rec["stok"], "Koreksi stok dari impor")
        else:
            ids[rec["kode"]] = db.execute(
                text(
                    """
                    INSERT INTO barang
                      (perusahaan_id, kode, nama, kategori_id, lokasi, satuan, stok, stok_minimum, harga,
                       emoji, pemasok, kedaluwarsa, jumlah_pesan_ulang)
                    VALUES (:p, :kode, :nama, :kid, :lokasi, :satuan, :stok, :min, :harga,
                            '📦', :pemasok, :exp, :pesan)
                    RETURNING id
                    """
                ),
                {
                    "p": pid, "kode": rec["kode"], "nama": rec["nama"], "kid": kid(rec.get("kategori", "")),
                    "lokasi": rec.get("lokasi", ""), "satuan": rec.get("satuan") or "pcs",
                    "stok": rec.get("stok", Decimal(0)), "min": rec.get("stokMin", Decimal(0)),
                    "harga": rec.get("harga", Decimal(0)), "pemasok": rec.get("pemasok", ""),
                    "exp": rec.get("kedaluwarsa"), "pesan": rec.get("jumlahPesanUlang"),
                },
            ).scalar()

    ringkas = f"{len(baru)} baru, {len(diperbarui)} diperbarui, {olah.dilewati} dilewati, {len(olah.error)} gagal"
    hasil.batchId = str(_batch(db, u, "barang", data.namaFile, len(olah.valid), ringkas))

    if n_sim:
        hari = opsi.hariSimulasi
        hari_ini = datetime.now(WIB).date()
        b_sim = _batch(db, u, "simulasi", data.namaFile, 0, f"Simulasi {hari} hari dari kolom volume penjualan")
        rows = []
        for rec in olah.valid:
            v = rec.get("volume")
            if not v or v < 1:
                continue
            rnd = random.Random("w" + rec["kode"])
            for i, jml in enumerate(_sebar(rec["kode"], int(v), hari)):
                if jml <= 0:
                    continue
                tgl = hari_ini - timedelta(days=hari - 1 - i)
                rows.append({
                    "p": pid, "b": ids[rec["kode"]], "u": u.id, "j": "keluar", "jml": jml, "per": -jml,
                    "c": "Simulasi dari volume penjualan",
                    "w": datetime(tgl.year, tgl.month, tgl.day, 9, 0, tzinfo=WIB) + timedelta(minutes=rnd.randint(0, 540)),
                    "batch": b_sim,
                })
        _masukkan_transaksi(db, rows)
        db.execute(text("UPDATE impor_batch SET jumlah_baris = :n WHERE id = :id"), {"n": len(rows), "id": b_sim})
        hasil.simulasi = len(rows)
    db.commit()
    return hasil


def _proses_riwayat(db, u, data: ImporIn, kolom, baris, terapkan: bool) -> HasilOut:
    pid, opsi = u.perusahaan_id, data.opsi
    by_kode: dict[str, int] = {}
    by_nama: dict[str, list[int]] = {}
    for r in db.execute(text("SELECT id, kode, nama FROM barang WHERE perusahaan_id = :p AND aktif"), {"p": pid}).mappings():
        by_kode[r["kode"]] = r["id"]
        by_nama.setdefault(r["nama"].lower(), []).append(r["id"])
    olah = mesin.olah_riwayat(kolom, baris, data.pemetaan, opsi.jenisBawaan, opsi.urutanTanggal, by_kode, by_nama)
    hasil = HasilOut(
        jenis="riwayat", totalBaris=len(baris), valid=len(olah.valid), baru=len(olah.valid),
        diperbarui=0, dilewati=0, jumlahError=len(olah.error),
        error=[ErrorBaris(baris=b, pesan=p) for b, p in olah.error[:30]],
        peringatan=olah.peringatan, contoh=_contoh(olah.valid),
    )
    if not terapkan:
        return hasil
    if not olah.valid:
        raise HTTPException(422, "Tidak ada baris yang valid untuk diimpor.")
    batch = _batch(db, u, "riwayat", data.namaFile, len(olah.valid), f"{len(olah.valid)} transaksi, {len(olah.error)} baris gagal")
    rows = []
    for rec in olah.valid:
        t, jml = rec["tanggal"], rec["jumlah"]
        rows.append({
            "p": pid, "b": rec["barang_id"], "u": u.id, "j": rec["jenis"], "jml": jml,
            "per": jml if rec["jenis"] == "masuk" else -jml, "c": rec["catatan"] or "Impor riwayat",
            "w": datetime(t.year, t.month, t.day, 12, 0, tzinfo=WIB), "batch": batch,
        })
    _masukkan_transaksi(db, rows)
    db.commit()
    hasil.batchId = str(batch)
    return hasil


def _proses(db: Session, u: Pengguna, data: ImporIn, terapkan: bool) -> HasilOut:
    path = _path_berkas(data.berkasId, u.perusahaan_id)
    try:
        kolom, baris = mesin.baca_berkas(path, settings.maks_baris_impor)
    except mesin.BerkasTidakValid as e:
        raise HTTPException(422, str(e))
    _cek_pemetaan(data.jenis, kolom, data.pemetaan)
    if data.jenis == "barang":
        return _proses_barang(db, u, data, kolom, baris, terapkan)
    return _proses_riwayat(db, u, data, kolom, baris, terapkan)


@router.post("/pratinjau", response_model=HasilOut)
def pratinjau(data: ImporIn, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    return _proses(db, u, data, terapkan=False)


@router.post("/terapkan", response_model=HasilOut)
def terapkan(data: ImporIn, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    hasil = _proses(db, u, data, terapkan=True)
    _path_berkas(data.berkasId, u.perusahaan_id).unlink(missing_ok=True)
    return hasil


# ----------------------------------------------------------- paket impor

@router.get("/batch", response_model=list[BatchOut])
def daftar_batch(db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    rows = db.execute(
        text(
            """
            SELECT id, jenis, nama_file, jumlah_baris, COALESCE(ringkasan, '') AS ringkasan,
                   dibuat_pada, dibatalkan_pada
            FROM impor_batch WHERE perusahaan_id = :p ORDER BY id DESC LIMIT 20
            """
        ),
        {"p": u.perusahaan_id},
    ).mappings()
    return [
        BatchOut(
            id=str(r["id"]), jenis=r["jenis"], namaFile=r["nama_file"], jumlahBaris=r["jumlah_baris"],
            ringkasan=r["ringkasan"], dibuat=ms(r["dibuat_pada"]), dibatalkan=r["dibatalkan_pada"] is not None,
            bisaDibatalkan=r["jenis"] != "barang" and r["dibatalkan_pada"] is None,
        )
        for r in rows
    ]


@router.delete("/batch/{batch_id}")
def batalkan(batch_id: int, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    b = db.execute(
        text("SELECT jenis, dibatalkan_pada FROM impor_batch WHERE id = :id AND perusahaan_id = :p"),
        {"id": batch_id, "p": u.perusahaan_id},
    ).mappings().first()
    if not b:
        raise HTTPException(404, "Paket impor tidak ditemukan")
    if b["dibatalkan_pada"] is not None:
        raise HTTPException(409, "Paket impor ini sudah dibatalkan")
    if b["jenis"] == "barang":
        raise HTTPException(
            400,
            "Impor barang tidak dapat dibatalkan. Untuk memperbaikinya, impor ulang file yang benar: "
            "barang dengan kode yang sama akan diperbarui.",
        )
    n = db.execute(
        text("DELETE FROM transaksi WHERE impor_batch_id = :id AND perusahaan_id = :p"),
        {"id": batch_id, "p": u.perusahaan_id},
    ).rowcount
    db.execute(text("UPDATE impor_batch SET dibatalkan_pada = now() WHERE id = :id"), {"id": batch_id})
    db.commit()
    return {"dihapus": n}


# ----------------------------------------------------------- template

CONTOH = {
    "barang": (
        ["Kode", "Nama", "Kategori", "Lokasi", "Satuan", "Stok", "Stok Minimum", "Harga", "Pemasok", "Kedaluwarsa"],
        [["899100100201", "Mi Instan", "Makanan", "Rak C-1", "pcs", 120, 40, 3500, "PT Boga", "31-12-2026"],
         ["899100100302", "Gula Pasir", "Makanan", "Rak C-2", "kg", 60, 25, 17000, "CV Manis", ""]],
    ),
    "riwayat": (
        ["Tanggal", "Kode", "Jumlah", "Jenis", "Catatan"],
        [["01-10-2026", "899100100201", 12, "keluar", "Penjualan harian"],
         ["02-10-2026", "899100100201", 100, "masuk", "Kiriman supplier"]],
    ),
}


@router.get("/template/{jenis}")
def template(jenis: Literal["barang", "riwayat"], format: Literal["csv", "xlsx"] = "csv", u: Pengguna = Depends(pengguna_aktif)):
    kepala, isi = CONTOH[jenis]
    return buat_berkas(f"template-{jenis}", kepala, isi, format, ",")