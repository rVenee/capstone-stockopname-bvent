export type Barang = {
  id: string;
  nama: string;
  kode: string;
  kategori: string;
  lokasi: string;
  satuan: string;
  stok: number;
  stokMin: number;
  harga: number;
  emoji: string; // ikon cadangan kalau barang belum punya foto
  gambar?: string | null; // nama berkas foto di server
  pemasok?: string;
  kedaluwarsa?: string | null; // YYYY-MM-DD
  jumlahPesanUlang?: number | null;
};

// Pilihan ikon cadangan (dipakai kalau barang belum punya foto)
export const EMOJI = ["📦", "🍚", "🥛", "🥚", "🛢️", "🍜", "🍬", "🍵", "☕", "🧼", "🥬", "🐟", "🍞", "🧃"];

export type StatusInfo = { label: string; variant: "danger" | "warning" | "success" };

export function getStatus(b: Barang): StatusInfo {
  if (b.stok < b.stokMin) return { label: "Di bawah min", variant: "danger" };
  if (b.stok <= Math.ceil(b.stokMin * 1.25)) return { label: "Menipis", variant: "warning" };
  return { label: "Aman", variant: "success" };
}

export function formatRupiah(n: number) {
  return "Rp " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "2026-12-31" -> "31-12-2026" */
export function formatTanggal(iso?: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}-${m}-${y}` : iso;
}

/** "31-12-2026" atau "2026-12-31" -> "2026-12-31"; teks kosong -> null; tidak valid -> undefined */
export function keTanggalIso(teks: string): string | null | undefined {
  const t = teks.trim();
  if (!t) return null;
  let y: string, m: string, d: string;
  let cocok = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (cocok) [, y, m, d] = cocok;
  else {
    cocok = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!cocok) return undefined;
    [, d, m, y] = cocok;
  }
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (dt.getFullYear() !== Number(y) || dt.getMonth() !== Number(m) - 1 || dt.getDate() !== Number(d)) {
    return undefined;
  }
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}