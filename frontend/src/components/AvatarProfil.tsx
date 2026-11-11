import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { fotoProfilSource, useFotoProfil } from "../services/fotoProfil";
import { colors } from "../constants/theme";

type Props = { size?: number; bordered?: boolean };

/** Foto profil bulat milik pengguna yang login. Kalau belum ada foto, tampil ikon orang. */
export default function AvatarProfil({ size = 56, bordered = false }: Props) {
  const { nama } = useFotoProfil();
  const [gagal, setGagal] = useState(false);
  useEffect(() => setGagal(false), [nama]);

  const sumber = gagal ? null : fotoProfilSource(nama);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryLight,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        ...(bordered ? { borderWidth: 3, borderColor: colors.navy } : null),
      }}
    >
      {sumber ? (
        <Image
          source={sumber}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setGagal(true)}
        />
      ) : (
        <Ionicons name="person" size={size * 0.52} color={colors.navy} />
      )}
    </View>
  );
}