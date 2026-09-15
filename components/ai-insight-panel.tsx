import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

export type AiInsightPanelState = "planned" | "loading" | "insufficient" | "ready";

const STATE_LABEL: Record<AiInsightPanelState, string> = {
  planned: "今後追加予定",
  loading: "読み込み中",
  insufficient: "データ不足",
  ready: "参考情報",
};

export function AiInsightPanel({
  state = "planned",
  title = "今日の分析・提案",
  message = "睡眠・疲労・頭痛・天候などの本人の記録をまとめて振り返る機能を、今後ここに追加します。",
  onPress,
}: {
  state?: AiInsightPanelState;
  title?: string;
  message?: string;
  onPress?: () => void;
}) {
  const colors = useColors("light");
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${title}。${STATE_LABEL[state]}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.panel,
        { backgroundColor: colors.sleepHomeSurface, borderColor: `${colors.sleepBlue}38`, shadowColor: colors.sleepForest },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: `${colors.sleepBlue}16` }]}>
          <MaterialIcons name="auto-awesome" size={25} color={colors.sleepBlue} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.sleepBlue }]}>AI INSIGHT</Text>
          <Text style={[styles.title, { color: colors.sleepHomeForeground }]}>{title}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: `${colors.sleepHomeMuted}12` }]}>
          <Text style={[styles.statusText, { color: colors.sleepHomeMuted }]}>{STATE_LABEL[state]}</Text>
        </View>
      </View>

      <View style={[styles.body, { backgroundColor: `${colors.sleepSky}12`, borderColor: `${colors.sleepSky}2B` }]}>
        <MaterialIcons name="forum" size={30} color={colors.sleepBlue} />
        <MaterialIcons name="eco" size={52} color={`${colors.sleepForest}1B`} style={styles.leafMark} />
        <MaterialIcons name="park" size={64} color={`${colors.sleepForest}20`} style={styles.forestMark} />
        <Text style={[styles.message, { color: colors.sleepHomeForeground }]}>{message}</Text>
        <Text style={[styles.detail, { color: colors.sleepHomeMuted }]}>今回は外部通信や健康データの送信を行いません。架空の提案も表示しません。</Text>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.sleepHomeBorder }]}>
        <MaterialIcons name="touch-app" size={17} color={colors.sleepForest} />
        <Text style={[styles.footerText, { color: colors.sleepHomeMuted }]}>タップして今後の機能について確認</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 246,
    borderWidth: 1,
    borderRadius: 26,
    padding: 17,
    gap: 14,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, fontWeight: "900" },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "900", letterSpacing: -0.3 },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 9, lineHeight: 13, fontWeight: "800" },
  body: { flex: 1, minHeight: 130, borderRadius: 20, borderWidth: 1, padding: 16, justifyContent: "center", alignItems: "center", gap: 9, overflow: "hidden" },
  leafMark: { position: "absolute", left: -7, top: 18, transform: [{ rotate: "-25deg" }] },
  forestMark: { position: "absolute", right: -5, bottom: -13 },
  message: { maxWidth: 310, textAlign: "center", fontSize: 14, lineHeight: 21, fontWeight: "700" },
  detail: { maxWidth: 310, textAlign: "center", fontSize: 11, lineHeight: 17 },
  footer: { minHeight: 29, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  footerText: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
});
