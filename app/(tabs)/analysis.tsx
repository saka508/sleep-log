import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ConditionTrendChart } from "@/components/condition-trend-chart";
import { PressureHistoryChart } from "@/components/pressure-history-chart";
import { Card, ChoicePills, MetricCard, PageHeader, SegmentedControl, SmallStatus } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { analyzeRelation, buildTrend, formatAnalysisMetric, getAnalysisMetricLabel, recordsForActualSleepAnalysis, summarizeTrend, type AnalysisGranularity, type AnalysisMetric, type AnalysisQuality } from "@/lib/condition-analysis";
import { Collapsible } from "@/components/ui/collapsible";
import { useSleepData } from "@/lib/sleep-store";
import type { PressureHistoryPeriodSelection } from "@/lib/pressure-history";
import { formatDuration, formatShortDate, getHeadacheFeatureLabel, timeToMinutes, type SleepRecord } from "@/lib/sleep-utils";

const METRIC_OPTIONS: { value: AnalysisMetric; label: string }[] = [
  { value: "sleepMinutes", label: "睡眠" }, { value: "bedTime", label: "就寝" }, { value: "wakeTime", label: "起床" }, { value: "napMinutes", label: "昼寝" },
  { value: "sleepiness", label: "眠気" }, { value: "fatigue", label: "疲労" }, { value: "clarity", label: "冴え" }, { value: "headacheIntensity", label: "頭痛" }, { value: "muscleFatigue", label: "筋肉疲労" }, { value: "pressureHpa", label: "気圧" },
];
export default function AnalysisScreen() {
  const colors = useColors();
  const router = useRouter();
  const { records, isReady } = useSleepData();
  const [granularity, setGranularity] = useState<AnalysisGranularity>("day");
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const personalRecords = useMemo(() => records.filter((record) => !record.isSample), [records]);
  const actualSleep = useMemo(() => recordsForActualSleepAnalysis(records), [records]);
  const summaryTrends = useMemo(() => ({
    sleep: summarizeTrend(buildTrend(records, "sleepMinutes", granularity), actualSleep.excludedLegacySleepRecords),
    sleepiness: summarizeTrend(buildTrend(records, "sleepiness", granularity)),
    fatigue: summarizeTrend(buildTrend(records, "fatigue", granularity)),
  }), [records, granularity, actualSleep.excludedLegacySleepRecords]);
  const openCategory = (category: AnalysisCategory) => {
    // The generated typed-routes file is refreshed by Expo tooling; keep the
    // dynamic category route localized until that generated declaration updates.
    router.push({ pathname: "/analysis/[category]", params: { category, granularity } } as never);
  };

  if (!isReady) return <ScreenContainer />;
  return <ScreenContainer>
    <View style={[styles.analysisSurface, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.topContent, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={contentHeight > viewportHeight + 2}
        scrollEnabled={viewportHeight === 0 || contentHeight > viewportHeight + 2}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <PageHeader title="詳細分析" />
        <Card style={styles.periodCard}>
          <View style={styles.periodHeader}><Text style={[styles.periodTitle, { color: colors.foreground }]}>表示期間</Text><SmallStatus label={`${personalRecords.length}日`} tone="muted" /></View>
          <SegmentedControl value={granularity} onChange={setGranularity} options={[{ value: "day", label: "日別" }, { value: "week", label: "週別" }, { value: "month", label: "月別" }]} />
          <Text style={[styles.periodNote, { color: colors.muted }]}>切替で再計算</Text>
        </Card>
        <AnalysisSectionLabel title="現在のまとめ" action={<SmallStatus label={`${personalRecords.length}日`} tone="muted" />} />
        <View style={styles.summaryGrid}>
          <SummaryValue label="睡眠" value={formatAnalysisMetric("sleepMinutes", summaryTrends.sleep.average)} accent={colors.sleepBlue} />
          <SummaryValue label="眠気" value={formatAnalysisMetric("sleepiness", summaryTrends.sleepiness.average)} accent={colors.sleepForest} />
          <SummaryValue label="疲労" value={formatAnalysisMetric("fatigue", summaryTrends.fatigue.average)} accent={colors.warning} />
          <SummaryValue label="頭痛日" value={personalRecords.length ? `${personalRecords.filter((record) => record.headache).length} / ${personalRecords.length}日` : "データなし"} accent={colors.sleepHeadache} />
        </View>
        <AnalysisSectionLabel title="項目別に見る" />
        <View style={styles.categoryList}>
          <AnalysisCategoryButton icon="bedtime" label="睡眠の詳細を見る" description="睡眠時間・就寝起床・昼寝" accent={colors.sleepBlue} onPress={() => openCategory("sleep")} />
          <AnalysisCategoryButton icon="favorite" label="体調の詳細を見る" description="眠気・冴え・疲労・筋肉疲労" accent={colors.sleepForest} onPress={() => openCategory("condition")} />
          <AnalysisCategoryButton icon="healing" label="頭痛の詳細を見る" description="日数・イベント・強度" accent={colors.sleepHeadache} onPress={() => openCategory("headache")} />
          <AnalysisCategoryButton icon="cloud" label="環境の詳細を見る" description="気圧履歴・変化量・天候" accent={colors.sleepSky} onPress={() => openCategory("environment")} />
        </View>
      </ScrollView>
    </View>
  </ScreenContainer>;
}

export type AnalysisCategory = "sleep" | "condition" | "headache" | "environment";

function AnalysisCategoryButton({ icon, label, description, accent, onPress }: { icon: ComponentProps<typeof MaterialIcons>["name"]; label: string; description: string; accent: string; onPress: () => void }) {
  const colors = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.categoryButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
    <View style={[styles.categoryIcon, { backgroundColor: `${accent}18` }]}><MaterialIcons name={icon} size={22} color={accent} /></View>
    <View style={styles.categoryCopy}><Text style={[styles.categoryTitle, { color: colors.foreground }]}>{label}</Text><Text style={[styles.categoryDescription, { color: colors.muted }]}>{description}</Text></View>
    <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
  </Pressable>;
}

function AnalysisSectionLabel({ title, action }: { title: string; action?: ReactNode }) {
  const colors = useColors();
  return <View style={styles.compactSectionHeader}><Text style={[styles.compactSectionTitle, { color: colors.foreground }]}>{title}</Text>{action}</View>;
}

function SummaryValue({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors = useColors();
  return <View style={[styles.summaryValue, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}><Text style={[styles.summaryLabel, { color: colors.sleepHomeMuted }]}>{label}</Text><Text style={[styles.summaryNumber, { color: colors.sleepHomeForeground }]}>{value}</Text></View>;
}

export type CategoryTrends = {
  sleep: ReturnType<typeof buildTrend>;
  nap: ReturnType<typeof buildTrend>;
  sleepiness: ReturnType<typeof buildTrend>;
  fatigue: ReturnType<typeof buildTrend>;
  clarity: ReturnType<typeof buildTrend>;
  muscleFatigue: ReturnType<typeof buildTrend>;
  headache: ReturnType<typeof buildTrend>;
  pressure: ReturnType<typeof buildTrend>;
};

export function SleepPanel({ trends, records, granularity, metric, setMetric, summary, colors }: { trends: CategoryTrends; records: SleepRecord[]; granularity: AnalysisGranularity; metric: AnalysisMetric; setMetric: (metric: AnalysisMetric) => void; summary: ReturnType<typeof summarizeTrend>; colors: ReturnType<typeof useColors> }) {
  return <>
    <Card style={styles.panelCard}>
      <Text style={[styles.panelTitle, { color: colors.foreground }]}>睡眠時間の推移</Text>
      <TrendBars points={trends.sleep} formatValue={(value) => formatAnalysisMetric("sleepMinutes", value)} accent={colors.sleepBlue} />
      <View style={styles.statsGrid}><View style={styles.statBox}><MetricCard label="平均" value={formatAnalysisMetric("sleepMinutes", summary.average)} icon="functions" accent={colors.sleepBlue} /></View><View style={styles.statBox}><MetricCard label="中央値" value={formatAnalysisMetric("sleepMinutes", summary.median)} icon="vertical-align-center" accent={colors.sleepBlue} /></View><View style={styles.statBox}><MetricCard label="有効日数" value={`${summary.dataDays} 日`} icon="event-available" accent={colors.sleepBlue} /></View></View>
      <Text style={[styles.note, { color: colors.muted }]}>欠損値は線や平均に含めず、「データなし」として扱います。{summary.excludedLegacySleepRecords ? ` 旧定義の睡眠時間 ${summary.excludedLegacySleepRecords} 件は実睡眠の分析から除外しています。` : ""}</Text>
    </Card>
    <Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>就寝・起床の記録</Text><SleepIntervalList records={records} colors={colors} /></Card>
    <Collapsible title="睡眠の指標を詳しく見る"><Card style={styles.panelCard}><ChoicePills value={metric} onChange={setMetric} options={METRIC_OPTIONS.filter((option) => ["sleepMinutes", "bedTime", "wakeTime", "napMinutes"].includes(option.value))} /><Text style={[styles.chartTitle, { color: colors.foreground }]}>{getAnalysisMetricLabel(metric)}の推移</Text><ConditionTrendChart points={buildTrend(records, metric, granularity)} formatValue={(value) => formatAnalysisMetric(metric, value)} /></Card></Collapsible>
  </>;
}

export function ConditionPanel({ trends, colors }: { trends: CategoryTrends; colors: ReturnType<typeof useColors> }) {
  const sections = [
    { key: "sleepiness", title: "眠気", points: trends.sleepiness, accent: colors.sleepBlue },
    { key: "fatigue", title: "疲労", points: trends.fatigue, accent: colors.warning },
    { key: "clarity", title: "頭の冴え", points: trends.clarity, accent: colors.sleepForest },
    { key: "muscleFatigue", title: "筋肉疲労", points: trends.muscleFatigue, accent: colors.sleepHeadache },
  ].filter((section) => section.points.some((point) => point.value !== null));
  if (!sections.length) {
    return <View style={[styles.compactEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.compactEmptyTitle, { color: colors.foreground }]}>この期間の体調記録はありません</Text><Text style={[styles.compactEmptyNote, { color: colors.muted }]}>眠気・疲労・頭の冴え・筋肉疲労を記録すると、ここに推移が表示されます。</Text></View>;
  }
  return <Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>主観状態の推移</Text>{sections.map((section) => <TrendBars key={section.key} points={section.points} formatValue={(value) => `${value.toFixed(1)} / 10`} accent={section.accent} title={section.title} />)}{sections.length < 4 ? <Text style={[styles.note, { color: colors.muted }]}>未入力の項目は表示していません。</Text> : null}</Card>;
}

export function HeadachePanel({ events, dailyHeadacheDays, personalRecords, trends, colors }: { events: import("@/lib/headache-events").HeadacheEvent[]; dailyHeadacheDays: number; personalRecords: SleepRecord[]; trends: CategoryTrends; colors: ReturnType<typeof useColors> }) {
  const recentEvents = events.slice(0, 6);
  return <Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>頭痛の記録</Text><View style={styles.statsGrid}><View style={styles.statBox}><MetricCard label="日次記録" value={personalRecords.length ? `${dailyHeadacheDays} 日` : "データなし"} icon="event" accent={colors.sleepHeadache} /></View><View style={styles.statBox}><MetricCard label="イベント" value={events.length ? `${events.length} 件` : "データなし"} icon="notifications-none" accent={colors.sleepHeadache} /></View></View><TrendBars points={trends.headache} formatValue={(value) => `${value.toFixed(1)} / 10`} accent={colors.sleepHeadache} title="日次頭痛強度" /><Text style={[styles.note, { color: colors.muted }]}>日次記録と頭痛イベントは別の保存元です。ここでは混在させず、個別に表示します。</Text>{recentEvents.length ? <View style={styles.eventList}>{recentEvents.map((event) => <View key={event.id} style={[styles.eventRow, { borderColor: colors.border }]}><Text style={[styles.eventDate, { color: colors.foreground }]}>{formatShortDate(event.date)} {new Date(event.startedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</Text><Text style={[styles.eventMeta, { color: colors.muted }]}>{event.severity === null ? "強さ 未入力" : `強さ ${event.severity} / 10`} · {event.symptoms.length ? event.symptoms.map(getHeadacheFeatureLabel).join("・") : "症状未入力"}</Text></View>)}</View> : <Text style={[styles.note, { color: colors.muted }]}>頭痛イベントはまだありません。</Text>}</Card>;
}

export function EnvironmentPanel({ pressurePeriod, latestPressureChanges, caffeineRecords, colors }: { pressurePeriod: PressureHistoryPeriodSelection; latestPressureChanges: { change3Hours?: { changeHpa: number }; change24Hours?: { changeHpa: number } }; caffeineRecords: SleepRecord[]; colors: ReturnType<typeof useColors> }) {
  const latestPressureBatch = pressurePeriod.latestBatch;
  return <><Card style={styles.panelCard}>{latestPressureBatch ? <><Text style={[styles.panelTitle, { color: colors.foreground }]}>気圧の時系列</Text>{pressurePeriod.pointCount >= 2 ? <PressureHistoryChart batches={pressurePeriod.batches} /> : <Text style={[styles.note, { color: colors.muted }]}>選択期間内の気圧点が1件のため、時系列グラフは表示できません。</Text>}<View style={styles.statsGrid}><View style={styles.statBox}><MetricCard label="3時間変化" value={formatPressureChange(latestPressureChanges.change3Hours)} icon="trending-flat" accent={colors.sleepBlue} /></View><View style={styles.statBox}><MetricCard label="24時間変化" value={formatPressureChange(latestPressureChanges.change24Hours)} icon="trending-flat" accent={colors.sleepBlue} /></View></View><Text style={[styles.note, { color: colors.muted }]}>{pressurePeriod.days}日間の保存済み履歴: {pressurePeriod.batches.length}バッチ・{pressurePeriod.pointCount}点。地点を判別できないバッチ間は線で結びません。</Text><Text style={[styles.note, { color: colors.muted }]}>選択期間内の最新取得 {new Date(latestPressureBatch.fetchedAt).toLocaleString("ja-JP")}。地上気圧のモデル系列を、記録の振り返り用に表示しています。</Text></> : <Text style={[styles.note, { color: colors.muted }]}>選択期間に気圧履歴はありません。ホームの「天候を更新」から取得できます。</Text>}</Card><Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>カフェイン記録</Text>{caffeineRecords.length ? caffeineRecords.slice(-6).reverse().map((record) => <View key={record.id} style={[styles.eventRow, { borderColor: colors.border }]}><Text style={[styles.eventDate, { color: colors.foreground }]}>{formatShortDate(record.date)} {record.caffeineTime || "時刻未入力"}</Text><Text style={[styles.eventMeta, { color: colors.muted }]}>{record.caffeineNote || "メモなし"}</Text></View>) : <Text style={[styles.note, { color: colors.muted }]}>カフェイン記録はありません。</Text>}<Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>複数の項目を横断して確認する分析は、高度な分析から開けます。</Text></Card></>;
}

function TrendBars({ points, formatValue, accent, title }: { points: ReturnType<typeof buildTrend>; formatValue: (value: number) => string; accent: string; title?: string }) {
  const colors = useColors();
  const valid = points.filter((point): point is typeof point & { value: number } => point.value !== null);
  const max = valid.length ? Math.max(...valid.map((point) => point.value), 1) : 1;
  const stats = summarizeTrend(points);
  return <View style={styles.trendBars}>{title ? <Text style={[styles.trendTitle, { color: colors.foreground }]}>{title}</Text> : null}{points.length ? points.slice(-10).map((point) => <View key={point.key} style={styles.barRow}><Text style={[styles.barLabel, { color: colors.muted }]}>{point.label}</Text>{point.value === null ? <Text style={[styles.barMissing, { color: colors.muted }]}>データなし</Text> : <View style={styles.barValueWrap}><View style={[styles.barTrack, { backgroundColor: `${accent}18` }]}><View style={[styles.barFill, { width: `${Math.max(4, Math.min(100, point.value / max * 100))}%`, backgroundColor: accent }]} /></View><Text style={[styles.barValue, { color: colors.foreground }]}>{formatValue(point.value)}</Text></View>}</View>) : <Text style={[styles.note, { color: colors.muted }]}>データなし</Text>}{valid.length ? <Text style={[styles.trendSummary, { color: colors.muted }]}>平均 {formatValue(stats.average as number)}　中央値 {formatValue(stats.median as number)}　有効 {stats.dataDays} 日</Text> : null}</View>;
}

function SleepIntervalList({ records, colors }: { records: SleepRecord[]; colors: ReturnType<typeof useColors> }) {
  if (!records.length) return <Text style={[styles.note, { color: colors.muted }]}>睡眠記録はありません。</Text>;
  return <View style={styles.eventList}>{records.slice(-7).reverse().map((record) => { const bed = timeToMinutes(record.bedTime); const wake = timeToMinutes(record.wakeTime); const durationLabel = record.sleepDurationDefinition === "actualSleep" ? "実睡眠" : "旧定義"; return <View key={record.id} style={[styles.eventRow, { borderColor: colors.border }]}><Text style={[styles.eventDate, { color: colors.foreground }]}>{formatShortDate(record.date)}　{record.bedTime} 〜 {record.wakeTime}</Text><Text style={[styles.eventMeta, { color: colors.muted }]}>{bed === null || wake === null ? "時刻データなし" : `${durationLabel} ${formatDuration(record.sleepMinutes, true)}`} · 昼寝 {formatDuration(record.napMinutes, true)}</Text></View>; })}</View>;
}

function formatPressureChange(change?: { changeHpa: number }) {
  if (!change) return "データ不足";
  const prefix = change.changeHpa > 0 ? "+" : "";
  const arrow = change.changeHpa > 0 ? "↑" : change.changeHpa < 0 ? "↓" : "→";
  return `${prefix}${change.changeHpa.toFixed(1)} ${arrow}`;
}

export function RelationCard({ relation }: { relation: ReturnType<typeof analyzeRelation> }) {
  const colors = useColors();
  const content = relation.status === "ready" && relation.coefficient !== null
    ? `相関の目安 ${relation.coefficient >= 0 ? "+" : "−"}${Math.abs(relation.coefficient).toFixed(2)}（${relation.pairedCount} 組）`
    : relation.status === "constant" ? `${relation.pairedCount} 組ありますが、値のばらつきがないため算出できません。` : `データ不足（${relation.pairedCount} / 5 組）。両方の値がある日だけを数えます。`;
  return <Card style={styles.relationCard}><Text style={[styles.relationTitle, { color: colors.foreground }]}>{relation.label}</Text><Text style={[styles.relationMeta, { color: colors.muted }]}>{relation.xLabel} × {relation.yLabel}</Text><Text style={[styles.relationValue, { color: relation.status === "ready" ? colors.primary : colors.muted }]}>{content}</Text>{relation.excludedLegacySleepRecords ? <Text style={[styles.relationMeta, { color: colors.muted }]}>旧定義の睡眠時間 {relation.excludedLegacySleepRecords} 件を除外</Text> : null}</Card>;
}

export function RecommendationValue({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={[styles.recommendationValue, { backgroundColor: `${colors.primary}12` }]}><Text style={[styles.recommendationLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.recommendationNumber, { color: colors.primary }]}>{value}</Text></View>;
}

export function DataQualityCard({ quality }: { quality: AnalysisQuality }) {
  const colors = useColors();
  return (
    <Card style={styles.qualityCard}>
      <View style={styles.detailQualityContent}>
        <View style={styles.qualityHeader}><Text style={[styles.qualityPeriod, { color: colors.foreground }]}>この表示で使った記録</Text><SmallStatus label={quality.statusLabel} tone={quality.status === "sufficient" ? "success" : quality.status === "partial" || quality.status === "reference" ? "warning" : "muted"} /></View>
        <Text style={[styles.qualityMessage, { color: colors.muted }]}>{quality.metricLabel} {quality.validMetricRecords} 件を表示しています。未記録 {quality.missingMetricRecords} 件は値を補わず、グラフから除外しています。</Text>
        {quality.excludedLegacySleepRecords ? <Text style={[styles.qualityNote, { color: colors.muted }]}>旧定義の睡眠時間 {quality.excludedLegacySleepRecords} 件は、実睡眠の表示から除外しています。</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  analysisSurface: { flex: 1 },
  topContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 18, gap: 6 },
  periodCard: { gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
  periodHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  periodTitle: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  periodNote: { fontSize: 10, lineHeight: 14 },
  compactSectionHeader: { minHeight: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  compactSectionTitle: { fontSize: 15, lineHeight: 20, fontWeight: "900" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryValue: { width: "48%", minHeight: 58, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, justifyContent: "center", gap: 1 },
  summaryLabel: { fontSize: 10, lineHeight: 14, fontWeight: "800" },
  summaryNumber: { fontSize: 16, lineHeight: 21, fontWeight: "900" },
  categoryList: { gap: 8 },
  categoryButton: { minHeight: 62, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  categoryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  categoryCopy: { flex: 1, gap: 2 },
  categoryTitle: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  categoryDescription: { fontSize: 11, lineHeight: 15 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  compactEmpty: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 4 },
  compactEmptyTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  compactEmptyNote: { fontSize: 12, lineHeight: 18 },
  panelCard: { gap: 12, paddingHorizontal: 14, paddingVertical: 15 },
  panelTitle: { fontSize: 17, lineHeight: 23, fontWeight: "900" },
  chartCard: { gap: 13, paddingHorizontal: 14, paddingVertical: 16 },
  chartTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  statsGrid: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, minWidth: 0 },
  note: { fontSize: 12, lineHeight: 18 },
  trendBars: { gap: 8 },
  trendTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800", marginTop: 3 },
  trendSummary: { fontSize: 10, lineHeight: 15, fontWeight: "700", marginTop: 2 },
  barRow: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 7 },
  barLabel: { width: 54, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  barValueWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  barTrack: { flex: 1, height: 10, borderRadius: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  barValue: { width: 82, fontSize: 10, lineHeight: 14, fontWeight: "800", textAlign: "right" },
  barMissing: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  eventList: { gap: 7 },
  eventRow: { borderBottomWidth: 1, paddingBottom: 7, gap: 2 },
  eventDate: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  eventMeta: { fontSize: 11, lineHeight: 16 },
  qualityCard: { paddingVertical: 14 },
  detailQualityContent: { gap: 6 },
  qualityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  qualityPeriod: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  qualityMessage: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  qualityNote: { fontSize: 11, lineHeight: 16 },
  relations: { gap: 8 },
  relationCard: { gap: 3, paddingVertical: 13 },
  relationTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  relationMeta: { fontSize: 11, lineHeight: 16 },
  relationValue: { fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 2 },
  recommendationCard: { gap: 12 },
  recommendationTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  recommendationReason: { fontSize: 12, lineHeight: 18 },
  recommendationGrid: { flexDirection: "row", gap: 8 },
  recommendationValue: { flex: 1, borderRadius: 12, padding: 10, gap: 2 },
  recommendationLabel: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  recommendationNumber: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  editTitle: { fontSize: 14, lineHeight: 20, fontWeight: "800", marginTop: 3 },
  editRow: { flexDirection: "row", gap: 7 },
  editField: { flex: 1, minWidth: 0, gap: 4 },
  editLabel: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  disclaimer: { borderRadius: 14, padding: 13 },
  disclaimerText: { fontSize: 12, lineHeight: 18 },
});
