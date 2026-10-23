import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts, radius, shadow } from "../constants/theme";

type Props = { label: string; onPress?: () => void; variant?: "filled" | "outline" };

export default function PrimaryButton({ label, onPress, variant = "filled" }: Props) {
  const filled = variant === "filled";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        filled ? styles.filled : styles.outline,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.text, { color: filled ? colors.white : colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.pill, alignItems: "center" },
  filled: { backgroundColor: colors.primary, ...shadow },
  outline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  text: { fontFamily: fonts.semibold, fontSize: 16 },
});