import json
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Pengguna, pengguna_aktif
from ..helpers import D, angka, ms
from ..izin import PENGELOLA
from ..schemas import TransaksiIn, TransaksiOut

router = APIRouter(tags=["transaksi"])


class TransaksiUbah(BaseModel):
    jenis: Literal["masuk", "keluar"]
    jumlah: float = Field(gt=0)
    catatan: str = ""


def _ke_transaksi(r) -> TransaksiOut:
    return TransaksiOut(
        id=str(r["id"]),
        barangId=str(r["barang_id"]),
        nama=r["nama"],
        emoji=r["emoji"],
        gambar=r["gambar"],
        satuan=r["satuan"],
        jenis=r["jenis"],
        jumlah=float(r["jumlah"]),
        stokSebelum=float(r["stok_sebelum"]) if r["stok_sebelum"] is not None else None,
        stokSesudah=float(r["stok_sesudah"]) if r["stok_sesudah"] is not None else None,
        catatan=r["catatan"],
        waktu=ms(r["waktu"]),
        oleh=r["oleh"],
    )


SELECT_TRANSAKSI = """
SELECT t.id, t.barang_id, b.nama, COALESCE(b.emoji, '📦') AS emoji, b.gambar, b.satuan,
       t.jenis, t.jumlah, t.stok_sebelum, t.stok_sesudah,
       COALESCE(t.catatan, '') AS catatan, t.waktu,
       COALESCE(u.nama, '') AS oleh
FROM transaksi t
JOIN barang b ON b.id = t.barang_id
LEFT JOIN pengguna u ON u.id = t.pengguna_id
"""


