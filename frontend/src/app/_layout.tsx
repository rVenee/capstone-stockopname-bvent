import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { BarangProvider } from "../data/BarangContext";
import { UserProvider, useUser } from "../data/UserContext";

// Kalau sesi habis (atau logout) di layar mana pun, otomatis kembali ke Login
function Gerbang() {
  const { siap, masuk } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (siap && !masuk && pathname !== "/login" && pathname !== "/") {
      router.replace("/login");
    }
  }, [siap, masuk, pathname]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

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
        <Gerbang />
      </BarangProvider>
    </UserProvider>
  );
}