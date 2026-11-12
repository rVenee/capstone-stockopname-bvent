"""Membuat berkas CSV / Excel untuk diunduh."""
import csv
import io
from datetime import date, datetime
from decimal import Decimal

from fastapi import Response


def _nilai(v):
    if v is None:
        return ""
    if isinstance(v, Decimal):
        f = float(v)
        return int(f) if f.is_integer() else f
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, date):
        return v.isoformat()
    return v


def _awal_rumus(v) -> bool:
    """Teks yang diawali = atau @ (atau + / - diikuti bukan angka) bisa dibaca Excel sebagai rumus."""
    if not isinstance(v, str) or not v:
        return False
    if v[0] in "=@":
        return True
    if v[0] in "+-":
        try:
            float(v.replace(",", "."))
            return False
        except ValueError:
            return True
    return False


def buat_berkas(nama: str, kepala: list[str], baris: list[list], format: str, pemisah: str = ",") -> Response:
    isi = [[_nilai(c) for c in r] for r in baris]
    if format == "xlsx":
        from openpyxl import Workbook
        from openpyxl.styles import Font

        wb = Workbook()
        ws = wb.active
        ws.title = "Data"
        ws.append(kepala)
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in isi:
            ws.append(r)
        # Teks yang menyerupai rumus disimpan apa adanya sebagai teks, bukan dijalankan
        for row in ws.iter_rows(min_row=2):
            for c in row:
                if _awal_rumus(c.value):
                    c.data_type = "s"
        for i, k in enumerate(kepala, start=1):
            lebar = max([len(str(k))] + [len(str(r[i - 1])) for r in isi[:200]]) + 2
            ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = min(max(lebar, 8), 45)
        buf = io.BytesIO()
        wb.save(buf)
        return Response(
            buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{nama}.xlsx"'},
        )
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=pemisah, lineterminator="\r\n")
    w.writerow(kepala)
    w.writerows([["'" + c if _awal_rumus(c) else c for c in r] for r in isi])
    # BOM supaya Excel membaca huruf dan tanda baca dengan benar
    return Response(
        ("\ufeff" + buf.getvalue()).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nama}.csv"'},
    )