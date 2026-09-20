import { useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { ConditionTrendChart } from "@/components/condition-trend-chart";
import { PressureHistoryChart } from "@/components/pressure-history-chart";
import { AppTextInput, Card, ChoicePills, MetricCard, PageHeader, PrimaryButton, SectionLabel, SegmentedControl, SmallStatus, ToggleRow } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { analyzeRelation, assessAnalysisQuality, buildSleepRecommendation, buildTrend, formatAnalysisMetric, getAnalysisMetricLabel, MIN_RECOMMENDATION_SLEEP_MINUTES, summarizeTrend, type AnalysisGranularity, type AnalysisMetric, type AnalysisQuality, type RelationKey } from "@/lib/condition-analysis";
import { Collapsible } from "@/components/ui/collapsible";
import { useSleepData } from "@/lib/sleep-store";
import { useHeadacheEvents } from "@/lib/headache-store";
import { calculatePressureChangesForBatch } from "@/lib/pressure-history";
import { usePressureHistory } from "@/lib/pressure-history-store";
import { formatDuration, formatShortDate, getHeadacheFeatureLabel, isTime, timeToMinutes, type SleepRecord } from "@/lib/sleep-utils";

const METRIC_OPTIONS: { value: AnalysisMetric; label: string }[] = [
  { value: "sleepMinutes", label: "睡眠" }, { value: "bedTime", label: "就寝" }, { value: "wakeTime", label: "起床" }, { value: "napMinutes", label: "昼寝" },
  { value: "sleepiness", label: "眠気" }, { value: "fatigue", label: "疲労" }, { value: "clarity", label: "冴え" }, { value: "headacheIntensity", label: "頭痛" }, { value: "muscleFatigue", label: "筋肉疲労" }, { value: "pressureHpa", label: "気圧" },
];
const RELATIONS: RelationKey[] = ["sleepSleepiness", "sleepClarity", "napSleep", "pressureHeadache", "pressureChangeHeadache", "caffeineTimeSleep", "caffeineTimeSleepiness"];

export default function AnalysisScreen() {
  const colors = useColors();
  const { records, settings, updateSettings, isReady } = useSleepData();
  const { events: headacheEvents, isReady: headacheEventsReady } = useHeadacheEvents();
  const { batches: pressureBatches, isReady: pressureHistoryReady } = usePressureHistory();
  const [granularity, setGranularity] = useState<AnalysisGranularity>("day");
  const [category, setCategory] = useState<AnalysisCategory>("sleep");
  const [metric, setMetric] = useState<AnalysisMetric>("sleepMinutes");
  const categoryTrends = useMemo(() => ({
    sleep: buildTrend(records, "sleepMinutes", granularity),
    nap: buildTrend(records, "napMinutes", granularity),
    sleepiness: buildTrend(records, "sleepiness", granularity),
    fatigue: buildTrend(records, "fatigue", granularity),
    clarity: buildTrend(records, "clarity", granularity),
    muscleFatigue: buildTrend(records, "muscleFatigue", granularity),
    headache: buildTrend(records, "headacheIntensity", granularity),
    pressure: buildTrend(records, "pressureHpa", granularity),
  }), [records, granularity]);
  const relations = useMemo(() => RELATIONS.map((key) => analyzeRelation(records, key)), [records]);
  const quality = useMemo(() => assessAnalysisQuality(records, metric, granularity, relations), [records, metric, granularity, relations]);
  const recommendation = useMemo(() => buildSleepRecommendation(records), [records]);
  const latestPressureBatch = pressureBatches[0];
  const latestPressureChanges = useMemo(
    () => latestPressureBatch ? calculatePressureChangesForBatch(latestPressureBatch) : {},
    [latestPressureBatch],
  );
  const [bedTimeOverride, setBedTime] = useState<string | null>(null);
  const [wakeTimeOverride, setWakeTime] = useState<string | null>(null);
  const [sleepMinutesOverride, setSleepMinutes] = useState<string | null>(null);
  const [isSavingRecommendation, setIsSavingRecommendation] = useState(false);
  const recommendationSaveLock = useRef(false);
  const bedTime = bedTimeOverride ?? (recommendation.status === "ready" ? settings.recommendationBedTime ?? recommendation.bedTime : "");
  const wakeTime = wakeTimeOverride ?? (recommendation.status === "ready" ? settings.recommendationWakeTime ?? recommendation.wakeTime : "");
  const sleepMinutes = sleepMinutesOverride ?? (recommendation.status === "ready" ? String(settings.recommendationSleepMinutes ?? recommendation.targetSleepMinutes) : "");

  const saveOverrides = async () => {
    if (recommendationSaveLock.current) return;
    const minutes = Number(sleepMinutes);
    if (!isTime(bedTime) || !isTime(wakeTime) || !Number.isFinite(minutes) || minutes < MIN_RECOMMENDATION_SLEEP_MINUTES) {
      Alert.alert("参考値を確認してください", "就寝・起床時刻は HH:MM、睡眠時間は7時間以上で入力してください。");
      return;
    }
    recommendationSaveLock.current = true;
    setIsSavingRecommendation(true);
    try {
      if (!await updateSettings({ recommendationBedTime: bedTime, recommendationWakeTime: wakeTime, recommendationSleepMinutes: Math.round(minutes) })) {
        Alert.alert("参考値を保存できませんでした", "入力内容はこの画面に残っています。時間をおいてもう一度お試しください。");
        return;
      }
      Alert.alert("参考値を保存しました", "いつでもこの画面から変更・無効化できます。");
    } finally {
      recommendationSaveLock.current = false;
      setIsSavingRecommendation(false);
    }
  };

  const toggleRecommendation = () => {
    if (recommendationSaveLock.current) return;
    recommendationSaveLock.current = true;
    void (async () => {
      try {
        if (!await updateSettings({ recommendationEnabled: !settings.recommendationEnabled })) {
          Alert.alert("表示設定を保存できませんでした", "設定は変更していません。時間をおいてもう一度お試しください。");
        }
      } finally {
        recommendationSaveLock.current = false;
      }
    })();
  };

  if (!isReady || !pressureHistoryReady || !headacheEventsReady) return <ScreenContainer />;

  const personalRecords = records.filter((record) => !record.isSample);
  const dailyHeadacheDays = personalRecords.filter((record) => record.headache).length;
  const caffeineRecords = personalRecords.filter((record) => record.caffeine && record.caffeineTime);

  return (
    <ScreenContainer>
      <View style={[styles.analysisSurface, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <PageHeader title="詳細分析" subtitle="個人記録を日付順に振り返る" />

        <Card style={styles.periodCard}>
          <View style={styles.periodHeader}><Text style={[styles.periodTitle, { color: colors.foreground }]}>表示期間</Text><SmallStatus label={`${personalRecords.length} 日を分析`} tone="muted" /></View>
          <SegmentedControl value={granularity} onChange={setGranularity} options={[{ value: "day", label: "日別" }, { value: "week", label: "週別" }, { value: "month", label: "月別" }]} />
          <Text style={[styles.periodNote, { color: colors.muted }]}>切替で再計算</Text>
        </Card>

        <SectionLabel title="現在のまとめ" action={<SmallStatus label={quality.statusLabel} tone={quality.status === "sufficient" ? "success" : quality.status === "partial" || quality.status === "reference" ? "warning" : "muted"} />} />
        <View style={styles.summaryGrid}>
          <SummaryValue label="睡眠" value={formatAnalysisMetric("sleepMinutes", summarizeTrend(categoryTrends.sleep).average)} accent={colors.sleepBlue} />
          <SummaryValue label="眠気" value={formatAnalysisMetric("sleepiness", summarizeTrend(categoryTrends.sleepiness).average)} accent={colors.sleepForest} />
          <SummaryValue label="疲労" value={formatAnalysisMetric("fatigue", summarizeTrend(categoryTrends.fatigue).average)} accent={colors.warning} />
          <SummaryValue label="頭痛日" value={personalRecords.length ? `${dailyHeadacheDays} / ${personalRecords.length}日` : "データなし"} accent={colors.sleepHeadache} />
        </View>

        <SectionLabel title="項目別に見る" />
        <SegmentedControl value={category} onChange={setCategory} options={[{ value: "sleep", label: "睡眠" }, { value: "condition", label: "体調" }, { value: "headache", label: "頭痛" }, { value: "environment", label: "環境" }]} />
        {category === "sleep" ? <SleepPanel trends={categoryTrends} records={personalRecords} granularity={granularity} metric={metric} setMetric={setMetric} summary={summarizeTrend(categoryTrends.sleep)} colors={colors} /> : null}
        {category === "condition" ? <ConditionPanel trends={categoryTrends} colors={colors} /> : null}
        {category === "headache" ? <HeadachePanel events={headacheEvents} dailyHeadacheDays={dailyHeadacheDays} personalRecords={personalRecords} trends={categoryTrends} colors={colors} /> : null}
        {category === "environment" ? <EnvironmentPanel latestPressureBatch={latestPressureBatch} latestPressureChanges={latestPressureChanges} caffeineRecords={caffeineRecords} colors={colors} /> : null}

        <DataQualityCard quality={quality} />

        <Collapsible title="関連を見る">
          <View style={styles.relations}>{relations.map((relation) => <RelationCard key={relation.key} relation={relation} />)}</View>
          <Text style={[styles.note, { color: colors.muted }]}>Pearsonの相関係数を使用します。両方の値がある日だけを対象にし、5組未満・値のばらつきがない場合は算出しません。相関は関連の目安であり、原因を示すものではありません。</Text>
        </Collapsible>

        <Collapsible title="参考値を見る">
          <Card style={styles.recommendationCard}>
            <ToggleRow icon="auto-awesome" label="参考値を表示" description="いつでも無効にできます" active={settings.recommendationEnabled} onPress={toggleRecommendation} />
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
              <PrimaryButton label={isSavingRecommendation ? "保存中…" : "調整した参考値を保存"} icon="save" secondary loading={isSavingRecommendation} onPress={() => { void saveOverrides(); }} />
            </> : null}
            {settings.recommendationEnabled && recommendation.status === "insufficient" ? <Text style={[styles.note, { color: colors.muted }]}>参考値は、眠気が低く頭の冴えが高かった日が {recommendation.minimumDays} 日以上で表示します。現在は {recommendation.qualifyingDays} 日です。</Text> : null}
            {settings.recommendationEnabled && recommendation.status === "tooShort" ? <Text style={[styles.note, { color: colors.muted }]}>条件に合う {recommendation.qualifyingDays} 日はありますが、過去の中央値が短すぎるため参考値は表示しません。</Text> : null}
          </Card>
        </Collapsible>

        <View style={[styles.disclaimer, { backgroundColor: `${colors.muted}12` }]}><Text style={[styles.disclaimerText, { color: colors.muted }]}>この分析は個人記録の振り返りであり、診断ではありません。気になる症状が続く場合は、保護者や医療機関に相談してください。</Text></View>
      </ScrollView>
      </View>
    </ScreenContainer>
  );
}

type AnalysisCategory = "sleep" | "condition" | "headache" | "environment";

function SummaryValue({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors = useColors();
  return <View style={[styles.summaryValue, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}><Text style={[styles.summaryLabel, { color: colors.sleepHomeMuted }]}>{label}</Text><Text style={[styles.summaryNumber, { color: colors.sleepHomeForeground }]}>{value}</Text></View>;
}

type CategoryTrends = {
  sleep: ReturnType<typeof buildTrend>;
  nap: ReturnType<typeof buildTrend>;
  sleepiness: ReturnType<typeof buildTrend>;
  fatigue: ReturnType<typeof buildTrend>;
  clarity: ReturnType<typeof buildTrend>;
  muscleFatigue: ReturnType<typeof buildTrend>;
  headache: ReturnType<typeof buildTrend>;
  pressure: ReturnType<typeof buildTrend>;
};

function SleepPanel({ trends, records, granularity, metric, setMetric, summary, colors }: { trends: CategoryTrends; records: SleepRecord[]; granularity: AnalysisGranularity; metric: AnalysisMetric; setMetric: (metric: AnalysisMetric) => void; summary: ReturnType<typeof summarizeTrend>; colors: ReturnType<typeof useColors> }) {
  return <>
    <Card style={styles.panelCard}>
      <Text style={[styles.panelTitle, { color: colors.foreground }]}>睡眠時間の推移</Text>
      <TrendBars points={trends.sleep} formatValue={(value) => formatAnalysisMetric("sleepMinutes", value)} accent={colors.sleepBlue} />
      <View style={styles.statsGrid}><View style={styles.statBox}><MetricCard label="平均" value={formatAnalysisMetric("sleepMinutes", summary.average)} icon="functions" accent={colors.sleepBlue} /></View><View style={styles.statBox}><MetricCard label="中央値" value={formatAnalysisMetric("sleepMinutes", summary.median)} icon="vertical-align-center" accent={colors.sleepBlue} /></View><View style={styles.statBox}><MetricCard label="有効日数" value={`${summary.dataDays} 日`} icon="event-available" accent={colors.sleepBlue} /></View></View>
      <Text style={[styles.note, { color: colors.muted }]}>欠損値は線や平均に含めず、「データなし」として扱います。</Text>
    </Card>
    <Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>就寝・起床の記録</Text><SleepIntervalList records={records} colors={colors} /></Card>
    <Collapsible title="睡眠の指標を詳しく見る"><Card style={styles.panelCard}><ChoicePills value={metric} onChange={setMetric} options={METRIC_OPTIONS.filter((option) => ["sleepMinutes", "bedTime", "wakeTime", "napMinutes"].includes(option.value))} /><Text style={[styles.chartTitle, { color: colors.foreground }]}>{getAnalysisMetricLabel(metric)}の推移</Text><ConditionTrendChart points={buildTrend(records, metric, granularity)} formatValue={(value) => formatAnalysisMetric(metric, value)} /></Card></Collapsible>
  </>;
}

function ConditionPanel({ trends, colors }: { trends: CategoryTrends; colors: ReturnType<typeof useColors> }) {
  return <Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>主観状態の推移</Text><TrendBars points={trends.sleepiness} formatValue={(value) => `${value.toFixed(1)} / 10`} accent={colors.sleepBlue} title="眠気" /><TrendBars points={trends.fatigue} formatValue={(value) => `${value.toFixed(1)} / 10`} accent={colors.warning} title="疲労" /><TrendBars points={trends.clarity} formatValue={(value) => `${value.toFixed(1)} / 10`} accent={colors.sleepForest} title="頭の冴え" /><TrendBars points={trends.muscleFatigue} formatValue={(value) => `${value.toFixed(1)} / 10`} accent={colors.sleepHeadache} title="筋肉疲労" /></Card>;
}

function HeadachePanel({ events, dailyHeadacheDays, personalRecords, trends, colors }: { events: import("@/lib/headache-events").HeadacheEvent[]; dailyHeadacheDays: number; personalRecords: SleepRecord[]; trends: CategoryTrends; colors: ReturnType<typeof useColors> }) {
  const recentEvents = events.slice(0, 6);
  return <Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>頭痛の記録</Text><View style={styles.statsGrid}><View style={styles.statBox}><MetricCard label="日次記録" value={personalRecords.length ? `${dailyHeadacheDays} 日` : "データなし"} icon="event" accent={colors.sleepHeadache} /></View><View style={styles.statBox}><MetricCard label="イベント" value={events.length ? `${events.length} 件` : "データなし"} icon="notifications-none" accent={colors.sleepHeadache} /></View></View><TrendBars points={trends.headache} formatValue={(value) => `${value.toFixed(1)} / 10`} accent={colors.sleepHeadache} title="日次頭痛強度" /><Text style={[styles.note, { color: colors.muted }]}>日次記録と頭痛イベントは別の保存元です。ここでは混在させず、個別に表示します。</Text>{recentEvents.length ? <View style={styles.eventList}>{recentEvents.map((event) => <View key={event.id} style={[styles.eventRow, { borderColor: colors.border }]}><Text style={[styles.eventDate, { color: colors.foreground }]}>{formatShortDate(event.date)} {new Date(event.startedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</Text><Text style={[styles.eventMeta, { color: colors.muted }]}>{event.severity === null ? "強さ 未入力" : `強さ ${event.severity} / 10`} · {event.symptoms.length ? event.symptoms.map(getHeadacheFeatureLabel).join("・") : "症状未入力"}</Text></View>)}</View> : <Text style={[styles.note, { color: colors.muted }]}>頭痛イベントはまだありません。</Text>}</Card>;
}

function EnvironmentPanel({ latestPressureBatch, latestPressureChanges, caffeineRecords, colors }: { latestPressureBatch?: NonNullable<ReturnType<typeof usePressureHistory>["batches"]>[number]; latestPressureChanges: { change3Hours?: { changeHpa: number }; change24Hours?: { changeHpa: number } }; caffeineRecords: SleepRecord[]; colors: ReturnType<typeof useColors> }) {
  return <><Card style={styles.panelCard}>{latestPressureBatch ? <><Text style={[styles.panelTitle, { color: colors.foreground }]}>気圧の時系列</Text><PressureHistoryChart batch={latestPressureBatch} /><View style={styles.statsGrid}><View style={styles.statBox}><MetricCard label="3時間変化" value={formatPressureChange(latestPressureChanges.change3Hours)} icon="trending-flat" accent={colors.sleepBlue} /></View><View style={styles.statBox}><MetricCard label="24時間変化" value={formatPressureChange(latestPressureChanges.change24Hours)} icon="trending-flat" accent={colors.sleepBlue} /></View></View><Text style={[styles.note, { color: colors.muted }]}>取得 {new Date(latestPressureBatch.fetchedAt).toLocaleString("ja-JP")}。地上気圧のモデル系列を、記録の振り返り用に表示しています。</Text></> : <Text style={[styles.note, { color: colors.muted }]}>気圧履歴はまだありません。ホームの「天候を更新」から取得できます。</Text>}</Card><Card style={styles.panelCard}><Text style={[styles.panelTitle, { color: colors.foreground }]}>カフェイン記録</Text>{caffeineRecords.length ? caffeineRecords.slice(-6).reverse().map((record) => <View key={record.id} style={[styles.eventRow, { borderColor: colors.border }]}><Text style={[styles.eventDate, { color: colors.foreground }]}>{formatShortDate(record.date)} {record.caffeineTime || "時刻未入力"}</Text><Text style={[styles.eventMeta, { color: colors.muted }]}>{record.caffeineNote || "メモなし"}</Text></View>) : <Text style={[styles.note, { color: colors.muted }]}>カフェイン記録はありません。</Text>}<Text style={[styles.note, { color: colors.muted, marginTop: 8 }]}>気圧やカフェインと体調の関係は、関連の目安として「関連を見る」で確認できます。</Text></Card></>;
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
  return <View style={styles.eventList}>{records.slice(-7).reverse().map((record) => { const bed = timeToMinutes(record.bedTime); const wake = timeToMinutes(record.wakeTime); return <View key={record.id} style={[styles.eventRow, { borderColor: colors.border }]}><Text style={[styles.eventDate, { color: colors.foreground }]}>{formatShortDate(record.date)}　{record.bedTime} 〜 {record.wakeTime}</Text><Text style={[styles.eventMeta, { color: colors.muted }]}>{bed === null || wake === null ? "時刻データなし" : formatDuration(record.sleepMinutes, true)} · 昼寝 {formatDuration(record.napMinutes, true)}</Text></View>; })}</View>;
}

function formatPressureChange(change?: { changeHpa: number }) {
  if (!change) return "データ不足";
  const prefix = change.changeHpa > 0 ? "+" : "";
  const arrow = change.changeHpa > 0 ? "↑" : change.changeHpa < 0 ? "↓" : "→";
  return `${prefix}${change.changeHpa.toFixed(1)} ${arrow}`;
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

function DataQualityCard({ quality }: { quality: AnalysisQuality }) {
  const colors = useColors();
  const tone = quality.status === "sufficient" ? colors.success : quality.status === "partial" || quality.status === "reference" ? colors.warning : colors.muted;
  return (
    <Card style={styles.qualityCard}>
      <Collapsible title={`データ品質（${quality.statusLabel}）`}>
        <View style={styles.qualityContent}>
          <View style={styles.qualityHeader}><Text style={[styles.qualityPeriod, { color: colors.foreground }]}>{quality.periodLabel}</Text><SmallStatus label={quality.statusLabel} tone={quality.status === "sufficient" ? "success" : quality.status === "partial" || quality.status === "reference" ? "warning" : "muted"} /></View>
          <Text style={[styles.qualityMessage, { color: tone }]}>{quality.message}</Text>
          <View style={styles.qualityGrid}>
            <QualityValue label="全記録" value={`${quality.totalRecords} 件`} />
            <QualityValue label="個人分析" value={`${quality.personalRecords} 件`} />
            <QualityValue label={`${quality.metricLabel}有効`} value={`${quality.validMetricRecords} 件`} />
            <QualityValue label="欠損除外" value={`${quality.missingMetricRecords} 件`} />
          </View>
          {quality.excludedSampleRecords ? <Text style={[styles.qualityNote, { color: colors.muted }]}>サンプル記録 {quality.excludedSampleRecords} 件を個人分析から除外しました。</Text> : null}
          <Text style={[styles.qualityNote, { color: colors.muted }]}>表示グループ: {quality.validPeriodGroups} / {quality.periodGroups}。相関は両方の値がある日だけを使います。</Text>
          <View style={styles.relationPairs}>{quality.relationPairs.map((relation) => <Text key={relation.key} style={[styles.relationPair, { color: colors.muted }]}>{relation.label}: {relation.pairedCount} / {quality.minimumRelationPairs} 組</Text>)}</View>
          <Text style={[styles.qualityNote, { color: colors.muted }]}>これは本人の記録を振り返るための参考情報であり、診断ではありません。</Text>
        </View>
      </Collapsible>
    </Card>
  );
}

function QualityValue({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={[styles.qualityValue, { backgroundColor: `${colors.primary}12` }]}><Text style={[styles.qualityValueLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.qualityValueNumber, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  analysisSurface: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 11 },
  periodCard: { gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  periodHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  periodTitle: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  periodNote: { fontSize: 11, lineHeight: 16 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryValue: { width: "48%", minHeight: 70, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", gap: 3 },
  summaryLabel: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
  summaryNumber: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
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
  qualityContent: { gap: 10 },
  qualityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  qualityPeriod: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  qualityMessage: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  qualityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  qualityValue: { width: "48%", borderRadius: 10, padding: 9, gap: 1 },
  qualityValueLabel: { fontSize: 10, lineHeight: 14, fontWeight: "700" },
  qualityValueNumber: { fontSize: 14, lineHeight: 20, fontWeight: "900" },
  qualityNote: { fontSize: 11, lineHeight: 16 },
  relationPairs: { gap: 3 },
  relationPair: { fontSize: 11, lineHeight: 16 },
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
