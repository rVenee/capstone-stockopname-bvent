import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { fetch } from "expo/fetch";
import { API_URL, ApiError, getToken } from "./api";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Mengubah sebuah tabel menjadi berkas Excel (.xlsx) lewat server, lalu membuka lembar bagikan
 * (WhatsApp, Drive, email, dll.). Dipakai mis. untuk hasil Rekomendasi Restock.
 */
export async function bagikanExcel(nama: string, kepala: string[], baris: (string | number)[][]) {
  if (!API_URL) throw new ApiError("Alamat server belum diatur.");

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${API_URL}/ekspor/tabel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken() ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nama, kepala, baris, format: "xlsx" }),
    });
  } catch (e: any) {
    throw new ApiError(`Gagal membuat file (${e?.message ?? "koneksi terputus"}).`);
  }
  if (!res.ok) {
    let pesan = `Gagal membuat file (${res.status}).`;
    try {
      const d = (await res.json())?.detail;
      if (typeof d === "string") pesan = d;
    } catch {
      // bukan JSON
    }
    throw new ApiError(pesan, res.status);
  }

  const berkas = new File(Paths.cache, `${nama}.xlsx`);
  if (berkas.exists) berkas.delete();
  berkas.create();
  berkas.write(new Uint8Array(await res.arrayBuffer()));

  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError("Fitur bagikan tidak tersedia di perangkat ini.");
  }
  await Sharing.shareAsync(berkas.uri, { mimeType: XLSX, dialogTitle: nama });
}