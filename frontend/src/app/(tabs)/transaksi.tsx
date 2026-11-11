import { useEffect, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import Card from "../../components/Card";
import PrimaryButton from "../../components/PrimaryButton";
import FotoBarang from "../../components/FotoBarang";
import { useBarang } from "../../data/BarangContext";
import { colors, fonts, radius } from "../../constants/theme";

const num = (t: string) => Number(t.replace(/\D/g, "")) || 0;

export default function Transaksi() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { items, getById, catat } = useBarang();
  const [jenis, setJenis] = useState<"masuk" | "keluar">("keluar");
  const [barangId, setBarangId] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState("1");
  const [catatan, setCatatan] = useState("");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (params.id) setBarangId(params.id);
  }, [params.id]);

  const b = barangId ? getById(barangId) : undefined;
  const n = num(jumlah);
  const sesudah = b ? (jenis === "masuk" ? b.stok + n : b.stok - n) : 0;
  const melebihi = !!b && jenis === "keluar" && n > b.stok;
  const dibawahMin = !!b && !melebihi && n > 0 && sesudah < b.stokMin;

  const simpan = async () => {
    if (menyimpan) return;
    if (!b) { Alert.alert("Pilih barang", "Pilih barang terlebih dahulu."); return; }
    if (n <= 0) { Alert.alert("Jumlah belum diisi", "Jumlah harus lebih dari 0."); return; }
    setMenyimpan(true);
    const hasil = await catat(b.id, jenis, n, catatan);
    setMenyimpan(false);
    if (!hasil.ok) { Alert.alert("Transaksi gagal", hasil.error); return; }
    setJumlah("1");
    setCatatan("");
    Alert.alert("Transaksi tersimpan", `${b.nama}: stok sekarang ${sesudah} ${b.satuan}.`, [
      { text: "OK" },
      { text: "Lihat Riwayat", onPress: () => router.push("/riwayat" as any) },
    ]);
  };

  const daftar = items.filter((x) => x.nama.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Transaksi Stok" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.toggle}>
          <Pressable style={[styles.toggleBtn, jenis === "masuk" && { backgroundColor: colors.success }]} onPress={() => setJenis("masuk")}>
            <Ionicons name="arrow-down-circle" size={20} color={jenis === "masuk" ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, jenis === "masuk" && { color: colors.white }]}>Barang Masuk</Text>
          </Pressable>
          <Pressable style={[styles.toggleBtn, jenis === "keluar" && { backgroundColor: colors.danger }]} onPress={() => setJenis("keluar")}>
            <Ionicons name="arrow-up-circle" size={20} color={jenis === "keluar" ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, jenis === "keluar" && { color: colors.white }]}>Barang Keluar</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Barang</Text>
        <Pressable style={styles.select} onPress={() => setPicker(true)}>
          {b ? (
            <>
              <FotoBarang gambar={b.gambar} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.selName}>{b.nama}</Text>
                <Text style={styles.selSub}>Stok {b.stok} {b.satuan} · {b.lokasi}</Text>
              </View>
            </>
          ) : (
            <Text style={[styles.selSub, { flex: 1, fontSize: 16 }]}>Pilih barang...</Text>
          )}
          <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.label}>Jumlah{b ? ` (${b.satuan})` : ""}</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={() => setJumlah(String(Math.max(0, n - 1)))}>
            <Ionicons name="remove" size={24} color={colors.white} />
          </Pressable>
          <TextInput style={styles.stepInput} value={jumlah} onChangeText={setJumlah} keyboardType="numeric" />
          <Pressable style={styles.stepBtn} onPress={() => setJumlah(String(n + 1))}>
            <Ionicons name="add" size={24} color={colors.white} />
          </Pressable>
        </View>

        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput style={styles.note} value={catatan} onChangeText={setCatatan} placeholder="mis. Penjualan harian / kiriman supplier" placeholderTextColor={colors.textMuted} multiline />

        {b ? (
          <Card style={{ marginTop: 20 }}>
            <Text style={styles.prevTitle}>Perkiraan stok</Text>
            <View style={styles.prevRow}>
              <Text style={styles.prevNum}>{b.stok}</Text>
              <Ionicons name="arrow-forward" size={22} color={colors.textMuted} />
              <Text style={[styles.prevNum, { color: melebihi ? colors.danger : dibawahMin ? colors.warning : colors.success }]}>{melebihi ? "—" : sesudah}</Text>
              <Text style={styles.prevUnit}>{b.satuan}</Text>
            </View>
            {melebihi ? (
              <Text style={[styles.warn, { color: colors.danger }]}>Jumlah melebihi stok yang tersedia.</Text>
            ) : dibawahMin ? (
              <Text style={[styles.warn, { color: colors.warning }]}>Stok akan berada di bawah minimum ({b.stokMin} {b.satuan}).</Text>
            ) : null}
          </Card>
        ) : null}

        <View style={{ marginTop: 24 }}>
          <PrimaryButton label="Simpan Transaksi" onPress={simpan} loading={menyimpan} />
        </View>
      </ScrollView>

      <Modal visible={picker} animationType="slide" transparent onRequestClose={() => setPicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Pilih Barang</Text>
              <Pressable onPress={() => setPicker(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={colors.navy} />
              </Pressable>
            </View>
            <TextInput style={styles.search} placeholder="Cari barang..." placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} />
            <FlatList
              data={daftar}
              keyExtractor={(x) => x.id}
              ListEmptyComponent={<Text style={styles.empty}>Barang tidak ditemukan.</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.opt} onPress={() => { setBarangId(item.id); setPicker(false); setQuery(""); }}>
                  <FotoBarang gambar={item.gambar} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selName}>{item.nama}</Text>
                    <Text style={styles.selSub}>Stok {item.stok} {item.satuan}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  toggle: { flexDirection: "row", gap: 10, backgroundColor: colors.primarySoft, padding: 6, borderRadius: radius.pill },
  toggleBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: radius.pill },
  toggleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginTop: 20, marginBottom: 6 },
  select: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  selName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  selSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  stepInput: { flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 26, color: colors.navy, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 8 },
  note: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, minHeight: 70, textAlignVertical: "top" },
  prevTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  prevRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 },
  prevNum: { fontFamily: fonts.bold, fontSize: 34, color: colors.navy },
  prevUnit: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted },
  warn: { fontFamily: fonts.medium, fontSize: 13, marginTop: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "75%" },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  search: { fontFamily: fonts.regular, fontSize: 16, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 8 },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.regular, color: colors.textMuted },
});