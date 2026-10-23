import { Barang } from "./barang";

const HARI_MS = 86400000;
export const MAX_HARI = 30;

// Parameter simulasi penjualan harian per id barang (nanti diganti data transaksi asli)
const BASE: Record<string, number> = { "1": 2.0, "2": 2.0, "3": 0.45, "4": 0.4, "5": 1.0, "6": 1.2, "7": 0.5, "8": 0.5 };
const GROWTH: Record<string, number> = { "1": 0.25, "2": 0.2, "3": 0.15 };
const DEFAULT_BASE = 0.5;
const DEFAULT_GROWTH = 0.05;

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function tanggalDepan(hari: number) {
  const d = new Date(Date.now() + hari * HARI_MS);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
}

function acak(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function seedDari(id: string) {
  let s = 0;
  for (const c of id) s = (s * 31 + c.charCodeAt(0)) % 10007;
  return s;
}

const rata = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

/** Penjualan harian 30 hari terakhir (indeks terakhir = hari ini). */
export function penjualanHarian(b: Barang): number[] {
  const base = BASE[b.id] ?? DEFAULT_BASE;
  const g = GROWTH[b.id] ?? DEFAULT_GROWTH;
  const seed = seedDari(b.id);
  return Array.from({ length: MAX_HARI }, (_, i) => {
    const naik = 1 + g * ((i / (MAX_HARI - 1)) * 2 - 1);
    const noise = 0.7 + acak(seed + i) * 0.6;
    return Math.round(base * naik * noise * 10) / 10;
  });
}

/** Stok akhir tiap hari, disusun mundur dari stok saat ini. */
export function riwayatStok(b: Barang): number[] {
  const s = penjualanHarian(b);
  const out = new Array<number>(MAX_HARI).fill(0);
  out[MAX_HARI - 1] = b.stok;
  for (let i = MAX_HARI - 1; i > 0; i--) out[i - 1] = out[i] + s[i];
  return out.map((v) => Math.round(v * 10) / 10);
}

export type Status = {
  label: string;
  variant: "danger" | "warning" | "success" | "info";
  urut: number;
};

export type Analisis = {
  barang: Barang;
  hari: number;
  rata: number;
  trenPersen: number;
  hariHabis: number | null;
  hariMin: number | null;
  stokAkhir: number;
  riwayat: number[];
  prediksi: { mid: number; low: number; high: number }[];
  status: Status;
};

function tentukanStatus(b: Barang, hariMin: number | null): Status {
  if (b.stok < b.stokMin) return { label: "Restock", variant: "danger", urut: 0 };
  if (hariMin !== null && hariMin <= 7) return { label: "Segera", variant: "warning", urut: 1 };
  if (hariMin !== null && hariMin <= 10) return { label: "Pantau", variant: "info", urut: 2 };
  return { label: "Aman", variant: "success", urut: 3 };
}

export function analisis(b: Barang, hari: number): Analisis {
  const sales = penjualanHarian(b);
  const win = sales.slice(-hari);
  const r = rata(win);
  const last7 = rata(sales.slice(-7));
  const prev7 = rata(sales.slice(-14, -7));
  const trenPersen = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;
  const sd = Math.sqrt(rata(win.map((x) => (x - r) ** 2)));

  const hariHabis = r > 0 ? b.stok / r : null;
  const hariMin = r > 0 ? (b.stok - b.stokMin) / r : null;

  const prediksi = Array.from({ length: hari }, (_, k) => {
    const h = k + 1;
    const mid = Math.max(0, b.stok - r * h);
    const d = sd * Math.sqrt(h);
    return { mid, low: Math.max(0, mid - d), high: Math.min(b.stok, mid + d) };
  });

  return {
    barang: b,
    hari,
    rata: r,
    trenPersen,
    hariHabis,
    hariMin,
    stokAkhir: prediksi[prediksi.length - 1]?.mid ?? b.stok,
    riwayat: riwayatStok(b).slice(-hari),
    prediksi,
    status: tentukanStatus(b, hariMin),
  };
}

export function ringkasan(items: Barang[], hari: number) {
  const daftar = items.map((b) => analisis(b, hari));
  return {
    daftar,
    akanHabis: daftar.filter((a) => a.hariHabis !== null && a.hariHabis < 7).length,
    menipis: daftar.filter((a) => a.status.urut <= 1).length,
    total: items.length,
  };
}

export function penjelasan(a: Analisis) {
  const b = a.barang;
  const arah = a.trenPersen >= 5 ? "naik" : a.trenPersen <= -5 ? "turun" : "relatif stabil";
  const detail =
    Math.abs(a.trenPersen) >= 5
      ? `, ${a.trenPersen > 0 ? "+" : ""}${a.trenPersen}% dibanding 7 hari sebelumnya`
      : "";
  let sisa: string;
  if (b.stok < b.stokMin) {
    sisa = "stok saat ini sudah di bawah minimum, sebaiknya segera restock";
  } else if (a.hariMin !== null && a.hariMin <= 60) {
    sisa = `stok diperkirakan menyentuh minimum pada ${tanggalDepan(Math.ceil(a.hariMin))}`;
  } else {
    sisa = "stok diperkirakan masih aman dalam waktu dekat";
  }
  return `Penjualan ${b.nama} ${arah} (rata-rata ±${a.rata.toFixed(1)} ${b.satuan}/hari${detail}); ${sisa}.`;
}

export type Saran = {
  a: Analisis;
  jumlah: number;
  batas: string;
  label: string;
  variant: "danger" | "warning" | "info";
  alasan: string;
};

const bulatkan = (n: number) => (n <= 10 ? Math.max(1, Math.ceil(n)) : Math.ceil(n / 5) * 5);

export function rekomendasi(items: Barang[], hari: number): Saran[] {
  return items
    .map((b) => analisis(b, hari))
    .filter((a) => a.status.urut <= 2)
    .sort((x, y) => x.status.urut - y.status.urut)
    .map((a) => {
      const b = a.barang;
      // target: cukup untuk 14 hari ke depan + stok minimum
      const jumlah = bulatkan(a.rata * 14 + b.stokMin - b.stok);
      const naikTurun =
        Math.abs(a.trenPersen) >= 5
          ? `; tren ${a.trenPersen > 0 ? "naik" : "turun"} ${Math.abs(a.trenPersen)}%`
          : "";

      if (a.status.urut === 0) {
        const hh = a.hariHabis !== null ? Math.max(1, Math.ceil(a.hariHabis)) : null;
        const hariBatas = Math.min(2, Math.max(1, Math.floor(a.hariHabis ?? 1)));
        return {
          a, jumlah, batas: tanggalDepan(hariBatas), label: "Mendesak", variant: "danger" as const,
          alasan: `Stok ${b.stok} sudah di bawah minimum (${b.stokMin})${hh ? `; diprediksi habis dalam ${hh} hari` : ""}${naikTurun}.`,
        };
      }
      const hm = Math.max(1, Math.floor(a.hariMin ?? 1));
      if (a.status.urut === 1) {
        return {
          a, jumlah, batas: tanggalDepan(hm), label: "Segera", variant: "warning" as const,
          alasan: `Diprediksi menyentuh stok minimum dalam ${Math.ceil(a.hariMin ?? 1)} hari; rata-rata keluar ±${a.rata.toFixed(1)} ${b.satuan}/hari${naikTurun}.`,
        };
      }
      return {
        a, jumlah, batas: tanggalDepan(hm), label: "Pantau", variant: "info" as const,
        alasan: `Stok masih aman, namun diperkirakan menyentuh minimum dalam ${Math.ceil(a.hariMin ?? 1)} hari${naikTurun}.`,
      };
    });
}