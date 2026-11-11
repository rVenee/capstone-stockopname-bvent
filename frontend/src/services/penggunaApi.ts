import { request } from "./api";
import type { Peran } from "../data/UserContext";

export type PenggunaItem = {
  id: string;
  nama: string;
  email: string;
  telepon: string;
  peran: Peran;
  aktif: boolean;
  bisaDiubah: boolean;
};

export type PenggunaBaru = {
  nama: string;
  email: string;
  telepon: string;
  password: string;
  peran: Peran;
};

export type PenggunaUbah = {
  nama: string;
  email: string;
  telepon: string;
  peran: Peran;
  aktif: boolean;
  passwordBaru?: string;
};

export const penggunaApi = {
  daftar: () => request<PenggunaItem[]>("/pengguna"),
  tambah: (b: PenggunaBaru) => request<PenggunaItem>("/pengguna", { method: "POST", body: b }),
  ubah: (id: string, b: PenggunaUbah) =>
    request<PenggunaItem>(`/pengguna/${id}`, { method: "PUT", body: b }),
  nonaktifkan: (id: string) => request<void>(`/pengguna/${id}`, { method: "DELETE" }),
};