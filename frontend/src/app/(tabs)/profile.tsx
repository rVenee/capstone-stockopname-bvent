import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import ScreenHeader from "../../components/ScreenHeader";
import { colors, fonts, radius, shadow } from "../../constants/theme";
import { useUser } from "../../data/UserContext";

export default function Profile() {
  const { user } = useUser();

  const fields = [
    { label: "Email", value: user.email, icon: "mail-outline" },
    { label: "Phone Number", value: user.telepon, icon: "call-outline" },
    { label: "Password", value: "***********", icon: "lock-closed-outline" },
  ] as const;

  const keluar = () =>
    Alert.alert("Log out", "Yakin ingin keluar dari akun ini?", [
      { text: "Batal", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => router.replace("/login") },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Profile" showBack={false} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={64} color={colors.navy} />
        </View>
        <Text style={styles.nama}>{user.nama}</Text>
        <Text style={styles.peran}>{user.peran}</Text>
        <Text style={styles.perusahaan}>{user.perusahaan}</Text>

        <View style={{ marginTop: 28, gap: 14 }}>
          {fields.map((f) => (
            <View key={f.label}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={styles.field}>
                <Text style={styles.value}>{f.value}</Text>
                <Ionicons name={f.icon} size={22} color={colors.textMuted} />
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 28 }}>
          <PrimaryButton label="Edit Profil" onPress={() => router.push("/profile-edit" as any)} />
        </View>

        <Text style={styles.logout} onPress={keluar}>
          Log out
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 40, alignItems: "stretch" },
  avatar: {
    alignSelf: "center", width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primaryLight,
    borderWidth: 3, borderColor: colors.navy, alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  nama: { fontFamily: fonts.bold, fontSize: 22, color: colors.primary, textAlign: "center", marginTop: 14 },
  peran: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, textAlign: "center" },
  perusahaan: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 2 },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginBottom: 6, marginLeft: 4 },
  field: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.primarySoft,
    borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 16, ...shadow,
  },
  value: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  logout: {
    fontFamily: fonts.semibold, fontSize: 18, color: colors.primary, textAlign: "center", marginTop: 28, padding: 8,
  },
});