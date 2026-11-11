import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import type { Barang } from "../data/barang";
import { API_URL, ApiError, getToken, request } from "./api";

export type SumberFoto = "kamera" | "galeri";

const UKURAN_MAKS = 1000; // sisi terpanjang foto setelah diperkecil (piksel)

/**
 * Mengambil foto dari kamera atau galeri, dipotong persegi lewat editor bawaan,
 * lalu diperkecil dan dikompres menjadi JPEG supaya cepat diunggah.
 * Mengembalikan alamat berkas lokal, atau null kalau dibatalkan.
 */
export async function pilihFoto(sumber: SumberFoto): Promise<string | null> {
  if (sumber === "kamera") {
    const izin = await ImagePicker.requestCameraPermissionsAsync();
    if (!izin.granted) {
      throw new ApiError("Izin kamera diperlukan untuk mengambil foto. Aktifkan di pengaturan aplikasi.");
    }
  }

  const hasil =
    sumber === "kamera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });

  if (hasil.canceled || !hasil.assets || hasil.assets.length === 0) return null;
  const aset = hasil.assets[0];

  try {
    const ctx = ImageManipulator.manipulate(aset.uri);
    if (aset.width > UKURAN_MAKS || aset.height > UKURAN_MAKS) {
      ctx.resize(aset.width >= aset.height ? { width: UKURAN_MAKS } : { height: UKURAN_MAKS });
    }
    const gambar = await ctx.renderAsync();
    const hasilSimpan = await gambar.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return hasilSimpan.uri;
  } catch {
    // kalau pengecilan gagal, pakai foto aslinya
    return aset.uri;
  }
}

/** Mengunggah foto (berkas lokal) untuk satu barang. */
export async function unggahFoto(barangId: string, uri: string): Promise<Barang> {
  if (!API_URL) throw new ApiError("Alamat server belum diatur.");

  // Di Expo SDK terbaru, berkas dikirim sebagai objek File (bukan { uri, name, type } seperti dulu)
  const form = new FormData();
  form.append("file", new File(uri) as any);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${API_URL}/barang/${barangId}/foto`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken() ?? ""}`, Accept: "application/json" },
      body: form as any,
      signal: controller.signal,
    });
  } catch (e: any) {
    throw new ApiError(`Foto gagal diunggah (${e?.message ?? "koneksi terputus"}).`);
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // tubuh respons kosong
  }
  if (!res.ok) {
    const d = data?.detail;
    throw new ApiError(typeof d === "string" ? d : `Foto gagal diunggah (${res.status}).`, res.status);
  }
  return data as Barang;
}

export const hapusFoto = (barangId: string) =>
  request<Barang>(`/barang/${barangId}/foto`, { method: "DELETE" });

/** Sumber gambar untuk komponen Image (foto hanya bisa dibuka dengan token login). */
export function fotoSource(nama?: string | null) {
  if (!nama || !API_URL) return null;
  return { uri: `${API_URL}/foto/${nama}`, headers: { Authorization: `Bearer ${getToken() ?? ""}` } };
}