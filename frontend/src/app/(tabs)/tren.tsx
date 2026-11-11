import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import PrimaryButton from "../../components/PrimaryButton";
import FotoBarang from "../../components/FotoBarang";
import Pagination, { paginate } from "../../components/Pagination";
import { api, TrenRingkasan } from "../../services/api";
import { colors, fonts, radius, shadow } from "../../constants/theme";

const WINDOWS = [7, 14, 30];
const warnaVar = { danger: colors.danger, warning: colors.warning, success: colors.success, info: colors.primary };

export default function Tren() {
  const [hari, setHari] = useState(7);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TrenRingkasan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let batal = false;
      setMemuat(true);
      api.tren(hari)
        .then((d) => { if (!batal) { setData(d); setGalat(null); } })
        .catch((e) => { if (!batal) setGalat(e?.message ?? "Gagal memuat tren."); })
        .finally(() => { if (!batal) setMemuat(false); });
      return () => { batal = true; };
    }, [hari])
  );

  const daftar = (data?.daftar ?? []).filter((a) => a.barang.nama.toLowerCase().includes(query.trim().toLowerCase()));
  const { items: halaman, current, totalPages } = paginate(daftar, page);

  const stats = [
    { n: data?.akanHabis ?? 0, label: "Akan habis < 7 hari", bg: colors.dangerBg, fg: colors.danger },
    { n: data?.menipis ?? 0, label: "Stok Menipis", bg: colors.warningBg, fg: "#C06A00" },
    { n: data?.total ?? 0, label: "Total Barang", bg: colors.primaryLight, fg: colors.navy },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Tren & Prediksi">
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search" placeholderTextColor={colors.textMuted} value={query} onChangeText={(t) => { setQuery(t); setPage(1); }} />
        </View>
      </ScreenHeader>

      <FlatList
        data={halaman}
        keyExtractor={(a) => a.barang.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.stats}>
              {stats.map((s) => (
                <View key={s.label} style={[styles.stat, { backgroundColor: s.bg }]}>
                  <Text style={[styles.statN, { color: s.fg }]}>{s.n}</Text>
                  <Text style={[styles.statL, { color: s.fg }]}>{s.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.title}>Tren Stok</Text>
            <View style={styles.chips}>
              {WINDOWS.map((w) => {
                const on = w === hari;
                return (
                  <Pressable key={w} onPress={() => { setHari(w); setPage(1); }} style={[styles.chip, on && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.chipText, on && { color: colors.white }]}>{w} Hari</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          memuat ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          : galat ? <Text style={styles.empty}>{galat}</Text>
          : <Text style={styles.empty}>Barang tidak ditemukan.</Text>
        }
        ListFooterComponent={<Pagination current={current} total={totalPages} onChange={setPage} />}
        renderItem={({ item: a }) => (
          <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} onPress={() => router.push({ pathname: "/tren-detail", params: { id: a.barang.id, hari: String(hari) } } as any)}>
            <FotoBarang gambar={a.barang.gambar} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nama} numberOfLines={1}>{a.barang.nama}</Text>
              <Text style={[styles.sub, { color: warnaVar[a.status.variant] }]}>Stok {a.barang.stok} → ± {Math.round(a.stokAkhir)} ({hari} hari)</Text>
            </View>
            <StatusBadge label={a.status.label} variant={a.status.variant} />
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        <PrimaryButton label="Lihat Rekomendasi Stok" onPress={() => router.push({ pathname: "/rekomendasi", params: { hari: String(hari) } } as any)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, height: 48, gap: 8, ...shadow },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  list: { padding: 20, paddingBottom: 12, gap: 10 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", ...shadow },
  statN: { fontFamily: fonts.bold, fontSize: 28 },
  statL: { fontFamily: fonts.semibold, fontSize: 11, textAlign: "center", marginTop: 2 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.navy, marginTop: 24 },
  chips: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 6 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  nama: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  empty: { textAlign: "center", marginTop: 40, fontFamily: fonts.regular, color: colors.textMuted },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
});