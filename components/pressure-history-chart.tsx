import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { PressureHistoryBatch } from "@/lib/pressure-history";

export function PressureHistoryChart({ batches }: { batches: PressureHistoryBatch[] }) {
  const colors = useColors();
  const series = batches.map((batch) => [...batch.points].sort((a, b) => a.observedAt.localeCompare(b.observedAt))).filter((points) => points.length > 0);
  const points = series.flat();
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
  const start = Math.min(...points.map((point) => Date.parse(point.observedAt)));
  const end = Math.max(...points.map((point) => Date.parse(point.observedAt)));
  const toX = (point: typeof points[number]) => left + ((Date.parse(point.observedAt) - start) / Math.max(1, end - start)) * (width - left - right);
  const toY = (value: number) => top + (1 - (value - min) / Math.max(0.1, max - min)) * (height - top - bottom);
  const tickTimes = [start, start + (end - start) / 2, end];

  return (
    <View style={{ width: "100%", overflow: "hidden" }} accessibilityLabel="最後に取得した気圧履歴のグラフ">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          return <Line key={ratio} x1={left} y1={y} x2={width - right} y2={y} stroke={colors.border} strokeDasharray="3 5" />;
        })}
        {series.map((seriesPoints, seriesIndex) => <Polyline key={`series-${seriesIndex}`} points={seriesPoints.map((point) => `${toX(point)},${toY(point.pressureHpa)}`).join(" ")} fill="none" stroke={colors.sleepBlue} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
        {points.map((point, index) => {
          const isLatest = Date.parse(point.observedAt) === end;
          return <Circle key={`${point.observedAt}-${index}`} cx={toX(point)} cy={toY(point.pressureHpa)} r={isLatest ? 4 : 1.8} fill={isLatest ? colors.sleepBlue : `${colors.sleepBlue}90`} />;
        })}
        {[0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          const value = max - ratio * (max - min);
          return <SvgText key={`label-${ratio}`} x={width - right} y={y - 5} fill={colors.muted} fontSize="9" textAnchor="end">{value.toFixed(1)} hPa</SvgText>;
        })}
        {tickTimes.map((timestamp, index) => {
          const date = new Date(timestamp);
          const label = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:00`;
          return <SvgText key={`time-${index}`} x={left + (index / 2) * (width - left - right)} y={height - 9} fill={colors.muted} fontSize="9" textAnchor="middle">{label}</SvgText>;
        })}
      </Svg>
    </View>
  );
}
