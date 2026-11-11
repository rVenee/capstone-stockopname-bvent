import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import Pagination, { paginate } from "../../components/Pagination";
import { penggunaApi, PenggunaItem } from "../../services/penggunaApi";
import { labelPeran } from "../../data/UserContext";
import { colors, fonts, radius, shadow } from "../../constants/theme";

const varian = { leader: "info", admin: "warning", staff: "success" } as const;

export default function Pengguna() {
  const [data, setData] = useState<PenggunaItem[] | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useFocusEffect(
    useCallback(() => {
      let batal = false;
      setMemuat(true);
      penggunaApi
        .daftar()
        .then((d) => {
          if (!batal) {
            setData(d);
            setGalat(null);
          }
        })
        .catch((e) => {
          if (!batal) setGalat(e?.message ?? "Gagal memuat daftar pengguna.");
        })
        .finally(() => {
          if (!batal) setMemuat(false);
        });
      return () => {
        batal = true;
      };
    }, [])
  );

  const q = query.trim().toLowerCase();
  const daftar = (data ?? []).filter(
    (p) => p.nama.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  );
  const { items: halaman, current, totalPages } = paginate(daftar, page);

  const buka = (p: PenggunaItem) => {
    if (!p.bisaDiubah) {
      Alert.alert(
        p.nama,
        "Akun ini tidak dapat Anda ubah. Data akun sendiri diubah lewat menu Profil."
      );
      return;
    }
    router.push({ pathname: "/pengguna-form", params: { id: p.id } } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Manajemen Pengguna">
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama atau email"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setPage(1);
            }}
          />
        </View>
      </ScreenHeader>

      <Text style={styles.title}>Daftar Pengguna</Text>

      <FlatList
        data={halaman}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          memuat ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : galat ? (
            <Text style={styles.empty}>{galat}</Text>
          ) : (
            <Text style={styles.empty}>Pengguna tidak ditemukan.</Text>
          )
        }
        ListFooterComponent={<Pagination current={current} total={totalPages} onChange={setPage} />}
        renderItem={({ item: p }) => (
          <Pressable
            style={({ pressed }) => [styles.row, !p.aktif && { opacity: 0.55 }, pressed && { opacity: 0.8 }]}
            onPress={() => buka(p)}
          >
            <View style={styles.avatar}>
              <Text style={styles.inisial}>{p.nama.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nama}>{p.nama}</Text>
              <Text style={styles.sub}>{p.email}</Text>
              {p.telepon ? <Text style={styles.sub}>{p.telepon}</Text> : null}
              <View style={styles.badges}>
                <StatusBadge label={labelPeran(p.peran)} variant={varian[p.peran]} />
                {!p.aktif ? <StatusBadge label="Nonaktif" variant="danger" /> : null}
              </View>
            </View>
            {p.bisaDiubah ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
          </Pressable>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push({ pathname: "/pengguna-form" } as any)}
      >
        <Ionicons name="person-add" size={26} color={colors.white} />
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
  title: { fontFamily: fonts.bold, fontSize: 26, color: colors.navy, paddingHorizontal: 24, marginTop: 20 },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  inisial: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  nama: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  badges: { flexDirection: "row", gap: 6, marginTop: 8 },
  empty: { textAlign: "center", marginTop: 40, fontFamily: fonts.regular, color: colors.textMuted },
  fab: {
    position: "absolute", right: 24, bottom: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadow,
  },
});