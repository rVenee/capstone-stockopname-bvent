import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow } from "../constants/theme";
import { useBarang } from "../data/BarangContext";

export default function GalatBanner() {
  const { galat, memuat, refresh } = useBarang();
  const insets = useSafeAreaInsets();
  if (!galat) return null;

  return (
    <View style={[styles.box, { bottom: Math.max(insets.bottom, 12) + 84 }]}>
      <Text style={styles.text}>{galat}</Text>
      <Pressable onPress={refresh} disabled={memuat} hitSlop={8}>
        <Text style={styles.coba}>{memuat ? "Memuat..." : "Coba lagi"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow,
  },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.white },
  coba: { fontFamily: fonts.bold, fontSize: 13, color: colors.white, textDecorationLine: "underline" },
});