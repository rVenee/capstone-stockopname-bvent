import { useEffect, useSyncExternalStore } from "react";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { useUser } from "../data/UserContext";
import { API_URL, ApiError, getToken, request } from "./api";

// Foto profil disimpan sekali di sini, supaya Profil, Edit Profil, dan Home selalu menampilkan foto yang sama.
type Keadaan = { userId: string; nama: string | null; siap: boolean };

let keadaan: Keadaan = { userId: "", nama: null, siap: false };
const pendengar = new Set<() => void>();
const ubah = (k: Keadaan) => {
  keadaan = k;
  pendengar.forEach((f) => f());
};

/** Foto profil pengguna yang sedang login (dimuat otomatis sekali per login). */
export function useFotoProfil(): Keadaan {
  const { user } = useUser();
  const k = useSyncExternalStore(
    (f) => {
      pendengar.add(f);
      return () => {
        pendengar.delete(f);
      };
    },
    () => keadaan
  );

  useEffect(() => {
    if (!user.id) {
      if (keadaan.userId) ubah({ userId: "", nama: null, siap: false });
      return;
    }
    if (keadaan.userId === user.id) return;
    ubah({ userId: user.id, nama: null, siap: false });
    request<{ nama: string | null }>("/profil/foto")
      .then((d) => {
        if (keadaan.userId === user.id) ubah({ userId: user.id, nama: d.nama, siap: true });
      })
      .catch(() => {
        if (keadaan.userId === user.id) ubah({ ...keadaan, siap: true });
      });
  }, [user.id]);

  return k;
}

/** Mengunggah foto profil baru (berkas lokal). */
export async function unggahFotoProfil(uri: string) {
  if (!API_URL) throw new ApiError("Alamat server belum diatur.");
  const form = new FormData();
  form.append("file", new File(uri) as any);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${API_URL}/profil/foto`, {
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
  ubah({ ...keadaan, nama: data.nama, siap: true });
}

export async function hapusFotoProfil() {
  const d = await request<{ nama: string | null }>("/profil/foto", { method: "DELETE" });
  ubah({ ...keadaan, nama: d.nama, siap: true });
}

/** Sumber gambar untuk komponen Image (foto hanya bisa dibuka dengan token login). */
export function fotoProfilSource(nama?: string | null) {
  if (!nama || !API_URL) return null;
  return { uri: `${API_URL}/profil/foto/${nama}`, headers: { Authorization: `Bearer ${getToken() ?? ""}` } };
}