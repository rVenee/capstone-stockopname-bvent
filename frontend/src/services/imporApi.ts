import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { fetch } from "expo/fetch";
import { API_URL, ApiError, getToken, request } from "./api";

// ------------------------------------------------------------ tipe

export type Jenis = "barang" | "riwayat";
export type Bidang = { key: string; label: string; wajib: boolean };

export type BacaHasil = {
  berkasId: string;
  nama: string;
  jumlahBaris: number;
  kolom: string[];
  contoh: string[][];
  jenisSaran: Jenis;
  saran: Record<Jenis, Record<string, string | null>>;
  bidang: Record<Jenis, Bidang[]>;
};

export type OpsiImpor = {
  kurs: number;
  lewatiNonaktif: boolean;
  urutanTanggal: "auto" | "hari-bulan" | "bulan-hari";
  jenisBawaan: "masuk" | "keluar";
  simulasi: boolean;
  hariSimulasi: number;
};

export type HasilImpor = {
  jenis: Jenis;
  totalBaris: number;
  valid: number;
  baru: number;
  diperbarui: number;
  dilewati: number;
  jumlahError: number;
  error: { baris: number; pesan: string }[];
  peringatan: string[];
  contoh: Record<string, any>[];
  simulasi: number;
  batchId: string | null;
};

export type PaketImpor = {
  id: string;
  jenis: "barang" | "riwayat" | "simulasi";
  namaFile: string;
  jumlahBaris: number;
  ringkasan: string;
  dibuat: number;
  dibatalkan: boolean;
  bisaDibatalkan: boolean;
};

// ------------------------------------------------------------ memilih & membaca berkas

/** Membuka pemilih berkas (CSV atau Excel). Mengembalikan null kalau dibatalkan. */
export async function pilihBerkas(): Promise<{ uri: string; nama: string } | null> {
  const hasil = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (hasil.canceled || !hasil.assets || hasil.assets.length === 0) return null;
  const aset = hasil.assets[0];
  if (!/\.(csv|txt|tsv|xlsx)$/i.test(aset.name)) {
    throw new ApiError("Format file tidak didukung. Pilih file CSV (.csv) atau Excel (.xlsx).");
  }
  return { uri: aset.uri, nama: aset.name };
}

/** Mengunggah berkas ke server untuk dibaca (kolom, contoh isi, dan tebakan pemetaan). */
/** Mengunggah berkas ke server untuk dibaca (kolom, contoh isi, dan tebakan pemetaan). */
export function bacaBerkas(uri: string, nama: string): Promise<BacaHasil> {
  if (!API_URL) return Promise.reject(new ApiError("Alamat server belum diatur."));

  // sehingga tidak terkena batas izin baca milik expo-file-system di Expo Go.
  const form = new FormData();
  const mime = /\.xlsx$/i.test(nama)
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  form.append("file", { uri, name: nama, type: mime } as any);

  return new Promise<BacaHasil>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/impor/baca`);
    xhr.setRequestHeader("Authorization", `Bearer ${getToken() ?? ""}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.timeout = 120000;
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // tubuh respons kosong atau bukan JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as BacaHasil);
      } else {
        const d = data?.detail;
        reject(new ApiError(typeof d === "string" ? d : `File gagal dibaca (${xhr.status}).`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("File gagal diunggah. Periksa koneksi ke server."));
    xhr.ontimeout = () => reject(new ApiError("File gagal diunggah: waktu habis."));
    xhr.send(form);
  });
}

// ------------------------------------------------------------ pratinjau, terapkan, paket

type Badan = {
  berkasId: string;
  namaFile: string;
  jenis: Jenis;
  pemetaan: Record<string, string | null>;
  opsi: OpsiImpor;
};

export const pratinjauImpor = (b: Badan) =>
  request<HasilImpor>("/impor/pratinjau", { method: "POST", body: b, timeout: 180000 });

export const terapkanImpor = (b: Badan) =>
  request<HasilImpor>("/impor/terapkan", { method: "POST", body: b, timeout: 300000 });

export const daftarPaket = () => request<PaketImpor[]>("/impor/batch");

export const batalkanPaket = (id: string) =>
  request<{ dihapus: number }>(`/impor/batch/${id}`, { method: "DELETE" });

// ------------------------------------------------------------ ekspor & template

const MIME = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Mengunduh berkas dari server, menyimpannya sementara, lalu membuka lembar bagikan (WhatsApp, Drive, dll.). */
export async function unduhDanBagikan(path: string, namaBerkas: string, format: "csv" | "xlsx") {
  if (!API_URL) throw new ApiError("Alamat server belum diatur.");
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(API_URL + path, { headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
  } catch (e: any) {
    throw new ApiError(`Gagal mengunduh (${e?.message ?? "koneksi terputus"}).`);
  }
  if (!res.ok) {
    let pesan = `Gagal mengunduh (${res.status}).`;
    try {
      const d = (await res.json())?.detail;
      if (typeof d === "string") pesan = d;
    } catch {
      // bukan JSON
    }
    throw new ApiError(pesan, res.status);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const berkas = new File(Paths.cache, `${namaBerkas}.${format}`);
  if (berkas.exists) berkas.delete();
  berkas.create();
  berkas.write(bytes);

  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError("Fitur bagikan tidak tersedia di perangkat ini.");
  }
  await Sharing.shareAsync(berkas.uri, { mimeType: MIME[format], dialogTitle: namaBerkas });
}