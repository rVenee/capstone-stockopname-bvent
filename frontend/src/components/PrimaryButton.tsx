import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, fonts, radius, shadow } from "../constants/theme";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "filled" | "outline";
  loading?: boolean;
  disabled?: boolean;
};

export default function PrimaryButton({
  label,
  onPress,
  variant = "filled",
  loading = false,
  disabled = false,
}: Props) {
  const filled = variant === "filled";
  const mati = loading || disabled;
  return (
    <Pressable
      onPress={mati ? undefined : onPress}
      disabled={mati}
      style={({ pressed }) => [
        styles.btn,
        filled ? styles.filled : styles.outline,
        { opacity: mati ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.text, { color: filled ? colors.white : colors.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { backgroundColor: colors.primary, ...shadow },
  outline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  text: { fontFamily: fonts.semibold, fontSize: 16 },
});