@router.get("/transaksi", response_model=list[TransaksiOut])
def riwayat(
    q: str = "",
    jenis: str = "",
    sumber: str = "app",
    limit: int = Query(300, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    u: Pengguna = Depends(pengguna_aktif),
):
    """Bawaan: hanya pergerakan stok yang dicatat lewat aplikasi.
    Tambahkan ?sumber=semua untuk menyertakan riwayat hasil impor."""
    sql = SELECT_TRANSAKSI + " WHERE t.perusahaan_id = :p"
    params: dict = {"p": u.perusahaan_id, "lim": limit, "off": offset}
    if sumber != "semua":
        sql += " AND t.sumber = 'app'"
    if q.strip():
        sql += " AND b.nama ILIKE :q"
        params["q"] = f"%{q.strip()}%"
    if jenis in ("masuk", "keluar", "opname"):
        sql += " AND t.jenis = :j"
        params["j"] = jenis
    sql += " ORDER BY t.waktu DESC, t.id DESC LIMIT :lim OFFSET :off"
    rows = db.execute(text(sql), params).mappings().all()
    return [_ke_transaksi(r) for r in rows]


@router.post("/transaksi", response_model=TransaksiOut, status_code=201)
def catat(data: TransaksiIn, db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    # FOR UPDATE: mengunci baris barang supaya dua transaksi bersamaan tidak saling menimpa
    b = db.execute(
        text(
            """
            SELECT id, nama, satuan, stok FROM barang
            WHERE id = :id AND perusahaan_id = :p AND aktif
            FOR UPDATE
            """
        ),
        {"id": data.barangId, "p": u.perusahaan_id},
    ).mappings().first()
    if not b:
        raise HTTPException(404, "Barang tidak ditemukan")

    jumlah = D(data.jumlah)
    stok = b["stok"]
    if data.jenis == "keluar" and jumlah > stok:
        raise HTTPException(400, f"Stok {b['nama']} hanya {angka(stok)} {b['satuan']}.")

    sesudah = stok + jumlah if data.jenis == "masuk" else stok - jumlah
    perubahan = jumlah if data.jenis == "masuk" else -jumlah

    db.execute(
        text("UPDATE barang SET stok = :s, diubah_pada = now() WHERE id = :id"),
        {"s": sesudah, "id": b["id"]},
    )
    baru = db.execute(
        text(
            """
            INSERT INTO transaksi
              (perusahaan_id, barang_id, pengguna_id, jenis, jumlah, perubahan,
               stok_sebelum, stok_sesudah, catatan)
            VALUES (:p, :b, :u, :j, :jml, :per, :sb, :sa, :c)
            RETURNING id
            """
        ),
        {
            "p": u.perusahaan_id,
            "b": b["id"],
            "u": u.id,
            "j": data.jenis,
            "jml": jumlah,
            "per": perubahan,
            "sb": stok,
            "sa": sesudah,
            "c": data.catatan.strip(),
        },
    ).scalar()
    db.commit()

    r = db.execute(text(SELECT_TRANSAKSI + " WHERE t.id = :id"), {"id": baru}).mappings().first()
    return _ke_transaksi(r)


# ----------------------------------------------------------- ubah / hapus transaksi

def _foto(t) -> dict:
    return {
        "jenis": t["jenis"],
        "jumlah": float(t["jumlah"]),
        "catatan": t["catatan"] or "",
        "waktu": ms(t["waktu"]),
        "stokSebelum": float(t["stok_sebelum"]) if t["stok_sebelum"] is not None else None,
        "stokSesudah": float(t["stok_sesudah"]) if t["stok_sesudah"] is not None else None,
    }


def _terapkan_perubahan(db: Session, u: Pengguna, trx_id: int, spec: TransaksiUbah | None) -> int:
    """Mengubah (spec berisi nilai baru) atau menghapus (spec None) satu transaksi,
    lalu menyusun ulang stok sebelum/sesudah seluruh riwayat barang itu.
    Ditolak kalau stok jadi negatif di titik mana pun, atau kalau sudah ada opname sesudahnya."""
    pid = u.perusahaan_id
    t = db.execute(
        text(
            """
            SELECT id, barang_id, jenis, jumlah, perubahan, catatan, waktu, sumber, stok_sebelum, stok_sesudah
            FROM transaksi WHERE id = :id AND perusahaan_id = :p
            """
        ),
        {"id": trx_id, "p": pid},
    ).mappings().first()
    if not t:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    if t["sumber"] != "app":
        raise HTTPException(
            400, "Riwayat hasil impor tidak diubah di sini. Batalkan paketnya lewat menu Impor & Ekspor Data."
        )
    if t["jenis"] == "opname":
        raise HTTPException(
            400, "Transaksi hasil stock opname tidak dapat diubah atau dihapus. Lakukan opname baru untuk mengoreksi stok."
        )

    # Kunci barangnya, supaya tidak bentrok dengan transaksi lain yang sedang dicatat
    b = db.execute(
        text("SELECT id, nama, satuan, stok FROM barang WHERE id = :b AND perusahaan_id = :p FOR UPDATE"),
        {"b": t["barang_id"], "p": pid},
    ).mappings().first()
    if not b:
        raise HTTPException(404, "Barang tidak ditemukan")

    sesudahnya_opname = db.execute(
        text(
            """
            SELECT 1 FROM transaksi
            WHERE barang_id = :b AND perusahaan_id = :p AND jenis = 'opname' AND (waktu, id) > (:w, :id)
            LIMIT 1
            """
        ),
        {"b": b["id"], "p": pid, "w": t["waktu"], "id": t["id"]},
    ).first()
    if sesudahnya_opname:
        raise HTTPException(
            400, "Transaksi ini sudah tercakup dalam stock opname berikutnya, jadi tidak dapat diubah atau dihapus."
        )

    semua = db.execute(
        text(
            """
            SELECT id, jenis, jumlah, perubahan, waktu FROM transaksi
            WHERE barang_id = :b AND perusahaan_id = :p AND sumber = 'app'
            ORDER BY waktu, id
            """
        ),
        {"b": b["id"], "p": pid},
    ).mappings().all()

    # Stok awal rantai = stok sekarang dikurangi seluruh perubahan yang tercatat di aplikasi
    jalan = b["stok"] - sum((r["perubahan"] for r in semua), Decimal(0))
    pembaruan = []
    for r in semua:
        if r["id"] == trx_id:
            if spec is None:
                continue
            jml = D(spec.jumlah)
            jenis, perubahan = spec.jenis, (jml if spec.jenis == "masuk" else -jml)
        else:
            jml, jenis, perubahan = r["jumlah"], r["jenis"], r["perubahan"]
        sebelum = jalan
        jalan = jalan + perubahan
        if jalan < 0:
            hari = r["waktu"].strftime("%d-%m-%Y")
            raise HTTPException(
                400,
                f"Perubahan ini membuat stok {b['nama']} menjadi negatif ({angka(jalan)} {b['satuan']}) "
                f"pada riwayat tanggal {hari}. Ubah transaksi lain lebih dulu.",
            )
        pembaruan.append((r["id"], jenis, jml, perubahan, sebelum, jalan))

    sebelum_foto = _foto(t)
    for rid, jenis, jml, perubahan, sebelum, sesudah in pembaruan:
        extra = ", catatan = :c" if (rid == trx_id and spec is not None) else ""
        par = {"id": rid, "j": jenis, "jml": jml, "per": perubahan, "sb": sebelum, "sa": sesudah}
        if extra:
            par["c"] = spec.catatan.strip()
        db.execute(
            text(
                f"UPDATE transaksi SET jenis = :j, jumlah = :jml, perubahan = :per, "
                f"stok_sebelum = :sb, stok_sesudah = :sa{extra} WHERE id = :id"
            ),
            par,
        )
    if spec is None:
        db.execute(text("DELETE FROM transaksi WHERE id = :id"), {"id": trx_id})
    db.execute(text("UPDATE barang SET stok = :s, diubah_pada = now() WHERE id = :b"), {"s": jalan, "b": b["id"]})

    sesudah_foto = None
    if spec is not None:
        baris = next(x for x in pembaruan if x[0] == trx_id)
        sesudah_foto = {
            "jenis": spec.jenis, "jumlah": float(spec.jumlah), "catatan": spec.catatan.strip(),
            "waktu": sebelum_foto["waktu"], "stokSebelum": float(baris[4]), "stokSesudah": float(baris[5]),
        }
    db.execute(
        text(
            """
            INSERT INTO transaksi_log (perusahaan_id, transaksi_id, barang_id, aksi, pengguna_id, sebelum, sesudah)
            VALUES (:p, :t, :b, :a, :u, CAST(:s AS jsonb), CAST(:n AS jsonb))
            """
        ),
        {
            "p": pid, "t": trx_id, "b": b["id"], "a": "hapus" if spec is None else "ubah", "u": u.id,
            "s": json.dumps(sebelum_foto), "n": json.dumps(sesudah_foto) if sesudah_foto else None,
        },
    )
    db.commit()
    return b["id"]


@router.put("/transaksi/{trx_id}", response_model=TransaksiOut)
def ubah_transaksi(
    trx_id: int, data: TransaksiUbah, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)
):
    _terapkan_perubahan(db, u, trx_id, data)
    r = db.execute(text(SELECT_TRANSAKSI + " WHERE t.id = :id"), {"id": trx_id}).mappings().first()
    return _ke_transaksi(r)


@router.delete("/transaksi/{trx_id}", status_code=204)
def hapus_transaksi(trx_id: int, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    _terapkan_perubahan(db, u, trx_id, None)
    return Response(status_code=204)