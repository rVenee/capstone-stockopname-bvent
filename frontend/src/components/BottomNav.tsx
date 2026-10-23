import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow } from "../constants/theme";

const items = [
  { name: "home", label: "Home", icon: "home-outline", iconActive: "home" },
  { name: "scan", label: "Scan", icon: "scan-outline", iconActive: "scan" },
  { name: "profile", label: "Profil", icon: "person-outline", iconActive: "person" },
] as const;

export default function BottomNav({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const [keyboardTampil, setKeyboardTampil] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardTampil(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardTampil(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardTampil) return null;

  const current: string = state.routes[state.index].name;
  // Layar menu (tren, barang, dst.) dianggap bagian dari tab Home
  const active = current === "scan" ? "scan" : current === "profile" || current === "profile-edit" ? "profile" : "home";

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {items.map((it) => {
          const focused = active === it.name;
          return (
            <Pressable
              key={it.name}
              onPress={() => navigation.navigate(it.name)}
              style={styles.item}
              hitSlop={8}
            >
              <Ionicons
                name={focused ? it.iconActive : it.icon}
                size={26}
                color={focused ? colors.white : "rgba(255,255,255,0.65)"}
              />
              {focused ? <Text style={styles.label}>{it.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.white, paddingHorizontal: 20, paddingTop: 8 },
  bar: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 64,
    alignItems: "center",
    justifyContent: "space-around",
    ...shadow,
  },
  item: { alignItems: "center", justifyContent: "center", minWidth: 64 },
  label: { color: colors.white, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
});