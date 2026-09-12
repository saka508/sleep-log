import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { ConditionTrendChart } from "@/components/condition-trend-chart";
import { AppTextInput, Card, ChoicePills, MetricCard, PageHeader, PrimaryButton, SectionLabel, SmallStatus, ToggleRow } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { analyzeRelation, buildSleepRecommendation, buildTrend, formatAnalysisMetric, getAnalysisMetricLabel, MIN_RECOMMENDATION_SLEEP_MINUTES, summarizeTrend, type AnalysisGranularity, type AnalysisMetric, type RelationKey } from "@/lib/condition-analysis";
import { useSleepData } from "@/lib/sleep-store";
import { formatDuration, isTime } from "@/lib/sleep-utils";

const METRIC_OPTIONS: Array<{ value: AnalysisMetric; label: string }> = [
  { value: "sleepMinutes", label: "睡眠" }, { value: "bedTime", label: "就寝" }, { value: "wakeTime", label: "起床" }, { value: "napMinutes", label: "昼寝" },
  { value: "sleepiness", label: "眠気" }, { value: "clarity", label: "冴え" }, { value: "headacheIntensity", label: "頭痛" }, { value: "pressureHpa", label: "気圧" },
];
const RELATIONS: RelationKey[] = ["sleepSleepiness", "sleepClarity", "napSleep", "pressureHeadache", "pressureChangeHeadache", "caffeineTimeSleep", "caffeineTimeSleepiness"];

