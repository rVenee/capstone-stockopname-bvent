import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import PrimaryButton from "../../components/PrimaryButton";
import AvatarProfil from "../../components/AvatarProfil";
import { useUser } from "../../data/UserContext";
import { pilihFoto, SumberFoto } from "../../services/foto";
import { hapusFotoProfil, unggahFotoProfil, useFotoProfil } from "../../services/fotoProfil";
import { colors, fonts, radius } from "../../constants/theme";

export default function ProfileEdit() {
  const { user, simpanProfil } = useUser();
  const { nama: fotoNama } = useFotoProfil();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [telepon, setTelepon] = useState("");
  const [passBaru, setPassBaru] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [fotoSibuk, setFotoSibuk] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setNama(user.nama);
      setEmail(user.email);
      setTelepon(user.telepon);
      setPassBaru("");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const ambilFoto = async (sumber: SumberFoto) => {
    if (fotoSibuk) return;
    try {
      const uri = await pilihFoto(sumber);
      if (!uri) return;
      setFotoSibuk(true);
      await unggahFotoProfil(uri);
    } catch (e: any) {
      Alert.alert("Foto profil", e?.message ?? "Tidak dapat memproses foto.");
    } finally {
      setFotoSibuk(false);
    }
  };

  const hapusFoto = () =>
    Alert.alert("Hapus foto profil?", "Foto profilmu akan dihapus.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setFotoSibuk(true);
          try {
            await hapusFotoProfil();
          } catch (e: any) {
            Alert.alert("Gagal", e?.message ?? "Terjadi kesalahan.");
          } finally {
            setFotoSibuk(false);
          }
        },
      },
    ]);

  const simpan = async () => {
    if (menyimpan) return;
    if (!nama.trim()) { Alert.alert("Data belum lengkap", "Nama tidak boleh kosong."); return; }
    if (!email.includes("@")) { Alert.alert("Email tidak valid", "Periksa kembali alamat email."); return; }
    if (passBaru && passBaru.length < 6) { Alert.alert("Password terlalu pendek", "Password baru minimal 6 karakter."); return; }
    setMenyimpan(true);
    try {
      await simpanProfil({ nama: nama.trim(), email: email.trim(), telepon: telepon.trim(), passwordBaru: passBaru || undefined });
      Alert.alert("Profil diperbarui", "Perubahan berhasil disimpan.");
      router.back();
    } catch (e: any) {
      Alert.alert("Gagal menyimpan", e?.message ?? "Terjadi kesalahan.");
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Edit Profile" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.fotoBox}>
          <View>
            <AvatarProfil size={116} bordered />
            {fotoSibuk ? (
              <View style={styles.overlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
          </View>
          <View style={styles.fotoAksi}>
            <Pressable style={styles.aksiBtn} onPress={() => ambilFoto("kamera")} disabled={fotoSibuk}>
              <Ionicons name="camera" size={18} color={colors.primary} />
              <Text style={styles.aksiText}>Kamera</Text>
            </Pressable>
            <Pressable style={styles.aksiBtn} onPress={() => ambilFoto("galeri")} disabled={fotoSibuk}>
              <Ionicons name="images" size={18} color={colors.primary} />
              <Text style={styles.aksiText}>Galeri</Text>
            </Pressable>
            {fotoNama ? (
              <Pressable style={styles.aksiBtn} onPress={hapusFoto} disabled={fotoSibuk}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.aksiText, { color: colors.danger }]}>Hapus</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={nama} onChangeText={setNama} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} value={telepon} onChangeText={setTelepon} keyboardType="phone-pad" />

        <Text style={styles.label}>Password Baru (opsional)</Text>
        <TextInput style={styles.input} value={passBaru} onChangeText={setPassBaru} secureTextEntry placeholder="Kosongkan jika tidak diganti" placeholderTextColor={colors.textMuted} />

        <View style={{ marginTop: 28 }}>
          <PrimaryButton label="Save Changes" onPress={simpan} loading={menyimpan} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 40 },
  fotoBox: { alignItems: "center", gap: 14, marginBottom: 4 },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 58,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },
  fotoAksi: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" },
  aksiBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: colors.primarySoft,
  },
  aksiText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  input: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 14 },
});