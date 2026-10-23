import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BarcodeScanner from "../../components/BarcodeScanner";
import Card from "../../components/Card";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import { colors, fonts, radius } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { Barang, getStatus } from "../../data/barang";
import { cariByKode } from "../../data/kode";

type Hasil = { kode: string; barang?: Barang };

export default function Scan() {
  const { items } = useBarang();
  const [fokus, setFokus] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [manual, setManual] = useState("");

  // Kamera hanya menyala saat tab Scan sedang dibuka
  useFocusEffect(
    useCallback(() => {
      setFokus(true);
      return () => setFokus(false);
    }, [])
  );

  const proses = (kode: string) => {
    const k = kode.trim();
    if (!k) return;
    setHasil({ kode: k, barang: cariByKode(items, k) });
  };

  const scanLagi = () => {
    setHasil(null);
    setManual("");
  };

  const b = hasil?.barang;
  const s = b ? getStatus(b) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Scan Barcode" showBack={false} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <BarcodeScanner aktif={fokus && !hasil} onScan={proses} />

        {!hasil ? (
          <>
            <Text style={styles.hint}>Arahkan kamera ke barcode barang.</Text>
            <Text style={styles.label}>Atau ketik kode barang</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.input}
                value={manual}
                onChangeText={setManual}
                keyboardType="numeric"
                placeholder="mis. 987654321098"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={() => proses(manual)}
              />
              <Pressable style={styles.cari} onPress={() => proses(manual)}>
                <Ionicons name="search" size={22} color={colors.white} />
              </Pressable>
            </View>
          </>
        ) : b && s ? (
          <Card style={{ marginTop: 16 }}>
            <View style={styles.head}>
              <Text style={styles.emoji}>{b.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nama}>{b.nama}</Text>
                <Text style={styles.sub}>
                  Stok {b.stok} {b.satuan} · {b.lokasi}
                </Text>
                <Text style={styles.sub}>Kode {b.kode}</Text>
              </View>
              <StatusBadge label={s.label} variant={s.variant} />
            </View>
            <View style={{ gap: 10, marginTop: 14 }}>
              <PrimaryButton
                label="Catat Transaksi"
                onPress={() => router.push({ pathname: "/transaksi", params: { id: b.id } } as any)}
              />
              <PrimaryButton
                label="Lihat Detail"
                variant="outline"
                onPress={() => router.push({ pathname: "/barang-detail", params: { id: b.id } } as any)}
              />
              <Pressable onPress={scanLagi} style={styles.lagi}>
                <Text style={styles.lagiText}>Scan Lagi</Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.nama}>Barang belum terdaftar</Text>
            <Text style={styles.sub}>Kode {hasil.kode} tidak ditemukan di daftar barang.</Text>
            <View style={{ gap: 10, marginTop: 14 }}>
              <PrimaryButton
                label="Tambah Barang Baru"
                onPress={() => router.push({ pathname: "/barang-form", params: { kode: hasil.kode } } as any)}
              />
              <Pressable onPress={scanLagi} style={styles.lagi}>
                <Text style={styles.lagiText}>Scan Lagi</Text>
              </Pressable>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 14 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginTop: 22, marginBottom: 6 },
  manualRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, backgroundColor: colors.primarySoft,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12,
  },
  cari: {
    width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 44 },
  nama: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  lagi: { alignItems: "center", padding: 8 },
  lagiText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
});