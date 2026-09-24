import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, PageHeader, PrimaryButton } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { analyzeRelation, MIN_RELATION_RECORDS, type RelationKey } from "@/lib/condition-analysis";
import { useSleepData } from "@/lib/sleep-store";

const RELATION_KEYS: RelationKey[] = ["sleepSleepiness", "sleepClarity", "napSleep", "pressureHeadache", "pressureChangeHeadache", "caffeineTimeSleep", "caffeineTimeSleepiness"];

export default function AdvancedAnalysisRelationScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ key?: string }>();
  const { records, isReady } = useSleepData();
  const key = RELATION_KEYS.includes(params.key as RelationKey) ? params.key as RelationKey : "sleepSleepiness";
  if (!isReady) return <ScreenContainer />;
  const relation = analyzeRelation(records, key);
  const isReadyResult = relation.status === "ready" && relation.coefficient !== null;
  const coefficient = relation.coefficient ?? 0;
  const fill = `${Math.max(0, Math.min(100, (coefficient + 1) * 50))}%` as `${number}%`;
  const resultText = isReadyResult
    ? `相関係数は ${coefficient >= 0 ? "+" : ""}${coefficient.toFixed(2)} です。`
    : relation.status === "constant"
      ? "比較できる記録はありますが、値のばらつきがないため相関は算出できません。"
      : `比較可能な記録が ${MIN_RELATION_RECORDS} 組に届かないため、相関は算出していません。`;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <PageHeader title={relation.label} subtitle={`${relation.xLabel} × ${relation.yLabel}`} action={<PrimaryButton label="関連分析" secondary onPress={() => router.back()} />} />
    <Card style={styles.card}><Text style={[styles.eyebrow, { color: colors.primary }]}>結果</Text><Text style={[styles.result, { color: colors.foreground }]}>{resultText}</Text><Text style={[styles.note, { color: colors.muted }]}>比較できた組: {relation.pairedCount} 組</Text></Card>
    <Card style={styles.card}><Text style={[styles.eyebrow, { color: colors.primary }]}>グラフ</Text>{isReadyResult ? <><Text style={[styles.axis, { color: colors.muted }]}>Pearson r（−1.00 〜 +1.00）</Text><View style={[styles.track, { backgroundColor: colors.background }]}><View style={[styles.zero, { backgroundColor: colors.border }]} /><View style={[styles.fill, { width: fill, backgroundColor: colors.primary }]} /></View><View style={styles.axisLabels}><Text style={[styles.note, { color: colors.muted }]}>−1.00</Text><Text style={[styles.note, { color: colors.foreground }]}>r {coefficient >= 0 ? "+" : ""}{coefficient.toFixed(2)}</Text><Text style={[styles.note, { color: colors.muted }]}>+1.00</Text></View></> : <Text style={[styles.note, { color: colors.muted }]}>比較可能なデータが揃うと、ここに相関係数の位置を表示します。</Text>}</Card>
    <Card style={styles.card}><Text style={[styles.eyebrow, { color: colors.primary }]}>根拠</Text><Text style={[styles.note, { color: colors.muted }]}>同じ日付に両方の値がある本人記録だけを使用します。サンプル記録と未記録の値は含めません。</Text>{relation.excludedLegacySleepRecords ? <Text style={[styles.note, { color: colors.muted }]}>旧定義の睡眠時間 {relation.excludedLegacySleepRecords} 件は実睡眠の分析から除外しました。</Text> : null}<Text style={[styles.note, { color: colors.muted }]}>相関は因果関係を意味しません。</Text></Card>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24, gap: 10 },
  card: { gap: 9, paddingHorizontal: 14, paddingVertical: 15 },
  eyebrow: { fontSize: 12, lineHeight: 17, fontWeight: "900", letterSpacing: 0.6 },
  result: { fontSize: 17, lineHeight: 24, fontWeight: "900" },
  note: { fontSize: 12, lineHeight: 18 },
  axis: { fontSize: 11, lineHeight: 16 },
  track: { height: 16, borderRadius: 10, overflow: "hidden", position: "relative", justifyContent: "center" },
  zero: { position: "absolute", left: "50%", width: 1, top: 0, bottom: 0, zIndex: 2 },
  fill: { height: "100%", borderRadius: 10 },
  axisLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
