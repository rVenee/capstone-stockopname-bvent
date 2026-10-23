export type Jenis = "masuk" | "keluar" | "opname";

export type Transaksi = {
  id: string;
  barangId: string;
  nama: string;
  emoji: string;
  satuan: string;
  jenis: Jenis;
  jumlah: number;
  stokSebelum: number;
  stokSesudah: number;
  catatan: string;
  waktu: number;
};

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const pad = (n: number) => String(n).padStart(2, "0");

export function formatJam(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatWaktu(ts: number) {
  const d = new Date(ts);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${formatJam(ts)}`;
}

export function ringkasTransaksi(t: Transaksi) {
  const aksi =
    t.jenis === "masuk"
      ? `ditambah ${t.jumlah} unit`
      : t.jenis === "keluar"
      ? `dikurangi ${t.jumlah} unit`
      : "disesuaikan (opname)";
  return `[${formatJam(t.waktu)}] ${t.nama} ${aksi}`;
}

const menitLalu = (m: number) => Date.now() - m * 60000;

export const initialTransaksi: Transaksi[] = [
  { id: "t1", barangId: "4", nama: "Minyak Goreng", emoji: "🛢️", satuan: "liter", jenis: "keluar", jumlah: 1, stokSebelum: 16, stokSesudah: 15, catatan: "", waktu: menitLalu(20) },
  { id: "t2", barangId: "1", nama: "Beras", emoji: "🍚", satuan: "kg", jenis: "keluar", jumlah: 5, stokSebelum: 20, stokSesudah: 15, catatan: "Penjualan harian", waktu: menitLalu(180) },
  { id: "t3", barangId: "2", nama: "Susu 1000ml", emoji: "🥛", satuan: "pcs", jenis: "masuk", jumlah: 10, stokSebelum: 15, stokSesudah: 25, catatan: "Kiriman supplier", waktu: menitLalu(60 * 24) },
  { id: "t4", barangId: "5", nama: "Mi Instan", emoji: "🍜", satuan: "pcs", jenis: "keluar", jumlah: 4, stokSebelum: 10, stokSesudah: 6, catatan: "", waktu: menitLalu(60 * 26) },
  { id: "t5", barangId: "6", nama: "Gula", emoji: "🍬", satuan: "kg", jenis: "keluar", jumlah: 7, stokSebelum: 15, stokSesudah: 8, catatan: "", waktu: menitLalu(60 * 50) },
  { id: "t6", barangId: "3", nama: "Telur", emoji: "🥚", satuan: "tray", jenis: "masuk", jumlah: 10, stokSebelum: 15, stokSesudah: 25, catatan: "Restock mingguan", waktu: menitLalu(60 * 72) },
];