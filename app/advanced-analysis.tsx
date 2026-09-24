import { router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, PageHeader, PrimaryButton } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

export default function AdvancedAnalysisScreen() {
  const colors = useColors();

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          title="高度な分析"
          subtitle="複数の本人記録を条件ごとに比較"
          action={<PrimaryButton label="メニュー" secondary onPress={() => router.back()} />}
        />

        <Card style={[styles.aiCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}42` }]}>
          <View style={[styles.aiIcon, { backgroundColor: `${colors.primary}1C` }]}><MaterialIcons name="auto-awesome" size={28} color={colors.primary} /></View>
          <View style={styles.aiCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>AI 総合分析</Text>
            <Text style={[styles.aiTitle, { color: colors.foreground }]}>あなたの傾向をまとめる</Text>
            <Text style={[styles.aiBody, { color: colors.muted }]}>未実装です。外部AI通信、自動発見、説明文の生成はまだ行いません。</Text>
          </View>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>利用できる個別分析</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>保存済みの本人記録のみ</Text>
        </View>

        <View style={styles.toolGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="睡眠と体調の条件分析を開く"
            onPress={() => router.push("/advanced-analysis-conditions" as never)}
            style={({ pressed }) => [styles.toolCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          >
            <View style={[styles.toolIcon, { backgroundColor: `${colors.primary}1A` }]}><MaterialIcons name="bedtime" size={22} color={colors.primary} /></View>
            <View style={styles.toolCopy}>
              <Text style={[styles.toolTitle, { color: colors.foreground }]}>睡眠 × 体調</Text>
              <Text style={[styles.toolDetail, { color: colors.muted }]}>睡眠時間と日次の体調を比較</Text>
            </View>
            <MaterialIcons name="chevron-right" size={25} color={colors.primary} />
          </Pressable>

          <View accessibilityState={{ disabled: true }} style={[styles.toolCard, styles.disabledTool, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.toolIcon, { backgroundColor: `${colors.warning}18` }]}><MaterialIcons name="cloud" size={22} color={colors.warning} /></View>
            <View style={styles.toolCopy}>
              <Text style={[styles.toolTitle, { color: colors.foreground }]}>気象 × 頭痛</Text>
              <Text style={[styles.toolDetail, { color: colors.muted }]}>Phase 1未対応・時刻対応を検討中</Text>
            </View>
          </View>
        </View>

        <PrimaryButton label="条件を変えて調べる" onPress={() => router.push("/advanced-analysis-conditions" as never)} />
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>既存の分析を見る</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>横断的な情報</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="関連分析を開く" onPress={() => router.push("/advanced-analysis-relations" as never)} style={({ pressed }) => [styles.toolCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
          <View style={[styles.toolIcon, { backgroundColor: `${colors.primary}1A` }]}><MaterialIcons name="insights" size={22} color={colors.primary} /></View>
          <View style={styles.toolCopy}><Text style={[styles.toolTitle, { color: colors.foreground }]}>関連分析</Text><Text style={[styles.toolDetail, { color: colors.muted }]}>睡眠・体調・気圧などの関連を確認</Text></View>
          <MaterialIcons name="chevron-right" size={25} color={colors.primary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="データ品質と分析の根拠を開く" onPress={() => router.push("/advanced-analysis-quality" as never)} style={({ pressed }) => [styles.toolCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
          <View style={[styles.toolIcon, { backgroundColor: `${colors.primary}1A` }]}><MaterialIcons name="fact-check" size={22} color={colors.primary} /></View>
          <View style={styles.toolCopy}><Text style={[styles.toolTitle, { color: colors.foreground }]}>データ品質・分析の根拠</Text><Text style={[styles.toolDetail, { color: colors.muted }]}>比較可能件数・欠損・対象外を確認</Text></View>
          <MaterialIcons name="chevron-right" size={25} color={colors.primary} />
        </Pressable>
        <Text style={[styles.note, { color: colors.muted }]}>表示する差や集計値は因果関係、診断、予測を示しません。運動・食事・Healthデータは今回の対象外です。</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18, gap: 10 },
  aiCard: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  aiIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  aiCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.9 },
  aiTitle: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
  aiBody: { fontSize: 12, lineHeight: 17 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 1 },
  sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: "900" },
  sectionHint: { fontSize: 11, lineHeight: 16 },
  toolGrid: { gap: 8 },
  toolCard: { minHeight: 72, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  disabledTool: { opacity: 0.58 },
  toolIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  toolCopy: { flex: 1, gap: 1 },
  toolTitle: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  toolDetail: { fontSize: 11, lineHeight: 16 },
  note: { fontSize: 11, lineHeight: 16, paddingHorizontal: 2 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
