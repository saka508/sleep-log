import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { PressureHistoryChart } from "@/components/pressure-history-chart";
import { Card } from "@/components/sleep-ui";
import { useColors } from "@/hooks/use-colors";
import type { PressureHistoryDaySummary, PressureHistoryPeriod } from "@/lib/pressure-history";

export type PressureHistoryDayMarker = {
  id: string;
  label: string;
  tone?: "default" | "warning";
};

type Props = {
  days: PressureHistoryDaySummary[];
  period: PressureHistoryPeriod;
  markersByDate?: Record<string, PressureHistoryDayMarker[]>;
};

export function EnvironmentPressureHistory({ days, period, markersByDate = {} }: Props) {
  const colors = useColors();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (!days.length) {
    return <Card><Text style={[styles.note, { color: colors.muted }]}>表示できる日付を作成できませんでした。</Text></Card>;
  }

  if (period === "day") {
    return <PressureDayDetail day={days[0]} markers={markersByDate[days[0].date] ?? []} />;
  }

  if (period === "week") {
    return (
      <View style={styles.list}>
        <Text style={[styles.listGuide, { color: colors.muted }]}>新しい日から順に7日分を表示しています。日をタップすると、詳細を1件だけ展開します。</Text>
        {days.map((day) => {
          const expanded = expandedDate === day.date;
          return <PressureCompactDayCard key={day.date} day={day} expanded={expanded} onToggle={() => setExpandedDate(expanded ? null : day.date)} markers={markersByDate[day.date] ?? []} />;
        })}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={[styles.listGuide, { color: colors.muted }]}>直近30日を新しい順に表示しています。行をタップすると、その日の詳細を1件だけ展開します。</Text>
      {days.map((day) => {
        const expanded = expandedDate === day.date;
        return <PressureCompactDayCard key={day.date} day={day} expanded={expanded} onToggle={() => setExpandedDate(expanded ? null : day.date)} markers={markersByDate[day.date] ?? []} />;
      })}
    </View>
  );
}

function PressureDayDetail({ day, markers }: { day: PressureHistoryDaySummary; markers: PressureHistoryDayMarker[] }) {
  return (
    <Card style={styles.detailCard}>
      <DayHeader day={day} />
      {!day.pointCount ? <EmptyDay /> : <>
        <PressureHistoryChart batches={day.batches} variant="detail" />
        <PressureStats day={day} includeChanges />
        <DayMarkers markers={markers} />
        <DayEvidence day={day} />
      </>}
    </Card>
  );
}

function PressureCompactDayCard({ day, expanded, onToggle, markers }: { day: PressureHistoryDaySummary; expanded: boolean; onToggle: () => void; markers: PressureHistoryDayMarker[] }) {
  const colors = useColors();
  return (
    <Card style={[styles.compactDayCard, expanded && { borderColor: `${colors.sleepBlue}70` }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${formatDateLabel(day.date)}の気圧履歴を${expanded ? "閉じる" : "開く"}`} onPress={onToggle} style={({ pressed }) => [styles.compactPressable, pressed && styles.pressed]}>
        <View style={styles.compactTitleRow}>
          <View style={styles.compactTitleWrap}>
            <Text style={[styles.dayTitle, { color: colors.foreground }]}>{formatDateLabel(day.date)}</Text>
            <Text style={[styles.pointCount, { color: colors.muted }]}>{day.pointCount ? `${day.pointCount}点` : "記録なし"}</Text>
          </View>
          <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={24} color={expanded ? colors.sleepBlue : colors.muted} />
        </View>
        {day.pointCount ? <View style={styles.compactDataRow}>
          <View style={[styles.sparklineWrap, { backgroundColor: `${colors.sleepBlue}08` }]}><PressureHistoryChart batches={day.batches} variant="sparkline" /></View>
          <View style={styles.compactStats}>
            <CompactStat label="最高" value={formatHpa(day.highestHpa)} />
            <CompactStat label="最低" value={formatHpa(day.lowestHpa)} />
            <CompactStat label="変動" value={formatHpa(day.rangeHpa)} />
          </View>
        </View> : null}
      </Pressable>
      {expanded ? <PressureExpandedDetail day={day} markers={markers} /> : null}
    </Card>
  );
}

function PressureExpandedDetail({ day, markers }: { day: PressureHistoryDaySummary; markers: PressureHistoryDayMarker[] }) {
  const colors = useColors();
  return (
    <View style={[styles.expandedArea, { borderTopColor: colors.border }]}>
      {!day.pointCount ? <EmptyDay compact /> : <>
        <PressureHistoryChart batches={day.batches} variant="detail" />
        <PressureStats day={day} includeChanges />
        <View style={styles.markerSlot}><DayMarkers markers={markers} /></View>
        <DayEvidence day={day} compact />
      </>}
    </View>
  );
}

function DayHeader({ day }: { day: PressureHistoryDaySummary }) {
  const colors = useColors();
  return <View style={styles.dayHeader}><Text style={[styles.dayTitle, { color: colors.foreground }]}>{formatDateLabel(day.date)}</Text><Text style={[styles.pointCount, { color: colors.muted }]}>{day.pointCount ? `${day.pointCount}点` : "記録なし"}</Text></View>;
}

function PressureStats({ day, includeChanges = false }: { day: PressureHistoryDaySummary; includeChanges?: boolean }) {
  return <View style={styles.statsGrid}>
    <StatTile label="最高" value={formatHpa(day.highestHpa)} />
    <StatTile label="最低" value={formatHpa(day.lowestHpa)} />
    <StatTile label="変動幅" value={formatHpa(day.rangeHpa)} />
    <StatTile label="データ点" value={`${day.pointCount} 点`} />
    {includeChanges ? <><StatTile label="3時間変化" value={formatPressureChange(day.change3Hours)} /><StatTile label="24時間変化" value={formatPressureChange(day.change24Hours)} /></> : null}
  </View>;
}

function StatTile({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={[styles.statTile, { backgroundColor: `${colors.sleepBlue}10`, borderColor: `${colors.sleepBlue}28` }]}><Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: colors.foreground }]}>{value}</Text></View>;
}

function CompactStat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.compactStat}><Text style={[styles.compactLabel, { color: colors.muted }]}>{label}</Text><Text numberOfLines={1} style={[styles.compactValue, { color: colors.foreground }]}>{value}</Text></View>;
}

function DayEvidence({ day, compact = false }: { day: PressureHistoryDaySummary; compact?: boolean }) {
  const colors = useColors();
  const latest = day.latestObservedAt ? new Date(day.latestObservedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : null;
  return <View style={styles.evidence}>
    <Text style={[compact ? styles.compactNote : styles.note, { color: colors.muted }]}>保存済み {day.pointCount}点{latest ? `・最終観測 ${latest}` : ""}。過去の値は補完していません。</Text>
    {day.hasSeparatedBatches ? <Text style={[compact ? styles.compactNote : styles.note, { color: colors.warning }]}>地点を判別できない複数バッチを含むため、線を分けています。最高・最低・変動は最終観測を含むバッチの{day.summaryPointCount}点で計算しています。</Text> : null}
  </View>;
}

function DayMarkers({ markers }: { markers: PressureHistoryDayMarker[] }) {
  const colors = useColors();
  if (!markers.length) return null;
  return <View style={styles.markers}>{markers.map((marker) => <View key={marker.id} style={[styles.marker, { backgroundColor: marker.tone === "warning" ? `${colors.warning}18` : `${colors.primary}12` }]}><Text style={[styles.markerText, { color: marker.tone === "warning" ? colors.warning : colors.primary }]}>{marker.label}</Text></View>)}</View>;
}

function EmptyDay({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return <View style={[styles.empty, { backgroundColor: `${colors.muted}0C` }]}><MaterialIcons name="cloud-off" size={compact ? 18 : 22} color={colors.muted} /><Text style={[compact ? styles.compactNote : styles.note, { color: colors.muted }]}>この日の保存済み気圧記録はありません。</Text></View>;
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${month}月${day}日（${new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date)}）`;
}

function formatHpa(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} hPa`;
}

function formatPressureChange(change?: { changeHpa: number }) {
  if (!change) return "データ不足";
  const prefix = change.changeHpa > 0 ? "+" : "";
  const arrow = change.changeHpa > 0 ? "↑" : change.changeHpa < 0 ? "↓" : "→";
  return `${prefix}${change.changeHpa.toFixed(1)} ${arrow}`;
}

const styles = StyleSheet.create({
  list: { gap: 9 },
  listGuide: { fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
  detailCard: { gap: 12, paddingHorizontal: 13, paddingVertical: 14 },
  compactDayCard: { paddingHorizontal: 0, paddingVertical: 0, overflow: "hidden", borderWidth: 1 },
  compactPressable: { minHeight: 72, paddingHorizontal: 12, paddingVertical: 9, gap: 6 },
  pressed: { opacity: 0.72 },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  compactTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  compactTitleWrap: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: 8, minWidth: 0 },
  dayTitle: { fontSize: 17, lineHeight: 23, fontWeight: "900" },
  pointCount: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  chartSurface: { borderRadius: 11, overflow: "hidden" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  statTile: { width: "48%", minWidth: 0, borderRadius: 11, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7, gap: 1 },
  statLabel: { fontSize: 10, lineHeight: 14, fontWeight: "700" },
  statValue: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  compactDataRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  sparklineWrap: { width: "35%", minWidth: 88, height: 42, borderRadius: 8, overflow: "hidden", justifyContent: "center" },
  compactStats: { flex: 1, minWidth: 0, flexDirection: "row", gap: 6 },
  compactStat: { flex: 1, minWidth: 0, gap: 1 },
  compactLabel: { fontSize: 9, lineHeight: 12, fontWeight: "700" },
  compactValue: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
  expandedArea: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  markerSlot: { minHeight: 0 },
  evidence: { gap: 3 },
  note: { fontSize: 12, lineHeight: 18 },
  compactNote: { fontSize: 11, lineHeight: 16 },
  empty: { minHeight: 50, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  markers: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  marker: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  markerText: { fontSize: 10, lineHeight: 14, fontWeight: "800" },
});
