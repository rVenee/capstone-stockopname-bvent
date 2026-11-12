import math
from collections import defaultdict
from datetime import datetime, timedelta
from statistics import pstdev
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from .schemas import AnalisisOut, BarangOut, SaranOut, StatusOut, TitikPrediksi

ZONA = ZoneInfo("Asia/Jakarta")
MAX_HARI = 30
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def hari_ini():
    return datetime.now(ZONA).date()


def tanggal_depan(n: int) -> str:
    d = hari_ini() + timedelta(days=n)
    return f"{d.day} {BULAN[d.month - 1]}"


def angka(x: float) -> str:
    x = float(x)
    return str(int(x)) if x.is_integer() else f"{x:.2f}".rstrip("0").rstrip(".")


def bulat_js(x: float) -> int:
    """Pembulatan seperti Math.round di JavaScript (0.5 ke atas)."""
    return int(math.floor(x + 0.5))


def rata(a: list[float]) -> float:
    return sum(a) / len(a) if a else 0.0


def muat_deret(db: Session, pid: int):
    """Mengembalikan (penjualan, perubahan) per barang untuk 30 hari terakhir.
    Indeks terakhir = hari ini."""
    awal = hari_ini() - timedelta(days=MAX_HARI - 1)
    penjualan: dict[int, list[float]] = defaultdict(lambda: [0.0] * MAX_HARI)
    perubahan: dict[int, list[float]] = defaultdict(lambda: [0.0] * MAX_HARI)

    rows = db.execute(
        text("SELECT barang_id, tanggal, terjual FROM penjualan_harian WHERE perusahaan_id = :p AND tanggal >= :a"),
        {"p": pid, "a": awal},
    ).all()
    for barang_id, tanggal, terjual in rows:
        i = (tanggal - awal).days
        if 0 <= i < MAX_HARI:
            penjualan[barang_id][i] = float(terjual)

    rows = db.execute(
        text(
            """
            SELECT barang_id, (waktu AT TIME ZONE 'Asia/Jakarta')::date AS tanggal, SUM(perubahan)
            FROM transaksi
            WHERE perusahaan_id = :p AND sumber = 'app' AND (waktu AT TIME ZONE 'Asia/Jakarta')::date >= :a
            GROUP BY barang_id, (waktu AT TIME ZONE 'Asia/Jakarta')::date
            """
        ),
        {"p": pid, "a": awal},
    ).all()
    for barang_id, tanggal, total in rows:
        i = (tanggal - awal).days
        if 0 <= i < MAX_HARI:
            perubahan[barang_id][i] = float(total)

    return penjualan, perubahan


def tentukan_status(b: BarangOut, hari_min: float | None) -> StatusOut:
    if b.stok < b.stokMin:
        return StatusOut(label="Restock", variant="danger", urut=0)
    if hari_min is not None and hari_min <= 7:
        return StatusOut(label="Segera", variant="warning", urut=1)
    if hari_min is not None and hari_min <= 10:
        return StatusOut(label="Pantau", variant="info", urut=2)
    return StatusOut(label="Aman", variant="success", urut=3)


def _penjelasan(b: BarangOut, r: float, tren: int, hari_min: float | None) -> str:
    arah = "naik" if tren >= 5 else "turun" if tren <= -5 else "relatif stabil"
    detail = f", {'+' if tren > 0 else ''}{tren}% dibanding 7 hari sebelumnya" if abs(tren) >= 5 else ""
    if b.stok < b.stokMin:
        sisa = "stok saat ini sudah di bawah minimum, sebaiknya segera restock"
    elif hari_min is not None and hari_min <= 60:
        sisa = f"stok diperkirakan menyentuh minimum pada {tanggal_depan(math.ceil(hari_min))}"
    else:
        sisa = "stok diperkirakan masih aman dalam waktu dekat"
    return f"Penjualan {b.nama} {arah} (rata-rata ±{r:.1f} {b.satuan}/hari{detail}); {sisa}."


