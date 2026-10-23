import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Card from "../../components/Card";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import TrendChart from "../../components/TrendChart";
import { colors, fonts, radius, shadow } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { analisis, penjelasan } from "../../data/tren";

const WINDOWS = [7, 14, 30];

export default function TrenDetail() {
  const params = useLocalSearchParams<{ id: string; hari?: string }>();
  const { getById } = useBarang();
  const [hari, setHari] = useState(Number(params.hari) || 7);

  useEffect(() => {
    if (params.hari) setHari(Number(params.hari));
  }, [params.hari, params.id]);

  const b = params.id ? getById(params.id) : undefined;
  const a = useMemo(() => (b ? analisis(b, hari) : null), [b, hari]);

  if (!b || !a) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Tren" />
        <Text style={styles.missing}>Barang tidak ditemukan.</Text>
      </View>
    );
  }

  const stats = [
    { n: String(b.stok), label: "Stok saat ini", bg: colors.primaryLight, fg: colors.navy },
    { n: `±${Math.round(a.stokAkhir)}`, label: `Prediksi ${hari} hari`, bg: colors.warningBg, fg: "#C06A00" },
    { n: String(b.stokMin), label: "Stok minimum", bg: colors.primaryLight, fg: colors.navy },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={`Tren ${b.nama.split(" ")[0]}`} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.top}>
          <Text style={styles.emoji}>{b.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.nama}>{b.nama}</Text>
            <Text style={styles.kode}>Kode {b.kode} - {b.lokasi}</Text>
          </View>
          <StatusBadge label={a.status.label} variant={a.status.variant} />
        </View>

        <View style={styles.chips}>
          {WINDOWS.map((w) => {
            const on = w === hari;
            return (
              <Pressable
                key={w}
                onPress={() => setHari(w)}
                style={[styles.chip, on && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.chipText, on && { color: colors.white }]}>{w} Hari</Text>
              </Pressable>
            );
          })}
        </View>

        <Card style={{ padding: 10 }}>
          <TrendChart riwayat={a.riwayat} prediksi={a.prediksi} stokMin={b.stokMin} />
        </Card>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: s.bg }]}>
              <Text style={[styles.statN, { color: s.fg }]}>{s.n}</Text>
              <Text style={[styles.statL, { color: s.fg }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ai}>
          <Text style={styles.aiTitle}>💡 Penjelasan AI</Text>
          <Text style={styles.aiText}>{penjelasan(a)}</Text>
        </View>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            label="Lihat Rekomendasi Stok"
            onPress={() => router.push({ pathname: "/rekomendasi", params: { hari: String(hari) } } as any)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 52 },
  nama: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  kode: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  chips: { flexDirection: "row", gap: 10, marginVertical: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  stats: { flexDirection: "row", gap: 10, marginTop: 16 },
  stat: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", ...shadow },
  statN: { fontFamily: fonts.bold, fontSize: 26 },
  statL: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 },
  ai: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 16, marginTop: 16 },
  aiTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy, marginBottom: 6 },
  aiText: { fontFamily: fonts.regular, fontSize: 14, color: colors.navy, lineHeight: 21 },
  missing: { textAlign: "center", marginTop: 60, fontFamily: fonts.regular, color: colors.textMuted },
});