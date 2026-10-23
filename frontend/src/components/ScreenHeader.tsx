import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../constants/theme";

type Props = { title: string; showBack?: boolean; children?: ReactNode };

export default function ScreenHeader({ title, showBack = true, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.back} />
      </View>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 32 },
  title: { color: colors.white, fontFamily: fonts.medium, fontSize: 18 },
  extra: { marginTop: 16 },
});