import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import Card from "../../components/Card";
import PrimaryButton from "../../components/PrimaryButton";
import { useBarang } from "../../data/BarangContext";
import {
  bacaBerkas, BacaHasil, Bidang, HasilImpor, Jenis, OpsiImpor, pratinjauImpor, terapkanImpor,
} from "../../services/imporApi";
import { colors, fonts, radius } from "../../constants/theme";

const TIDAK_DIPAKAI = "— Tidak dipakai —";

export default function Impor() {
  const { uri, nama, jenis: jenisAwal } = useLocalSearchParams<{ uri: string; nama: string; jenis?: string }>();
  const { segarkan } = useBarang();

  const [baca, setBaca] = useState<BacaHasil | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [jenis, setJenis] = useState<Jenis>(jenisAwal === "riwayat" ? "riwayat" : "barang");
  const [pemetaan, setPemetaan] = useState<Record<string, string | null>>({});
  const [kursTeks, setKursTeks] = useState("1");
  const [lewati, setLewati] = useState(true);
  const [simulasi, setSimulasi] = useState(false);
  const [urutan, setUrutan] = useState<OpsiImpor["urutanTanggal"]>("auto");
  const [jenisBawaan, setJenisBawaan] = useState<"masuk" | "keluar">("keluar");
  const [pratinjau, setPratinjau] = useState<HasilImpor | null>(null);
  const [akhir, setAkhir] = useState<HasilImpor | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pilih, setPilih] = useState<Bidang | null>(null);

  useEffect(() => {
    let batal = false;
    if (!uri) return;
    bacaBerkas(uri, nama ?? "data.csv")
      .then((h) => {
        if (batal) return;
        setBaca(h);
        setPemetaan(h.saran[jenis] ?? {});
      })
      .catch((e) => {
        if (!batal) setGalat(e?.message ?? "File tidak dapat dibaca.");
      });
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const gantiJenis = (j: Jenis) => {
    if (!baca || j === jenis) return;
    setJenis(j);
    setPemetaan(baca.saran[j] ?? {});
    setPratinjau(null);
  };

  const pilihKolom = (kolom: string | null) => {
    if (!pilih) return;
    setPemetaan((prev) => ({ ...prev, [pilih.key]: kolom }));
    setPratinjau(null);
    setPilih(null);
  };

  const kurs = Number(kursTeks.replace(",", "."));

  const badan = () => {
    const opsi: OpsiImpor = {
      kurs: kurs > 0 ? kurs : 1,
      lewatiNonaktif: lewati,
      urutanTanggal: urutan,
      jenisBawaan,
      simulasi,
      hariSimulasi: 30,
    };
    return { berkasId: baca!.berkasId, namaFile: baca!.nama, jenis, pemetaan, opsi };
  };

  const cek = (): string | null => {
    if (!baca) return "File belum dibaca.";
    for (const b of baca.bidang[jenis]) {
      if (b.wajib && !pemetaan[b.key]) return `Pilih kolom untuk "${b.label}".`;
    }
    if (jenis === "riwayat" && !pemetaan.kode && !pemetaan.nama) return 'Pilih kolom "Kode barang" atau "Nama barang".';
    if (jenis === "barang" && !(kurs > 0)) return "Kurs harus lebih dari 0.";
    return null;
  };

  const jalankanPratinjau = async () => {
    const masalah = cek();
    if (masalah) {
      Alert.alert("Pemetaan belum lengkap", masalah);
      return;
    }
    setSibuk(true);
    try {
      setPratinjau(await pratinjauImpor(badan()));
    } catch (e: any) {
      Alert.alert("Pratinjau gagal", e?.message ?? "Terjadi kesalahan.");
    } finally {
      setSibuk(false);
    }
  };

  const terapkan = () => {
    if (!pratinjau) return;
    Alert.alert(
      "Terapkan impor?",
      jenis === "barang"
        ? `${pratinjau.baru} barang baru ditambahkan dan ${pratinjau.diperbarui} barang diperbarui.`
        : `${pratinjau.valid} transaksi riwayat ditambahkan. Stok barang tidak berubah.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Terapkan",
          onPress: async () => {
            setSibuk(true);
            try {
              const h = await terapkanImpor(badan());
              await segarkan();
              setAkhir(h);
            } catch (e: any) {
              Alert.alert("Impor gagal", e?.message ?? "Terjadi kesalahan.");
            } finally {
              setSibuk(false);
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------- tampilan

  if (galat) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Impor Data" />
        <Text style={styles.pesan}>{galat}</Text>
      </View>
    );
  }
  if (!baca) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Impor Data" />
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        <Text style={styles.pesan}>Membaca {nama ?? "file"}...</Text>
      </View>
    );
  }

  if (akhir) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Impor Selesai" />
        <ScrollView contentContainerStyle={styles.body}>
          <Card style={{ alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={styles.judulBesar}>Impor berhasil</Text>
            {akhir.jenis === "barang" ? (
              <Text style={styles.teksTengah}>
                {akhir.baru} barang baru, {akhir.diperbarui} diperbarui
                {akhir.dilewati ? `, ${akhir.dilewati} dilewati` : ""}.
                {akhir.simulasi ? `\n${akhir.simulasi} baris riwayat simulasi dibuat.` : ""}
              </Text>
            ) : (
              <Text style={styles.teksTengah}>{akhir.valid} transaksi riwayat ditambahkan.</Text>
            )}
            {akhir.jumlahError ? <Text style={styles.kecil}>{akhir.jumlahError} baris dilewati karena bermasalah.</Text> : null}
          </Card>
          <View style={{ marginTop: 20 }}>
            <PrimaryButton label="Selesai" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const bidang = baca.bidang[jenis];
  const contoh = (kolom: string | null | undefined) => {
    if (!kolom) return "";
    const i = baca.kolom.indexOf(kolom);
    return i >= 0 ? baca.contoh[0]?.[i] ?? "" : "";
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Impor Data" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 4 }}>
          <Text style={styles.judul}>{baca.nama}</Text>
          <Text style={styles.kecil}>{baca.jumlahBaris} baris · {baca.kolom.length} kolom</Text>
        </Card>

        <Text style={styles.label}>Jenis data</Text>
        <View style={styles.chips}>
          {(["barang", "riwayat"] as Jenis[]).map((j) => (
            <Pressable key={j} onPress={() => gantiJenis(j)} style={[styles.chip, j === jenis && { backgroundColor: colors.primary }]}>
              <Text style={[styles.chipText, j === jenis && { color: colors.white }]}>{j === "barang" ? "Daftar barang" : "Riwayat penjualan"}</Text>
            </Pressable>
          ))}
        </View>
        {baca.jenisSaran !== jenis ? (
          <Text style={styles.petunjuk}>Dari isinya, file ini sepertinya berisi {baca.jenisSaran === "barang" ? "daftar barang" : "riwayat penjualan"}.</Text>
        ) : null}

        <Text style={styles.label}>Pasangkan kolom</Text>
        <Text style={styles.petunjuk}>Aplikasi sudah menebak. Ketuk baris untuk mengubah kolomnya.</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {bidang.map((b) => {
            const kolom = pemetaan[b.key];
            return (
              <Pressable key={b.key} style={({ pressed }) => [styles.baris, pressed && { opacity: 0.8 }]} onPress={() => setPilih(b)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.barisLabel}>{b.label}{b.wajib ? " *" : ""}</Text>
                  <Text style={[styles.barisNilai, !kolom && { color: b.wajib ? colors.danger : colors.textMuted }]} numberOfLines={1}>
                    {kolom ? `${kolom}${contoh(kolom) ? `  (mis. ${contoh(kolom)})` : ""}` : b.wajib ? "Belum dipilih" : "Tidak dipakai"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Pengaturan</Text>
        <Card style={{ gap: 14 }}>
          {jenis === "barang" ? (
            <>
              {pemetaan.harga ? (
                <View>
                  <Text style={styles.barisLabel}>Kurs harga</Text>
                  <TextInput style={styles.input} value={kursTeks} onChangeText={(t) => { setKursTeks(t); setPratinjau(null); }} keyboardType="decimal-pad" />
                  <Text style={styles.petunjuk}>Harga di file dikalikan angka ini. Isi 1 kalau sudah dalam rupiah, atau mis. 16000 kalau harga di file dalam dolar.</Text>
                </View>
              ) : null}
              {pemetaan.status ? (
                <View style={styles.saklar}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.barisLabel}>Lewati barang nonaktif</Text>
                    <Text style={styles.petunjuk}>Baris berstatus Discontinued, Nonaktif, atau sejenisnya tidak diimpor.</Text>
                  </View>
                  <Switch value={lewati} onValueChange={(v) => { setLewati(v); setPratinjau(null); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
                </View>
              ) : null}
              {pemetaan.volume ? (
                <View style={styles.saklar}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.barisLabel}>Buat riwayat penjualan simulasi</Text>
                    <Text style={styles.petunjuk}>Membagi volume penjualan ke 30 hari terakhir supaya Tren dan Rekomendasi bisa dicoba. Berlabel simulasi dan bisa dibatalkan.</Text>
                  </View>
                  <Switch value={simulasi} onValueChange={(v) => { setSimulasi(v); setPratinjau(null); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
                </View>
              ) : null}
            </>
          ) : (
            !pemetaan.jenis ? (
              <View>
                <Text style={styles.barisLabel}>Semua baris dianggap</Text>
                <View style={[styles.chips, { marginTop: 8 }]}>
                  {(["keluar", "masuk"] as const).map((j) => (
                    <Pressable key={j} onPress={() => { setJenisBawaan(j); setPratinjau(null); }} style={[styles.chip, j === jenisBawaan && { backgroundColor: colors.primary }]}>
                      <Text style={[styles.chipText, j === jenisBawaan && { color: colors.white }]}>{j === "keluar" ? "Barang keluar (penjualan)" : "Barang masuk"}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          )}
          {(jenis === "riwayat" || pemetaan.kedaluwarsa) ? (
            <View>
              <Text style={styles.barisLabel}>Urutan tanggal di file</Text>
              <View style={[styles.chips, { marginTop: 8 }]}>
                {([["auto", "Otomatis"], ["hari-bulan", "Hari/Bulan"], ["bulan-hari", "Bulan/Hari"]] as const).map(([k, l]) => (
                  <Pressable key={k} onPress={() => { setUrutan(k); setPratinjau(null); }} style={[styles.chip, k === urutan && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.chipText, k === urutan && { color: colors.white }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton label="Lihat Pratinjau" variant={pratinjau ? "outline" : "filled"} onPress={jalankanPratinjau} loading={sibuk && !pratinjau} />
        </View>

        {pratinjau ? (
          <>
            <Text style={styles.label}>Pratinjau</Text>
            <Card style={{ gap: 6 }}>
              {pratinjau.jenis === "barang" ? (
                <Text style={styles.teks}>
                  <Text style={styles.tebal}>{pratinjau.baru}</Text> barang baru · <Text style={styles.tebal}>{pratinjau.diperbarui}</Text> diperbarui
                  {pratinjau.dilewati ? ` · ${pratinjau.dilewati} dilewati` : ""}
                </Text>
              ) : (
                <Text style={styles.teks}><Text style={styles.tebal}>{pratinjau.valid}</Text> transaksi akan ditambahkan</Text>
              )}
              {pratinjau.simulasi ? <Text style={styles.teks}>{pratinjau.simulasi} barang akan diberi riwayat simulasi</Text> : null}
              <Text style={styles.kecil}>
                {pratinjau.totalBaris} baris di file{pratinjau.jumlahError ? ` · ${pratinjau.jumlahError} bermasalah` : " · tidak ada yang bermasalah"}
              </Text>
              {pratinjau.peringatan.map((p) => (
                <Text key={p} style={styles.peringatan}>ℹ️ {p}</Text>
              ))}
              {pratinjau.contoh.length > 0 ? (
                <View style={styles.contoh}>
                  <Text style={styles.kecil}>Contoh hasil bacaan:</Text>
                  {pratinjau.contoh.slice(0, 3).map((c, i) => (
                    <Text key={i} style={styles.contohBaris} numberOfLines={2}>
                      {pratinjau.jenis === "barang"
                        ? `${c.kode} · ${c.nama}${c.stok != null ? ` · stok ${c.stok}` : ""}${c.harga != null ? ` · Rp ${Math.round(c.harga).toLocaleString("id-ID")}` : ""}`
                        : `${c.tanggal} · ${c.jenis} ${c.jumlah}`}
                    </Text>
                  ))}
                </View>
              ) : null}
              {pratinjau.error.length > 0 ? (
                <View style={styles.contoh}>
                  <Text style={[styles.kecil, { color: colors.danger }]}>Baris bermasalah (akan dilewati):</Text>
                  {pratinjau.error.slice(0, 8).map((e) => (
                    <Text key={e.baris} style={styles.errorBaris}>Baris {e.baris}: {e.pesan}</Text>
                  ))}
                  {pratinjau.jumlahError > 8 ? <Text style={styles.kecil}>dan {pratinjau.jumlahError - 8} lainnya</Text> : null}
                </View>
              ) : null}
            </Card>
            <View style={{ marginTop: 16 }}>
              <PrimaryButton label="Terapkan Impor" onPress={terapkan} loading={sibuk} disabled={pratinjau.valid === 0} />
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={!!pilih} animationType="slide" transparent onRequestClose={() => setPilih(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{pilih?.label}</Text>
              <Pressable onPress={() => setPilih(null)} hitSlop={12}>
                <Ionicons name="close" size={26} color={colors.navy} />
              </Pressable>
            </View>
            <FlatList
              data={[null, ...baca.kolom]}
              keyExtractor={(k) => k ?? "__kosong"}
              renderItem={({ item: k }) => (
                <Pressable style={styles.opsiBaris} onPress={() => pilihKolom(k)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opsiNama}>{k ?? TIDAK_DIPAKAI}</Text>
                    {k ? <Text style={styles.kecil} numberOfLines={1}>mis. {contoh(k) || "(kosong)"}</Text> : null}
                  </View>
                  {(k ?? null) === (pilih ? pemetaan[pilih.key] ?? null : null) ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
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
  body: { padding: 20, paddingBottom: 60 },
  pesan: { textAlign: "center", marginTop: 24, paddingHorizontal: 24, fontFamily: fonts.regular, color: colors.textMuted },
  judul: { fontFamily: fonts.semibold, fontSize: 16, color: colors.navy },
  judulBesar: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  teks: { fontFamily: fonts.regular, fontSize: 14.5, color: colors.text, lineHeight: 21 },
  teksTengah: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlign: "center", lineHeight: 22 },
  tebal: { fontFamily: fonts.bold },
  kecil: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  label: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy, marginTop: 24, marginBottom: 8 },
  petunjuk: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  baris: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
  },
  barisLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  barisNilai: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, marginTop: 2 },
  input: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
  saklar: { flexDirection: "row", alignItems: "center", gap: 12 },
  peringatan: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.navy, lineHeight: 18 },
  contoh: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  contohBaris: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  errorBaris: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "75%" },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy, flex: 1 },
  opsiBaris: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  opsiNama: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});