import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BarangProvider } from "../data/BarangContext";
import { UserProvider } from "../data/UserContext";

export default function RootLayout() {
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!loaded) return null;

  return (
    <UserProvider>
      <BarangProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </BarangProvider>
    </UserProvider>
  );
}