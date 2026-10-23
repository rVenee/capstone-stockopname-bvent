import { createContext, ReactNode, useContext, useState } from "react";
import { Barang, initialBarang } from "./barang";
import { buatBaris, initialSesi, SesiOpname } from "./opname";
import { initialTransaksi, Transaksi } from "./transaksi";

type HasilCatat = { ok: true } | { ok: false; error: string };
type HasilOpname = { ok: true; sesi: SesiOpname } | { ok: false; error: string };

type Ctx = {
  items: Barang[];
  transaksi: Transaksi[];
  sesi: SesiOpname[];
  draft: Record<string, string>;
  getById: (id: string) => Barang | undefined;
  tambah: (b: Omit<Barang, "id">) => void;
  ubah: (id: string, b: Omit<Barang, "id">) => void;
  hapus: (id: string) => void;
  catat: (barangId: string, jenis: "masuk" | "keluar", jumlah: number, catatan: string) => HasilCatat;
  setDraftNilai: (barangId: string, nilai: string) => void;
  mulaiOpname: () => void;
  terapkanOpname: (catatan: string) => HasilOpname;
};

const BarangContext = createContext<Ctx | null>(null);

export function BarangProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Barang[]>(initialBarang);
  const [transaksi, setTransaksi] = useState<Transaksi[]>(initialTransaksi);
  const [sesi, setSesi] = useState<SesiOpname[]>(initialSesi);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const value: Ctx = {
    items,
    transaksi,
    sesi,
    draft,
    getById: (id) => items.find((b) => b.id === id),
    tambah: (b) => setItems((prev) => [...prev, { ...b, id: String(Date.now()) }]),
    ubah: (id, b) => setItems((prev) => prev.map((x) => (x.id === id ? { ...b, id } : x))),
    hapus: (id) => {
      setItems((prev) => prev.filter((x) => x.id !== id));
      setDraft((prev) => {
        const { [id]: _hapus, ...sisa } = prev;
        return sisa;
      });
    },
    catat: (barangId, jenis, jumlah, catatan) => {
      const b = items.find((x) => x.id === barangId);
      if (!b) return { ok: false, error: "Barang tidak ditemukan." };
      if (jumlah <= 0) return { ok: false, error: "Jumlah harus lebih dari 0." };
      if (jenis === "keluar" && jumlah > b.stok) {
        return { ok: false, error: `Stok ${b.nama} hanya ${b.stok} ${b.satuan}.` };
      }
      const sesudah = jenis === "masuk" ? b.stok + jumlah : b.stok - jumlah;
      setItems((prev) => prev.map((x) => (x.id === barangId ? { ...x, stok: sesudah } : x)));
      setTransaksi((prev) => [
        {
          id: "t" + Date.now(),
          barangId,
          nama: b.nama,
          emoji: b.emoji,
          satuan: b.satuan,
          jenis,
          jumlah,
          stokSebelum: b.stok,
          stokSesudah: sesudah,
          catatan: catatan.trim(),
          waktu: Date.now(),
        },
        ...prev,
      ]);
      return { ok: true };
    },
    setDraftNilai: (barangId, nilai) => setDraft((prev) => ({ ...prev, [barangId]: nilai })),
    mulaiOpname: () => setDraft({}),
    terapkanOpname: (catatan) => {
      const baris = buatBaris(items, draft);
      if (baris.length === 0) return { ok: false, error: "Belum ada barang yang dihitung." };

      const waktu = Date.now();
      const cat = catatan.trim();
      const sesiBaru: SesiOpname = { id: "s" + waktu, waktu, catatan: cat, baris };

      const fisikMap = new Map(baris.map((b) => [b.barangId, b.fisik]));
      setItems((prev) =>
        prev.map((x) => (fisikMap.has(x.id) ? { ...x, stok: fisikMap.get(x.id)! } : x))
      );

      const trx: Transaksi[] = baris
        .filter((b) => b.selisih !== 0)
        .map((b, i) => ({
          id: `t${waktu}-${i}`,
          barangId: b.barangId,
          nama: b.nama,
          emoji: b.emoji,
          satuan: b.satuan,
          jenis: "opname",
          jumlah: Math.abs(b.selisih),
          stokSebelum: b.sistem,
          stokSesudah: b.fisik,
          catatan: cat ? `Opname: ${cat}` : "Penyesuaian stock opname",
          waktu,
        }));
      setTransaksi((prev) => [...trx, ...prev]);
      setSesi((prev) => [sesiBaru, ...prev]);
      setDraft({});
      return { ok: true, sesi: sesiBaru };
    },
  };

  return <BarangContext.Provider value={value}>{children}</BarangContext.Provider>;
}

export function useBarang() {
  const ctx = useContext(BarangContext);
  if (!ctx) throw new Error("useBarang harus dipakai di dalam BarangProvider");
  return ctx;
}