import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius } from "../constants/theme";
import PrimaryButton from "./PrimaryButton";

type Props = { aktif: boolean; onScan: (kode: string) => void; tinggi?: number };

export default function BarcodeScanner({ aktif, onScan, tinggi = 320 }: Props) {
  const [izin, mintaIzin] = useCameraPermissions();
  const terakhir = useRef({ kode: "", waktu: 0 });

  if (!izin) return <View style={[styles.box, { height: tinggi }]} />;

  if (!izin.granted) {
    return (
      <View style={[styles.box, styles.center, { height: tinggi }]}>
        <Text style={styles.izinText}>Izin kamera dibutuhkan untuk scan barcode.</Text>
        <View style={{ marginTop: 14 }}>
          <PrimaryButton label="Izinkan Kamera" onPress={mintaIzin} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.box, { height: tinggi }]}>
      {aktif ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
          }}
          onBarcodeScanned={({ data }) => {
            const now = Date.now();
            if (data === terakhir.current.kode && now - terakhir.current.waktu < 2500) return;
            terakhir.current = { kode: data, waktu: now };
            onScan(data);
          }}
        />
      ) : null}
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={styles.frame} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: "#1B2A3F", borderRadius: radius.lg, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  izinText: { fontFamily: fonts.medium, fontSize: 15, color: colors.white, textAlign: "center" },
  frameWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  frame: {
    width: "78%", height: "42%", borderRadius: 18, borderWidth: 3, borderColor: "rgba(255,255,255,0.9)",
  },
});