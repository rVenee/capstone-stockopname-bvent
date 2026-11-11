export type Jenis = "masuk" | "keluar" | "opname";

export type Transaksi = {
  id: string;
  barangId: string;
  nama: string;
  emoji: string;
  gambar?: string | null;
  satuan: string;
  jenis: Jenis;
  jumlah: number;
  stokSebelum: number | null;
  stokSesudah: number | null;
  catatan: string;
  waktu: number;
  oleh?: string;
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