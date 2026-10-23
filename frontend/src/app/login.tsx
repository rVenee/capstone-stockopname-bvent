import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import { colors, fonts } from "../constants/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");

  const masuk = () => {
    if (!email.trim() || !password) {
      Alert.alert("Data belum lengkap", "Email dan password wajib diisi.");
      return;
    }
    if (!email.includes("@")) {
      Alert.alert("Email tidak valid", "Periksa kembali alamat email.");
      return;
    }
    router.replace("/home");
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.top, { paddingTop: insets.top }]}>
        <Text style={styles.logo}>VENT</Text>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Company Code"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          value={company}
          onChangeText={setCompany}
        />

        <View style={{ marginTop: 28 }}>
          <PrimaryButton label="Masuk" onPress={masuk} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  top: { height: 240, alignItems: "center", justifyContent: "center" },
  logo: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 56,
    fontStyle: "italic",
    letterSpacing: 2,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  sheetContent: { padding: 32, paddingTop: 36 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.primary,
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.text,
    paddingVertical: 12,
    marginBottom: 18,
  },
});