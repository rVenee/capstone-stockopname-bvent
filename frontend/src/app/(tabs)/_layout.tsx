import { Tabs } from "expo-router";
import BottomNav from "../../components/BottomNav";

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="profile-edit" options={{ href: null }} />
      <Tabs.Screen name="tren" options={{ href: null }} />
      <Tabs.Screen name="tren-detail" options={{ href: null }} />
      <Tabs.Screen name="rekomendasi" options={{ href: null }} />
      <Tabs.Screen name="barang" options={{ href: null }} />
      <Tabs.Screen name="barang-detail" options={{ href: null }} />
      <Tabs.Screen name="barang-form" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="riwayat" options={{ href: null }} />
      <Tabs.Screen name="transaksi" options={{ href: null }} />
      <Tabs.Screen name="opname" options={{ href: null }} />
      <Tabs.Screen name="opname-hitung" options={{ href: null }} />
      <Tabs.Screen name="opname-ringkasan" options={{ href: null }} />
    </Tabs>
  );
}