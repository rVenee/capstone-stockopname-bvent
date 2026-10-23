import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius } from "../constants/theme";

export const PER_PAGE = 10;

export function paginate<T>(data: T[], page: number, perPage = PER_PAGE) {
  const totalPages = Math.max(1, Math.ceil(data.length / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: data.slice((current - 1) * perPage, current * perPage),
    current,
    totalPages,
  };
}

function daftarNomor(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

type Props = { current: number; total: number; onChange: (p: number) => void };

export default function Pagination({ current, total, onChange }: Props) {
  if (total <= 1) return null;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(current - 1)}
        disabled={current === 1}
        style={[styles.btn, current === 1 && { opacity: 0.35 }]}
        hitSlop={6}
      >
        <Ionicons name="chevron-back" size={18} color={colors.navy} />
      </Pressable>

      {daftarNomor(current, total).map((n, i) =>
        n === "…" ? (
          <Text key={`d${i}`} style={styles.dots}>…</Text>
        ) : (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[styles.btn, n === current && styles.active]}
          >
            <Text style={[styles.text, n === current && { color: colors.white }]}>
              {String(n).padStart(2, "0")}
            </Text>
          </Pressable>
        )
      )}

      <Pressable
        onPress={() => onChange(current + 1)}
        disabled={current === total}
        style={[styles.btn, current === total && { opacity: 0.35 }]}
        hitSlop={6}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.navy} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" },
  btn: {
    minWidth: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primarySoft, paddingHorizontal: 6,
  },
  active: { backgroundColor: colors.primary },
  text: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy },
  dots: { fontFamily: fonts.medium, fontSize: 16, color: colors.textMuted, paddingHorizontal: 2 },
});