def analisis(b: BarangOut, sales: list[float], net: list[float], hari: int, detail: bool) -> AnalisisOut:
    win = sales[-hari:]
    r = rata(win)
    last7 = rata(sales[-7:])
    prev7 = rata(sales[-14:-7])
    tren = bulat_js(((last7 - prev7) / prev7) * 100) if prev7 > 0 else 0
    sd = pstdev(win) if win else 0.0

    hari_habis = b.stok / r if r > 0 else None
    hari_min = (b.stok - b.stokMin) / r if r > 0 else None

    prediksi: list[TitikPrediksi] = []
    for h in range(1, hari + 1):
        mid = max(0.0, b.stok - r * h)
        d = sd * math.sqrt(h)
        prediksi.append(
            TitikPrediksi(mid=mid, low=max(0.0, mid - d), high=min(b.stok, mid + d))
        )

    out = AnalisisOut(
        barang=b,
        hari=hari,
        rata=r,
        trenPersen=tren,
        hariHabis=hari_habis,
        hariMin=hari_min,
        stokAkhir=prediksi[-1].mid if prediksi else b.stok,
        status=tentukan_status(b, hari_min),
    )

    if detail:
        stok_harian = [0.0] * MAX_HARI
        stok_harian[-1] = b.stok
        for i in range(MAX_HARI - 1, 0, -1):
            stok_harian[i - 1] = stok_harian[i] - net[i]
        out.riwayat = [round(v, 1) for v in stok_harian[-hari:]]
        out.prediksi = prediksi
        out.penjelasan = _penjelasan(b, r, tren, hari_min)
    return out


def _bulatkan(n: float) -> int:
    return max(1, math.ceil(n)) if n <= 10 else math.ceil(n / 5) * 5


def rekomendasi(barang: list[BarangOut], penjualan, perubahan, hari: int) -> list[SaranOut]:
    hasil = [
        analisis(b, penjualan[int(b.id)], perubahan[int(b.id)], hari, detail=False) for b in barang
    ]
    hasil = sorted((a for a in hasil if a.status.urut <= 2), key=lambda a: a.status.urut)

    saran: list[SaranOut] = []
    for a in hasil:
        b = a.barang
        jumlah = _bulatkan(a.rata * 14 + b.stokMin - b.stok)
        naik_turun = (
            f"; tren {'naik' if a.trenPersen > 0 else 'turun'} {abs(a.trenPersen)}%"
            if abs(a.trenPersen) >= 5
            else ""
        )

        if a.status.urut == 0:
            hh = max(1, math.ceil(a.hariHabis)) if a.hariHabis is not None else None
            hari_batas = min(2, max(1, math.floor(a.hariHabis if a.hariHabis is not None else 1)))
            alasan = (
                f"Stok {angka(b.stok)} sudah di bawah minimum ({angka(b.stokMin)})"
                + (f"; diprediksi habis dalam {hh} hari" if hh else "")
                + naik_turun
                + "."
            )
            label, variant, batas = "Mendesak", "danger", tanggal_depan(hari_batas)
        elif a.status.urut == 1:
            hm = a.hariMin if a.hariMin is not None else 1
            alasan = (
                f"Diprediksi menyentuh stok minimum dalam {math.ceil(hm)} hari; "
                f"rata-rata keluar ±{a.rata:.1f} {b.satuan}/hari{naik_turun}."
            )
            label, variant, batas = "Segera", "warning", tanggal_depan(max(1, math.floor(hm)))
        else:
            hm = a.hariMin if a.hariMin is not None else 1
            alasan = (
                f"Stok masih aman, namun diperkirakan menyentuh minimum dalam {math.ceil(hm)} hari{naik_turun}."
            )
            label, variant, batas = "Pantau", "info", tanggal_depan(max(1, math.floor(hm)))

        saran.append(
            SaranOut(
                barang=b, jumlah=jumlah, batas=batas, label=label,
                variant=variant, alasan=alasan, rata=a.rata,
            )
        )
    return saran