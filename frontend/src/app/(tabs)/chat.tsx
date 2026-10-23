import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
    Pressable, Share, StyleSheet, Text, TextInput, View,
} from "react-native";
import ScreenHeader from "../../components/ScreenHeader";
import { colors, fonts, radius } from "../../constants/theme";
import { useBarang } from "../../data/BarangContext";
import { AIReply, askAI, Tabel } from "../../services/chatService";

const NAMA_USER = "Rahmat";
const SARAN = ["Stok di bawah minimum?", "Barang paling laku bulan ini?", "Kapan restock Beras?"];

type Pesan = {
  id: string;
  role: "user" | "ai";
  text: string;
  loading?: boolean;
  reply?: AIReply;
};

function TabelView({ tabel }: { tabel: Tabel }) {
  return (
    <View style={styles.tabel}>
      <View style={styles.trow}>
        {tabel.headers.map((h, i) => (
          <Text key={h} style={[styles.th, { flex: i === 0 ? 2 : 1 }]}>{h}</Text>
        ))}
      </View>
      {tabel.rows.map((r, ri) => (
        <View key={ri} style={[styles.trow, styles.trowLine]}>
          {r.map((c, ci) => (
            <Text
              key={ci}
              style={[
                styles.td,
                { flex: ci === 0 ? 2 : 1 },
                tabel.merahKolom === ci && { color: colors.danger, fontFamily: fonts.semibold },
              ]}
            >
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function SqlBlock({ sql, ditolak }: { sql: string; ditolak: boolean }) {
  const [open, setOpen] = useState(ditolak);
  return (
    <View style={{ marginTop: 10 }}>
      <Pressable onPress={() => setOpen(!open)} hitSlop={8}>
        <Text style={styles.sqlToggle}>{open ? "▾" : "▸"} Lihat SQL</Text>
      </Pressable>
      {open ? (
        <View style={[styles.sqlBox, ditolak && { borderColor: colors.danger, borderWidth: 1.5 }]}>
          <Text style={styles.sqlText}>{sql}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function Chat() {
  const { items, transaksi } = useBarang();
  const [messages, setMessages] = useState<Pesan[]>([]);
  const [input, setInput] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const listRef = useRef<FlatList<Pesan>>(null);

  const kirim = async (q: string) => {
    const teks = q.trim();
    if (!teks || sibuk) return;
    setInput("");
    const t = Date.now();
    const idAI = `a${t}`;
    setMessages((prev) => [
      ...prev,
      { id: `u${t}`, role: "user", text: teks },
      { id: idAI, role: "ai", text: "", loading: true },
    ]);
    setSibuk(true);
    try {
      const reply = await askAI(teks, items, transaksi);
      setMessages((prev) =>
        prev.map((m) => (m.id === idAI ? { id: idAI, role: "ai", text: reply.text, reply } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === idAI
            ? {
                id: idAI,
                role: "ai",
                text: "Maaf, terjadi kendala saat menghubungi AI. Coba lagi sebentar lagi.",
                reply: { status: "gagal", text: "" },
              }
            : m
        )
      );
    } finally {
      setSibuk(false);
    }
  };

  const jalankanTindakan = (key: "rekomendasi" | "csv", reply: AIReply) => {
    if (key === "rekomendasi") {
      kirim("Buatkan rekomendasi restock");
    } else if (reply.csv) {
      Share.share({ message: reply.csv, title: "stok.csv" });
    } else {
      Alert.alert("Ekspor CSV", "Tidak ada data untuk diekspor.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Chat dengan AI" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View>
              <View style={[styles.bubble, styles.ai]}>
                <Text style={styles.aiText}>
                  Halo {NAMA_USER}! Tanyakan apa saja tentang stok dengan bahasa sehari-hari
                </Text>
              </View>
              <View style={styles.chips}>
                {SARAN.map((s) => (
                  <Pressable key={s} style={styles.chip} onPress={() => kirim(s)}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item: m }) => {
            if (m.role === "user") {
              return (
                <View style={[styles.bubble, styles.user]}>
                  <Text style={styles.userText}>{m.text}</Text>
                </View>
              );
            }
            if (m.loading) {
              return (
                <View style={[styles.bubble, styles.ai, styles.loadingRow]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.aiText}>AI sedang menyusun jawaban...</Text>
                </View>
              );
            }
            const r = m.reply;
            return (
              <View style={[styles.bubble, styles.ai]}>
                {r?.status === "ditolak" ? (
                  <Text style={[styles.tag, { color: colors.danger }]}>🚫 Diblokir validator keamanan</Text>
                ) : r?.status === "gagal" ? (
                  <Text style={[styles.tag, { color: colors.warning }]}>⚠️ Pertanyaan belum dipahami</Text>
                ) : null}
                <Text style={styles.aiText}>{m.text}</Text>
                {r?.tabel ? <TabelView tabel={r.tabel} /> : null}
                {r?.sql ? <SqlBlock sql={r.sql} ditolak={r.status === "ditolak"} /> : null}
                {r?.tindakan?.length ? (
                  <View style={styles.actions}>
                    {r.tindakan.map((t, i) => (
                      <Pressable
                        key={t.key}
                        style={[styles.actBtn, i === 0 ? styles.actFilled : styles.actOutline]}
                        onPress={() => jalankanTindakan(t.key, r)}
                      >
                        <Text style={[styles.actText, { color: i === 0 ? colors.white : colors.navy }]}>
                          {t.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }}
        />

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Tulis pertanyaan..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => kirim(input)}
            returnKeyType="send"
            editable={!sibuk}
          />
          <Pressable
            style={[styles.send, (sibuk || !input.trim()) && { opacity: 0.5 }]}
            onPress={() => kirim(input)}
            disabled={sibuk || !input.trim()}
          >
            <Ionicons name="send" size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const mono = Platform.select({ android: "monospace", ios: "Menlo", default: "monospace" });

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 8, gap: 12 },
  bubble: { maxWidth: "92%", borderRadius: radius.md, padding: 14 },
  ai: { alignSelf: "flex-start", backgroundColor: colors.primarySoft },
  user: { alignSelf: "flex-end", backgroundColor: colors.primary },
  aiText: { fontFamily: fonts.regular, fontSize: 15, color: colors.navy, lineHeight: 22 },
  userText: { fontFamily: fonts.regular, fontSize: 15, color: colors.white, lineHeight: 22 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tag: { fontFamily: fonts.semibold, fontSize: 13, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1, borderColor: colors.primaryLight, backgroundColor: colors.white,
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  tabel: {
    marginTop: 10, backgroundColor: colors.white, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4,
  },
  trow: { flexDirection: "row", paddingVertical: 8, gap: 6 },
  trowLine: { borderTopWidth: 1, borderTopColor: colors.border },
  th: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  td: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  sqlToggle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  sqlBox: { marginTop: 6, backgroundColor: "#15263F", borderRadius: radius.sm, padding: 12 },
  sqlText: { fontFamily: mono, fontSize: 12, color: "#DCE8F7", lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill },
  actFilled: { backgroundColor: colors.primary },
  actOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primaryLight },
  actText: { fontFamily: fonts.semibold, fontSize: 14 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16,
    marginTop: 4, marginBottom: 8, borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.pill, paddingLeft: 18, paddingRight: 6, height: 54, backgroundColor: colors.white,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  send: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
});