import { Barang } from "../data/barang";
import { Transaksi } from "../data/transaksi";

export type Tabel = {
  headers: string[];
  rows: (string | number)[][];
  merahKolom?: number;
};

export type AIReply = {
  status: "ok" | "ditolak" | "gagal";
  text: string;
  tabel?: Tabel;
  sql?: string;
  csv?: string;
  tindakan?: { key: "rekomendasi" | "csv"; label: string }[];
};

/*
 * NANTI: ganti isi askAI() dengan panggilan ke backend, misalnya:
 *
 *   const res = await fetch(`${API_URL}/nlq`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ pertanyaan }),
 *   });
 *   return (await res.json()) as AIReply;
 *
 * Selama backend mengembalikan JSON berbentuk AIReply, tampilan chat tidak perlu diubah.
 */
export async function askAI(
  pertanyaan: string,
  items: Barang[],
  transaksi: Transaksi[]
): Promise<AIReply> {
  await new Promise((r) => setTimeout(r, 900));
  return jawab(pertanyaan.toLowerCase(), items, transaksi);
}

const HARI = 86400000;

function toCsv(t: Tabel) {
  return [t.headers, ...t.rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

function cariBarang(q: string, items: Barang[]) {
  const tokens = q.split(/[^a-z0-9]+/);
  return items.find((b) => {
    const nama = b.nama.toLowerCase();
    return q.includes(nama) || tokens.includes(nama.split(" ")[0]);
  });
}

function rataKeluarPerHari(b: Barang, transaksi: Transaksi[]) {
  const keluar = transaksi.filter((t) => t.barangId === b.id && t.jenis === "keluar");
  if (keluar.length === 0) return 0;
  const total = keluar.reduce((s, t) => s + t.jumlah, 0);
  const awal = Math.min(...transaksi.map((t) => t.waktu));
  const hari = Math.max(3, (Date.now() - awal) / HARI);
  return total / hari;
}

function jawab(q: string, items: Barang[], transaksi: Transaksi[]): AIReply {
  // 1. Validator keamanan: tolak perintah selain membaca data
  const bahaya = q.match(/\b(hapus|delete|kosongkan|drop|truncate|update|ubah|reset|insert|tambah|tambahkan)\b/);
  if (bahaya) {
    const v = bahaya[1];
    const sql = /hapus|delete|kosongkan/.test(v)
      ? "DELETE FROM barang;"
      : /drop|truncate/.test(v)
      ? "DROP TABLE barang;"
      : /update|ubah|reset/.test(v)
      ? "UPDATE barang SET stok = 0;"
      : "INSERT INTO barang (nama, stok) VALUES (...);";
    return {
      status: "ditolak",
      text:
        "Maaf, saya hanya boleh membaca data (SELECT). Permintaan mengubah atau menghapus data diblokir demi keamanan. Gunakan menu Daftar Barang atau Transaksi Stok untuk mengubah data.",
      sql,
    };
  }

  const b = cariBarang(q, items);

  // 2. Rekomendasi restock
  if (q.includes("rekomendasi") || (/restock/.test(q) && !b)) {
    const rows = items
      .filter((x) => x.stok < x.stokMin)
      .map((x) => [x.nama, x.stok, x.stokMin, `+${x.stokMin * 2 - x.stok} ${x.satuan}`]);
    if (rows.length === 0) {
      return { status: "ok", text: "Semua barang masih di atas stok minimum, belum perlu restock." };
    }
    const tabel: Tabel = { headers: ["Barang", "Stok", "Min", "Saran beli"], rows, merahKolom: 1 };
    return {
      status: "ok",
      text: `Rekomendasi restock untuk ${rows.length} barang (target stok = 2× stok minimum):`,
      tabel,
      sql: "SELECT nama, stok, stok_minimum,\n       (stok_minimum * 2 - stok) AS saran_beli\nFROM barang\nWHERE stok < stok_minimum;",
      csv: toCsv(tabel),
      tindakan: [{ key: "csv", label: "Ekspor CSV" }],
    };
  }

  // 3. Kapan restock barang tertentu
  if (b && /(kapan|restock|habis)/.test(q)) {
    const harian = rataKeluarPerHari(b, transaksi);
    let text: string;
    if (b.stok < b.stokMin) {
      text = `Stok ${b.nama} sudah di bawah minimum (${b.stok} dari ${b.stokMin} ${b.satuan}). Sebaiknya restock sekarang.`;
    } else if (harian <= 0) {
      text = `Belum ada data pengeluaran ${b.nama}, jadi belum bisa diperkirakan. Stok saat ini ${b.stok} ${b.satuan} (minimum ${b.stokMin}).`;
    } else {
      const hari = Math.max(1, Math.floor((b.stok - b.stokMin) / harian));
      text = `Rata-rata ${b.nama} keluar ±${harian.toFixed(1)} ${b.satuan}/hari. Stok ${b.stok} ${b.satuan} diperkirakan menyentuh minimum (${b.stokMin}) sekitar ${hari} hari lagi, jadi restock sebaiknya sebelum itu.`;
    }
    return {
      status: "ok",
      text,
      sql: `SELECT b.nama, b.stok, b.stok_minimum,\n       SUM(t.jumlah) AS total_keluar\nFROM barang b\nLEFT JOIN transaksi t\n  ON t.barang_id = b.id AND t.jenis = 'keluar'\nWHERE b.nama ILIKE '%${b.nama.split(" ")[0]}%'\nGROUP BY b.id;`,
      tindakan: [{ key: "rekomendasi", label: "Rekomendasi restock" }],
    };
  }

  // 4. Info stok barang tertentu
  if (b) {
    return {
      status: "ok",
      text: `Stok ${b.nama} saat ini ${b.stok} ${b.satuan} (minimum ${b.stokMin}), disimpan di ${b.lokasi}.`,
      sql: `SELECT nama, stok, stok_minimum, lokasi\nFROM barang\nWHERE nama ILIKE '%${b.nama.split(" ")[0]}%';`,
    };
  }

  // 5. Di bawah stok minimum
  if (/(di bawah|dibawah|bawah|menipis|minimum|kurang)/.test(q)) {
    const rows = items
      .filter((x) => x.stok < x.stokMin)
      .map((x) => [x.nama, x.stok, x.stokMin]);
    const sql = "SELECT nama, stok, stok_minimum\nFROM barang\nWHERE stok < stok_minimum;";
    if (rows.length === 0) {
      return { status: "ok", text: "Tidak ada barang di bawah stok minimum.", sql };
    }
    const tabel: Tabel = { headers: ["Barang", "Stok", "Min"], rows, merahKolom: 1 };
    return {
      status: "ok",
      text: `Ada ${rows.length} barang di bawah stok minimum:`,
      tabel,
      sql,
      csv: toCsv(tabel),
      tindakan: [
        { key: "rekomendasi", label: "Ya, buatkan rekomendasi" },
        { key: "csv", label: "Ekspor CSV" },
      ],
    };
  }

  // 6. Barang paling laku
  if (/(laku|terjual|terlaris|paling banyak)/.test(q)) {
    const total = new Map<string, { nama: string; satuan: string; jumlah: number }>();
    transaksi
      .filter((t) => t.jenis === "keluar")
      .forEach((t) => {
        const cur = total.get(t.barangId) ?? { nama: t.nama, satuan: t.satuan, jumlah: 0 };
        cur.jumlah += t.jumlah;
        total.set(t.barangId, cur);
      });
    const rows = [...total.values()]
      .sort((a, b2) => b2.jumlah - a.jumlah)
      .slice(0, 5)
      .map((x) => [x.nama, x.jumlah, x.satuan]);
    const sql =
      "SELECT b.nama, SUM(t.jumlah) AS terjual\nFROM transaksi t\nJOIN barang b ON b.id = t.barang_id\nWHERE t.jenis = 'keluar'\n  AND t.waktu >= date_trunc('month', now())\nGROUP BY b.nama\nORDER BY terjual DESC\nLIMIT 5;";
    if (rows.length === 0) {
      return { status: "ok", text: "Belum ada barang keluar bulan ini.", sql };
    }
    const tabel: Tabel = { headers: ["Barang", "Terjual", "Satuan"], rows };
    return {
      status: "ok",
      text: "Barang paling laku bulan ini:",
      tabel,
      sql,
      csv: toCsv(tabel),
      tindakan: [{ key: "csv", label: "Ekspor CSV" }],
    };
  }

  // 7. Tidak dipahami
  return {
    status: "gagal",
    text: 'Maaf, saya belum memahami pertanyaan itu. Coba tanyakan: "Stok di bawah minimum?", "Barang paling laku bulan ini?", atau "Kapan restock Beras?".',
  };
}