 import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../constants/theme";
import ScreenHeader from "./ScreenHeader";

type Props = { title: string; showBack?: boolean };

export default function PlaceholderScreen({ title, showBack = true }: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={title} showBack={showBack} />
      <View style={styles.center}>
        <Text style={styles.text}>Layar ini dibuat di step berikutnya.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.regular, color: colors.textMuted },
});