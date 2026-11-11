import { useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import PrimaryButton from "../../components/PrimaryButton";
import FotoBarang from "../../components/FotoBarang";
import Pagination, { paginate } from "../../components/Pagination";
import { useBarang } from "../../data/BarangContext";
import { useUser } from "../../data/UserContext";
import { formatWaktu, Jenis, Transaksi } from "../../data/transaksi";
import { api } from "../../services/api";
import { colors, fonts, radius, shadow } from "../../constants/theme";

const FILTERS: { key: "all" | Jenis; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "masuk", label: "Masuk" },
  { key: "keluar", label: "Keluar" },
  { key: "opname", label: "Opname" },
];

const warna: Record<Jenis, string> = { masuk: colors.success, keluar: colors.danger, opname: colors.primary };
const labelJenis: Record<Jenis, string> = { masuk: "Masuk", keluar: "Keluar", opname: "Opname" };
const num = (t: string) => Number(t.replace(/\D/g, "")) || 0;

export default function Riwayat() {
  const { transaksi, segarkan } = useBarang();
  const { izin } = useUser();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Jenis>("all");
  const [page, setPage] = useState(1);

  // lembar ubah transaksi
  const [dipilih, setDipilih] = useState<Transaksi | null>(null);
  const [jenisEdit, setJenisEdit] = useState<"masuk" | "keluar">("keluar");
  const [jumlahEdit, setJumlahEdit] = useState("1");
  const [catatanEdit, setCatatanEdit] = useState("");
  const [sibuk, setSibuk] = useState<"simpan" | "hapus" | null>(null);

  const data = transaksi.filter((t) => (filter === "all" || t.jenis === filter) && t.nama.toLowerCase().includes(query.trim().toLowerCase()));
  const { items: halaman, current, totalPages } = paginate(data, page);

  const buka = (t: Transaksi) => {
    if (!izin.kelolaData) return;
    if (t.jenis === "opname") {
      Alert.alert("Transaksi opname", "Transaksi hasil stock opname tidak dapat diubah atau dihapus. Lakukan opname baru untuk mengoreksi stok.");
      return;
    }
    setDipilih(t);
    setJenisEdit(t.jenis === "masuk" ? "masuk" : "keluar");
    setJumlahEdit(String(t.jumlah));
    setCatatanEdit(t.catatan);
  };

  const tutup = () => {
    if (!sibuk) setDipilih(null);
  };

  const simpan = async () => {
    if (!dipilih || sibuk) return;
    const n = num(jumlahEdit);
    if (n <= 0) {
      Alert.alert("Jumlah belum diisi", "Jumlah harus lebih dari 0.");
      return;
    }
    setSibuk("simpan");
    try {
      await api.ubahTransaksi(dipilih.id, { jenis: jenisEdit, jumlah: n, catatan: catatanEdit });
      await segarkan();
      setDipilih(null);
    } catch (e: any) {
      Alert.alert("Tidak dapat menyimpan", e?.message ?? "Terjadi kesalahan.");
    } finally {
      setSibuk(null);
    }
  };

  const hapus = () => {
    if (!dipilih || sibuk) return;
    Alert.alert("Hapus transaksi ini?", "Stok barang dihitung ulang tanpa transaksi ini. Penghapusan tercatat dengan namamu.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setSibuk("hapus");
          try {
            await api.hapusTransaksi(dipilih.id);
            await segarkan();
            setDipilih(null);
          } catch (e: any) {
            Alert.alert("Tidak dapat menghapus", e?.message ?? "Terjadi kesalahan.");
          } finally {
            setSibuk(null);
          }
        },
      },
    ]);
  };

  const n = num(jumlahEdit);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Riwayat Stok">
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search" placeholderTextColor={colors.textMuted} value={query} onChangeText={(t) => { setQuery(t); setPage(1); }} />
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
              <Pressable onPress={() => { setFilter(f.key); setPage(1); }} style={[styles.chip, on && { backgroundColor: colors.primary }]}>
                <Text style={[styles.chipText, on && { color: colors.white }]}>{f.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {izin.kelolaData ? <Text style={styles.petunjuk}>Ketuk satu baris untuk mengubah atau menghapus transaksi.</Text> : null}

      <FlatList
        data={halaman}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada riwayat.</Text>}
        ListFooterComponent={<Pagination current={current} total={totalPages} onChange={setPage} />}
        renderItem={({ item: t }) => {
          // Perubahan stok: dari jenisnya (opname dihitung dari stok sebelum/sesudah)
          const delta =
            t.jenis === "opname" ? (t.stokSesudah ?? 0) - (t.stokSebelum ?? 0) : t.jenis === "masuk" ? t.jumlah : -t.jumlah;
          const tanda = delta > 0 ? "+" : delta < 0 ? "−" : "±";
          return (
            <Pressable style={({ pressed }) => [styles.row, pressed && izin.kelolaData && { opacity: 0.85 }]} onPress={() => buka(t)}>
              <FotoBarang gambar={t.gambar} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nama}>{t.nama}</Text>
                <Text style={styles.sub}>{formatWaktu(t.waktu)}{t.oleh ? ` · ${t.oleh}` : ""}</Text>
                {t.stokSebelum != null && t.stokSesudah != null ? (
                  <Text style={styles.sub}>Stok {t.stokSebelum} → {t.stokSesudah} {t.satuan}</Text>
                ) : null}
                {t.catatan ? <Text style={styles.note}>“{t.catatan}”</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.delta, { color: warna[t.jenis] }]}>{tanda}{Math.abs(delta)}</Text>
                <Text style={[styles.jenis, { color: warna[t.jenis] }]}>{labelJenis[t.jenis]}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => router.push("/transaksi" as any)}>
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>

      <Modal visible={!!dipilih} animationType="slide" transparent onRequestClose={tutup}>
        <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={tutup} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Ubah Transaksi</Text>
              <Pressable onPress={tutup} hitSlop={12}>
                <Ionicons name="close" size={26} color={colors.navy} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {dipilih ? (
                <View style={styles.info}>
                  <FotoBarang gambar={dipilih.gambar} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nama}>{dipilih.nama}</Text>
                    <Text style={styles.sub}>{formatWaktu(dipilih.waktu)}{dipilih.oleh ? ` · ${dipilih.oleh}` : ""}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.toggle}>
                <Pressable style={[styles.toggleBtn, jenisEdit === "masuk" && { backgroundColor: colors.success }]} onPress={() => setJenisEdit("masuk")}>
                  <Text style={[styles.toggleText, jenisEdit === "masuk" && { color: colors.white }]}>Barang Masuk</Text>
                </Pressable>
                <Pressable style={[styles.toggleBtn, jenisEdit === "keluar" && { backgroundColor: colors.danger }]} onPress={() => setJenisEdit("keluar")}>
                  <Text style={[styles.toggleText, jenisEdit === "keluar" && { color: colors.white }]}>Barang Keluar</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Jumlah{dipilih ? ` (${dipilih.satuan})` : ""}</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtn} onPress={() => setJumlahEdit(String(Math.max(0, n - 1)))}>
                  <Ionicons name="remove" size={22} color={colors.white} />
                </Pressable>
                <TextInput style={styles.stepInput} value={jumlahEdit} onChangeText={setJumlahEdit} keyboardType="numeric" />
                <Pressable style={styles.stepBtn} onPress={() => setJumlahEdit(String(n + 1))}>
                  <Ionicons name="add" size={22} color={colors.white} />
                </Pressable>
              </View>

              <Text style={styles.label}>Catatan</Text>
              <TextInput style={styles.catatan} value={catatanEdit} onChangeText={setCatatanEdit} placeholder="Catatan (opsional)" placeholderTextColor={colors.textMuted} multiline />

              <Text style={styles.petunjuk2}>Stok barang dihitung ulang otomatis. Kalau perubahan ini membuat stok negatif, perubahan ditolak.</Text>

              <View style={{ marginTop: 16 }}>
                <PrimaryButton label="Simpan Perubahan" onPress={simpan} loading={sibuk === "simpan"} disabled={sibuk === "hapus"} />
              </View>
              <Pressable style={styles.hapus} onPress={hapus} disabled={!!sibuk}>
                {sibuk === "hapus" ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.hapusText}>Hapus Transaksi</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, height: 48, gap: 8, ...shadow },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  chips: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  petunjuk: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, paddingHorizontal: 24, marginTop: -6, marginBottom: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  nama: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.navy, fontStyle: "italic", marginTop: 3 },
  delta: { fontFamily: fonts.bold, fontSize: 22 },
  jenis: { fontFamily: fonts.medium, fontSize: 12 },
  empty: { textAlign: "center", marginTop: 40, fontFamily: fonts.regular, color: colors.textMuted },
  fab: { position: "absolute", right: 24, bottom: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadow },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "85%" },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  info: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  toggle: { flexDirection: "row", gap: 8, backgroundColor: colors.primarySoft, padding: 5, borderRadius: radius.pill },
  toggleBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  toggleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginTop: 16, marginBottom: 6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  stepInput: { flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 24, color: colors.navy, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingVertical: 6 },
  catatan: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10, minHeight: 56, textAlignVertical: "top" },
  petunjuk2: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginTop: 12 },
  hapus: { alignItems: "center", padding: 14, marginTop: 4 },
  hapusText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
});