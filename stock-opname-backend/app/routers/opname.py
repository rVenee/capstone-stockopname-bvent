from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import Pengguna, pengguna_aktif
from ..helpers import ms
from ..izin import PENGELOLA
from ..schemas import BarisOpname, DraftIn, DraftOut, SesiOut, TerapkanIn

router = APIRouter(prefix="/opname", tags=["opname"])


def _id_draft(db: Session, pid: int) -> int | None:
    return db.execute(
        text(
            "SELECT id FROM opname_sesi WHERE perusahaan_id = :p AND status = 'draft' "
            "ORDER BY id DESC LIMIT 1"
        ),
        {"p": pid},
    ).scalar()


def _buat_draft(db: Session, pid: int, uid: int) -> int:
    return db.execute(
        text("INSERT INTO opname_sesi (perusahaan_id, pengguna_id) VALUES (:p, :u) RETURNING id"),
        {"p": pid, "u": uid},
    ).scalar()


def _daftar_sesi(db: Session, pid: int, sesi_id: int | None = None) -> list[SesiOut]:
    sql = """
    SELECT s.id AS sesi_id, s.catatan, s.diterapkan_pada,
           i.barang_id, b.nama, COALESCE(b.emoji, '📦') AS emoji, b.satuan,
           i.stok_sistem, i.stok_fisik, i.selisih
    FROM opname_sesi s
    JOIN opname_item i ON i.opname_sesi_id = s.id
    JOIN barang b ON b.id = i.barang_id
    WHERE s.perusahaan_id = :p AND s.status = 'selesai'
    """
    params: dict = {"p": pid}
    if sesi_id is not None:
        sql += " AND s.id = :sid"
        params["sid"] = sesi_id
    else:
        sql += (
            " AND s.id IN (SELECT id FROM opname_sesi WHERE perusahaan_id = :p "
            "AND status = 'selesai' ORDER BY id DESC LIMIT 50)"
        )
    sql += " ORDER BY s.diterapkan_pada DESC, s.id DESC, i.barang_id"

    hasil: dict[int, SesiOut] = {}
    for r in db.execute(text(sql), params).mappings():
        sesi = hasil.get(r["sesi_id"])
        if sesi is None:
            sesi = SesiOut(
                id=str(r["sesi_id"]),
                waktu=ms(r["diterapkan_pada"]),
                catatan=r["catatan"] or "",
                baris=[],
            )
            hasil[r["sesi_id"]] = sesi
        sesi.baris.append(
            BarisOpname(
                barangId=str(r["barang_id"]),
                nama=r["nama"],
                emoji=r["emoji"],
                satuan=r["satuan"],
                sistem=float(r["stok_sistem"]),
                fisik=float(r["stok_fisik"]),
                selisih=float(r["selisih"]),
            )
        )
    return list(hasil.values())


