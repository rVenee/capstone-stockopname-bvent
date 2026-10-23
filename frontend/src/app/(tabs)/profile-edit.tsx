import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import { colors, fonts, radius } from "../../constants/theme";
import { useUser } from "../../data/UserContext";

export default function ProfileEdit() {
  const { user, ubahUser } = useUser();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [telepon, setTelepon] = useState("");
  const [passBaru, setPassBaru] = useState("");

  useFocusEffect(
    useCallback(() => {
      setNama(user.nama);
      setEmail(user.email);
      setTelepon(user.telepon);
      setPassBaru("");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const simpan = () => {
    if (!nama.trim()) {
      Alert.alert("Data belum lengkap", "Nama tidak boleh kosong.");
      return;
    }
    if (!email.includes("@")) {
      Alert.alert("Email tidak valid", "Periksa kembali alamat email.");
      return;
    }
    if (passBaru && passBaru.length < 6) {
      Alert.alert("Password terlalu pendek", "Password baru minimal 6 karakter.");
      return;
    }
    ubahUser({ nama: nama.trim(), email: email.trim(), telepon: telepon.trim() });
    Alert.alert("Profil diperbarui", "Perubahan berhasil disimpan.");
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Edit Profile" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}>
          <Ionicons name="person" size={64} color={colors.navy} />
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={nama} onChangeText={setNama} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} value={telepon} onChangeText={setTelepon} keyboardType="phone-pad" />

        <Text style={styles.label}>Password Baru (opsional)</Text>
        <TextInput
          style={styles.input}
          value={passBaru}
          onChangeText={setPassBaru}
          secureTextEntry
          placeholder="Kosongkan jika tidak diganti"
          placeholderTextColor={colors.textMuted}
        />

        <View style={{ marginTop: 28 }}>
          <PrimaryButton label="Save Changes" onPress={simpan} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 40 },
  avatar: {
    alignSelf: "center", width: 110, height: 110, borderRadius: 55, backgroundColor: colors.primaryLight,
    borderWidth: 3, borderColor: colors.navy, alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  input: {
    fontFamily: fonts.regular, fontSize: 16, color: colors.text, backgroundColor: colors.primarySoft,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 14,
  },
});