"""Mesin impor: membaca CSV/Excel, menebak pemetaan kolom, membersihkan nilai."""
import csv
import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

# (kunci, label, wajib)
BIDANG = {
    "barang": [
        ("kode", "Kode barang", True),
        ("nama", "Nama barang", True),
        ("kategori", "Kategori", False),
        ("lokasi", "Lokasi", False),
        ("satuan", "Satuan", False),
        ("stok", "Stok", False),
        ("stokMin", "Stok minimum", False),
        ("harga", "Harga", False),
        ("pemasok", "Pemasok", False),
        ("kedaluwarsa", "Tanggal kedaluwarsa", False),
        ("status", "Status (mis. Discontinued)", False),
        ("volume", "Volume penjualan (untuk riwayat simulasi)", False),
    ],
    "riwayat": [
        ("tanggal", "Tanggal", True),
        ("jumlah", "Jumlah", True),
        ("kode", "Kode barang", False),
        ("nama", "Nama barang", False),
        ("jenis", "Jenis (masuk / keluar)", False),
        ("catatan", "Catatan", False),
    ],
}

# Judul kolom (huruf kecil, tanpa spasi/simbol) yang dikenali untuk tiap bidang
ALIAS = {
    "kode": ["productid", "kode", "kodebarang", "kodeproduk", "sku", "barcode", "itemcode", "idproduk", "idbarang", "partnumber", "id"],
    "nama": ["productname", "nama", "namabarang", "namaproduk", "produk", "barang", "item", "itemname", "product", "description", "deskripsi"],
    "kategori": ["catagory", "category", "kategori", "jenisbarang", "kelompok", "group"],
    "lokasi": ["warehouselocation", "lokasi", "rak", "gudang", "location", "bin", "lokasirak"],
    "satuan": ["satuan", "unit", "uom", "unitofmeasure"],
    "stok": ["stockquantity", "stok", "stock", "qty", "quantity", "jumlahstok", "onhand", "stoksaatini", "sisa"],
    "stokMin": ["reorderlevel", "stokminimum", "stokmin", "minstock", "minimumstock", "minimum", "batasminimum", "safetystock"],
    "harga": ["unitprice", "harga", "price", "hargasatuan", "hargajual", "hargabeli"],
    "pemasok": ["suppliername", "pemasok", "supplier", "vendor", "namapemasok"],
    "kedaluwarsa": ["expirationdate", "kedaluwarsa", "expirydate", "expiry", "expdate", "exp", "tanggalexp", "tanggalkedaluwarsa", "tglkedaluwarsa"],
    "jumlahPesanUlang": ["reorderquantity", "jumlahpesanulang", "reorderqty", "orderqty", "qtypesan"],
    "status": ["status", "statusbarang"],
    "volume": ["salesvolume", "volumepenjualan", "totalterjual", "unitssold"],
    "tanggal": ["tanggal", "date", "tgl", "waktu", "datetime", "tanggaltransaksi", "saledate", "solddate", "orderdate", "tanggaljual"],
    "jumlah": ["jumlah", "qty", "quantity", "unitssold", "terjual", "jumlahterjual", "qtyterjual", "banyak"],
    "jenis": ["jenis", "type", "jenistransaksi", "tipetransaksi", "movement", "tipe"],
    "catatan": ["catatan", "keterangan", "note", "notes", "remark", "remarks"],
}
# Urutan penentuan: bidang yang lebih spesifik dipilih lebih dulu
URUTAN = {
    "barang": ["kode", "nama", "kategori", "lokasi", "satuan", "stok", "stokMin", "harga", "pemasok",
                "kedaluwarsa", "status", "volume"],
    "riwayat": ["tanggal", "jumlah", "kode", "nama", "jenis", "catatan"],
}

SERING_NONAKTIF = {"discontinued", "nonaktif", "tidakaktif", "inactive", "dihentikan", "stopped", "obsolete", "diskontinu"}
JENIS_MASUK = {"masuk", "in", "inbound", "receive", "received", "purchase", "pembelian", "restock", "terima", "penerimaan"}
JENIS_KELUAR = {"keluar", "out", "outbound", "sale", "sales", "sold", "penjualan", "jual", "terjual", "pengeluaran"}


