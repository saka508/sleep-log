import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, LineChart, MetricCard, PageHeader, ScatterPlot, SectionLabel, SegmentedControl, SmallStatus } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSleepData } from "@/lib/sleep-store";
import { correlation, formatDuration, getMetricValue, getSleepStats, type TrendMetric } from "@/lib/sleep-utils";

type Period = "7" | "14" | "30";
type Relation = "sleepiness" | "clarity" | "bedtime";

export default function AnalysisScreen() {
  const colors = useColors();
  const { records, isReady } = useSleepData();
  const [period, setPeriod] = useState<Period>("14");
  const [metric, setMetric] = useState<TrendMetric>("sleepMinutes");
  const [relation, setRelation] = useState<Relation>("sleepiness");
  const filtered = useMemo(() => {
    const boundary = new Date();
    boundary.setHours(12, 0, 0, 0);
    boundary.setDate(boundary.getDate() - (Number(period) - 1));
    const key = `${boundary.getFullYear()}-${String(boundary.getMonth() + 1).padStart(2, "0")}-${String(boundary.getDate()).padStart(2, "0")}`;
    return records.filter((record) => record.date >= key).slice().sort((a, b) => a.date.localeCompare(b.date));
  }, [records, period]);
  const stats = getSleepStats(filtered);
  const pair = useMemo(() => {
    const yMetric: TrendMetric = relation === "clarity" ? "clarity" : "sleepiness";
    const xMetric: TrendMetric = relation === "bedtime" ? "bedTime" : "sleepMinutes";
    const value = correlation(filtered.map((record) => ({ x: getMetricValue(record, xMetric), y: getMetricValue(record, yMetric) })));
    return { xMetric, yMetric, value };
  }, [filtered, relation]);

  if (!isReady) return <ScreenContainer />;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="分析" subtitle="記録から生活リズムの傾向を見つけよう" />
        <SegmentedControl value={period} onChange={setPeriod} options={[{ value: "7", label: "7日" }, { value: "14", label: "14日" }, { value: "30", label: "30日" }]} />

        {filtered.length < 3 ? (
          <EmptyState title="記録が増えると分析できます" description="同じ項目を3日以上記録すると、平均とグラフが表示されます。" />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}><MetricCard label="平均睡眠" value={formatDuration(stats.averageSleepMinutes, true)} icon="bedtime" accent="#5B63D9" /></View>
              <View style={styles.statBox}><MetricCard label="平均眠気" value={`${stats.averageSleepiness.toFixed(1)} / 10`} icon="nightlight-round" accent="#8B5CF6" /></View>
              <View style={styles.statBox}><MetricCard label="平均の冴え" value={`${stats.averageClarity.toFixed(1)} / 10`} icon="psychology" accent="#189B87" /></View>
              <View style={styles.statBox}><MetricCard label="昼寝した日" value={`${stats.napDays} 日`} icon="hotel" accent="#D97A35" /></View>
            </View>

            <SectionLabel title="時系列の変化" action={<SmallStatus label={`${filtered.length} 件`} tone="muted" />} />
            <Card style={styles.chartCard}>
              <View style={styles.metricPicker}>
                <SegmentedControl value={metric} onChange={setMetric} options={[{ value: "sleepMinutes", label: "睡眠" }, { value: "sleepiness", label: "眠気" }, { value: "clarity", label: "冴え" }]} />
              </View>
              <LineChart records={filtered} metric={metric} />
              <View style={[styles.chartFoot, { backgroundColor: colors.background }]}>
                <Text style={[styles.chartFootText, { color: colors.muted }]}>横軸：日付　／　縦軸：{metric === "sleepMinutes" ? "睡眠時間" : metric === "sleepiness" ? "眠気（0〜10）" : "頭の冴え（0〜10）"}</Text>
              </View>
            </Card>

            <SectionLabel title="睡眠との関係" />
            <Card style={styles.chartCard}>
              <View style={styles.metricPicker}>
                <SegmentedControl value={relation} onChange={setRelation} options={[{ value: "sleepiness", label: "眠気" }, { value: "clarity", label: "冴え" }, { value: "bedtime", label: "就寝×眠気" }]} />
              </View>
              <ScatterPlot records={filtered} xMetric={pair.xMetric} yMetric={pair.yMetric} />
              <View style={styles.relationshipCopy}>
                <Text style={[styles.relationshipTitle, { color: colors.foreground }]}>
                  {pair.value === null ? "もう少し記録が必要です" : `相関の目安：${pair.value >= 0 ? "+" : "−"}${Math.abs(pair.value).toFixed(2)}（${describeStrength(pair.value)}）`}
                </Text>
                <Text style={[styles.relationshipText, { color: colors.muted }]}>
                  {pair.value === null
                    ? "3日以上の記録で傾向を確認できます。"
                    : `${describeDirection(pair.xMetric, pair.yMetric, pair.value)}点のばらつきから生活の傾向を眺めるための表示です。医学的な原因や診断を示すものではありません。`}
                </Text>
              </View>
            </Card>

            <SectionLabel title="ほかの項目" />
            <View style={styles.miniCharts}>
              <Card style={styles.miniChartCard}>
                <Text style={[styles.miniTitle, { color: colors.foreground }]}>就寝時刻</Text>
                <LineChart records={filtered} metric="bedTime" />
              </Card>
              <Card style={styles.miniChartCard}>
                <Text style={[styles.miniTitle, { color: colors.foreground }]}>昼寝時間</Text>
                <LineChart records={filtered} metric="napMinutes" />
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function describeStrength(value: number) {
  const strength = Math.abs(value);
  if (strength >= 0.7) return "はっきりした傾向";
  if (strength >= 0.4) return "ゆるやかな傾向";
  return "ほとんど関係なし";
}

/**
 * Turns the sign of the correlation into plain Japanese. The direction is the
 * useful part — "長く寝た日ほど眠気が軽い" and its opposite are very different
 * findings that an absolute value would hide.
 */
function describeDirection(xMetric: TrendMetric, yMetric: TrendMetric, value: number) {
  if (Math.abs(value) < 0.4) return "";
  const x = xMetric === "bedTime" ? "就寝が遅い日ほど" : "睡眠が長い日ほど";
  const y = yMetric === "clarity" ? "頭の冴え" : "眠気";
  return `${x}${y}は${value >= 0 ? "高め" : "低め"}、という傾向が出ています。`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 11 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox: { width: "48.5%" },
  chartCard: { gap: 14, paddingHorizontal: 14, paddingVertical: 16 },
  metricPicker: { marginHorizontal: 2 },
  chartFoot: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  chartFootText: { fontSize: 11, lineHeight: 16, textAlign: "center" },
  relationshipCopy: { gap: 4, paddingHorizontal: 5 },
  relationshipTitle: { fontSize: 14, lineHeight: 20, fontWeight: "800" },
  relationshipText: { fontSize: 12, lineHeight: 18 },
  miniCharts: { gap: 10 },
  miniChartCard: { paddingHorizontal: 14, paddingVertical: 15, gap: 8 },
  miniTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
});