@router.post("/mulai")
def mulai(db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    """Memulai sesi baru. Draf lama (kalau ada) dihapus."""
    db.execute(
        text("DELETE FROM opname_sesi WHERE perusahaan_id = :p AND status = 'draft'"),
        {"p": u.perusahaan_id},
    )
    sid = _buat_draft(db, u.perusahaan_id, u.id)
    db.commit()
    return {"id": str(sid)}


@router.get("/draft", response_model=DraftOut)
def lihat_draft(db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    sid = _id_draft(db, u.perusahaan_id)
    if sid is None:
        return DraftOut(nilai={})
    rows = db.execute(
        text("SELECT barang_id, stok_fisik FROM opname_item WHERE opname_sesi_id = :s"),
        {"s": sid},
    ).all()
    return DraftOut(nilai={str(b): float(f) for b, f in rows})


@router.put("/draft/{barang_id}", response_model=DraftOut)
def isi_draft(
    barang_id: int,
    data: DraftIn,
    db: Session = Depends(get_db),
    u: Pengguna = Depends(pengguna_aktif),
):
    """Mengisi (atau mengosongkan, kalau fisik = null) hitungan fisik satu barang."""
    pid = u.perusahaan_id
    sid = _id_draft(db, pid) or _buat_draft(db, pid, u.id)

    if data.fisik is None:
        db.execute(
            text("DELETE FROM opname_item WHERE opname_sesi_id = :s AND barang_id = :b"),
            {"s": sid, "b": barang_id},
        )
    else:
        hasil = db.execute(
            text(
                """
                INSERT INTO opname_item (opname_sesi_id, barang_id, stok_sistem, stok_fisik)
                SELECT :s, b.id, b.stok, :f
                FROM barang b
                WHERE b.id = :b AND b.perusahaan_id = :p AND b.aktif
                ON CONFLICT (opname_sesi_id, barang_id)
                DO UPDATE SET stok_fisik = EXCLUDED.stok_fisik, stok_sistem = EXCLUDED.stok_sistem
                """
            ),
            {"s": sid, "b": barang_id, "f": data.fisik, "p": pid},
        )
        if hasil.rowcount == 0:
            raise HTTPException(404, "Barang tidak ditemukan")
    db.commit()
    return lihat_draft(db, u)


@router.post("/terapkan", response_model=SesiOut)
def terapkan(data: TerapkanIn, db: Session = Depends(get_db), u: Pengguna = Depends(PENGELOLA)):
    """Menyesuaikan stok sistem dengan hitungan fisik, semuanya dalam satu transaksi database."""
    pid = u.perusahaan_id
    sid = _id_draft(db, pid)
    if sid is None:
        raise HTTPException(400, "Belum ada barang yang dihitung.")

    items = db.execute(
        text("SELECT barang_id, stok_fisik FROM opname_item WHERE opname_sesi_id = :s ORDER BY barang_id"),
        {"s": sid},
    ).all()
    if not items:
        raise HTTPException(400, "Belum ada barang yang dihitung.")

    catatan = data.catatan.strip()
    for barang_id, fisik in items:
        b = db.execute(
            text("SELECT stok FROM barang WHERE id = :id AND perusahaan_id = :p AND aktif FOR UPDATE"),
            {"id": barang_id, "p": pid},
        ).first()
        if b is None:  # barang sudah dihapus sejak dihitung
            db.execute(
                text("DELETE FROM opname_item WHERE opname_sesi_id = :s AND barang_id = :b"),
                {"s": sid, "b": barang_id},
            )
            continue

        sistem = b[0]
        selisih = fisik - sistem
        db.execute(
            text("UPDATE opname_item SET stok_sistem = :sis WHERE opname_sesi_id = :s AND barang_id = :b"),
            {"sis": sistem, "s": sid, "b": barang_id},
        )
        if selisih != 0:
            db.execute(
                text("UPDATE barang SET stok = :f, diubah_pada = now() WHERE id = :id"),
                {"f": fisik, "id": barang_id},
            )
            db.execute(
                text(
                    """
                    INSERT INTO transaksi
                      (perusahaan_id, barang_id, pengguna_id, jenis, jumlah, perubahan,
                       stok_sebelum, stok_sesudah, catatan, opname_sesi_id)
                    VALUES (:p, :b, :u, 'opname', :jml, :per, :sb, :sa, :c, :s)
                    """
                ),
                {
                    "p": pid,
                    "b": barang_id,
                    "u": u.id,
                    "jml": abs(selisih),
                    "per": selisih,
                    "sb": sistem,
                    "sa": fisik,
                    "c": f"Opname: {catatan}" if catatan else "Penyesuaian stock opname",
                    "s": sid,
                },
            )

    db.execute(
        text(
            """
            UPDATE opname_sesi
            SET status = 'selesai', catatan = :c, diterapkan_pada = now(), pengguna_id = :u
            WHERE id = :s
            """
        ),
        {"c": catatan, "u": u.id, "s": sid},
    )
    db.commit()

    hasil = _daftar_sesi(db, pid, sid)
    if not hasil:
        raise HTTPException(400, "Belum ada barang yang dihitung.")
    return hasil[0]


@router.get("/sesi", response_model=list[SesiOut])
def riwayat_sesi(db: Session = Depends(get_db), u: Pengguna = Depends(pengguna_aktif)):
    return _daftar_sesi(db, u.perusahaan_id)