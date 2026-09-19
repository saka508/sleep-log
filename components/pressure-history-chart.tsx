import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { PressureHistoryBatch } from "@/lib/pressure-history";

export function PressureHistoryChart({ batch }: { batch: PressureHistoryBatch }) {
  const colors = useColors();
  const points = [...batch.points].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (points.length < 2) return null;
  const width = 336;
  const height = 190;
  const left = 14;
  const right = 12;
  const top = 15;
  const bottom = 32;
  const rawMin = Math.min(...points.map((point) => point.pressureHpa));
  const rawMax = Math.max(...points.map((point) => point.pressureHpa));
  const padding = rawMin === rawMax ? 1 : Math.max(0.6, (rawMax - rawMin) * 0.16);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const toX = (index: number) => left + (index / Math.max(1, points.length - 1)) * (width - left - right);
  const toY = (value: number) => top + (1 - (value - min) / Math.max(0.1, max - min)) * (height - top - bottom);
  const line = points.map((point, index) => `${toX(index)},${toY(point.pressureHpa)}`).join(" ");
  const tickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <View style={{ width: "100%", overflow: "hidden" }} accessibilityLabel="最後に取得した気圧履歴のグラフ">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          return <Line key={ratio} x1={left} y1={y} x2={width - right} y2={y} stroke={colors.border} strokeDasharray="3 5" />;
        })}
        <Polyline points={line} fill="none" stroke={colors.sleepBlue} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => <Circle key={point.observedAt} cx={toX(index)} cy={toY(point.pressureHpa)} r={index === points.length - 1 ? 4 : 1.8} fill={index === points.length - 1 ? colors.sleepBlue : `${colors.sleepBlue}90`} />)}
        {[0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          const value = max - ratio * (max - min);
          return <SvgText key={`label-${ratio}`} x={width - right} y={y - 5} fill={colors.muted} fontSize="9" textAnchor="end">{value.toFixed(1)} hPa</SvgText>;
        })}
        {tickIndexes.map((index) => {
          const date = new Date(points[index].observedAt);
          const label = Number.isFinite(date.getTime()) ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:00` : "—";
          return <SvgText key={`time-${index}`} x={toX(index)} y={height - 9} fill={colors.muted} fontSize="9" textAnchor="middle">{label}</SvgText>;
        })}
      </Svg>
    </View>
  );
}
