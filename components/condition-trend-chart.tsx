import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import type { TrendPoint } from "@/lib/condition-analysis";

export function ConditionTrendChart({ points, formatValue }: { points: TrendPoint[]; formatValue: (value: number) => string }) {
  const colors = useColors();
  const chart = useMemo(() => {
    const valid = points.filter((point): point is TrendPoint & { value: number } => point.value !== null);
    if (!valid.length) return null;
    const width = 336;
    const height = 196;
    const left = 34;
    const right = 12;
    const top = 18;
    const bottom = 35;
    const rawMin = Math.min(...valid.map((point) => point.value));
    const rawMax = Math.max(...valid.map((point) => point.value));
    const padding = rawMin === rawMax ? Math.max(1, Math.abs(rawMin) * 0.08) : (rawMax - rawMin) * 0.18;
    const min = rawMin - padding;
    const max = rawMax + padding;
    const toX = (index: number) => left + (index / Math.max(1, points.length - 1)) * (width - left - right);
    const toY = (value: number) => top + (1 - (value - min) / Math.max(1, max - min)) * (height - top - bottom);
    const segments: string[] = [];
    let segment: string[] = [];
    points.forEach((point, index) => {
      if (point.value === null) {
        if (segment.length > 1) segments.push(segment.join(" "));
        segment = [];
        return;
      }
      segment.push(`${toX(index)},${toY(point.value)}`);
    });
    if (segment.length > 1) segments.push(segment.join(" "));
    return { width, height, left, right, top, bottom, min, max, toX, toY, segments };
  }, [points]);

  if (!chart) return <View style={[styles.empty, { backgroundColor: colors.background }]}><Text style={[styles.emptyText, { color: colors.muted }]}>この項目のデータなし</Text></View>;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = chart.top + ratio * (chart.height - chart.top - chart.bottom);
          const value = chart.max - ratio * (chart.max - chart.min);
          return <G key={ratio}>
            <Line x1={chart.left} y1={y} x2={chart.width - chart.right} y2={y} stroke={colors.border} strokeDasharray="3 5" />
            <SvgText x={chart.left - 5} y={y + 3} fill={colors.muted} fontSize="8" textAnchor="end">{formatValue(value)}</SvgText>
          </G>;
        })}
        {chart.segments.map((segment, index) => <Polyline key={`segment-${index}`} points={segment} fill="none" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
        {points.map((point, index) => point.value === null ? null : <Circle key={point.key} cx={chart.toX(index)} cy={chart.toY(point.value)} r="4" fill={colors.surface} stroke={colors.primary} strokeWidth="2.2" />)}
        {points.map((point, index) => (
          <SvgText key={`${point.key}-label`} x={chart.toX(index)} y={chart.height - 10} fill={colors.muted} fontSize="8" textAnchor="middle">
            {index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 4) === 0 ? point.label : ""}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden" },
  empty: { minHeight: 150, borderRadius: 12, alignItems: "center", justifyContent: "center", padding: 16 },
  emptyText: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
});
