import { Barang } from "./barang";

export type BarisOpname = {
  barangId: string;
  nama: string;
  emoji: string;
  gambar?: string | null;
  satuan: string;
  sistem: number;
  fisik: number;
  selisih: number;
};

export type SesiOpname = {
  id: string;
  waktu: number;
  catatan: string;
  baris: BarisOpname[];
};

/** Mengubah draf isian (id -> teks) menjadi baris opname untuk barang yang sudah dihitung. */
export function buatBaris(items: Barang[], draft: Record<string, string>): BarisOpname[] {
  const out: BarisOpname[] = [];
  for (const b of items) {
    const v = draft[b.id];
    if (v === undefined || v.trim() === "") continue;
    const fisik = Number(v);
    if (Number.isNaN(fisik)) continue;
    out.push({
      barangId: b.id,
      nama: b.nama,
      emoji: b.emoji,
      gambar: b.gambar,
      satuan: b.satuan,
      sistem: b.stok,
      fisik,
      selisih: fisik - b.stok,
    });
  }
  return out;
}

export function ringkasSesi(baris: BarisOpname[]) {
  const selisih = baris.filter((b) => b.selisih !== 0).length;
  return { diperiksa: baris.length, sesuai: baris.length - selisih, selisih };
}

export function formatSelisih(n: number) {
  if (n === 0) return "Sesuai";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}