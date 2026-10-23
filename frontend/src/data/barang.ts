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
  emoji: string;
};

export const KATEGORI = ["Makanan", "Minuman", "Peralatan", "Lainnya"];
export const SATUAN = ["pcs", "kg", "liter", "tray", "pack"];
export const EMOJI = ["🍚", "🥛", "🥚", "🛢️", "🍜", "🍬", "🍵", "☕", "🧼", "📦"];

export const initialBarang: Barang[] = [
  { id: "1", nama: "Beras", kode: "123456789012", kategori: "Makanan", lokasi: "Rak A-1", satuan: "kg", stok: 15, stokMin: 20, harga: 14000, emoji: "🍚" },
  { id: "2", nama: "Susu 1000ml", kode: "987654321098", kategori: "Minuman", lokasi: "Rak A-2", satuan: "pcs", stok: 25, stokMin: 20, harga: 25000, emoji: "🥛" },
  { id: "3", nama: "Telur", kode: "123450987610", kategori: "Makanan", lokasi: "Rak B-1", satuan: "tray", stok: 25, stokMin: 10, harga: 52000, emoji: "🥚" },
  { id: "4", nama: "Minyak Goreng", kode: "123098457610", kategori: "Makanan", lokasi: "Rak B-2", satuan: "liter", stok: 15, stokMin: 10, harga: 18000, emoji: "🛢️" },
  { id: "5", nama: "Mi Instan", kode: "899100100201", kategori: "Makanan", lokasi: "Rak C-1", satuan: "pcs", stok: 6, stokMin: 10, harga: 3500, emoji: "🍜" },
  { id: "6", nama: "Gula", kode: "899100100302", kategori: "Makanan", lokasi: "Rak C-2", satuan: "kg", stok: 8, stokMin: 15, harga: 17000, emoji: "🍬" },
  { id: "7", nama: "Teh Celup", kode: "899100100403", kategori: "Minuman", lokasi: "Rak A-3", satuan: "pack", stok: 30, stokMin: 12, harga: 9000, emoji: "🍵" },
  { id: "8", nama: "Kopi Bubuk", kode: "899100100504", kategori: "Minuman", lokasi: "Rak A-3", satuan: "pack", stok: 14, stokMin: 12, harga: 22000, emoji: "☕" },
];

export type StatusInfo = { label: string; variant: "danger" | "warning" | "success" };

export function getStatus(b: Barang): StatusInfo {
  if (b.stok < b.stokMin) return { label: "Di bawah min", variant: "danger" };
  if (b.stok <= Math.ceil(b.stokMin * 1.25)) return { label: "Menipis", variant: "warning" };
  return { label: "Aman", variant: "success" };
}

export function formatRupiah(n: number) {
  return "Rp " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}