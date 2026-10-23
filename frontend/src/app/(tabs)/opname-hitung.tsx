import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Pagination, { paginate } from "../../components/Pagination";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import { colors, fonts, radius, shadow } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { formatSelisih } from "../../data/opname";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "belum", label: "Belum dihitung" },
] as const;

export default function OpnameHitung() {
  const { items, draft, setDraftNilai } = useBarang();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "belum">("all");
  const [page, setPage] = useState(1);

  const terisi = Object.values(draft).filter((v) => v.trim() !== "").length;
  const persen = items.length ? Math.round((terisi / items.length) * 100) : 0;

  const data = items.filter(
    (b) =>
      b.nama.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === "all" || (draft[b.id] ?? "").trim() === "")
  );
  const { items: halaman, current, totalPages } = paginate(data, page);

  const keRingkasan = () => {
    if (terisi === 0) {
      Alert.alert("Belum ada hitungan", "Isi jumlah fisik minimal satu barang.");
      return;
    }
    router.push("/opname-ringkasan" as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Hitung Fisik">
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

      <FlatList
        data={halaman}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.progress}>
              {terisi} dari {items.length} barang dihitung
            </Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${persen}%` }]} />
            </View>
            <View style={styles.chips}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      setFilter(f.key);
                      setPage(1);
                    }}
                    style={[styles.chip, on && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.chipText, on && { color: colors.white }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.kosong}>
            {filter === "belum" ? "Semua barang sudah dihitung. 🎉" : "Barang tidak ditemukan."}
          </Text>
        }
        ListFooterComponent={<Pagination current={current} total={totalPages} onChange={setPage} />}
        renderItem={({ item: b }) => {
          const v = draft[b.id] ?? "";
          const terhitung = v.trim() !== "";
          const selisih = terhitung ? Number(v) - b.stok : 0;
          return (
            <View style={styles.row}>
              <Text style={styles.emoji}>{b.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nama}>{b.nama}</Text>
                <Text style={styles.sub}>
                  Sistem: {b.stok} {b.satuan} · {b.lokasi}
                </Text>
                {terhitung ? (
                  <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
                    <StatusBadge
                      label={selisih === 0 ? "Sesuai" : `Selisih ${formatSelisih(selisih)}`}
                      variant={selisih === 0 ? "success" : selisih > 0 ? "info" : "danger"}
                    />
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: "center" }}>
                <TextInput
                  style={[styles.input, terhitung && { borderColor: colors.primary }]}
                  value={v}
                  onChangeText={(t) => setDraftNilai(b.id, t.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.unit}>{b.satuan}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        <PrimaryButton label={`Lihat Ringkasan (${terisi}/${items.length})`} onPress={keRingkasan} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.white,
    borderRadius: radius.pill, paddingHorizontal: 16, height: 48, gap: 8, ...shadow,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  list: { padding: 20, paddingBottom: 12, gap: 10 },
  progress: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, marginTop: 8, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  chips: { flexDirection: "row", gap: 10, marginTop: 14 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  emoji: { fontSize: 32, width: 42, textAlign: "center" },
  nama: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  input: {
    width: 76, height: 48, textAlign: "center", fontFamily: fonts.bold, fontSize: 20, color: colors.navy,
    backgroundColor: colors.primarySoft, borderRadius: radius.sm, borderWidth: 1.5, borderColor: "transparent",
  },
  unit: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  kosong: { textAlign: "center", marginTop: 30, fontFamily: fonts.regular, color: colors.textMuted },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
});