import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, IconButton, PageHeader } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useHeadacheEvents } from "@/lib/headache-store";
import { formatAcquiredAt, formatMonthDay, getHeadacheFeatureLabel } from "@/lib/sleep-utils";

export default function HeadacheScreen() {
  const colors = useColors();
  const { events, isReady } = useHeadacheEvents();
  const addEvent = () => router.push("/headache-event");
  if (!isReady) return <ScreenContainer />;

  return (
    <ScreenContainer>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, events.length === 0 && styles.emptyList]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<>
          <PageHeader title="頭痛イベント" subtitle={`${events.length} 件・睡眠記録とは別に保存`} action={<IconButton icon="add" label="頭痛イベントを追加" tone="primary" onPress={addEvent} />} />
          <Card style={styles.notice}><MaterialIcons name="info-outline" size={19} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.muted }]}>ここでは発生時刻のある頭痛だけを表示します。既存の日次頭痛記録は変換・集計していません。</Text></Card>
        </>}
        ListEmptyComponent={<EmptyState title="頭痛イベントはありません" description="頭痛が起きた時刻や強さを、天候が取得できない時でも記録できます。" icon="healing" />}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${formatMonthDay(item.date)}の頭痛イベントを編集`} onPress={() => router.push({ pathname: "/headache-event", params: { id: item.id } })} style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
            <View style={[styles.severity, { backgroundColor: `${colors.error}12` }]}><Text style={[styles.severityValue, { color: colors.error }]}>{item.severity ?? "—"}</Text><Text style={[styles.severityLabel, { color: colors.muted }]}>/ 10</Text></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{formatMonthDay(item.date)}　{formatAcquiredAt(item.startedAt).split(" ")[1]}</Text>
              <Text style={[styles.rowMeta, { color: colors.muted }]}>{item.symptoms.length ? item.symptoms.map(getHeadacheFeatureLabel).join("、") : "症状・部位は未入力"}</Text>
              <Text style={[styles.rowWeather, { color: colors.muted }]}>{item.weatherSnapshot ? `${item.weatherSnapshot.condition}・${item.weatherSnapshot.pressureHpa} hPa・${item.weatherSnapshot.temperatureC} ℃` : "天候データなし"}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={21} color={colors.muted} />
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 9 },
  emptyList: { flexGrow: 1 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 3 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  row: { minHeight: 94, borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  severity: { width: 54, height: 61, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  severityValue: { fontSize: 24, lineHeight: 28, fontWeight: "900" },
  severityLabel: { fontSize: 9, lineHeight: 12, fontWeight: "700" },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  rowMeta: { fontSize: 12, lineHeight: 17 },
  rowWeather: { fontSize: 11, lineHeight: 16 },
});
