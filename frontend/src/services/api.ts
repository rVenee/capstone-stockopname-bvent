import * as SecureStore from "expo-secure-store";
import type { Barang } from "../data/barang";
import type { SesiOpname } from "../data/opname";
import type { Transaksi } from "../data/transaksi";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

const KUNCI_TOKEN = "stock_opname_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

// ------------------------------------------------------------ token

let token: string | null = null;
let onTidakSah: (() => void) | null = null;

export const setToken = (t: string | null) => {
  token = t;
};
export const getToken = () => token;
export const setOnTidakSah = (fn: (() => void) | null) => {
  onTidakSah = fn;
};

export async function simpanTokenAman(t: string | null) {
  try {
    if (t) await SecureStore.setItemAsync(KUNCI_TOKEN, t);
    else await SecureStore.deleteItemAsync(KUNCI_TOKEN);
  } catch {
    // penyimpanan aman tidak tersedia: abaikan, login akan diminta lagi
  }
}

export async function bacaTokenAman(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KUNCI_TOKEN);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ permintaan

function pesanGalat(data: any, status: number): string {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    const teks = d.map((x: any) => x?.msg ?? "").filter(Boolean).join("; ");
    if (teks) return teks;
  }
  return `Terjadi kesalahan (${status}).`;
}

// timeout (milidetik) opsional: permintaan yang lama seperti impor data memakai batas lebih besar
type Opsi = { method?: string; body?: unknown; auth?: boolean; timeout?: number };

export async function request<T>(path: string, opsi: Opsi = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "Alamat server belum diatur. Isi EXPO_PUBLIC_API_URL di file .env, lalu jalankan ulang dengan 'npx expo start --tunnel -c'."
    );
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opsi.body !== undefined) headers["Content-Type"] = "application/json";
  if (opsi.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opsi.timeout ?? 15000);

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opsi.method ?? "GET",
      headers,
      body: opsi.body !== undefined ? JSON.stringify(opsi.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      "Tidak dapat terhubung ke server. Pastikan backend berjalan dan HP bisa menjangkau alamatnya."
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // tubuh respons kosong atau bukan JSON
  }

  if (!res.ok) {
    if (res.status === 401 && opsi.auth !== false && onTidakSah) onTidakSah();
    throw new ApiError(pesanGalat(data, res.status), res.status);
  }
  return data as T;
}

// ------------------------------------------------------------ tipe jawaban API

export type ApiUser = {
  id: string;
  nama: string;
  email: string;
  telepon: string;
  peran: string;
  perusahaan: string;
};

export type Varian = "danger" | "warning" | "success" | "info";

export type TrenStatus = { label: string; variant: Varian; urut: number };

export type TrenItem = {
  barang: Barang;
  hari: number;
  rata: number;
  trenPersen: number;
  hariHabis: number | null;
  hariMin: number | null;
  stokAkhir: number;
  status: TrenStatus;
  riwayat?: number[] | null;
  prediksi?: { mid: number; low: number; high: number }[] | null;
  penjelasan?: string | null;
};

export type TrenRingkasan = {
  akanHabis: number;
  menipis: number;
  total: number;
  daftar: TrenItem[];
};

export type Saran = {
  barang: Barang;
  jumlah: number;
  batas: string;
  label: string;
  variant: Varian;
  alasan: string;
  rata: number;
};

// ------------------------------------------------------------ fungsi API

export const api = {
  login: (email: string, password: string, kodePerusahaan: string) =>
    request<{ token: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      body: { email, password, kodePerusahaan },
      auth: false,
    }),
  me: () => request<ApiUser>("/auth/me"),
  ubahProfil: (b: { nama: string; email: string; telepon: string; passwordBaru?: string }) =>
    request<ApiUser>("/auth/me", { method: "PUT", body: b }),

  barang: () => request<Barang[]>("/barang"),
  tambahBarang: (b: Omit<Barang, "id">) => request<Barang>("/barang", { method: "POST", body: b }),
  ubahBarang: (id: string, b: Omit<Barang, "id">) =>
    request<Barang>(`/barang/${id}`, { method: "PUT", body: b }),
  hapusBarang: (id: string) => request<void>(`/barang/${id}`, { method: "DELETE" }),

  transaksi: (limit = 500) => request<Transaksi[]>(`/transaksi?limit=${limit}`),
  catat: (barangId: string, jenis: "masuk" | "keluar", jumlah: number, catatan: string) =>
    request<Transaksi>("/transaksi", {
      method: "POST",
      body: { barangId: Number(barangId), jenis, jumlah, catatan },
    }),
  
  ubahTransaksi: (id: string, b: { jenis: "masuk" | "keluar"; jumlah: number; catatan: string }) =>
  request<Transaksi>(`/transaksi/${id}`, { method: "PUT", body: b }),
  hapusTransaksi: (id: string) => request<void>(`/transaksi/${id}`, { method: "DELETE" }),

  opnameMulai: () => request<{ id: string }>("/opname/mulai", { method: "POST" }),
  opnameDraft: () => request<{ nilai: Record<string, number> }>("/opname/draft"),
  opnameIsi: (barangId: string, fisik: number | null) =>
    request<unknown>(`/opname/draft/${barangId}`, { method: "PUT", body: { fisik } }),
  opnameTerapkan: (catatan: string) =>
    request<SesiOpname>("/opname/terapkan", { method: "POST", body: { catatan } }),
  opnameSesi: () => request<SesiOpname[]>("/opname/sesi"),

  tren: (hari: number) => request<TrenRingkasan>(`/tren?hari=${hari}`),
  trenBarang: (id: string, hari: number) => request<TrenItem>(`/tren/${id}?hari=${hari}`),
  rekomendasi: (hari: number) => request<Saran[]>(`/rekomendasi?hari=${hari}`),
};