import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import Card from "../../components/Card";
import Pagination, { paginate } from "../../components/Pagination";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import { colors, fonts } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { formatSelisih, ringkasSesi } from "../../data/opname";
import { formatWaktu } from "../../data/transaksi";

export default function Opname() {
  const { sesi, draft, items, mulaiOpname } = useBarang();
  const [page, setPage] = useState(1);
  const [memulai, setMemulai] = useState(false);
  const terisi = Object.values(draft).filter((v) => v.trim() !== "").length;
  const { items: halaman, current, totalPages } = paginate(sesi, page);

  const mulai = () => {
    const buka = async () => {
      setMemulai(true);
      const hasil = await mulaiOpname();
      setMemulai(false);
      if (!hasil.ok) {
        Alert.alert("Gagal memulai sesi", hasil.error);
        return;
      }
      router.push("/opname-hitung" as any);
    };
    if (terisi > 0) {
      Alert.alert("Mulai sesi baru?", "Hitungan sesi yang sedang berjalan akan dihapus.", [
        { text: "Batal", style: "cancel" },
        { text: "Mulai Baru", style: "destructive", onPress: buka },
      ]);
    } else {
      buka();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Stock Opname" />
      <FlatList
        data={halaman}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Card>
              <Text style={styles.judul}>Cocokkan stok sistem dengan stok fisik</Text>
              <Text style={styles.teks}>
                Hitung barang di gudang, masukkan jumlah fisiknya, lalu terapkan selisihnya ke sistem.
              </Text>
              <View style={{ marginTop: 14 }}>
                <PrimaryButton label="Mulai Opname Baru" onPress={mulai} loading={memulai} />
              </View>
            </Card>

            {terisi > 0 ? (
              <Card style={{ backgroundColor: colors.primarySoft }}>
                <Text style={styles.judul}>Sesi sedang berjalan</Text>
                <Text style={styles.teks}>
                  {terisi} dari {items.length} barang sudah dihitung.
                </Text>
                <View style={{ marginTop: 12 }}>
                  <PrimaryButton
                    label="Lanjutkan Menghitung"
                    variant="outline"
                    onPress={() => router.push("/opname-hitung" as any)}
                  />
                </View>
              </Card>
            ) : null}

            <Text style={styles.section}>Riwayat Sesi</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.kosong}>Belum ada sesi opname.</Text>}
        ListFooterComponent={<Pagination current={current} total={totalPages} onChange={setPage} />}
        renderItem={({ item: s }) => {
          const r = ringkasSesi(s.baris);
          const selisih = s.baris.filter((b) => b.selisih !== 0);
          return (
            <Card style={{ marginTop: 10 }}>
              <Text style={styles.waktu}>{formatWaktu(s.waktu)}</Text>
              {s.catatan ? <Text style={styles.catatan}>“{s.catatan}”</Text> : null}
              <View style={styles.badges}>
                <StatusBadge label={`${r.diperiksa} diperiksa`} variant="info" />
                <StatusBadge label={`${r.sesuai} sesuai`} variant="success" />
                {r.selisih > 0 ? <StatusBadge label={`${r.selisih} selisih`} variant="danger" /> : null}
              </View>
              {selisih.map((b) => (
                <Text key={b.barangId} style={styles.baris}>
                  {b.nama}: sistem {b.sistem} → fisik {b.fisik} ({formatSelisih(b.selisih)} {b.satuan})
                </Text>
              ))}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40 },
  judul: { fontFamily: fonts.semibold, fontSize: 16, color: colors.navy },
  teks: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  section: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy, marginTop: 10 },
  kosong: { textAlign: "center", marginTop: 20, fontFamily: fonts.regular, color: colors.textMuted },
  waktu: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  catatan: { fontFamily: fonts.regular, fontSize: 13, color: colors.navy, fontStyle: "italic", marginTop: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  baris: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.text, marginTop: 8 },
});