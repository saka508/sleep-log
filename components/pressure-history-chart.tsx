import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { PressureHistoryBatch } from "@/lib/pressure-history";

export type PressureHistoryChartVariant = "detail" | "mini" | "sparkline";

export function PressureHistoryChart({ batches, variant = "detail" }: { batches: PressureHistoryBatch[]; variant?: PressureHistoryChartVariant }) {
  const colors = useColors();
  const series = batches.map((batch) => [...batch.points].sort((a, b) => a.observedAt.localeCompare(b.observedAt))).filter((points) => points.length > 0);
  const points = series.flat();
  if (!points.length) return null;
  const width = 336;
  const height = variant === "detail" ? 190 : variant === "mini" ? 112 : 46;
  const left = variant === "sparkline" ? 4 : variant === "mini" ? 10 : 14;
  const right = variant === "sparkline" ? 4 : variant === "mini" ? 8 : 12;
  const top = variant === "sparkline" ? 5 : variant === "mini" ? 9 : 15;
  const bottom = variant === "sparkline" ? 5 : variant === "mini" ? 20 : 32;
  const rawMin = Math.min(...points.map((point) => point.pressureHpa));
  const rawMax = Math.max(...points.map((point) => point.pressureHpa));
  const padding = rawMin === rawMax ? 1 : Math.max(0.6, (rawMax - rawMin) * 0.16);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const start = Math.min(...points.map((point) => Date.parse(point.observedAt)));
  const end = Math.max(...points.map((point) => Date.parse(point.observedAt)));
  const toX = (point: typeof points[number]) => end === start
    ? width / 2
    : left + ((Date.parse(point.observedAt) - start) / (end - start)) * (width - left - right);
  const toY = (value: number) => top + (1 - (value - min) / Math.max(0.1, max - min)) * (height - top - bottom);
  const tickTimes = variant === "detail" ? [start, start + (end - start) / 2, end] : [start, end];
  const markerPoints = variant === "sparkline" ? series.map((seriesPoints) => seriesPoints.at(-1)!).filter(Boolean) : points;

  return (
    <View style={{ width: "100%", overflow: "hidden" }} accessibilityLabel="保存された気圧履歴のグラフ">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {variant !== "sparkline" ? [0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          return <Line key={ratio} x1={left} y1={y} x2={width - right} y2={y} stroke={colors.border} strokeDasharray="3 5" />;
        }) : null}
        {series.filter((seriesPoints) => seriesPoints.length > 1).map((seriesPoints, seriesIndex) => <Polyline key={`series-${seriesIndex}`} points={seriesPoints.map((point) => `${toX(point)},${toY(point.pressureHpa)}`).join(" ")} fill="none" stroke={colors.sleepBlue} strokeWidth={variant === "sparkline" ? 2.4 : 3} strokeLinejoin="round" strokeLinecap="round" />)}
        {markerPoints.map((point, index) => {
          const isLatest = Date.parse(point.observedAt) === end;
          const radius = variant === "sparkline" ? (isLatest ? 2.5 : 1.2) : isLatest ? 4 : 1.8;
          return <Circle key={`${point.observedAt}-${index}`} cx={toX(point)} cy={toY(point.pressureHpa)} r={radius} fill={isLatest ? colors.sleepBlue : `${colors.sleepBlue}90`} />;
        })}
        {variant === "detail" ? [0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          const value = max - ratio * (max - min);
          return <SvgText key={`label-${ratio}`} x={width - right} y={y - 5} fill={colors.muted} fontSize="9" textAnchor="end">{value.toFixed(1)} hPa</SvgText>;
        }) : null}
        {variant !== "sparkline" ? tickTimes.map((timestamp, index) => {
          const date = new Date(timestamp);
          const label = variant === "detail" ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:00` : `${String(date.getHours()).padStart(2, "0")}時`;
          const denominator = Math.max(1, tickTimes.length - 1);
          return <SvgText key={`time-${index}`} x={left + (index / denominator) * (width - left - right)} y={height - 6} fill={colors.muted} fontSize="9" textAnchor={index === 0 ? "start" : index === tickTimes.length - 1 ? "end" : "middle"}>{label}</SvgText>;
        }) : null}
      </Svg>
    </View>
  );
}
