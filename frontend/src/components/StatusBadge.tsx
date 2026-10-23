import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius } from "../constants/theme";

type Variant = "danger" | "warning" | "success" | "info";

const map = {
  danger: { bg: colors.dangerBg, fg: colors.danger },
  warning: { bg: colors.warningBg, fg: colors.warning },
  success: { bg: colors.successBg, fg: colors.success },
  info: { bg: colors.primarySoft, fg: colors.primary },
};

export default function StatusBadge({ label, variant }: { label: string; variant: Variant }) {
  const c = map[variant];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  text: { fontFamily: fonts.semibold, fontSize: 13 },
});