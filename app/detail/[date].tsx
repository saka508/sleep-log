import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, IconButton, PageHeader, PrimaryButton, SectionLabel, SmallStatus } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSleepData } from "@/lib/sleep-store";
import { formatAcquiredAt, formatDate, formatDuration, getHeadacheFeatureLabel } from "@/lib/sleep-utils";
import { OPEN_METEO_ATTRIBUTION_URL } from "@/lib/weather-service";

export default function RecordDetailScreen() {
  const colors = useColors();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { records, removeRecord, isReady } = useSleepData();
  const record = records.find((item) => item.date === date);

  const remove = () => {
    Alert.alert("この記録を削除しますか？", "削除した記録は元に戻せません。", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => { removeRecord(date); router.replace("/history"); } },
    ]);
  };

  if (!isReady) return <ScreenContainer />;
  if (!record) {
    return (
      <ScreenContainer>
        <View style={styles.emptyWrap}>
          <EmptyState title="記録が見つかりません" description="履歴から別の日を選ぶか、新しい記録を追加してください。" icon="search-off" />
          <PrimaryButton label="履歴へ戻る" secondary onPress={() => router.replace("/history")} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          title="記録の詳細"
          subtitle={formatDate(record.date)}
          action={<View style={styles.headerActions}><IconButton icon="edit" label="編集" onPress={() => router.push({ pathname: "/record", params: { date: record.date } })} /><IconButton icon="delete-outline" label="削除" tone="danger" onPress={remove} /></View>}
        />
        <Card style={[styles.hero, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>実睡眠時間</Text>
              <Text style={styles.heroValue}>{formatDuration(record.sleepMinutes, true)}</Text>
            </View>
            {record.isSample ? <SmallStatus label="サンプル" tone="muted" /> : <MaterialIcons name="bedtime" size={28} color="#FFFFFF" />}
          </View>
          <View style={styles.heroTimes}><Text style={styles.heroTime}>{record.bedTime}</Text><MaterialIcons name="arrow-forward" size={18} color="#EDEEFF" /><Text style={styles.heroTime}>{record.wakeTime}</Text></View>
        </Card>

        <SectionLabel title="睡眠の内訳" />
        <Card style={styles.listCard}>
          <DetailRow icon="timer" label="寝つくまで" value={`${record.latencyMinutes} 分`} />
          <DetailRow icon="hotel" label="昼寝" value={record.napMinutes > 0 ? `${record.napMinutes} 分` : "なし"} last />
        </Card>

        {record.weather ? <>
          <SectionLabel title="天候・気圧" />
          <Card style={styles.listCard}>
            <DetailRow icon="compress" label="気圧" value={`${record.weather.pressureHpa} hPa`} />
            <DetailRow icon="thermostat" label="気温" value={`${record.weather.temperatureC} ℃`} />
            <DetailRow icon="cloud" label="天気" value={record.weather.condition} />
            <DetailRow icon="schedule" label="取得日時" value={formatAcquiredAt(record.weather.fetchedAt)} last />
          </Card>
          <Text style={[styles.weatherCaution, { color: colors.muted }]}>気圧は体調との関係を振り返るための記録であり、頭痛などの診断・予測を行うものではありません。</Text>
          <Text accessibilityRole="link" onPress={() => { void Linking.openURL(OPEN_METEO_ATTRIBUTION_URL); }} style={[styles.attribution, { color: colors.primary }]}>Weather data by Open-Meteo.com</Text>
        </> : null}

        <SectionLabel title="日中のようす" />
        <View style={styles.scores}>
          <ScoreCard label="眠気" value={record.sleepiness} accent="#8B5CF6" low="眠くない" high="とても眠い" />
          <ScoreCard label="頭の冴え" value={record.clarity} accent="#189B87" low="ぼんやり" high="冴えている" />
        </View>
        {record.fatigue !== undefined || record.muscleFatigue !== undefined ? <View style={styles.scores}>
          {record.fatigue !== undefined ? <ScoreCard label="疲労" value={record.fatigue} accent="#D97706" low="疲労なし" high="とても疲れている" /> : <View style={styles.scoreCard} />}
          {record.muscleFatigue !== undefined ? <ScoreCard label="筋肉疲労" value={record.muscleFatigue} accent="#DC2626" low="なし" high="とても強い" /> : <View style={styles.scoreCard} />}
        </View> : null}
        <Card style={styles.listCard}>
          <DetailRow icon="local-cafe" label="カフェイン" value={record.caffeine ? "あり" : "なし"} valueColor={record.caffeine ? colors.warning : colors.success} />
          {record.caffeine && record.caffeineTime ? <DetailRow icon="schedule" label="摂取時刻" value={record.caffeineTime} /> : null}
          {record.caffeine && record.caffeineNote ? <DetailRow icon="notes" label="飲み物・量" value={record.caffeineNote} /> : null}
          <DetailRow icon="healing" label="頭痛" value={record.headache ? "あり" : "なし"} valueColor={record.headache ? colors.error : colors.success} last={!record.headache} />
          {record.headache ? <DetailRow icon="speed" label="頭痛の強さ" value={`${record.headacheIntensity ?? 0} / 10`} last={!record.headacheFeatures?.length} /> : null}
          {record.headache && record.headacheFeatures?.length ? <DetailRow icon="fact-check" label="頭痛の特徴" value={record.headacheFeatures.map(getHeadacheFeatureLabel).join("、")} last /> : null}
        </Card>
        {(record.fatigue !== undefined || record.muscleFatigue !== undefined) ? <Text style={[styles.subjectiveCaution, { color: colors.muted }]}>疲労・筋肉疲労は生活の振り返り用の記録であり、医学的な診断ではありません。</Text> : null}

        {record.note ? <><SectionLabel title="その日の体調メモ" /><Card><Text style={[styles.note, { color: colors.foreground }]}>{record.note}</Text></Card></> : null}
        <View style={[styles.disclaimer, { backgroundColor: `${colors.muted}12` }]}><MaterialIcons name="info-outline" size={17} color={colors.muted} /><Text style={[styles.disclaimerText, { color: colors.muted }]}>この記録は生活の振り返り用です。症状が気になる場合は、保護者や医療機関に相談してください。</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({ icon, label, value, valueColor, last = false }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; valueColor?: string; last?: boolean }) {
  const colors = useColors();
  return <View style={[styles.detailRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}><View style={[styles.detailIcon, { backgroundColor: `${colors.primary}12` }]}><MaterialIcons name={icon} size={19} color={colors.primary} /></View><Text style={[styles.detailLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.detailValue, { color: valueColor ?? colors.foreground }]}>{value}</Text></View>;
}

function ScoreCard({ label, value, accent, low, high }: { label: string; value: number; accent: string; low: string; high: string }) {
  const colors = useColors();
  return <Card style={styles.scoreCard}><Text style={[styles.scoreLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.scoreValue, { color: accent }]}>{value}<Text style={[styles.scoreSuffix, { color: colors.muted }]}> / 10</Text></Text><View style={[styles.scoreBar, { backgroundColor: `${accent}18` }]}><View style={[styles.scoreFill, { backgroundColor: accent, width: `${value * 10}%` }]} /></View><View style={styles.scoreRange}><Text style={[styles.scoreRangeText, { color: colors.muted }]}>{low}</Text><Text style={[styles.scoreRangeText, { color: colors.muted }]}>{high}</Text></View></Card>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, gap: 16 },
  emptyWrap: { padding: 18, gap: 14 },
  headerActions: { flexDirection: "row", gap: 8 },
  hero: { padding: 21, gap: 18 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLabel: { color: "#EDEEFF", fontSize: 14, lineHeight: 20, fontWeight: "800" },
  heroValue: { color: "#FFFFFF", fontSize: 34, lineHeight: 42, fontWeight: "900", letterSpacing: -0.8, marginTop: 4 },
  heroTimes: { flexDirection: "row", alignItems: "center", gap: 10, borderTopColor: "#FFFFFF33", borderTopWidth: 1, paddingTop: 14 },
  heroTime: { color: "#FFFFFF", fontSize: 19, lineHeight: 26, fontWeight: "800" },
  listCard: { paddingVertical: 3 },
  detailRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 },
  detailIcon: { width: 37, height: 37, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  detailLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  detailValue: { maxWidth: "52%", flexShrink: 1, textAlign: "right", fontSize: 15, lineHeight: 21, fontWeight: "900" },
  scores: { flexDirection: "row", gap: 12 },
  scoreCard: { flex: 1, gap: 6, padding: 15 },
  scoreLabel: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  scoreValue: { fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.5 },
  scoreSuffix: { fontSize: 12, fontWeight: "700" },
  scoreBar: { height: 7, borderRadius: 9, overflow: "hidden", marginTop: 2 },
  scoreFill: { height: "100%", borderRadius: 9 },
  scoreRange: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  scoreRangeText: { fontSize: 9, lineHeight: 13 },
  note: { fontSize: 15, lineHeight: 24 },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 13, borderRadius: 14 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  weatherCaution: { fontSize: 12, lineHeight: 18 },
  subjectiveCaution: { fontSize: 12, lineHeight: 18 },
  attribution: { minHeight: 32, paddingVertical: 6, alignSelf: "flex-start", fontSize: 12, lineHeight: 18, fontWeight: "800", textDecorationLine: "underline" },
});
