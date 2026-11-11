import { useCallback, useState } from "react";
import {
  Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import PrimaryButton from "../../components/PrimaryButton";
import BarcodeScanner from "../../components/BarcodeScanner";
import FotoBarang from "../../components/FotoBarang";
import { useBarang } from "../../data/BarangContext";
import { formatTanggal, keTanggalIso } from "../../data/barang";
import { hapusFoto, pilihFoto, SumberFoto, unggahFoto } from "../../services/foto";
import { colors, fonts, radius } from "../../constants/theme";

const num = (t: string) => Number(t.replace(/\D/g, "")) || 0;

// Pilihan berbentuk chip, dengan opsi "+ Baru" untuk mengetik nilai sendiri
function PilihanTeks({
  opsi, nilai, onChange, placeholder,
}: { opsi: string[]; nilai: string; onChange: (v: string) => void; placeholder: string }) {
  const [baru, setBaru] = useState(false);
  const daftar = baru || !nilai || opsi.includes(nilai) ? opsi : [...opsi, nilai];
  return (
    <View>
      <View style={styles.chips}>
        {daftar.map((o) => {
          const on = !baru && o === nilai;
          return (
            <Pressable
              key={o}
              onPress={() => {
                setBaru(false);
                onChange(o);
              }}
              style={[styles.chip, on && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.chipText, on && { color: colors.white }]}>{o}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setBaru(true);
            onChange("");
          }}
          style={[styles.chip, baru && { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.chipText, baru && { color: colors.white }]}>+ Baru</Text>
        </Pressable>
      </View>
      {baru ? (
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          value={nilai}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
      ) : null}
    </View>
  );
}

export default function BarangForm() {
  const { id, kode: kodeParam } = useLocalSearchParams<{ id?: string; kode?: string }>();
  const { getById, tambah, ubah, segarkan, kategori: daftarKategori, satuan: daftarSatuan } = useBarang();
  const editing = !!id;

  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  const [kategori, setKategori] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [satuan, setSatuan] = useState("");
  const [stok, setStok] = useState("");
  const [stokMin, setStokMin] = useState("");
  const [harga, setHarga] = useState("");
  const [pemasok, setPemasok] = useState("");
  const [kedaluwarsa, setKedaluwarsa] = useState("");
  const [gambarLama, setGambarLama] = useState<string | null>(null);
  const [fotoLokal, setFotoLokal] = useState<string | null>(null);
  const [hapusFotoLama, setHapusFotoLama] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const b = id ? getById(id) : undefined;
      setNama(b?.nama ?? "");
      setKode(b?.kode ?? kodeParam ?? "");
      setKategori(b?.kategori ?? daftarKategori[0] ?? "Lainnya");
      setLokasi(b?.lokasi ?? "");
      setSatuan(b?.satuan ?? daftarSatuan[0] ?? "pcs");
      setStok(b ? String(b.stok) : "");
      setStokMin(b ? String(b.stokMin) : "");
      setHarga(b ? String(b.harga) : "");
      setPemasok(b?.pemasok ?? "");
      setKedaluwarsa(b?.kedaluwarsa ? formatTanggal(b.kedaluwarsa) : "");
      setGambarLama(b?.gambar ?? null);
      setFotoLokal(null);
      setHapusFotoLama(false);
      setScanOpen(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, kodeParam])
  );

  const ambilFoto = async (sumber: SumberFoto) => {
    try {
      const uri = await pilihFoto(sumber);
      if (uri) {
        setFotoLokal(uri);
        setHapusFotoLama(false);
      }
    } catch (e: any) {
      Alert.alert("Foto", e?.message ?? "Tidak dapat mengambil foto.");
    }
  };

  const hapusFotoPilihan = () => {
    setFotoLokal(null);
    if (gambarLama) setHapusFotoLama(true);
  };

  const punyaFoto = !!fotoLokal || (!!gambarLama && !hapusFotoLama);

  const simpan = async () => {
    if (menyimpan) return;
    if (!nama.trim() || !kode.trim()) {
      Alert.alert("Data belum lengkap", "Nama barang dan kode barang wajib diisi.");
      return;
    }
    if (!kategori.trim() || !satuan.trim()) {
      Alert.alert("Data belum lengkap", "Kategori dan satuan wajib diisi.");
      return;
    }
    const exp = keTanggalIso(kedaluwarsa);
    if (exp === undefined) {
      Alert.alert("Tanggal tidak valid", "Tanggal kedaluwarsa memakai format HH-BB-TTTT, mis. 31-12-2026.");
      return;
    }
    const data = {
      nama: nama.trim(),
      kode: kode.trim(),
      kategori: kategori.trim(),
      lokasi: lokasi.trim(),
      satuan: satuan.trim(),
      stok: num(stok),
      stokMin: num(stokMin),
      harga: num(harga),
      emoji: "📦", // tidak ditampilkan lagi; hanya mengisi kolom lama di database
      pemasok: pemasok.trim(),
      kedaluwarsa: exp,
    };

    setMenyimpan(true);
    const hasil = editing && id ? await ubah(id, data) : await tambah(data);
    if (!hasil.ok) {
      setMenyimpan(false);
      Alert.alert("Gagal menyimpan", hasil.error);
      return;
    }

    // Foto diunggah setelah barangnya tersimpan (butuh id barang)
    let peringatan: string | null = null;
    try {
      if (fotoLokal) await unggahFoto(hasil.barang.id, fotoLokal);
      else if (hapusFotoLama && gambarLama) await hapusFoto(hasil.barang.id);
      if (fotoLokal || hapusFotoLama) await segarkan();
    } catch (e: any) {
      peringatan = e?.message ?? "Foto gagal diproses.";
    }
    setMenyimpan(false);
    if (peringatan) {
      Alert.alert("Barang tersimpan", `Data barang sudah disimpan, tetapi fotonya belum berhasil: ${peringatan}`);
    }
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={editing ? "Edit Barang" : "Tambah Barang"} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.fotoRow}>
          {fotoLokal ? (
            <Image source={{ uri: fotoLokal }} style={styles.fotoBaru} />
          ) : (
            <FotoBarang gambar={hapusFotoLama ? null : gambarLama} size={112} />
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <Pressable style={styles.fotoBtn} onPress={() => ambilFoto("kamera")}>
              <Ionicons name="camera" size={20} color={colors.white} />
              <Text style={styles.fotoBtnText}>Ambil Foto</Text>
            </Pressable>
            <Pressable style={[styles.fotoBtn, styles.fotoBtnOutline]} onPress={() => ambilFoto("galeri")}>
              <Ionicons name="images" size={20} color={colors.primary} />
              <Text style={[styles.fotoBtnText, { color: colors.primary }]}>Pilih dari Galeri</Text>
            </Pressable>
            {punyaFoto ? (
              <Pressable onPress={hapusFotoPilihan} hitSlop={8}>
                <Text style={styles.hapusFoto}>Hapus foto</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.label}>Nama Barang</Text>
        <TextInput style={styles.input} value={nama} onChangeText={setNama} placeholder="mis. Beras" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Kode Barang</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={kode}
            onChangeText={setKode}
            placeholder="Ketik atau scan barcode"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.scanBtn} onPress={() => setScanOpen(true)}>
            <Ionicons name="scan" size={24} color={colors.white} />
          </Pressable>
        </View>

        <Text style={styles.label}>Kategori</Text>
        <PilihanTeks opsi={daftarKategori} nilai={kategori} onChange={setKategori} placeholder="Nama kategori baru" />

        <Text style={styles.label}>Lokasi</Text>
        <TextInput style={styles.input} value={lokasi} onChangeText={setLokasi} placeholder="mis. Rak A-1" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Satuan</Text>
        <PilihanTeks opsi={daftarSatuan} nilai={satuan} onChange={setSatuan} placeholder="Satuan baru, mis. karung" />

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

        <Text style={styles.label}>Pemasok (opsional)</Text>
        <TextInput style={styles.input} value={pemasok} onChangeText={setPemasok} placeholder="Nama pemasok" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Tanggal Kedaluwarsa (opsional)</Text>
        <TextInput style={styles.input} value={kedaluwarsa} onChangeText={setKedaluwarsa} placeholder="HH-BB-TTTT, mis. 31-12-2026" placeholderTextColor={colors.textMuted} />

        <View style={{ marginTop: 28 }}>
          <PrimaryButton
            label={editing ? "Simpan Perubahan" : "Simpan Barang"}
            onPress={simpan}
            loading={menyimpan}
          />
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
  fotoRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 },
  fotoBaru: { width: 112, height: 112, borderRadius: 25, backgroundColor: colors.primarySoft },
  fotoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: 14,
  },
  fotoBtnOutline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  fotoBtnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
  hapusFoto: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger, textAlign: "center", paddingVertical: 4 },
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
  modal: { flex: 1, backgroundColor: colors.white, padding: 20, paddingTop: 50 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  modalHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 16 },
});