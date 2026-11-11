import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import Card from "../../components/Card";
import PrimaryButton from "../../components/PrimaryButton";
import StatusBadge from "../../components/StatusBadge";
import FotoBarang from "../../components/FotoBarang";
import Pagination, { paginate } from "../../components/Pagination";
import { useBarang } from "../../data/BarangContext";
import { useUser } from "../../data/UserContext";
import { buatBaris, formatSelisih, ringkasSesi } from "../../data/opname";
import { colors, fonts, radius, shadow } from "../../constants/theme";

export default function OpnameRingkasan() {
  const { items, draft, terapkanOpname } = useBarang();
  const { izin } = useUser();
  const [catatan, setCatatan] = useState("");
  const [page, setPage] = useState(1);
  const [menerapkan, setMenerapkan] = useState(false);

  const baris = useMemo(
    () => buatBaris(items, draft).sort((a, b) => Number(b.selisih !== 0) - Number(a.selisih !== 0) || Math.abs(b.selisih) - Math.abs(a.selisih)),
    [items, draft]
  );
  const r = ringkasSesi(baris);
  const { items: halaman, current, totalPages } = paginate(baris, page);

  const stats = [
    { n: r.diperiksa, label: "Diperiksa", bg: colors.primaryLight, fg: colors.navy },
    { n: r.sesuai, label: "Sesuai", bg: colors.successBg, fg: colors.success },
    { n: r.selisih, label: "Selisih", bg: colors.dangerBg, fg: colors.danger },
  ];

  const terapkan = () => {
    if (menerapkan) return;
    Alert.alert(
      "Terapkan penyesuaian?",
      r.selisih > 0 ? `Stok ${r.selisih} barang akan disesuaikan dengan hitungan fisik dan dicatat di Riwayat Stok.` : "Semua barang sesuai. Sesi opname akan disimpan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Terapkan",
          onPress: async () => {
            setMenerapkan(true);
            const hasil = await terapkanOpname(catatan);
            setMenerapkan(false);
            if (!hasil.ok) { Alert.alert("Gagal", hasil.error); return; }
            setCatatan("");
            setPage(1);
            Alert.alert("Opname selesai", "Stok sistem sudah disesuaikan dengan hitungan fisik.");
            router.navigate("/opname" as any);
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Ringkasan Selisih" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: s.bg }]}>
              <Text style={[styles.statN, { color: s.fg }]}>{s.n}</Text>
              <Text style={[styles.statL, { color: s.fg }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Hasil Hitungan</Text>
        {baris.length === 0 ? (
          <Card><Text style={styles.kosong}>Belum ada barang yang dihitung. Kembali dan isi jumlah fisik.</Text></Card>
        ) : (
          <View style={{ gap: 10 }}>
            {halaman.map((b) => (
              <View key={b.barangId} style={styles.row}>
                <FotoBarang gambar={b.gambar} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nama} numberOfLines={1}>{b.nama}</Text>
                  <Text style={styles.sub}>Sistem {b.sistem} → Fisik {b.fisik} {b.satuan}</Text>
                </View>
                <StatusBadge label={b.selisih === 0 ? "Sesuai" : formatSelisih(b.selisih)} variant={b.selisih === 0 ? "success" : b.selisih > 0 ? "info" : "danger"} />
              </View>
            ))}
            <Pagination current={current} total={totalPages} onChange={setPage} />
          </View>
        )}

        {izin.terapkanOpname ? (
          <>
            <Text style={styles.label}>Catatan (opsional)</Text>
            <TextInput style={styles.note} value={catatan} onChangeText={setCatatan} placeholder="mis. Opname akhir bulan" placeholderTextColor={colors.textMuted} multiline />
            <Text style={styles.info}>Menerapkan akan menyesuaikan stok sistem dengan hitungan fisik. Setiap selisih tercatat di Riwayat Stok sebagai “Opname”.</Text>
          </>
        ) : (
          <Card style={{ backgroundColor: colors.primarySoft, marginTop: 24 }}>
            <Text style={styles.infoIzin}>Hanya Admin atau Leader yang dapat menerapkan penyesuaian stok. Hitunganmu sudah tersimpan, minta Admin untuk menerapkannya.</Text>
          </Card>
        )}

        <View style={{ gap: 12, marginTop: 20 }}>
          {izin.terapkanOpname ? <PrimaryButton label="Terapkan Penyesuaian Stok" onPress={terapkan} loading={menerapkan} /> : null}
          <PrimaryButton label="Kembali & Edit Hitungan" variant="outline" onPress={() => router.back()} disabled={menerapkan} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", ...shadow },
  statN: { fontFamily: fonts.bold, fontSize: 28 },
  statL: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 },
  section: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy, marginTop: 24, marginBottom: 12 },
  kosong: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  nama: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginTop: 24, marginBottom: 6 },
  note: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, minHeight: 70, textAlignVertical: "top" },
  info: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 12, lineHeight: 18 },
  infoIzin: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, lineHeight: 20 },
});