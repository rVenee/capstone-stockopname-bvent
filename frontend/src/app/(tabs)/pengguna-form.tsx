import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import ScreenHeader from "../../components/ScreenHeader";
import PrimaryButton from "../../components/PrimaryButton";
import { penggunaApi } from "../../services/penggunaApi";
import { labelPeran, Peran, useUser } from "../../data/UserContext";
import { colors, fonts, radius } from "../../constants/theme";

export default function PenggunaForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useUser();
  const editing = !!id;

  // Leader boleh membuat semua peran, Admin hanya Staff
  const opsiPeran: Peran[] = user.peran === "leader" ? ["staff", "admin", "leader"] : ["staff"];

  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [telepon, setTelepon] = useState("");
  const [password, setPassword] = useState("");
  const [peran, setPeran] = useState<Peran>("staff");
  const [aktif, setAktif] = useState(true);
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setPassword("");
      if (!id) {
        setNama("");
        setEmail("");
        setTelepon("");
        setPeran("staff");
        setAktif(true);
        setMemuat(false);
        return;
      }
      let batal = false;
      setMemuat(true);
      penggunaApi
        .daftar()
        .then((daftar) => {
          const p = daftar.find((x) => x.id === id);
          if (batal || !p) return;
          setNama(p.nama);
          setEmail(p.email);
          setTelepon(p.telepon);
          setPeran(p.peran);
          setAktif(p.aktif);
        })
        .catch((e) => Alert.alert("Gagal memuat", e?.message ?? "Terjadi kesalahan."))
        .finally(() => {
          if (!batal) setMemuat(false);
        });
      return () => {
        batal = true;
      };
    }, [id])
  );

  const simpan = async () => {
    if (menyimpan) return;
    if (!nama.trim()) {
      Alert.alert("Data belum lengkap", "Nama wajib diisi.");
      return;
    }
    if (!email.includes("@")) {
      Alert.alert("Email tidak valid", "Periksa kembali alamat email.");
      return;
    }
    if (!editing && password.length < 6) {
      Alert.alert("Password terlalu pendek", "Password minimal 6 karakter.");
      return;
    }
    if (editing && password && password.length < 6) {
      Alert.alert("Password terlalu pendek", "Password baru minimal 6 karakter.");
      return;
    }
    setMenyimpan(true);
    try {
      if (editing && id) {
        await penggunaApi.ubah(id, {
          nama: nama.trim(),
          email: email.trim(),
          telepon: telepon.trim(),
          peran,
          aktif,
          passwordBaru: password || undefined,
        });
      } else {
        await penggunaApi.tambah({
          nama: nama.trim(),
          email: email.trim(),
          telepon: telepon.trim(),
          password,
          peran,
        });
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Gagal menyimpan", e?.message ?? "Terjadi kesalahan.");
    } finally {
      setMenyimpan(false);
    }
  };

  const nonaktifkan = () =>
    Alert.alert("Nonaktifkan akun?", `${nama} tidak akan bisa login lagi. Riwayat transaksinya tetap tersimpan.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Nonaktifkan",
        style: "destructive",
        onPress: async () => {
          try {
            await penggunaApi.nonaktifkan(id!);
            router.back();
          } catch (e: any) {
            Alert.alert("Gagal", e?.message ?? "Terjadi kesalahan.");
          }
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={editing ? "Edit Pengguna" : "Tambah Pengguna"} />
      {memuat ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nama</Text>
          <TextInput style={styles.input} value={nama} onChangeText={setNama} placeholder="Nama lengkap" placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="nama@perusahaan.com"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>No. Telepon</Text>
          <TextInput
            style={styles.input}
            value={telepon}
            onChangeText={setTelepon}
            keyboardType="phone-pad"
            placeholder="+62..."
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>{editing ? "Password baru (opsional)" : "Password"}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={editing ? "Kosongkan jika tidak diganti" : "Minimal 6 karakter"}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Peran</Text>
          <View style={styles.chips}>
            {opsiPeran.map((p) => {
              const on = p === peran;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeran(p)}
                  style={[styles.chip, on && { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.chipText, on && { color: colors.white }]}>{labelPeran(p)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {user.peran === "admin"
              ? "Admin hanya dapat mengelola akun Staff."
              : "Leader: semua hak. Admin: kelola data dan akun Staff. Staff: mencatat transaksi dan menghitung opname."}
          </Text>

          {editing ? (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Akun aktif</Text>
                <Text style={styles.hint}>Akun nonaktif tidak bisa login.</Text>
              </View>
              <Switch
                value={aktif}
                onValueChange={setAktif}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>
          ) : null}

          <View style={{ marginTop: 28 }}>
            <PrimaryButton
              label={editing ? "Simpan Perubahan" : "Tambah Pengguna"}
              onPress={simpan}
              loading={menyimpan}
            />
          </View>

          {editing && aktif ? (
            <Pressable onPress={nonaktifkan} style={styles.hapus}>
              <Text style={styles.hapusText}>Nonaktifkan Akun</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy, marginTop: 16, marginBottom: 6 },
  input: {
    fontFamily: fonts.regular, fontSize: 16, color: colors.text, backgroundColor: colors.primarySoft,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 8, lineHeight: 18 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22 },
  switchLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  hapus: { alignItems: "center", padding: 12, marginTop: 14 },
  hapusText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
});