import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Card from "../../components/Card";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import { colors, fonts, radius } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { rekomendasi } from "../../data/tren";

export default function Rekomendasi() {
  const params = useLocalSearchParams<{ hari?: string }>();
  const hari = Number(params.hari) || 30;
  const { items } = useBarang();
  const saran = useMemo(() => rekomendasi(items, hari), [items, hari]);

  const ekspor = () => {
    const baris = [
      ["Barang", "Jumlah restock", "Satuan", "Waktu", "Alasan"],
      ...saran.map((s) => [s.a.barang.nama, s.jumlah, s.a.barang.satuan, `Sebelum ${s.batas}`, s.alasan]),
    ];
    const csv = baris.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    Share.share({ message: csv, title: "rekomendasi-restock.csv" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Rekomendasi Restock" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Saran Restock</Text>
        <Text style={styles.sub}>Berdasarkan tren {hari} hari</Text>

        {saran.length === 0 ? (
          <Card style={{ marginTop: 20 }}>
            <Text style={styles.kosong}>
              Semua barang masih aman, belum ada yang perlu direstock saat ini. ✅
            </Text>
          </Card>
        ) : (
          saran.map((s) => (
            <Card key={s.a.barang.id} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.emoji}>{s.a.barang.emoji}</Text>
                <Text style={styles.nama}>{s.a.barang.nama}</Text>
                <StatusBadge label={s.label} variant={s.variant} />
              </View>
              <View style={styles.boxes}>
                <View style={styles.box}>
                  <Text style={styles.boxL}>Jumlah restock</Text>
                  <Text style={styles.boxV}>+{s.jumlah} {s.a.barang.satuan}</Text>
                </View>
                <View style={styles.box}>
                  <Text style={styles.boxL}>Waktu</Text>
                  <Text style={styles.boxV}>Sebelum {s.batas}</Text>
                </View>
              </View>
              <Text style={styles.alasan}>
                <Text style={{ fontFamily: fonts.bold }}>Alasan: </Text>
                {s.alasan}
              </Text>
            </Card>
          ))
        )}

        {saran.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <PrimaryButton label="Ekspor CSV" variant="outline" onPress={ekspor} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40, gap: 14 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.navy },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: -8 },
  card: { gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoji: { fontSize: 32 },
  nama: { flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  boxes: { flexDirection: "row", gap: 10 },
  box: { flex: 1, backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: 12 },
  boxL: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  boxV: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy, marginTop: 2 },
  alasan: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.navy, lineHeight: 20 },
  kosong: { fontFamily: fonts.medium, fontSize: 15, color: colors.navy, textAlign: "center" },
});