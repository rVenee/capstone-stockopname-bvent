import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Card from "../../components/Card";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import { colors, fonts, radius } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { formatRupiah, getStatus } from "../../data/barang";

function Barcode({ code }: { code: string }) {
  const bars = code.split("").map((d, i) => ({
    w: 1 + (Number(d) % 3),
    dark: i % 2 === 0,
  }));
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
  const { getById, hapus } = useBarang();
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
    ["Lokasi", b.lokasi],
    ["Satuan", b.satuan],
    ["Stok", `${b.stok} ${b.satuan}`],
    ["Stok Minimum", `${b.stokMin} ${b.satuan}`],
    ["Harga", formatRupiah(b.harga)],
  ];

  const konfirmasiHapus = () =>
    Alert.alert("Hapus barang?", `${b.nama} akan dihapus dari daftar.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
          hapus(b.id);
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
            <Text style={styles.emoji}>{b.emoji}</Text>
            <View style={{ alignItems: "flex-end", gap: 10 }}>
              <Pressable
                style={styles.editBtn}
                onPress={() =>
                  router.push({ pathname: "/barang-form", params: { id: b.id } } as any)
                }
              >
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
              <StatusBadge label={s.label} variant={s.variant} />
            </View>
          </View>

          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text style={styles.k}>{k}</Text>
              <Text style={styles.v}>{v}</Text>
            </View>
          ))}

          <Barcode code={b.kode} />
        </Card>

        <Pressable style={styles.delete} onPress={konfirmasiHapus}>
          <Text style={styles.deleteText}>Hapus Barang</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  emoji: { fontSize: 72 },
  editBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  editText: { color: colors.white, fontFamily: fonts.medium, fontSize: 15 },
  row: { flexDirection: "row", paddingVertical: 6 },
  k: { width: 130, fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  v: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  code: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, marginTop: 6, letterSpacing: 2 },
  delete: { marginTop: 20, alignItems: "center", padding: 12 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
  missing: { textAlign: "center", marginTop: 60, fontFamily: fonts.regular, color: colors.textMuted },
});