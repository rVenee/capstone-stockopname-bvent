import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../constants/theme";
import { useBarang } from "../data/BarangContext";
import { useUser } from "../data/UserContext";

export default function Index() {
  const { siap, masuk } = useUser();
  const { dataSiap } = useBarang();

  // Tunggu pengecekan sesi dan pemuatan data pertama selesai
  if (!siap || (masuk && !dataSiap)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  return <Redirect href={masuk ? "/home" : "/login"} />;
}