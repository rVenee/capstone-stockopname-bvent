import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import { colors, fonts } from "../constants/theme";
import { tanggalDepan } from "../data/tren";

type Titik = { mid: number; low: number; high: number };
type Props = { riwayat: number[]; prediksi: Titik[]; stokMin: number };

const TINGGI = 230;
const PAD = { l: 34, r: 12, t: 24, b: 28 };

export default function TrendChart({ riwayat, prediksi, stokMin }: Props) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const n = riwayat.length;
  const H = prediksi.length;
  const total = n + H;
  const maxVal = Math.max(...riwayat, ...prediksi.map((p) => p.high), stokMin);
  const step = maxVal > 60 ? 20 : maxVal > 30 ? 10 : 5;
  const yMax = Math.ceil(maxVal / step) * step || step;

  const innerW = Math.max(w - PAD.l - PAD.r, 1);
  const innerH = TINGGI - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (total <= 1 ? 0 : (i / (total - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / yMax) * innerH;

  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);

  const hari = n - 1;
  const todayX = x(n - 1);
  const todayY = y(riwayat[n - 1]);

  const histPts = riwayat.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const midPts = [`${todayX},${todayY}`, ...prediksi.map((p, k) => `${x(n + k)},${y(p.mid)}`)].join(" ");
  const bandPts = [
    `${todayX},${todayY}`,
    ...prediksi.map((p, k) => `${x(n + k)},${y(p.high)}`),
    ...prediksi.map((p, k) => `${x(n + k)},${y(p.low)}`).reverse(),
  ].join(" ");

  return (
    <View onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={TINGGI}>
          {ticks.map((v) => (
            <Line key={v} x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke="#E3EEFB" strokeWidth={1} />
          ))}
          {ticks.map((v) => (
            <SvgText key={`l${v}`} x={PAD.l - 6} y={y(v) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end" fontFamily={fonts.regular}>
              {v}
            </SvgText>
          ))}

          <Polygon points={bandPts} fill={colors.primary} fillOpacity={0.15} />

          <Line x1={PAD.l} x2={w - PAD.r} y1={y(stokMin)} y2={y(stokMin)} stroke={colors.danger} strokeWidth={1.5} strokeDasharray="6 4" />
          <SvgText x={PAD.l + 6} y={y(stokMin) - 5} fontSize={11} fill={colors.danger} fontFamily={fonts.medium}>
            {`Stok minimum (${stokMin})`}
          </SvgText>

          <Line x1={todayX} x2={todayX} y1={PAD.t - 4} y2={y(0)} stroke="#9AA8BC" strokeWidth={1} strokeDasharray="2 3" />
          <SvgText x={todayX} y={PAD.t - 9} fontSize={11} fill={colors.textMuted} textAnchor="middle" fontFamily={fonts.regular}>
            Hari ini
          </SvgText>

          <Polyline points={histPts} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={midPts} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
          <Circle cx={todayX} cy={todayY} r={5} fill={colors.primary} />

          <SvgText x={PAD.l} y={TINGGI - 8} fontSize={11} fill={colors.textMuted} textAnchor="start" fontFamily={fonts.regular}>
            {tanggalDepan(-hari)}
          </SvgText>
          <SvgText x={todayX} y={TINGGI - 8} fontSize={11} fill={colors.textMuted} textAnchor="middle" fontFamily={fonts.regular}>
            {tanggalDepan(0)}
          </SvgText>
          <SvgText x={w - PAD.r} y={TINGGI - 8} fontSize={11} fill={colors.textMuted} textAnchor="end" fontFamily={fonts.regular}>
            {tanggalDepan(H)}
          </SvgText>
        </Svg>
      ) : (
        <View style={{ height: TINGGI }} />
      )}

      <View style={styles.legend}>
        <View style={styles.item}>
          <View style={[styles.line, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Riwayat</Text>
        </View>
        <View style={styles.item}>
          <View style={styles.dash}>
            <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} />
          </View>
          <Text style={styles.legendText}>Prediksi</Text>
        </View>
        <View style={styles.item}>
          <View style={styles.box} />
          <Text style={styles.legendText}>Rentang prediksi</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  line: { width: 20, height: 3, borderRadius: 2 },
  dash: { flexDirection: "row", gap: 3 },
  dot: { width: 5, height: 3, borderRadius: 1, backgroundColor: colors.primary },
  box: { width: 18, height: 10, borderRadius: 3, backgroundColor: "rgba(61,149,251,0.2)" },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});