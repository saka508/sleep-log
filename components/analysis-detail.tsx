import { useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  ConditionPanel,
  DataQualityCard,
  EnvironmentPanel,
  HeadachePanel,
  RelationCard,
  SleepPanel,
  type AnalysisCategory,
  type CategoryTrends,
} from "@/app/(tabs)/analysis";
import { AppTextInput, Card, PageHeader, PrimaryButton, SegmentedControl, SmallStatus, ToggleRow } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { Collapsible } from "@/components/ui/collapsible";
import { useColors } from "@/hooks/use-colors";
import { analyzeRelation, assessAnalysisQuality, buildSleepRecommendation, buildTrend, MIN_RECOMMENDATION_SLEEP_MINUTES, summarizeTrend, type AnalysisGranularity, type AnalysisMetric, type RelationKey } from "@/lib/condition-analysis";
import { useHeadacheEvents } from "@/lib/headache-store";
import { calculatePressureChangesForBatch } from "@/lib/pressure-history";
import { usePressureHistory } from "@/lib/pressure-history-store";
import { useSleepData } from "@/lib/sleep-store";
import { formatDuration, isTime } from "@/lib/sleep-utils";

const RELATIONS: RelationKey[] = ["sleepSleepiness", "sleepClarity", "napSleep", "pressureHeadache", "pressureChangeHeadache", "caffeineTimeSleep", "caffeineTimeSleepiness"];

function parseCategory(value: string | string[] | undefined): AnalysisCategory {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "condition" || candidate === "headache" || candidate === "environment" ? candidate : "sleep";
}

function parseGranularity(value: string | string[] | undefined): AnalysisGranularity {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "week" || candidate === "month" ? candidate : "day";
}

const CATEGORY_TITLES: Record<AnalysisCategory, string> = {
  sleep: "睡眠の詳細",
  condition: "体調の詳細",
  headache: "頭痛の詳細",
  environment: "環境の詳細",
};

const QUALITY_METRICS: Record<AnalysisCategory, AnalysisMetric> = {
  sleep: "sleepMinutes",
  condition: "sleepiness",
  headache: "headacheIntensity",
  environment: "pressureHpa",
};

export default function AnalysisDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; granularity?: string }>();
  const category = parseCategory(params.category);
  const [granularity, setGranularity] = useState<AnalysisGranularity>(() => parseGranularity(params.granularity));
  const { records, settings, updateSettings, isReady } = useSleepData();
  const { events, isReady: headacheEventsReady } = useHeadacheEvents();
  const { batches, isReady: pressureHistoryReady } = usePressureHistory();
  const [metric, setMetric] = useState<AnalysisMetric>(QUALITY_METRICS[category]);
  const personalRecords = useMemo(() => records.filter((record) => !record.isSample), [records]);
  const trends: CategoryTrends = useMemo(() => ({
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
  const latestPressureBatch = batches[0];
  const latestPressureChanges = useMemo(() => latestPressureBatch ? calculatePressureChangesForBatch(latestPressureBatch) : {}, [latestPressureBatch]);
  const recommendation = useMemo(() => buildSleepRecommendation(records), [records]);
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
        if (!await updateSettings({ recommendationEnabled: !settings.recommendationEnabled })) Alert.alert("表示設定を保存できませんでした", "設定は変更していません。時間をおいてもう一度お試しください。");
      } finally {
        recommendationSaveLock.current = false;
      }
    })();
  };

  if (!isReady || !headacheEventsReady || !pressureHistoryReady) return <ScreenContainer />;
  return <ScreenContainer>
    <View style={[styles.surface, { backgroundColor: colors.background }]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PageHeader title={CATEGORY_TITLES[category]} subtitle="分析トップから選んだ項目を詳しく表示" action={<PrimaryButton label="分析トップ" secondary onPress={() => router.back()} />} />
      <Card style={styles.periodCard}><View style={styles.periodHeader}><Text style={[styles.periodTitle, { color: colors.foreground }]}>表示期間</Text><SmallStatus label={`${personalRecords.length}日`} tone="muted" /></View><SegmentedControl value={granularity} onChange={setGranularity} options={[{ value: "day", label: "日別" }, { value: "week", label: "週別" }, { value: "month", label: "月別" }]} /></Card>
      {category === "sleep" ? <SleepPanel trends={trends} records={personalRecords} granularity={granularity} metric={metric} setMetric={setMetric} summary={summarizeTrend(trends.sleep)} colors={colors} /> : null}
      {category === "condition" ? <ConditionPanel trends={trends} colors={colors} /> : null}
      {category === "headache" ? <HeadachePanel events={events} dailyHeadacheDays={personalRecords.filter((record) => record.headache).length} personalRecords={personalRecords} trends={trends} colors={colors} /> : null}
      {category === "environment" ? <EnvironmentPanel latestPressureBatch={latestPressureBatch} latestPressureChanges={latestPressureChanges} caffeineRecords={personalRecords.filter((record) => record.caffeine && record.caffeineTime)} colors={colors} /> : null}
      <DataQualityCard quality={quality} />
      <CollapsibleRelations relations={relations} />
      {category === "sleep" ? <SleepRecommendation recommendation={recommendation} settings={settings} updateSettings={updateSettings} bedTime={bedTime} wakeTime={wakeTime} sleepMinutes={sleepMinutes} setBedTime={setBedTime} setWakeTime={setWakeTime} setSleepMinutes={setSleepMinutes} toggleRecommendation={toggleRecommendation} saveOverrides={saveOverrides} isSavingRecommendation={isSavingRecommendation} /> : null}
      <View style={[styles.disclaimer, { backgroundColor: `${colors.muted}12` }]}><Text style={[styles.disclaimerText, { color: colors.muted }]}>この分析は個人記録の振り返りであり、診断ではありません。</Text></View>
    </ScrollView>
    </View>
  </ScreenContainer>;
}

