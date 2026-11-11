import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import Card from "../../components/Card";
import { useBarang } from "../../data/BarangContext";
import { useUser } from "../../data/UserContext";
import { request } from "../../services/api";
import { colors, fonts, radius } from "../../constants/theme";

type HasilReset = { barang: number; transaksi: number; sesiOpname: number };

export default function ResetData() {
  const { user, izin } = useUser();
  const { refresh } = useBarang();
  const [ketik, setKetik] = useState("");
  const [sibuk, setSibuk] = useState(false);

  // "PT Jaya Abadi - JYA112" -> "JYA112"
  const kode = (user.perusahaan.split(" - ").pop() ?? "").trim();
  const cocok = kode.length > 0 && ketik.trim().toUpperCase() === kode.toUpperCase();

  if (!izin.resetData) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Reset Data" />
        <Text style={styles.pesan}>Hanya Leader yang dapat mereset data.</Text>
      </View>
    );
  }

  const jalankan = () => {
    if (!cocok || sibuk) return;
    Alert.alert(
      "Hapus semua data?",
      `Semua barang, transaksi, hasil stock opname, dan riwayat impor milik ${user.perusahaan} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, hapus semua",
          style: "destructive",
          onPress: async () => {
            setSibuk(true);
            try {
              const h = await request<HasilReset>("/data/reset", {
                method: "POST",
                body: { konfirmasi: ketik.trim() },
                timeout: 60000,
              });
              await refresh();
              setKetik("");
              Alert.alert("Data direset", `${h.barang} barang dan ${h.transaksi} transaksi dihapus.`, [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (e: any) {
              Alert.alert("Reset gagal", e?.message ?? "Terjadi kesalahan.");
            } finally {
              setSibuk(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Reset Data" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card style={styles.peringatan}>
          <View style={styles.baris}>
            <Ionicons name="warning" size={26} color={colors.danger} />
            <Text style={styles.judul}>Tindakan ini tidak dapat dibatalkan</Text>
          </View>
          <Text style={styles.teks}>Yang akan dihapus dari {user.perusahaan}:</Text>
          <Text style={styles.butir}>• Semua barang beserta fotonya dan kategorinya</Text>
          <Text style={styles.butir}>• Seluruh riwayat transaksi stok</Text>
          <Text style={styles.butir}>• Seluruh hasil stock opname</Text>
          <Text style={styles.butir}>• Catatan riwayat impor</Text>
          <Text style={[styles.teks, { marginTop: 8 }]}>Akun pengguna dan data perusahaan tidak ikut terhapus.</Text>
        </Card>

        <Pressable style={styles.ekspor} onPress={() => router.push("/kelola-data" as any)}>
          <Ionicons name="download-outline" size={22} color={colors.primary} />
          <Text style={styles.eksporText}>Simpan cadangan dulu lewat Impor & Ekspor Data</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.label}>Untuk melanjutkan, ketik kode perusahaan: <Text style={styles.kode}>{kode}</Text></Text>
        <TextInput
          style={[styles.input, cocok && { borderColor: colors.danger }]}
          value={ketik}
          onChangeText={setKetik}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={kode}
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={[styles.tombol, !cocok && { opacity: 0.4 }]} onPress={jalankan} disabled={!cocok || sibuk}>
          {sibuk ? <ActivityIndicator color={colors.white} /> : <Text style={styles.tombolText}>Hapus Semua Data</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 60 },
  pesan: { textAlign: "center", marginTop: 60, fontFamily: fonts.regular, color: colors.textMuted, paddingHorizontal: 24 },
  peringatan: { backgroundColor: colors.dangerBg, borderColor: colors.danger, gap: 6 },
  baris: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  judul: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.danger },
  teks: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
  butir: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 22, paddingLeft: 4 },
  ekspor: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.primarySoft, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 16,
  },
  eksporText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginTop: 24, marginBottom: 8 },
  kode: { fontFamily: fonts.bold, color: colors.danger },
  input: {
    fontFamily: fonts.semibold, fontSize: 18, letterSpacing: 1, color: colors.text, backgroundColor: colors.primarySoft,
    borderRadius: radius.sm, borderWidth: 1.5, borderColor: "transparent", paddingHorizontal: 14, paddingVertical: 12,
  },
  tombol: {
    marginTop: 22, minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.danger, alignItems: "center",
    justifyContent: "center", paddingHorizontal: 20,
  },
  tombolText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.white },
});