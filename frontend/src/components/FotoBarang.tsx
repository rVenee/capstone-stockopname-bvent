import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { fotoSource } from "../services/foto";
import { colors } from "../constants/theme";

type Props = {
  gambar?: string | null; // nama berkas foto
  emoji?: string; // tidak dipakai lagi (dibiarkan supaya layar lama tidak perlu diubah)
  size?: number;
};

/** Foto barang. Kalau belum ada foto (atau gagal dimuat), tampil kotak netral yang polos. */
export default function FotoBarang({ gambar, size = 44 }: Props) {
  const [gagal, setGagal] = useState(false);
  useEffect(() => setGagal(false), [gambar]);

  const sumber = gagal ? null : fotoSource(gambar);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        backgroundColor: "#EEF3FA",
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {sumber ? (
        // expo-image mengirim header Authorization (foto hanya bisa dibuka dengan login)
        <Image
          source={sumber}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setGagal(true)}
        />
      ) : (
        <Ionicons name="cube-outline" size={size * 0.42} color="#B7C4D8" />
      )}
    </View>
  );
}