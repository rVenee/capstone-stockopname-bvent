import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BarcodeScanner from "../../components/BarcodeScanner";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import { colors, fonts, radius } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { EMOJI, KATEGORI, SATUAN } from "../../data/barang";

const num = (t: string) => Number(t.replace(/\D/g, "")) || 0;

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.chip, on && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.chipText, on && { color: colors.white }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BarangForm() {
  const { id, kode: kodeParam } = useLocalSearchParams<{ id?: string; kode?: string }>();
  const { getById, tambah, ubah } = useBarang();
  const editing = !!id;

  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  const [kategori, setKategori] = useState(KATEGORI[0]);
  const [lokasi, setLokasi] = useState("");
  const [satuan, setSatuan] = useState(SATUAN[0]);
  const [stok, setStok] = useState("");
  const [stokMin, setStokMin] = useState("");
  const [harga, setHarga] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [scanOpen, setScanOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const b = id ? getById(id) : undefined;
      setNama(b?.nama ?? "");
      setKode(b?.kode ?? kodeParam ?? "");
      setKategori(b?.kategori ?? KATEGORI[0]);
      setLokasi(b?.lokasi ?? "");
      setSatuan(b?.satuan ?? SATUAN[0]);
      setStok(b ? String(b.stok) : "");
      setStokMin(b ? String(b.stokMin) : "");
      setHarga(b ? String(b.harga) : "");
      setEmoji(b?.emoji ?? EMOJI[0]);
      setScanOpen(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, kodeParam])
  );

  const simpan = () => {
    if (!nama.trim() || !kode.trim()) {
      Alert.alert("Data belum lengkap", "Nama barang dan kode barang wajib diisi.");
      return;
    }
    const data = {
      nama: nama.trim(),
      kode: kode.trim(),
      kategori,
      lokasi: lokasi.trim(),
      satuan,
      stok: num(stok),
      stokMin: num(stokMin),
      harga: num(harga),
      emoji,
    };
    if (editing && id) ubah(id, data);
    else tambah(data);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={editing ? "Edit Barang" : "Tambah Barang"} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nama Barang</Text>
        <TextInput style={styles.input} value={nama} onChangeText={setNama} placeholder="mis. Beras" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Kode Barang</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={kode}
            onChangeText={setKode}
            keyboardType="numeric"
            placeholder="Ketik atau scan barcode"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.scanBtn} onPress={() => setScanOpen(true)}>
            <Ionicons name="scan" size={24} color={colors.white} />
          </Pressable>
        </View>

        <Text style={styles.label}>Kategori</Text>
        <Chips options={KATEGORI} value={kategori} onChange={setKategori} />

        <Text style={styles.label}>Lokasi</Text>
        <TextInput style={styles.input} value={lokasi} onChangeText={setLokasi} placeholder="mis. Rak A-1" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Satuan</Text>
        <Chips options={SATUAN} value={satuan} onChange={setSatuan} />

        <View style={styles.two}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stok</Text>
            <TextInput style={styles.input} value={stok} onChangeText={setStok} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stok Minimum</Text>
            <TextInput style={styles.input} value={stokMin} onChangeText={setStokMin} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        <Text style={styles.label}>Harga (Rp)</Text>
        <TextInput style={styles.input} value={harga} onChangeText={setHarga} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Gambar</Text>
        <View style={styles.chips}>
          {EMOJI.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={[styles.emojiBox, e === emoji && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
            >
              <Text style={{ fontSize: 28 }}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: 28 }}>
          <PrimaryButton label={editing ? "Simpan Perubahan" : "Simpan Barang"} onPress={simpan} />
        </View>
      </ScrollView>

      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Scan Barcode</Text>
            <Pressable onPress={() => setScanOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={28} color={colors.navy} />
            </Pressable>
          </View>
          <BarcodeScanner
            aktif={scanOpen}
            tinggi={420}
            onScan={(k) => {
              setKode(k);
              setScanOpen(false);
            }}
          />
          <Text style={styles.modalHint}>Arahkan kamera ke barcode, kodenya akan terisi otomatis.</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginTop: 16, marginBottom: 6 },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  two: { flexDirection: "row", gap: 12 },
  emojiBox: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modal: { flex: 1, backgroundColor: colors.white, padding: 20, paddingTop: 50 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  modalHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 16 },
});