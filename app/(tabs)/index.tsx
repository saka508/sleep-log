import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, MetricCard, PageHeader, PrimaryButton, SectionLabel, SmallStatus } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSleepData } from "@/lib/sleep-store";
import { daysFromToday, formatDate, formatDuration, getSleepStats, todayKey } from "@/lib/sleep-utils";

export default function TodayScreen() {
  const colors = useColors();
  const { records, isReady } = useSleepData();
  const today = todayKey();
  const record = records.find((item) => item.date === today);
  // Today and the previous six days, on the device's local calendar. Using UTC
  // here would shift the window by a day for most of the day in JST.
  const windowStart = daysFromToday(-6);
  const recent = records.filter((item) => item.date >= windowStart && item.date <= today);
  const stats = getSleepStats(recent);
  const missing = record ? [] : ["睡眠時刻", "眠気", "頭の冴え"];
  const openRecord = () => router.push({ pathname: "/record", params: { date: today } });

  if (!isReady) {
    return <ScreenContainer />;
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          title="今日"
          subtitle={formatDate(today)}
          action={<SmallStatus label={record?.isSample ? "サンプル" : record ? "記録済み" : "未記録"} tone={record?.isSample ? "muted" : record ? "success" : "warning"} />}
        />

        <Card style={[styles.heroCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>昨夜の睡眠</Text>
              <Text style={styles.heroValue}>{record ? formatDuration(record.sleepMinutes, true) : "未入力"}</Text>
              <Text style={styles.heroCaption}>{record ? `${record.bedTime} 就寝  →  ${record.wakeTime} 起床` : "まずは昨夜の睡眠を記録しましょう"}</Text>
            </View>
            <View style={styles.heroIcon}>
              <MaterialIcons name="bedtime" size={28} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroBottom}>
            <Text style={styles.heroBottomText}>
              {record ? `寝つくまで ${record.latencyMinutes}分${record.napMinutes ? ` ・ 昼寝 ${record.napMinutes}分` : ""}` : "就寝・起床時刻から睡眠時間を自動計算できます"}
            </Text>
          </View>
        </Card>

        <View style={styles.metrics}>
          <MetricCard label="今日の眠気" value={record ? `${record.sleepiness} / 10` : "—"} caption={record ? (record.sleepiness <= 3 ? "軽めです" : record.sleepiness <= 6 ? "気をつけて" : "休憩をとろう") : "未入力"} icon="nightlight-round" accent="#8B5CF6" />
          <MetricCard label="頭の冴え" value={record ? `${record.clarity} / 10` : "—"} caption={record ? (record.clarity >= 7 ? "調子よさそう" : "ゆっくり始めよう") : "未入力"} icon="psychology" accent="#189B87" />
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
        </Card>

        <SectionLabel title="最近のようす" />
        <Card style={styles.insightCard}>
          <View style={[styles.insightIcon, { backgroundColor: `${colors.primary}14` }]}>
            <MaterialIcons name="insights" size={22} color={colors.primary} />
          </View>
          <View style={styles.missingCopy}>
            <Text style={[styles.missingTitle, { color: colors.foreground }]}>直近7日の平均睡眠（{recent.length} 件）</Text>
            <Text style={[styles.insightValue, { color: colors.primary }]}>{recent.length ? formatDuration(stats.averageSleepMinutes, true) : "記録が増えると表示されます"}</Text>
            <Text style={[styles.missingText, { color: colors.muted }]}>分析タブでは、眠気や頭の冴えとの関係をグラフで確認できます。</Text>
          </View>
        </Card>

        <View style={[styles.notice, { backgroundColor: `${colors.muted}12` }]}>
          <MaterialIcons name="info-outline" size={17} color={colors.muted} />
          <Text style={[styles.noticeText, { color: colors.muted }]}>Sleep Log は生活記録・傾向把握のためのアプリで、医学的な診断は行いません。</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 11 },
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
  insightCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  insightIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  insightValue: { fontSize: 20, lineHeight: 27, fontWeight: "900", marginTop: 2 },
  notice: { flexDirection: "row", gap: 8, padding: 13, borderRadius: 14, alignItems: "flex-start" },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
