import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import FotoBarang from "../../components/FotoBarang";
import { useBarang } from "../../data/BarangContext";
import { useUser } from "../../data/UserContext";
import { formatRupiah, formatTanggal, getStatus } from "../../data/barang";
import { hapusFoto, pilihFoto, SumberFoto, unggahFoto } from "../../services/foto";
import { colors, fonts, radius } from "../../constants/theme";

function Barcode({ code }: { code: string }) {
  const bars = code.replace(/\D/g, "").split("").map((d) => ({ w: 1 + (Number(d) % 3) }));
  return (
    <View style={{ alignItems: "center", marginTop: 16 }}>
      <View style={{ flexDirection: "row", height: 64 }}>
        {bars.flatMap((b, i) => [
          <View key={`a${i}`} style={{ width: b.w * 2, backgroundColor: "#000" }} />,
          <View key={`b${i}`} style={{ width: 2 }} />,
        ])}
      </View>
      <Text style={styles.code}>{code}</Text>
    </View>
  );
}

export default function BarangDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById, hapus, segarkan } = useBarang();
  const { izin } = useUser();
  const [mengunggah, setMengunggah] = useState(false);
  const b = id ? getById(id) : undefined;

  if (!b) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Detail Barang" />
        <Text style={styles.missing}>Barang tidak ditemukan.</Text>
      </View>
    );
  }

  const s = getStatus(b);
  const rows: [string, string][] = [
    ["Nama Barang", b.nama],
    ["Kode Barang", b.kode],
    ["Kategori", b.kategori],
    ["Lokasi", b.lokasi || "-"],
    ["Satuan", b.satuan],
    ["Stok", `${b.stok} ${b.satuan}`],
    ["Stok Minimum", `${b.stokMin} ${b.satuan}`],
    ["Harga", formatRupiah(b.harga)],
  ];
  if (b.pemasok) rows.push(["Pemasok", b.pemasok]);
  if (b.kedaluwarsa) rows.push(["Kedaluwarsa", formatTanggal(b.kedaluwarsa)]);
  if (b.jumlahPesanUlang != null) rows.push(["Jumlah Pesan Ulang", `${b.jumlahPesanUlang} ${b.satuan}`]);

  const gantiFoto = async (sumber: SumberFoto) => {
    try {
      const uri = await pilihFoto(sumber);
      if (!uri) return;
      setMengunggah(true);
      await unggahFoto(b.id, uri);
      await segarkan();
    } catch (e: any) {
      Alert.alert("Foto gagal", e?.message ?? "Terjadi kesalahan.");
    } finally {
      setMengunggah(false);
    }
  };

  const konfirmasiHapusFoto = () =>
    Alert.alert("Hapus foto?", "Foto barang ini akan dihapus.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setMengunggah(true);
          try {
            await hapusFoto(b.id);
            await segarkan();
          } catch (e: any) {
            Alert.alert("Gagal", e?.message ?? "Terjadi kesalahan.");
          } finally {
            setMengunggah(false);
          }
        },
      },
    ]);

  const konfirmasiHapus = () =>
    Alert.alert("Hapus barang?", `${b.nama} akan dihapus dari daftar.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const hasil = await hapus(b.id);
          if (!hasil.ok) {
            Alert.alert("Gagal menghapus", hasil.error);
            return;
          }
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Detail Barang" />
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <View style={styles.top}>
            <View>
              <FotoBarang gambar={b.gambar} emoji={b.emoji} size={130} />
              {mengunggah ? (
                <View style={styles.overlay}>
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 10 }}>
              {izin.kelolaBarang ? (
                <Pressable
                  style={styles.editBtn}
                  onPress={() =>
                    router.push({ pathname: "/barang-form", params: { id: b.id } } as any)
                  }
                >
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              ) : null}
              <StatusBadge label={s.label} variant={s.variant} />
            </View>
          </View>

          {izin.kelolaBarang ? (
            <View style={styles.fotoAksi}>
              <Pressable style={styles.aksiBtn} onPress={() => gantiFoto("kamera")} disabled={mengunggah}>
                <Ionicons name="camera" size={18} color={colors.primary} />
                <Text style={styles.aksiText}>Kamera</Text>
              </Pressable>
              <Pressable style={styles.aksiBtn} onPress={() => gantiFoto("galeri")} disabled={mengunggah}>
                <Ionicons name="images" size={18} color={colors.primary} />
                <Text style={styles.aksiText}>Galeri</Text>
              </Pressable>
              {b.gambar ? (
                <Pressable style={styles.aksiBtn} onPress={konfirmasiHapusFoto} disabled={mengunggah}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.aksiText, { color: colors.danger }]}>Hapus</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={{ marginTop: 12 }}>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.row}>
                <Text style={styles.k}>{k}</Text>
                <Text style={styles.v}>{v}</Text>
              </View>
            ))}
          </View>

          <Barcode code={b.kode} />
        </Card>

        {izin.kelolaBarang ? (
          <Pressable style={styles.delete} onPress={konfirmasiHapus}>
            <Text style={styles.deleteText}>Hapus Barang</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  top: { flexDirection: "row", justifyContent: "space-between" },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 29,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },
  editBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  editText: { color: colors.white, fontFamily: fonts.medium, fontSize: 15 },
  fotoAksi: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  aksiBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: colors.primarySoft,
  },
  aksiText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  row: { flexDirection: "row", paddingVertical: 6 },
  k: { width: 130, fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  v: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  code: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, marginTop: 6, letterSpacing: 2 },
  delete: { marginTop: 20, alignItems: "center", padding: 12 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
  missing: { textAlign: "center", marginTop: 60, fontFamily: fonts.regular, color: colors.textMuted },
});