class BerkasTidakValid(Exception):
    pass


def normal(teks: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(teks).lower())


# ----------------------------------------------------------- membaca berkas

def _unik(header: list) -> list[str]:
    hasil: list[str] = []
    for i, h in enumerate(header):
        nama = str(h).strip() if h is not None else ""
        if not nama:
            nama = f"Kolom {i + 1}"
        dasar, n = nama, 2
        while nama in hasil:
            nama = f"{dasar} ({n})"
            n += 1
        hasil.append(nama)
    return hasil


def _baca_csv(data: bytes) -> tuple[list[str], list[list]]:
    for enc in ("utf-8-sig", "cp1252"):
        try:
            teks = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise BerkasTidakValid("Berkas tidak dapat dibaca (encoding tidak dikenali).")

    baris_awal = next((b for b in teks.splitlines() if b.strip()), "")
    pemisah = max([",", ";", "\t", "|"], key=lambda d: baris_awal.count(d))
    if baris_awal.count(pemisah) == 0:
        pemisah = ","
    semua = [r for r in csv.reader(io.StringIO(teks), delimiter=pemisah) if any(c.strip() for c in r)]
    if not semua:
        raise BerkasTidakValid("Berkas kosong.")
    kolom = _unik(semua[0])
    n = len(kolom)
    isi = [(r + [""] * n)[:n] for r in semua[1:]]
    return kolom, isi


def _baca_xlsx(path: Path) -> tuple[list[str], list[list]]:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(path, read_only=True, data_only=True)
    except Exception:
        raise BerkasTidakValid("Berkas Excel tidak dapat dibuka.")
    ws = wb.active
    semua = []
    for r in ws.iter_rows(values_only=True):
        if any(c not in (None, "") for c in r):
            semua.append(["" if c is None else c for c in r])
    wb.close()
    if not semua:
        raise BerkasTidakValid("Lembar Excel kosong.")
    kolom = _unik(semua[0])
    n = len(kolom)
    isi = [(r + [""] * n)[:n] for r in semua[1:]]
    return kolom, isi


def baca_berkas(path: Path, maks_baris: int) -> tuple[list[str], list[list]]:
    data = path.read_bytes()
    if data[:2] == b"PK" and zipfile.is_zipfile(path):
        kolom, isi = _baca_xlsx(path)
    elif path.suffix.lower() in (".csv", ".txt", ".tsv"):
        kolom, isi = _baca_csv(data)
    else:
        raise BerkasTidakValid("Format berkas tidak didukung. Gunakan CSV atau Excel (.xlsx).")
    if len(isi) > maks_baris:
        raise BerkasTidakValid(f"Berkas terlalu besar ({len(isi)} baris). Maksimal {maks_baris} baris.")
    return kolom, isi


def sarankan(kolom: list[str], jenis: str) -> dict[str, str | None]:
    """Menebak kolom mana berarti apa, dari judul kolom."""
    dipakai: set[int] = set()
    hasil: dict[str, str | None] = {}
    ternormal = [normal(k) for k in kolom]
    for f in URUTAN[jenis]:
        hasil[f] = None
        for alias in ALIAS[f]:
            ketemu = next((i for i, n in enumerate(ternormal) if n == alias and i not in dipakai), None)
            if ketemu is not None:
                hasil[f] = kolom[ketemu]
                dipakai.add(ketemu)
                break
    return hasil


# ----------------------------------------------------------- membersihkan nilai

