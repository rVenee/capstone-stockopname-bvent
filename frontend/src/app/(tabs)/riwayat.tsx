import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Pagination, { paginate } from "../../components/Pagination";
import ScreenHeader from "../../components/ScreenHeader";
import { colors, fonts, radius, shadow } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { formatWaktu, Jenis } from "../../data/transaksi";

const FILTERS: { key: "all" | Jenis; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "masuk", label: "Masuk" },
  { key: "keluar", label: "Keluar" },
  { key: "opname", label: "Opname" },
];

const warna: Record<Jenis, string> = {
  masuk: colors.success,
  keluar: colors.danger,
  opname: colors.primary,
};

const labelJenis: Record<Jenis, string> = {
  masuk: "Masuk",
  keluar: "Keluar",
  opname: "Opname",
};

export default function Riwayat() {
  const { transaksi } = useBarang();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Jenis>("all");
  const [page, setPage] = useState(1);

  const data = transaksi.filter(
    (t) =>
      (filter === "all" || t.jenis === filter) &&
      t.nama.toLowerCase().includes(query.trim().toLowerCase())
  );
  const { items: halaman, current, totalPages } = paginate(data, page);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Riwayat Stok">
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setPage(1);
            }}
          />
        </View>
      </ScreenHeader>

      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={styles.chips}
          renderItem={({ item: f }) => {
            const on = f.key === filter;
            return (
              <Pressable
                onPress={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
                style={[styles.chip, on && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.chipText, on && { color: colors.white }]}>{f.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={halaman}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada riwayat.</Text>}
        ListFooterComponent={<Pagination current={current} total={totalPages} onChange={setPage} />}
        renderItem={({ item: t }) => {
          const delta = t.stokSesudah - t.stokSebelum;
          const tanda = delta > 0 ? "+" : delta < 0 ? "−" : "±";
          return (
            <View style={styles.row}>
              <Text style={styles.emoji}>{t.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nama}>{t.nama}</Text>
                <Text style={styles.sub}>{formatWaktu(t.waktu)}</Text>
                <Text style={styles.sub}>
                  Stok {t.stokSebelum} → {t.stokSesudah} {t.satuan}
                </Text>
                {t.catatan ? <Text style={styles.note}>“{t.catatan}”</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.delta, { color: warna[t.jenis] }]}>
                  {tanda}{Math.abs(delta)}
                </Text>
                <Text style={[styles.jenis, { color: warna[t.jenis] }]}>{labelJenis[t.jenis]}</Text>
              </View>
            </View>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => router.push("/transaksi" as any)}>
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.white,
    borderRadius: radius.pill, paddingHorizontal: 16, height: 48, gap: 8, ...shadow,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  chips: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  emoji: { fontSize: 32, width: 42, textAlign: "center" },
  nama: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.navy, fontStyle: "italic", marginTop: 3 },
  delta: { fontFamily: fonts.bold, fontSize: 22 },
  jenis: { fontFamily: fonts.medium, fontSize: 12 },
  empty: { textAlign: "center", marginTop: 40, fontFamily: fonts.regular, color: colors.textMuted },
  fab: {
    position: "absolute", right: 24, bottom: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadow,
  },
});