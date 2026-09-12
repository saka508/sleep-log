import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, type ComponentProps } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Card, LineChart, MetricCard, PageHeader, PrimaryButton, SectionLabel, SmallStatus } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useHeadacheEvents } from "@/lib/headache-store";
import { useSleepData } from "@/lib/sleep-store";
import { average, daysFromToday, formatAcquiredAt, formatDate, formatDuration, getSleepStats, todayKey, type SleepRecord } from "@/lib/sleep-utils";

export default function TodayScreen() {
  const colors = useColors();
  const { records, isReady } = useSleepData();
  const { events, isReady: headacheReady } = useHeadacheEvents();
  const today = todayKey();
  const record = records.find((item) => item.date === today);
  // Today and the previous six days, on the device's local calendar. Using UTC
  // here would shift the window by a day for most of the day in JST.
  const windowStart = daysFromToday(-6);
  const personalRecords = useMemo(() => records.filter((item) => !item.isSample), [records]);
  const recent = useMemo(() => personalRecords.filter((item) => item.date >= windowStart && item.date <= today), [personalRecords, today, windowStart]);
  const latestWeatherRecord = useMemo(
    () => personalRecords.filter((item) => item.weather).sort((a, b) => b.weather!.fetchedAt.localeCompare(a.weather!.fetchedAt))[0],
    [personalRecords],
  );
  const recentHeadacheEvents = useMemo(() => events.filter((item) => item.date >= windowStart && item.date <= today), [events, today, windowStart]);
  const stats = getSleepStats(recent);
  const fatigue = recent.map((item) => item.fatigue).filter((value): value is number => value !== undefined);
  const muscleFatigue = recent.map((item) => item.muscleFatigue).filter((value): value is number => value !== undefined);
  const missing = record ? [] : ["睡眠時刻", "眠気", "頭の冴え"];
  const openRecord = () => router.push({ pathname: "/record", params: { date: today } });

  if (!isReady) {
    return <ScreenContainer />;
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          title="ダッシュボード"
          subtitle={formatDate(today)}
          action={<SmallStatus label={record ? "今日の記録あり" : "今日の記録なし"} tone={record ? "success" : "muted"} />}
        />

        <WeatherCard weatherRecord={latestWeatherRecord} onOpenRecord={openRecord} />

        <View style={styles.quickActions}>
          <View style={styles.quickAction}><PrimaryButton label={record ? "今日の記録を編集" : "睡眠を記録"} icon={record ? "edit" : "add"} onPress={openRecord} /></View>
          <View style={styles.quickAction}><PrimaryButton label="詳細分析" icon="insights" secondary onPress={() => router.push("/analysis")} /></View>
        </View>

        <SectionLabel title="最近7日の記録" action={<SmallStatus label={`${recent.length} / 7 日`} tone={recent.length ? "primary" : "muted"} />} />
        <Card style={styles.overviewCard}>
          <SummaryRing completed={recent.length} total={7} />
          <View style={styles.overviewCopy}>
            <Text style={[styles.overviewTitle, { color: colors.foreground }]}>入力状況</Text>
            <Text style={[styles.overviewText, { color: colors.muted }]}>{recent.length ? `睡眠記録 ${recent.length} 日分。未記録は ${Math.max(0, 7 - recent.length)} 日分です。` : "個人の記録が増えると、ここに最近の様子を表示します。"}</Text>
            <Text style={[styles.overviewCaption, { color: colors.muted }]}>サンプル記録は個人向けの集計に含めません。</Text>
          </View>
        </Card>

        <View style={styles.metrics}>
          <MetricCard label="平均睡眠" value={recent.length ? formatDuration(stats.averageSleepMinutes, true) : "—"} caption={recent.length ? `記録された ${recent.length} 日の平均` : "データ不足"} icon="bedtime" accent={colors.primary} />
          <MetricCard label="頭痛イベント" value={headacheReady ? `${recentHeadacheEvents.length} 件` : "—"} caption="直近7日・別記録" icon="healing" accent={colors.error} />
        </View>

        <SectionLabel title="今日の記録" />
        <Card>
          {missing.length ? (
            <View style={styles.missingWrap}>
              <View style={[styles.missingIcon, { backgroundColor: `${colors.warning}18` }]}>
                <MaterialIcons name="edit-note" size={22} color={colors.warning} />
              </View>
              <View style={styles.missingCopy}>
                <Text style={[styles.missingTitle, { color: colors.foreground }]}>まだ入力されていません</Text>
                <Text style={[styles.missingText, { color: colors.muted }]}>{missing.join("・")}を記録すると、分析で傾向を見られます。</Text>
              </View>
            </View>
          ) : (
            <View style={styles.completeWrap}>
              <MaterialIcons name="check-circle" size={22} color={colors.success} />
              <View style={styles.missingCopy}>
                <Text style={[styles.missingTitle, { color: colors.foreground }]}>今日の記録はそろっています</Text>
                <Text style={[styles.missingText, { color: colors.muted }]}>気分や予定が変わったら、いつでも編集できます。</Text>
              </View>
            </View>
          )}
          <View style={styles.buttonSpacer}>
            <PrimaryButton label={record ? "記録を編集" : "記録を追加"} icon={record ? "edit" : "add"} onPress={openRecord} />
          </View>
          <View style={styles.headacheButton}>
            <PrimaryButton label="頭痛イベントを記録" icon="healing" secondary onPress={() => router.push("/headache-event")} />
          </View>
        </Card>

        <SectionLabel title="睡眠時間の推移" action={<SmallStatus label={recent.length >= 2 ? "記録済み" : "データ不足"} tone={recent.length >= 2 ? "primary" : "muted"} />} />
        <Card style={styles.trendCard}>
          {recent.length >= 2 ? <LineChart records={recent} metric="sleepMinutes" /> : <DashboardEmpty icon="show-chart" text="2日以上の睡眠記録で、ここに推移を表示します。" />}
          {recent.length ? <Text style={[styles.trendCaption, { color: colors.muted }]}>横軸は実際に記録した日付です。未記録の日を0として表示しません。</Text> : null}
        </Card>

        <SectionLabel title="日中の記録" />
        <View style={styles.metrics}>
          <MetricCard label="眠気" value={recent.length ? `${average(recent.map((item) => item.sleepiness)).toFixed(1)} / 10` : "—"} caption={recent.length ? `${recent.length} 日の記録` : "データ不足"} icon="nightlight-round" accent={colors.warning} />
          <MetricCard label="頭の冴え" value={recent.length ? `${average(recent.map((item) => item.clarity)).toFixed(1)} / 10` : "—"} caption={recent.length ? `${recent.length} 日の記録` : "データ不足"} icon="psychology" accent={colors.success} />
        </View>
        <View style={styles.metrics}>
          <MetricCard label="疲労" value={fatigue.length ? `${average(fatigue).toFixed(1)} / 10` : "—"} caption={fatigue.length ? `${fatigue.length} 日の記録` : "未入力"} icon="battery-alert" accent={colors.warning} />
          <MetricCard label="筋肉疲労" value={muscleFatigue.length ? `${average(muscleFatigue).toFixed(1)} / 10` : "—"} caption={muscleFatigue.length ? `${muscleFatigue.length} 日の記録` : "未入力"} icon="fitness-center" accent={colors.error} />
        </View>

        <Card style={[styles.headacheCard, { borderColor: `${colors.error}38`, backgroundColor: `${colors.error}0D` }]}>
          <View style={[styles.headacheIcon, { backgroundColor: `${colors.error}18` }]}><MaterialIcons name="healing" size={23} color={colors.error} /></View>
          <View style={styles.headacheCopy}>
            <Text style={[styles.headacheTitle, { color: colors.foreground }]}>頭痛が起きたときは、その場で記録</Text>
            <Text style={[styles.headacheText, { color: colors.muted }]}>時刻・強さ・症状を、天候が取得できないときでも残せます。</Text>
          </View>
          <PrimaryButton label="記録" icon="add" secondary onPress={() => router.push("/headache-event")} />
        </Card>

        <View style={[styles.notice, { backgroundColor: `${colors.muted}12` }]}>
          <MaterialIcons name="info-outline" size={17} color={colors.muted} />
          <Text style={[styles.noticeText, { color: colors.muted }]}>Sleep Log は生活記録・傾向把握のためのアプリで、医学的な診断は行いません。</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function WeatherCard({ weatherRecord, onOpenRecord }: { weatherRecord: SleepRecord | undefined; onOpenRecord: () => void }) {
  const colors = useColors();
  const weather = weatherRecord?.weather;
  return (
    <Card style={[styles.weatherCard, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}2B` }]}>
      <View style={[styles.weatherIcon, { backgroundColor: `${colors.primary}18` }]}><MaterialIcons name="wb-sunny" size={25} color={colors.primary} /></View>
      <View style={styles.weatherCopy}>
        <View style={styles.weatherHeading}><Text style={[styles.weatherTitle, { color: colors.foreground }]}>天候・気圧</Text><SmallStatus label={weather ? "保存済み" : "未取得"} tone={weather ? "primary" : "muted"} /></View>
        {weather ? <>
          <Text style={[styles.weatherValue, { color: colors.primary }]}>{weather.condition}　{weather.temperatureC}℃　{weather.pressureHpa} hPa</Text>
          <Text style={[styles.weatherMeta, { color: colors.muted }]}>最終取得: {formatAcquiredAt(weather.fetchedAt)}（{weatherRecord?.date} の記録）</Text>
        </> : <>
          <Text style={[styles.weatherValue, { color: colors.foreground }]}>天候データはまだありません</Text>
          <Text style={[styles.weatherMeta, { color: colors.muted }]}>記録画面で現在地から取得すると、最終取得時刻とともに表示します。</Text>
        </>}
        <Text accessibilityRole="button" onPress={onOpenRecord} style={[styles.weatherLink, { color: colors.primary }]}>{weather ? "記録画面で天候を更新" : "記録画面で天候を取得"}</Text>
      </View>
    </Card>
  );
}

function SummaryRing({ completed, total }: { completed: number; total: number }) {
  const colors = useColors();
  const size = 78;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, completed / total));
  return <View accessibilityLabel={`最近7日の睡眠記録は ${completed} 日です`} style={styles.ring}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`${colors.primary}16`} strokeWidth={stroke} />
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress)} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
    </Svg>
    <View style={styles.ringText}><Text style={[styles.ringNumber, { color: colors.foreground }]}>{completed}</Text><Text style={[styles.ringLabel, { color: colors.muted }]}>/ {total}日</Text></View>
  </View>;
}

function DashboardEmpty({ icon, text }: { icon: ComponentProps<typeof MaterialIcons>["name"]; text: string }) {
  const colors = useColors();
  return <View style={styles.emptyTrend}><MaterialIcons name={icon} size={25} color={colors.muted} /><Text style={[styles.emptyTrendText, { color: colors.muted }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 11 },
  weatherCard: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 14 },
  weatherIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  weatherCopy: { flex: 1, minWidth: 0, gap: 3 },
  weatherHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  weatherTitle: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  weatherValue: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  weatherMeta: { fontSize: 11, lineHeight: 16 },
  weatherLink: { alignSelf: "flex-start", fontSize: 12, lineHeight: 18, fontWeight: "800", paddingVertical: 3 },
  quickActions: { flexDirection: "row", gap: 9 },
  quickAction: { flex: 1, minWidth: 0 },
  overviewCard: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  ring: { width: 78, height: 78, alignItems: "center", justifyContent: "center" },
  ringText: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringNumber: { fontSize: 20, lineHeight: 23, fontWeight: "900" },
  ringLabel: { fontSize: 10, lineHeight: 13, fontWeight: "800" },
  overviewCopy: { flex: 1, gap: 3 },
  overviewTitle: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  overviewText: { fontSize: 13, lineHeight: 19 },
  overviewCaption: { fontSize: 11, lineHeight: 16 },
  heroCard: { padding: 16, gap: 12, shadowColor: "#5B63D9", shadowOpacity: 0.16, shadowRadius: 18, elevation: 4 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroEyebrow: { color: "#EDEEFF", fontSize: 14, lineHeight: 20, fontWeight: "800" },
  heroValue: { color: "#FFFFFF", fontSize: 32, lineHeight: 39, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  heroCaption: { color: "#EDEEFF", fontSize: 13, lineHeight: 19, marginTop: 3 },
  heroIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF24" },
  heroDivider: { height: 1, backgroundColor: "#FFFFFF2C" },
  heroBottom: { flexDirection: "row" },
  heroBottomText: { color: "#F4F4FF", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  metrics: { flexDirection: "row", gap: 9 },
  missingWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  completeWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  missingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  missingCopy: { flex: 1, gap: 3 },
  missingTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  missingText: { fontSize: 13, lineHeight: 19 },
  buttonSpacer: { marginTop: 12 },
  headacheButton: { marginTop: 9 },
  insightCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  insightIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  insightValue: { fontSize: 20, lineHeight: 27, fontWeight: "900", marginTop: 2 },
  trendCard: { paddingVertical: 14, gap: 7 },
  trendCaption: { fontSize: 11, lineHeight: 16 },
  emptyTrend: { minHeight: 132, alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  emptyTrendText: { fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 250 },
  headacheCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  headacheIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headacheCopy: { flex: 1, minWidth: 0, gap: 2 },
  headacheTitle: { fontSize: 14, lineHeight: 20, fontWeight: "900" },
  headacheText: { fontSize: 11, lineHeight: 16 },
  notice: { flexDirection: "row", gap: 8, padding: 13, borderRadius: 14, alignItems: "flex-start" },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
