import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, PageHeader, PrimaryButton } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { analyzeRelation, recordsForActualSleepAnalysis, recordsForPersonalAnalysis, type RelationKey } from "@/lib/condition-analysis";
import { useSleepData } from "@/lib/sleep-store";

const RELATION_KEYS: RelationKey[] = ["sleepSleepiness", "sleepClarity", "napSleep", "pressureHeadache", "pressureChangeHeadache", "caffeineTimeSleep", "caffeineTimeSleepiness"];

export default function AdvancedAnalysisQualityScreen() {
  const colors = useColors();
  const { records, isReady } = useSleepData();
  if (!isReady) return <ScreenContainer />;
  const personal = recordsForPersonalAnalysis(records);
  const actualSleep = recordsForActualSleepAnalysis(records);
  const relations = RELATION_KEYS.map((key) => analyzeRelation(records, key));
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <PageHeader title="データ品質・分析の根拠" subtitle="横断分析で使える記録の範囲" action={<PrimaryButton label="高度な分析" secondary onPress={() => router.back()} />} />
    <Card style={styles.card}><Text style={[styles.title, { color: colors.foreground }]}>横断分析に使える記録</Text><View style={styles.grid}><QualityValue label="保存記録" value={`${records.length} 件`} /><QualityValue label="本人記録" value={`${personal.length} 件`} /><QualityValue label="実睡眠" value={`${actualSleep.records.length} 件`} /><QualityValue label="旧定義を除外" value={`${actualSleep.excludedLegacySleepRecords} 件`} /></View><Text style={[styles.note, { color: colors.muted }]}>サンプル記録は横断分析に使用しません。旧定義の睡眠時間は実睡眠の分析へ推測変換せず除外します。</Text></Card>
    <Card style={styles.card}><Text style={[styles.title, { color: colors.foreground }]}>関連分析の比較可能件数</Text>{relations.map((relation) => <View key={relation.key} style={[styles.row, { borderColor: colors.border }]}><Text style={[styles.rowLabel, { color: colors.foreground }]}>{relation.label}</Text><Text style={[styles.rowValue, { color: colors.muted }]}>{relation.pairedCount} 組</Text></View>)}<Text style={[styles.note, { color: colors.muted }]}>値が未記録の日は比較対象に含めません。相関係数は5組以上かつ値にばらつきがある場合だけ表示します。</Text></Card>
    <Card style={styles.card}><Text style={[styles.title, { color: colors.foreground }]}>現在の限界</Text><Text style={[styles.note, { color: colors.muted }]}>頭痛イベントと時刻別気圧の照合、複数要因の自動探索、AIによる説明生成は未対応です。結果は本人記録の振り返り用であり、因果関係や診断を示しません。</Text></Card>
  </ScrollView></ScreenContainer>;
}

function QualityValue({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={[styles.value, { backgroundColor: `${colors.primary}12` }]}><Text style={[styles.valueLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.valueNumber, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24, gap: 10 },
  card: { gap: 10, paddingHorizontal: 14, paddingVertical: 15 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  value: { width: "48%", borderRadius: 12, padding: 10, gap: 2 },
  valueLabel: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  valueNumber: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  note: { fontSize: 12, lineHeight: 18 },
  row: { borderBottomWidth: 1, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowLabel: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  rowValue: { fontSize: 12, lineHeight: 18 },
});
