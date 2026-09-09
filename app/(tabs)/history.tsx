import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, PageHeader, SmallStatus } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSleepData } from "@/lib/sleep-store";
import { formatDuration, formatMonthDay } from "@/lib/sleep-utils";

export default function HistoryScreen() {
  const colors = useColors();
  const { records, isReady } = useSleepData();

  if (!isReady) return <ScreenContainer />;

  return (
    <ScreenContainer>
      <FlatList
        data={records}
        keyExtractor={(item) => item.date}
        contentContainerStyle={[styles.content, records.length === 0 && styles.emptyList]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<PageHeader title="履歴" subtitle={`${records.length} 件の睡眠記録`} />}
        ListEmptyComponent={<EmptyState title="記録がまだありません" description="今日タブから睡眠と体調を記録すると、ここに日付順で表示されます。" icon="calendar-month" />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${formatMonthDay(item.date)} の詳細を開く`}
            onPress={() => router.push({ pathname: "/detail/[date]", params: { date: item.date } })}
            style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          >
            <View style={[styles.dateBadge, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[styles.dayNumber, { color: colors.primary }]}>{item.date.slice(8)}</Text>
              <Text style={[styles.dayMonth, { color: colors.primary }]}>{item.date.slice(5, 7)}月</Text>
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.rowHeading}>
                <Text style={[styles.rowDate, { color: colors.foreground }]}>{formatMonthDay(item.date)}</Text>
                {item.isSample ? <SmallStatus label="サンプル" tone="muted" /> : null}
              </View>
              <Text style={[styles.rowMeta, { color: colors.muted }]}>{item.bedTime} → {item.wakeTime}　寝つき {item.latencyMinutes}分</Text>
              <View style={styles.tags}>
                {item.napMinutes > 0 ? <Text style={[styles.tag, { color: colors.primary, backgroundColor: `${colors.primary}12` }]}>昼寝 {item.napMinutes}分</Text> : null}
                {item.caffeine ? <Text style={[styles.tag, { color: colors.warning, backgroundColor: `${colors.warning}14` }]}>カフェイン</Text> : null}
                {item.headache ? <Text style={[styles.tag, { color: colors.error, backgroundColor: `${colors.error}12` }]}>頭痛</Text> : null}
              </View>
            </View>
            <View style={styles.rowEnd}>
              <Text style={[styles.duration, { color: colors.foreground }]}>{formatDuration(item.sleepMinutes, true)}</Text>
              <MaterialIcons name="chevron-right" size={21} color={colors.muted} />
            </View>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 8 },
  emptyList: { flexGrow: 1 },
  row: { minHeight: 101, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  dateBadge: { width: 48, height: 62, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayNumber: { fontSize: 22, lineHeight: 25, fontWeight: "900" },
  dayMonth: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  rowDate: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  rowMeta: { fontSize: 12, lineHeight: 17 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tag: { overflow: "hidden", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  rowEnd: { alignItems: "flex-end", justifyContent: "center", gap: 4 },
  duration: { fontSize: 14, lineHeight: 19, fontWeight: "900", textAlign: "right" },
});
