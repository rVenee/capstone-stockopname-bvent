import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { namaDepan, useUser } from "../../data/UserContext";
import { ringkasTransaksi } from "../../data/transaksi";
import AvatarProfil from "../../components/AvatarProfil";

const menus = [
  { label: "Tren &\nPrediksi", icon: "stats-chart", href: "/tren" },
  { label: "Daftar\nBarang", icon: "cube", href: "/barang" },
  { label: "Chat\ndengan AI", icon: "chatbubbles", href: "/chat" },
  { label: "Riwayat\nStok", icon: "time", href: "/riwayat" },
  { label: "Transaksi\nStok", icon: "swap-vertical", href: "/transaksi" },
  { label: "Stock\nOpname", icon: "clipboard", href: "/opname" },
] as const;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { transaksi } = useBarang();
  const liveText = transaksi[0] ? ringkasTransaksi(transaksi[0]) : "Belum ada aktivitas";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>{"Welcome\n" + namaDepan(user.nama) + "."}</Text>
          <Text style={styles.company}>{user.perusahaan}</Text>
        </View>
        <Pressable style={styles.avatar} onPress={() => router.navigate("/profile" as any)}>
           <AvatarProfil size={56} />
        </Pressable>
      </View>

      <Text style={styles.section}>Live Activity</Text>
      <View style={styles.live}>
        <Text style={styles.liveText}>{liveText}</Text>
      </View>

      <Text style={[styles.section, { marginTop: 28 }]}>Stock Menu</Text>
      <View style={styles.grid}>
        {menus.map((m) => (
          <Pressable
            key={m.href}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(m.href as any)}
          >
            <Ionicons name={m.icon} size={40} color={colors.navy} />
            <Text style={styles.tileLabel}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  welcome: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 42, color: colors.navy },
  company: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary, marginTop: 10 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontFamily: fonts.semibold, fontSize: 20, color: colors.navy, marginTop: 36, marginBottom: 12 },
  live: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    ...shadow,
  },
  liveText: { color: colors.white, fontFamily: fonts.medium, fontSize: 15, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  tile: {
    width: "31%",
    height: 132,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: 12,
    justifyContent: "space-between",
    ...shadow,
  },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.navy, lineHeight: 17 },
});