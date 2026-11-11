import {
  createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { AppState } from "react-native";
import { api, ApiError, request } from "../services/api";
import { Barang } from "./barang";
import { SesiOpname } from "./opname";
import { Transaksi } from "./transaksi";
import { useUser } from "./UserContext";

export type Hasil = { ok: true } | { ok: false; error: string };
export type HasilBarang = { ok: true; barang: Barang } | { ok: false; error: string };
type HasilOpname = { ok: true; sesi: SesiOpname } | { ok: false; error: string };

const pesan = (e: unknown) =>
  e instanceof ApiError ? e.message : "Terjadi kesalahan tak terduga.";

type Ctx = {
  items: Barang[];
  transaksi: Transaksi[];
  sesi: SesiOpname[];
  draft: Record<string, string>;
  kategori: string[]; // kategori yang dipakai perusahaan ini
  satuan: string[]; // satuan yang dipakai perusahaan ini + satuan umum
  dataSiap: boolean;
  memuat: boolean;
  galat: string | null;
  refresh: () => Promise<void>;
  segarkan: () => Promise<void>; // muat ulang barang dan riwayat (ringan)
  getById: (id: string) => Barang | undefined;
  tambah: (b: Omit<Barang, "id">) => Promise<HasilBarang>;
  ubah: (id: string, b: Omit<Barang, "id">) => Promise<HasilBarang>;
  hapus: (id: string) => Promise<Hasil>;
  catat: (barangId: string, jenis: "masuk" | "keluar", jumlah: number, catatan: string) => Promise<Hasil>;
  setDraftNilai: (barangId: string, nilai: string) => void;
  mulaiOpname: () => Promise<Hasil>;
  terapkanOpname: (catatan: string) => Promise<HasilOpname>;
};

const BarangContext = createContext<Ctx | null>(null);

export function BarangProvider({ children }: { children: ReactNode }) {
  const { masuk } = useUser();
  const [items, setItems] = useState<Barang[]>([]);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [sesi, setSesi] = useState<SesiOpname[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [kategori, setKategori] = useState<string[]>([]);
  const [satuan, setSatuan] = useState<string[]>([]);
  const [dataSiap, setDataSiap] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const tertunda = useRef<Record<string, string>>({});

  // Memuat ulang data (tanpa menyentuh draf opname yang sedang diketik)
  const muatData = useCallback(async () => {
    try {
      const [b, t, s, k, st] = await Promise.all([
        api.barang(),
        api.transaksi(),
        api.opnameSesi(),
        request<string[]>("/kategori"),
        request<string[]>("/satuan"),
      ]);
      setItems(b);
      setTransaksi(t);
      setSesi(s);
      setKategori(k);
      setSatuan(st);
      setGalat(null);
    } catch (e) {
      setGalat(pesan(e));
    }
  }, []);

  // Memuat semuanya, termasuk draf opname yang tersimpan di server
  const muatSemua = useCallback(async () => {
    setMemuat(true);
    try {
      const [b, t, s, d, k, st] = await Promise.all([
        api.barang(),
        api.transaksi(),
        api.opnameSesi(),
        api.opnameDraft(),
        request<string[]>("/kategori"),
        request<string[]>("/satuan"),
      ]);
      setItems(b);
      setTransaksi(t);
      setSesi(s);
      setKategori(k);
      setSatuan(st);
      setDraft(Object.fromEntries(Object.entries(d.nilai).map(([key, v]) => [key, String(v)])));
      setGalat(null);
    } catch (e) {
      setGalat(pesan(e));
    } finally {
      setMemuat(false);
      setDataSiap(true);
    }
  }, []);

  // Muat saat login, kosongkan saat logout
  useEffect(() => {
    if (masuk) {
      muatSemua();
    } else {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
      tertunda.current = {};
      setItems([]);
      setTransaksi([]);
      setSesi([]);
      setDraft({});
      setKategori([]);
      setSatuan([]);
      setDataSiap(false);
      setGalat(null);
    }
  }, [masuk, muatSemua]);

  // Segarkan data saat aplikasi dibuka kembali dari latar belakang
  useEffect(() => {
    if (!masuk) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") muatData();
    });
    return () => sub.remove();
  }, [masuk, muatData]);

  const kirimDraft = async (id: string, nilai: string) => {
    const v = nilai.trim();
    try {
      await api.opnameIsi(id, v === "" ? null : Number(v));
    } catch (e) {
      setGalat(pesan(e));
    }
  };

  const flushDraft = async () => {
    const ids = Object.keys(tertunda.current);
    for (const id of ids) {
      clearTimeout(timers.current[id]);
      const n = tertunda.current[id];
      delete timers.current[id];
      delete tertunda.current[id];
      if (n !== undefined) await kirimDraft(id, n);
    }
  };

  const jalankan = async (fn: () => Promise<unknown>): Promise<Hasil> => {
    try {
      await fn();
      await muatData();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: pesan(e) };
    }
  };

  const value: Ctx = {
    items,
    transaksi,
    sesi,
    draft,
    kategori,
    satuan,
    dataSiap,
    memuat,
    galat,
    refresh: async () => {
      await flushDraft();
      await muatSemua();
    },
    segarkan: muatData,
    getById: (id) => items.find((b) => b.id === id),

    tambah: async (b) => {
      try {
        const baru = await api.tambahBarang(b);
        await muatData();
        return { ok: true, barang: baru };
      } catch (e) {
        return { ok: false, error: pesan(e) };
      }
    },
    ubah: async (id, b) => {
      try {
        const baru = await api.ubahBarang(id, b);
        await muatData();
        return { ok: true, barang: baru };
      } catch (e) {
        return { ok: false, error: pesan(e) };
      }
    },
    hapus: (id) =>
      jalankan(async () => {
        await api.hapusBarang(id);
        setDraft((prev) => {
          const { [id]: _hapus, ...sisa } = prev;
          return sisa;
        });
      }),
    catat: (barangId, jenis, jumlah, catatan) =>
      jalankan(() => api.catat(barangId, jenis, jumlah, catatan)),

    setDraftNilai: (id, nilai) => {
      setDraft((prev) => ({ ...prev, [id]: nilai }));
      tertunda.current[id] = nilai;
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => {
        const n = tertunda.current[id];
        delete tertunda.current[id];
        delete timers.current[id];
        if (n !== undefined) kirimDraft(id, n);
      }, 600);
    },

    mulaiOpname: async () => {
      try {
        Object.values(timers.current).forEach(clearTimeout);
        timers.current = {};
        tertunda.current = {};
        await api.opnameMulai();
        setDraft({});
        return { ok: true };
      } catch (e) {
        return { ok: false, error: pesan(e) };
      }
    },

    terapkanOpname: async (catatan) => {
      try {
        await flushDraft();
        const sesiBaru = await api.opnameTerapkan(catatan);
        setDraft({});
        await muatData();
        return { ok: true, sesi: sesiBaru };
      } catch (e) {
        return { ok: false, error: pesan(e) };
      }
    },
  };

  return <BarangContext.Provider value={value}>{children}</BarangContext.Provider>;
}

export function useBarang() {
  const ctx = useContext(BarangContext);
  if (!ctx) throw new Error("useBarang harus dipakai di dalam BarangProvider");
  return ctx;
}