export default function AnalysisScreen() {
  const colors = useColors();
  const { records, settings, updateSettings, isReady } = useSleepData();
  const [granularity, setGranularity] = useState<AnalysisGranularity>("day");
  const [metric, setMetric] = useState<AnalysisMetric>("sleepMinutes");
  const trend = useMemo(() => buildTrend(records, metric, granularity), [records, metric, granularity]);
  const summary = useMemo(() => summarizeTrend(trend), [trend]);
  const relations = useMemo(() => RELATIONS.map((key) => analyzeRelation(records, key)), [records]);
  const recommendation = useMemo(() => buildSleepRecommendation(records), [records]);
  const [bedTime, setBedTime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [sleepMinutes, setSleepMinutes] = useState("");

  useEffect(() => {
    if (recommendation.status !== "ready") return;
    setBedTime(settings.recommendationBedTime ?? recommendation.bedTime);
    setWakeTime(settings.recommendationWakeTime ?? recommendation.wakeTime);
    setSleepMinutes(String(settings.recommendationSleepMinutes ?? recommendation.targetSleepMinutes));
  }, [recommendation, settings.recommendationBedTime, settings.recommendationWakeTime, settings.recommendationSleepMinutes]);

  const saveOverrides = () => {
    const minutes = Number(sleepMinutes);
    if (!isTime(bedTime) || !isTime(wakeTime) || !Number.isFinite(minutes) || minutes < MIN_RECOMMENDATION_SLEEP_MINUTES) {
      Alert.alert("参考値を確認してください", "就寝・起床時刻は HH:MM、睡眠時間は7時間以上で入力してください。");
      return;
    }
    updateSettings({ recommendationBedTime: bedTime, recommendationWakeTime: wakeTime, recommendationSleepMinutes: Math.round(minutes) });
    Alert.alert("参考値を保存しました", "いつでもこの画面から変更・無効化できます。");
  };

  if (!isReady) return <ScreenContainer />;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <PageHeader title="分析" subtitle="個人記録を日付順に振り返る" />

        <SectionLabel title="推移" action={<SmallStatus label={`${records.length} 件`} tone="muted" />} />
        <ChoicePills value={granularity} onChange={setGranularity} options={[{ value: "day", label: "日別" }, { value: "week", label: "週別" }, { value: "month", label: "月別" }]} />
        <Card style={styles.chartCard}>
          <ChoicePills value={metric} onChange={setMetric} options={METRIC_OPTIONS} />
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>{getAnalysisMetricLabel(metric)}の推移</Text>
          <ConditionTrendChart points={trend} formatValue={(value) => formatAnalysisMetric(metric, value)} />
          <View style={styles.statsGrid}>
            <View style={styles.statBox}><MetricCard label="平均" value={formatAnalysisMetric(metric, summary.average)} icon="functions" accent={colors.primary} /></View>
            <View style={styles.statBox}><MetricCard label="中央値" value={formatAnalysisMetric(metric, summary.median)} icon="vertical-align-center" accent={colors.primary} /></View>
            <View style={styles.statBox}><MetricCard label="データ日数" value={`${summary.dataDays} 日`} icon="event-available" accent={colors.primary} /></View>
          </View>
          <Text style={[styles.note, { color: colors.muted }]}>欠損している値は平均・中央値・線で扱わず、「データなし」として残します。{granularity === "day" ? "横軸は記録した実際の日付です。" : "週・月はその期間にある値だけを平均しています。"}</Text>
        </Card>

        <SectionLabel title="項目どうしの見比べ" />
        <View style={styles.relations}>{relations.map((relation) => <RelationCard key={relation.key} relation={relation} />)}</View>
        <Text style={[styles.note, { color: colors.muted }]}>Pearsonの相関係数を使用します。両方の値がある日だけを対象にし、5組未満・値のばらつきがない場合は算出しません。相関は関連の目安であり、原因を示すものではありません。</Text>

        <SectionLabel title="過去の記録から見た参考値" />
        <Card style={styles.recommendationCard}>
          <ToggleRow icon="auto-awesome" label="参考値を表示" description="いつでも無効にできます" active={settings.recommendationEnabled} onPress={() => updateSettings({ recommendationEnabled: !settings.recommendationEnabled })} />
          {!settings.recommendationEnabled ? <Text style={[styles.note, { color: colors.muted }]}>参考値の表示は無効です。記録や分析結果は削除されません。</Text> : null}
          {settings.recommendationEnabled && recommendation.status === "ready" ? <>
            <Text style={[styles.recommendationTitle, { color: colors.foreground }]}>過去の記録から見た参考値</Text>
            <Text style={[styles.recommendationReason, { color: colors.muted }]}>{recommendation.criteria} を条件にしています。サンプル記録は使いません。</Text>
            <View style={styles.recommendationGrid}><RecommendationValue label="就寝" value={bedTime} /><RecommendationValue label="起床" value={wakeTime} /><RecommendationValue label="睡眠" value={formatDuration(Number(sleepMinutes), true)} /></View>
            <Text style={[styles.editTitle, { color: colors.foreground }]}>自分用に調整</Text>
            <View style={styles.editRow}>
              <View style={styles.editField}><Text style={[styles.editLabel, { color: colors.muted }]}>就寝</Text><AppTextInput value={bedTime} onChangeText={setBedTime} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              <View style={styles.editField}><Text style={[styles.editLabel, { color: colors.muted }]}>起床</Text><AppTextInput value={wakeTime} onChangeText={setWakeTime} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              <View style={styles.editField}><Text style={[styles.editLabel, { color: colors.muted }]}>睡眠（分）</Text><AppTextInput value={sleepMinutes} onChangeText={setSleepMinutes} keyboardType="number-pad" /></View>
            </View>
            <PrimaryButton label="調整した参考値を保存" icon="save" secondary onPress={saveOverrides} />
          </> : null}
          {settings.recommendationEnabled && recommendation.status === "insufficient" ? <Text style={[styles.note, { color: colors.muted }]}>参考値は、眠気が低く頭の冴えが高かった日が {recommendation.minimumDays} 日以上で表示します。現在は {recommendation.qualifyingDays} 日です。</Text> : null}
          {settings.recommendationEnabled && recommendation.status === "tooShort" ? <Text style={[styles.note, { color: colors.muted }]}>条件に合う {recommendation.qualifyingDays} 日はありますが、過去の中央値が短すぎるため参考値は表示しません。</Text> : null}
        </Card>

        <View style={[styles.disclaimer, { backgroundColor: `${colors.muted}12` }]}><Text style={[styles.disclaimerText, { color: colors.muted }]}>この分析は個人記録の振り返りであり、診断ではありません。気になる症状が続く場合は、保護者や医療機関に相談してください。</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function RelationCard({ relation }: { relation: ReturnType<typeof analyzeRelation> }) {
  const colors = useColors();
  const content = relation.status === "ready" && relation.coefficient !== null
    ? `相関の目安 ${relation.coefficient >= 0 ? "+" : "−"}${Math.abs(relation.coefficient).toFixed(2)}（${relation.pairedCount} 組）`
    : relation.status === "constant" ? `${relation.pairedCount} 組ありますが、値のばらつきがないため算出できません。` : `データ不足（${relation.pairedCount} / 5 組）。両方の値がある日だけを数えます。`;
  return <Card style={styles.relationCard}><Text style={[styles.relationTitle, { color: colors.foreground }]}>{relation.label}</Text><Text style={[styles.relationMeta, { color: colors.muted }]}>{relation.xLabel} × {relation.yLabel}</Text><Text style={[styles.relationValue, { color: relation.status === "ready" ? colors.primary : colors.muted }]}>{content}</Text></Card>;
}

function RecommendationValue({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={[styles.recommendationValue, { backgroundColor: `${colors.primary}12` }]}><Text style={[styles.recommendationLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.recommendationNumber, { color: colors.primary }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 11 }, chartCard: { gap: 13, paddingHorizontal: 14, paddingVertical: 16 }, chartTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" }, statsGrid: { flexDirection: "row", gap: 8 }, statBox: { flex: 1, minWidth: 0 }, note: { fontSize: 12, lineHeight: 18 }, relations: { gap: 8 }, relationCard: { gap: 3, paddingVertical: 13 }, relationTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800" }, relationMeta: { fontSize: 11, lineHeight: 16 }, relationValue: { fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 2 }, recommendationCard: { gap: 12 }, recommendationTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" }, recommendationReason: { fontSize: 12, lineHeight: 18 }, recommendationGrid: { flexDirection: "row", gap: 8 }, recommendationValue: { flex: 1, borderRadius: 12, padding: 10, gap: 2 }, recommendationLabel: { fontSize: 11, lineHeight: 15, fontWeight: "700" }, recommendationNumber: { fontSize: 15, lineHeight: 21, fontWeight: "900" }, editTitle: { fontSize: 14, lineHeight: 20, fontWeight: "800", marginTop: 3 }, editRow: { flexDirection: "row", gap: 7 }, editField: { flex: 1, minWidth: 0, gap: 4 }, editLabel: { fontSize: 11, lineHeight: 15, fontWeight: "700" }, disclaimer: { borderRadius: 14, padding: 13 }, disclaimerText: { fontSize: 12, lineHeight: 18 },
});
