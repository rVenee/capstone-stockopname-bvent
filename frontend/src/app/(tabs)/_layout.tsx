import { View } from "react-native";
import { Stack } from "expo-router";
import BottomNav from "../../components/BottomNav";
import GalatBanner from "../../components/GalatBanner";

// Semua layar aplikasi berupa tumpukan layar (stack). Bar bawah (Home / Scan / Profil)
// tetap tampil di bawahnya dan berpindah layar lewat router.
export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <BottomNav />
      <GalatBanner />
    </View>
  );
}