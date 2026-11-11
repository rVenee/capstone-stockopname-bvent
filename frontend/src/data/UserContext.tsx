import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  api, ApiError, ApiUser, bacaTokenAman, setOnTidakSah, setToken, simpanTokenAman,
} from "../services/api";

export type Peran = "leader" | "admin" | "staff";

export type User = {
  id: string;
  nama: string;
  email: string;
  telepon: string;
  peran: Peran | "";
  perusahaan: string;
};

// Hak akses berdasarkan peran. Backend tetap menjadi penentu akhir.
export type Izin = {
  kelolaBarang: boolean; // tambah, ubah, hapus barang
  terapkanOpname: boolean; // menerapkan hasil opname ke stok
  kelolaPengguna: boolean; // melihat dan mengelola akun
  kelolaData: boolean; // impor data dan edit/hapus transaksi (tahap berikutnya)
  resetData: boolean; // hapus seluruh data (tahap berikutnya)
};

const izinDari = (peran: string): Izin => {
  const pengelola = peran === "leader" || peran === "admin";
  return {
    kelolaBarang: pengelola,
    terapkanOpname: pengelola,
    kelolaPengguna: pengelola,
    kelolaData: pengelola,
    resetData: peran === "leader",
  };
};

export const labelPeran = (p: string) =>
  p === "leader" ? "Leader" : p === "admin" ? "Admin" : p === "staff" ? "Staff" : "";

const kosong: User = { id: "", nama: "", email: "", telepon: "", peran: "", perusahaan: "" };

const keUser = (u: ApiUser): User => ({
  id: u.id,
  nama: u.nama,
  email: u.email,
  telepon: u.telepon,
  peran: u.peran as Peran,
  perusahaan: u.perusahaan,
});

type Ctx = {
  user: User;
  izin: Izin;
  masuk: boolean; // sudah login
  siap: boolean; // pengecekan sesi tersimpan sudah selesai
  login: (email: string, password: string, kodePerusahaan: string) => Promise<void>;
  logout: () => void;
  simpanProfil: (b: { nama: string; email: string; telepon: string; passwordBaru?: string }) => Promise<void>;
};

const UserContext = createContext<Ctx | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(kosong);
  const [masuk, setMasuk] = useState(false);
  const [siap, setSiap] = useState(false);

  const keluarLokal = () => {
    setToken(null);
    simpanTokenAman(null);
    setUser(kosong);
    setMasuk(false);
  };

  useEffect(() => {
    // Dipanggil otomatis kalau server menjawab 401 (sesi habis)
    setOnTidakSah(keluarLokal);

    (async () => {
      const t = await bacaTokenAman();
      if (t) {
        setToken(t);
        try {
          const me = await api.me();
          setUser(keUser(me));
          setMasuk(true);
        } catch (e) {
          setToken(null);
          if (e instanceof ApiError && e.status === 401) await simpanTokenAman(null);
        }
      }
      setSiap(true);
    })();

    return () => setOnTidakSah(null);
  }, []);

  const value: Ctx = {
    user,
    izin: izinDari(user.peran),
    masuk,
    siap,
    login: async (email, password, kode) => {
      const res = await api.login(email.trim(), password, kode.trim());
      setToken(res.token);
      await simpanTokenAman(res.token);
      setUser(keUser(res.user));
      setMasuk(true);
    },
    logout: keluarLokal,
    simpanProfil: async (b) => {
      const res = await api.ubahProfil(b);
      setUser(keUser(res));
    },
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser harus dipakai di dalam UserProvider");
  return ctx;
}

export const namaDepan = (nama: string) => nama.trim().split(/\s+/)[0] ?? "";