import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import { useBarang } from "../../data/BarangContext";
import { useUser } from "../../data/UserContext";
import { formatWaktu } from "../../data/transaksi";
import {
  batalkanPaket, daftarPaket, Jenis, PaketImpor, pilihBerkas, unduhDanBagikan,
} from "../../services/imporApi";
import { colors, fonts, radius } from "../../constants/theme";

type Format = "csv" | "xlsx";

const labelPaket = { barang: "Impor barang", riwayat: "Impor riwayat", simulasi: "Riwayat simulasi" } as const;

function Tombol({ ikon, label, onPress, sibuk }: { ikon: any; label: string; onPress: () => void; sibuk?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.tombol, pressed && { opacity: 0.8 }]} onPress={onPress} disabled={sibuk}>
      {sibuk ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={ikon} size={22} color={colors.primary} />}
      <Text style={styles.tombolText}>{label}</Text>
    </Pressable>
  );
}

export default function KelolaData() {
  const { izin } = useUser();
  const { segarkan } = useBarang();
  const [format, setFormat] = useState<Format>("xlsx");
  const [paket, setPaket] = useState<PaketImpor[]>([]);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const muatPaket = useCallback(() => {
    if (!izin.kelolaData) return;
    daftarPaket().then(setPaket).catch(() => {});
  }, [izin.kelolaData]);

  useFocusEffect(
    useCallback(() => {
      muatPaket();
    }, [muatPaket])
  );

  const mulaiImpor = async (jenis: Jenis) => {
    try {
      const f = await pilihBerkas();
      if (!f) return;
      router.push({ pathname: "/impor", params: { uri: f.uri, nama: f.nama, jenis } } as any);
    } catch (e: any) {
      Alert.alert("File tidak dapat dipakai", e?.message ?? "Terjadi kesalahan.");
    }
  };

  const unduh = async (kunci: string, path: string, nama: string) => {
    if (sibuk) return;
    setSibuk(kunci);
    try {
      await unduhDanBagikan(path, nama, format);
    } catch (e: any) {
      Alert.alert("Gagal", e?.message ?? "Terjadi kesalahan.");
    } finally {
      setSibuk(null);
    }
  };

  const batalkan = (p: PaketImpor) =>
    Alert.alert("Batalkan impor ini?", `${p.jumlahBaris} baris transaksi dari paket ini akan dihapus. Stok barang tidak berubah.`, [
      { text: "Tidak", style: "cancel" },
      {
        text: "Batalkan impor",
        style: "destructive",
        onPress: async () => {
          try {
            await batalkanPaket(p.id);
            await segarkan();
            muatPaket();
          } catch (e: any) {
            Alert.alert("Gagal", e?.message ?? "Terjadi kesalahan.");
          }
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Impor & Ekspor Data" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.format}>Format file</Text>
        <View style={styles.chips}>
          {(["xlsx", "csv"] as Format[]).map((f) => (
            <Pressable key={f} onPress={() => setFormat(f)} style={[styles.chip, f === format && { backgroundColor: colors.primary }]}>
              <Text style={[styles.chipText, f === format && { color: colors.white }]}>{f === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"}</Text>
            </Pressable>
          ))}
        </View>

        {izin.kelolaData ? (
          <>
            <Text style={styles.judul}>Impor Data</Text>
            <Card style={{ gap: 12 }}>
              <Text style={styles.teks}>
                Pilih file CSV atau Excel dari HP (misalnya dari WhatsApp atau Google Drive). Aplikasi akan menebak
                kolomnya, dan kamu bisa memperbaikinya sebelum data disimpan.
              </Text>
              <Tombol ikon="cube-outline" label="Impor Barang" onPress={() => mulaiImpor("barang")} />
              <Tombol ikon="trending-up-outline" label="Impor Riwayat Penjualan" onPress={() => mulaiImpor("riwayat")} />
              <View style={styles.garis} />
              <Text style={styles.kecil}>Belum punya file? Unduh contoh format:</Text>
              <Tombol ikon="document-text-outline" label="Template Barang" sibuk={sibuk === "tb"} onPress={() => unduh("tb", `/impor/template/barang?format=${format}`, "template-barang")} />
              <Tombol ikon="document-text-outline" label="Template Riwayat" sibuk={sibuk === "tr"} onPress={() => unduh("tr", `/impor/template/riwayat?format=${format}`, "template-riwayat")} />
            </Card>
          </>
        ) : null}

        <Text style={styles.judul}>Ekspor Data</Text>
        <Card style={{ gap: 12 }}>
          <Text style={styles.teks}>Hasilnya dibagikan lewat WhatsApp, email, atau disimpan ke Drive.</Text>
          <Tombol ikon="cube-outline" label="Ekspor Daftar Barang" sibuk={sibuk === "eb"} onPress={() => unduh("eb", `/ekspor/barang?format=${format}`, "daftar-barang")} />
          <Tombol ikon="swap-vertical-outline" label="Ekspor Riwayat Transaksi" sibuk={sibuk === "et"} onPress={() => unduh("et", `/ekspor/transaksi?format=${format}`, "riwayat-transaksi")} />
          <Tombol ikon="clipboard-outline" label="Ekspor Hasil Stock Opname" sibuk={sibuk === "eo"} onPress={() => unduh("eo", `/ekspor/opname?format=${format}`, "hasil-opname")} />
        </Card>

        {izin.kelolaData && paket.length > 0 ? (
          <>
            <Text style={styles.judul}>Riwayat Impor</Text>
            <View style={{ gap: 10 }}>
              {paket.map((p) => (
                <Card key={p.id} style={{ gap: 6 }}>
                  <View style={styles.baris}>
                    <Text style={styles.paketJudul}>{labelPaket[p.jenis]}</Text>
                    {p.dibatalkan ? <StatusBadge label="Dibatalkan" variant="danger" /> : null}
                  </View>
                  <Text style={styles.kecil}>{p.namaFile}</Text>
                  <Text style={styles.teks}>{p.ringkasan}</Text>
                  <Text style={styles.kecil}>{formatWaktu(p.dibuat)}</Text>
                  {p.bisaDibatalkan ? (
                    <Pressable onPress={() => batalkan(p)} hitSlop={8}>
                      <Text style={styles.batal}>Batalkan impor ini</Text>
                    </Pressable>
                  ) : null}
                </Card>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 100 },
  format: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  judul: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy, marginTop: 26, marginBottom: 12 },
  teks: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
  kecil: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  garis: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  tombol: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.primarySoft,
    borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52,
  },
  tombolText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  baris: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paketJudul: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  batal: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger, marginTop: 4 },
});