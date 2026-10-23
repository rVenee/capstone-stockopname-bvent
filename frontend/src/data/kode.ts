import { Barang } from "./barang";

// Hanya angka, tanpa nol di depan. Jadi UPC-A 12 digit dan EAN-13 (diawali 0) dianggap sama.
const normal = (k: string) => k.replace(/\D/g, "").replace(/^0+/, "");

export function cariByKode(items: Barang[], kode: string) {
  const n = normal(kode);
  if (!n) return undefined;
  return items.find((b) => normal(b.kode) === n);
}