import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import FotoBarang from "../../components/FotoBarang";
import Pagination, { paginate } from "../../components/Pagination";
import { useBarang } from "../../data/BarangContext";
import { useUser } from "../../data/UserContext";
import { getStatus } from "../../data/barang";
import { colors, fonts, radius, shadow } from "../../constants/theme";

export default function Barang() {
  const { items, kategori } = useBarang();
  const { izin } = useUser();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);

  const filters = ["All", ...kategori];

  const data = items.filter(
    (b) =>
      (filter === "All" || b.kategori === filter) &&
      b.nama.toLowerCase().includes(query.trim().toLowerCase())
  );
  const { items: halaman, current, totalPages } = paginate(data, page);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Daftar Barang">
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
          data={filters}
          keyExtractor={(f) => f}
          contentContainerStyle={styles.chips}
          renderItem={({ item: f }) => {
            const on = f === filter;
            return (
              <Pressable
                onPress={() => {
                  setFilter(f);
                  setPage(1);
                }}
                style={[styles.chip, on && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.chipText, on && { color: colors.white }]}>{f}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <Text style={styles.title}>Inventory</Text>

      <FlatList
        data={halaman}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {items.length === 0
              ? izin.kelolaBarang
                ? "Belum ada barang. Tekan tombol + untuk menambah."
                : "Belum ada barang."
              : "Barang tidak ditemukan."}
          </Text>
        }
        ListFooterComponent={<Pagination current={current} total={totalPages} onChange={setPage} />}
        renderItem={({ item: b }) => {
          const s = getStatus(b);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: "/barang-detail", params: { id: b.id } } as any)}
            >
              <FotoBarang gambar={b.gambar} emoji={b.emoji} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nama} numberOfLines={1}>{b.nama}</Text>
                <Text style={styles.sub}>
                  Stok {b.stok} {b.satuan} · Min {b.stokMin}
                </Text>
              </View>
              <StatusBadge label={s.label} variant={s.variant} />
            </Pressable>
          );
        }}
      />

      {izin.kelolaBarang ? (
        <Pressable
          style={styles.fab}
          onPress={() => router.push({ pathname: "/barang-form" } as any)}
        >
          <Ionicons name="add" size={32} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    height: 48,
    gap: 8,
    ...shadow,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  chips: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.navy, paddingHorizontal: 24, marginBottom: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 10, paddingTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  nama: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", marginTop: 40, fontFamily: fonts.regular, color: colors.textMuted, paddingHorizontal: 24 },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
});