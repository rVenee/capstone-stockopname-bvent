import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import PrimaryButton from "../../components/PrimaryButton";
import FotoBarang from "../../components/FotoBarang";
import { api, Saran } from "../../services/api";
import { bagikanExcel } from "../../services/ekspor";
import { colors, fonts, radius } from "../../constants/theme";

export default function Rekomendasi() {
  const params = useLocalSearchParams<{ hari?: string }>();
  const hari = Number(params.hari) || 30;
  const [saran, setSaran] = useState<Saran[] | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let batal = false;
      setMemuat(true);
      api.rekomendasi(hari)
        .then((d) => { if (!batal) { setSaran(d); setGalat(null); } })
        .catch((e) => { if (!batal) setGalat(e?.message ?? "Gagal memuat rekomendasi."); })
        .finally(() => { if (!batal) setMemuat(false); });
      return () => { batal = true; };
    }, [hari])
  );

  const ekspor = async () => {
    if (!saran) return;
    try {
      await bagikanExcel(
        `rekomendasi-restock-${hari}-hari`,
        ["Barang", "Kode", "Status", "Jumlah Restock", "Satuan", "Selesaikan Sebelum", "Rata-rata Terjual per Hari", "Alasan"],
        saran.map((s) => [
          s.barang.nama,
          s.barang.kode,
          s.label,
          s.jumlah,
          s.barang.satuan,
          s.batas,
          Math.round(s.rata * 10) / 10,
          s.alasan,
        ])
      );
    } catch (e: any) {
      Alert.alert("Ekspor gagal", e?.message ?? "Terjadi kesalahan.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Rekomendasi Restock" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Saran Restock</Text>
        <Text style={styles.sub}>Berdasarkan tren {hari} hari</Text>

        {memuat && !saran ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
        ) : galat && !saran ? (
          <Card style={{ marginTop: 20 }}><Text style={styles.kosong}>{galat}</Text></Card>
        ) : saran && saran.length === 0 ? (
          <Card style={{ marginTop: 20 }}><Text style={styles.kosong}>Semua barang masih aman, belum ada yang perlu direstock saat ini.</Text></Card>
        ) : (
          saran?.map((s) => (
            <Card key={s.barang.id} style={styles.card}>
              <View style={styles.head}>
                <FotoBarang gambar={s.barang.gambar} size={48} />
                <Text style={styles.nama} numberOfLines={1}>{s.barang.nama}</Text>
                <StatusBadge label={s.label} variant={s.variant} />
              </View>
              <View style={styles.boxes}>
                <View style={styles.box}>
                  <Text style={styles.boxL}>Jumlah restock</Text>
                  <Text style={styles.boxV}>+{s.jumlah} {s.barang.satuan}</Text>
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

        {saran && saran.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <PrimaryButton label="Ekspor Excel" variant="outline" onPress={ekspor} />
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
  nama: { flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  boxes: { flexDirection: "row", gap: 10 },
  box: { flex: 1, backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: 12 },
  boxL: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  boxV: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy, marginTop: 2 },
  alasan: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.navy, lineHeight: 20 },
  kosong: { fontFamily: fonts.medium, fontSize: 15, color: colors.navy, textAlign: "center" },
});