function CollapsibleRelations({ relations }: { relations: ReturnType<typeof analyzeRelation>[] }) {
  return <Collapsible title="関連分析を見る"><View style={styles.relations}>{relations.map((relation) => <RelationCard key={relation.key} relation={relation} />)}</View><Text style={styles.relationNote}>Pearsonの相関係数を使用し、5組未満・値のばらつきがない場合は算出しません。相関は関連の目安であり、原因を示すものではありません。</Text></Collapsible>;
}

function SleepRecommendation({ recommendation, settings, updateSettings, bedTime, wakeTime, sleepMinutes, setBedTime, setWakeTime, setSleepMinutes, toggleRecommendation, saveOverrides, isSavingRecommendation }: { recommendation: ReturnType<typeof buildSleepRecommendation>; settings: ReturnType<typeof useSleepData>["settings"]; updateSettings: ReturnType<typeof useSleepData>["updateSettings"]; bedTime: string; wakeTime: string; sleepMinutes: string; setBedTime: (value: string) => void; setWakeTime: (value: string) => void; setSleepMinutes: (value: string) => void; toggleRecommendation: () => void; saveOverrides: () => void; isSavingRecommendation: boolean }) {
  const colors = useColors();
  return <Collapsible title="参考就寝・起床時刻"><Card style={styles.recommendationCard}><ToggleRow icon="auto-awesome" label="参考値を表示" description="いつでも無効にできます" active={settings.recommendationEnabled} onPress={toggleRecommendation} />{!settings.recommendationEnabled ? <Text style={[styles.note, { color: colors.muted }]}>参考値の表示は無効です。</Text> : null}{settings.recommendationEnabled && recommendation.status === "ready" ? <><Text style={[styles.recommendationTitle, { color: colors.foreground }]}>過去の記録から見た参考値</Text><Text style={[styles.recommendationReason, { color: colors.muted }]}>{recommendation.criteria} を条件にしています。対象 {recommendation.qualifyingDays} 日。</Text><View style={styles.recommendationGrid}><View style={styles.recommendationValue}><Text style={[styles.recommendationLabel, { color: colors.muted }]}>就寝</Text><Text style={[styles.recommendationNumber, { color: colors.primary }]}>{bedTime}</Text></View><View style={styles.recommendationValue}><Text style={[styles.recommendationLabel, { color: colors.muted }]}>起床</Text><Text style={[styles.recommendationNumber, { color: colors.primary }]}>{wakeTime}</Text></View><View style={styles.recommendationValue}><Text style={[styles.recommendationLabel, { color: colors.muted }]}>睡眠</Text><Text style={[styles.recommendationNumber, { color: colors.primary }]}>{formatDuration(Number(sleepMinutes), true)}</Text></View></View><View style={styles.editRow}><AppTextInput value={bedTime} onChangeText={setBedTime} maxLength={5} keyboardType="numbers-and-punctuation" /><AppTextInput value={wakeTime} onChangeText={setWakeTime} maxLength={5} keyboardType="numbers-and-punctuation" /><AppTextInput value={sleepMinutes} onChangeText={setSleepMinutes} keyboardType="number-pad" /></View><PrimaryButton label={isSavingRecommendation ? "保存中…" : "調整した参考値を保存"} icon="save" secondary loading={isSavingRecommendation} onPress={saveOverrides} /></> : null}{settings.recommendationEnabled && recommendation.status === "insufficient" ? <Text style={[styles.note, { color: colors.muted }]}>必要な記録数 {recommendation.minimumDays} 日に対して {recommendation.qualifyingDays} 日です。</Text> : null}</Card></Collapsible>;
}

const styles = StyleSheet.create({
  surface: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 28, gap: 11 },
  periodCard: { gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  periodHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  periodTitle: { fontSize: 15, lineHeight: 20, fontWeight: "900" },
  panel: { gap: 12 },
  relations: { gap: 8, marginTop: 8 },
  relationNote: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 8 },
  recommendationCard: { gap: 12 },
  recommendationTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  recommendationReason: { fontSize: 12, lineHeight: 18 },
  recommendationGrid: { flexDirection: "row", gap: 8 },
  recommendationValue: { flex: 1, borderRadius: 12, padding: 10, backgroundColor: "#2878C912", gap: 2 },
  recommendationLabel: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  recommendationNumber: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  editRow: { flexDirection: "row", gap: 7 },
  note: { fontSize: 12, lineHeight: 18 },
  disclaimer: { borderRadius: 14, padding: 13 },
  disclaimerText: { fontSize: 12, lineHeight: 18 },
});