def ke_angka(v) -> Decimal | None:
    """Mengubah '$4.50', 'Rp 1.250.000', '1.250,50', 15, 2.5 menjadi angka. None kalau kosong."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float, Decimal)):
        return Decimal(str(v))
    s = str(v).strip()
    if not s:
        return None
    negatif = s.startswith("-") or (s.startswith("(") and s.endswith(")"))
    t = re.sub(r"[^\d.,]", "", s)
    if not t or not re.search(r"\d", t):
        raise ValueError(f"'{s}' bukan angka")
    ada_titik, ada_koma = "." in t, "," in t
    if ada_titik and ada_koma:
        if t.rfind(",") > t.rfind("."):
            t = t.replace(".", "").replace(",", ".")
        else:
            t = t.replace(",", "")
    elif ada_koma:
        t = t.replace(",", "") if re.fullmatch(r"\d{1,3}(,\d{3})+", t) else t.replace(",", ".")
    elif ada_titik and re.fullmatch(r"\d{1,3}(\.\d{3})+", t) and "$" not in s:
        t = t.replace(".", "")  # 1.250 / 1.250.000 gaya Indonesia
    try:
        d = Decimal(t)
    except InvalidOperation:
        raise ValueError(f"'{s}' bukan angka")
    return -d if negatif else d


POLA_TGL = re.compile(r"^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?:[ T].*)?$")


def deteksi_urutan(nilai: list) -> str:
    """'hari-bulan' atau 'bulan-hari', dari angka yang tidak mungkin ambigu (>12)."""
    for v in nilai:
        m = POLA_TGL.match(str(v).strip()) if isinstance(v, str) else None
        if not m or len(m.group(1)) == 4:
            continue
        a, b = int(m.group(1)), int(m.group(2))
        if a > 12:
            return "hari-bulan"
        if b > 12:
            return "bulan-hari"
    return "hari-bulan"


def ke_tanggal(v, urutan: str) -> date | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    if not s:
        return None
    m = POLA_TGL.match(s)
    if not m:
        raise ValueError(f"'{s}' bukan tanggal")
    a, b, c = m.group(1), m.group(2), m.group(3)
    if len(a) == 4:  # YYYY-MM-DD
        y, mo, d = int(a), int(b), int(c)
    else:
        y = int(c) + (2000 if len(c) == 2 else 0)
        if urutan == "bulan-hari":
            mo, d = int(a), int(b)
        else:
            d, mo = int(a), int(b)
    try:
        return date(y, mo, d)
    except ValueError:
        raise ValueError(f"'{s}' bukan tanggal yang valid")


def teks(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return str(v).strip()


# ----------------------------------------------------------- mengolah baris

@dataclass
class HasilOlah:
    valid: list[dict] = field(default_factory=list)
    error: list[tuple[int, str]] = field(default_factory=list)
    peringatan: list[str] = field(default_factory=list)
    dilewati: int = 0


def olah_barang(kolom: list[str], baris: list[list], pemetaan: dict, kurs: float, lewati_nonaktif: bool, urutan: str) -> HasilOlah:
    idx = {f: kolom.index(c) for f, c in pemetaan.items() if c and c in kolom}
    hasil = HasilOlah()
    peringatan_tgl = 0

    if urutan == "auto" and "kedaluwarsa" in idx:
        urutan = deteksi_urutan([r[idx["kedaluwarsa"]] for r in baris])
    elif urutan == "auto":
        urutan = "hari-bulan"

    def ambil(r, f):
        return r[idx[f]] if f in idx else None

    terlihat: dict[str, int] = {}
    for n, r in enumerate(baris, start=2):
        kode = teks(ambil(r, "kode"))
        nama = teks(ambil(r, "nama"))
        if not kode and not nama:
            continue
        if not kode:
            hasil.error.append((n, "Kode barang kosong"))
            continue
        if not nama:
            hasil.error.append((n, "Nama barang kosong"))
            continue
        if "status" in idx and lewati_nonaktif and normal(teks(ambil(r, "status"))) in SERING_NONAKTIF:
            hasil.dilewati += 1
            continue
        if kode in terlihat:
            hasil.error.append((n, f"Kode '{kode}' sudah muncul di baris {terlihat[kode]}"))
            continue

        rec: dict = {"kode": kode, "nama": nama, "_baris": n, "_set": {"nama"}}
        try:
            for f in ("stok", "stokMin", "harga", "jumlahPesanUlang", "volume"):
                if f not in idx:
                    continue
                v = ke_angka(ambil(r, f))
                if f in ("stok", "stokMin"):
                    v = v if v is not None else Decimal(0)
                    if v < 0:
                        raise ValueError("Stok negatif" if f == "stok" else "Stok minimum negatif")
                if f == "harga":
                    v = (v if v is not None else Decimal(0)) * Decimal(str(kurs))
                    if v < 0:
                        raise ValueError("Harga negatif")
                    v = v.quantize(Decimal("0.01"))
                rec[f] = v
                if f != "volume":
                    rec["_set"].add(f)
        except ValueError as e:
            hasil.error.append((n, str(e)))
            continue

        for f in ("kategori", "lokasi", "satuan", "pemasok"):
            if f in idx:
                rec[f] = teks(ambil(r, f))
                rec["_set"].add(f)
        if "kedaluwarsa" in idx:
            try:
                rec["kedaluwarsa"] = ke_tanggal(ambil(r, "kedaluwarsa"), urutan)
            except ValueError:
                rec["kedaluwarsa"] = None
                peringatan_tgl += 1
            rec["_set"].add("kedaluwarsa")

        terlihat[kode] = n
        hasil.valid.append(rec)

    if peringatan_tgl:
        hasil.peringatan.append(f"{peringatan_tgl} tanggal kedaluwarsa tidak terbaca dan dikosongkan.")
    if "kedaluwarsa" in idx:
        hasil.peringatan.append(f"Tanggal dibaca dengan urutan {'hari-bulan' if urutan == 'hari-bulan' else 'bulan-hari'}.")
    return hasil


def olah_riwayat(kolom, baris, pemetaan, jenis_bawaan: str, urutan: str, by_kode: dict, by_nama: dict) -> HasilOlah:
    idx = {f: kolom.index(c) for f, c in pemetaan.items() if c and c in kolom}
    hasil = HasilOlah()
    if urutan == "auto":
        urutan = deteksi_urutan([r[idx["tanggal"]] for r in baris]) if "tanggal" in idx else "hari-bulan"

    for n, r in enumerate(baris, start=2):
        kode = teks(r[idx["kode"]]) if "kode" in idx else ""
        nama = teks(r[idx["nama"]]) if "nama" in idx else ""
        if not kode and not nama and not teks(r[idx["tanggal"]]):
            continue
        try:
            tgl = ke_tanggal(r[idx["tanggal"]], urutan)
            if tgl is None:
                raise ValueError("Tanggal kosong")
            jml = ke_angka(r[idx["jumlah"]])
            if jml is None or jml == 0:
                raise ValueError("Jumlah kosong atau nol")
        except ValueError as e:
            hasil.error.append((n, str(e)))
            continue

        barang_id = None
        if kode and kode in by_kode:
            barang_id = by_kode[kode]
        elif nama and len(by_nama.get(nama.lower(), [])) == 1:
            barang_id = by_nama[nama.lower()][0]
        elif nama and len(by_nama.get(nama.lower(), [])) > 1:
            hasil.error.append((n, f"Nama '{nama}' dipakai beberapa barang, isi kolom kode barang"))
            continue
        if barang_id is None:
            hasil.error.append((n, f"Barang '{kode or nama or '?'}' tidak ditemukan di daftar barang"))
            continue

        jenis = jenis_bawaan
        if "jenis" in idx and teks(r[idx["jenis"]]):
            j = normal(teks(r[idx["jenis"]]))
            if j in JENIS_MASUK:
                jenis = "masuk"
            elif j in JENIS_KELUAR:
                jenis = "keluar"
            else:
                hasil.error.append((n, f"Jenis '{teks(r[idx['jenis']])}' tidak dikenali (masuk/keluar)"))
                continue
        hasil.valid.append({
            "barang_id": barang_id, "tanggal": tgl, "jumlah": abs(jml), "jenis": jenis,
            "catatan": teks(r[idx["catatan"]]) if "catatan" in idx else "", "_baris": n,
        })
    return hasil