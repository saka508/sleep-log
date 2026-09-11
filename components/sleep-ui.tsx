import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ReactNode, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import {
  formatMetricValue,
  formatShortDate,
  getMetricLabel,
  getMetricValue,
  type SleepRecord,
  type TrendMetric,
} from "@/lib/sleep-utils";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.pageSubtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = "plain",
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: "plain" | "primary" | "danger";
}) {
  const colors = useColors();
  const color = tone === "danger" ? colors.error : tone === "primary" ? "#FFFFFF" : colors.primary;
  const background = tone === "primary" ? colors.primary : tone === "danger" ? `${colors.error}16` : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: background, borderColor: colors.border }, pressed && styles.pressed]}
    >
      <MaterialIcons name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: secondary ? colors.surface : colors.primary,
          borderColor: secondary ? colors.border : colors.primary,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <MaterialIcons name={icon} size={20} color={secondary ? colors.primary : "#FFFFFF"} /> : null}
      <Text style={[styles.primaryButtonText, { color: secondary ? colors.primary : "#FFFFFF" }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function MetricCard({ label, value, caption, icon, accent = "#5B63D9" }: { label: string; value: string; caption?: string; icon: IconName; accent?: string }) {
  const colors = useColors();
  return (
    <Card style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}1A` }]}>
        <MaterialIcons name={icon} size={20} color={accent} />
      </View>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      {caption ? <Text style={[styles.metricCaption, { color: colors.muted }]}>{caption}</Text> : null}
    </Card>
  );
}

export function SectionLabel({ title, action }: { title: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action}
    </View>
  );
}

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  const colors = useColors();
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      {hint ? <Text style={[styles.fieldHint, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function AppTextInput({ style, ...props }: TextInputProps) {
  const colors = useColors();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }, style]}
      {...props}
    />
  );
}

export function ScorePicker({
  value,
  onChange,
  accent = "#5B63D9",
  accessibilityLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  accent?: string;
  accessibilityLabel: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.scorePicker} accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: 11 }, (_, index) => (
        <Pressable
          key={index}
          accessibilityRole="button"
          accessibilityLabel={`${index}`}
          accessibilityState={{ selected: index === value }}
          onPress={() => onChange(index)}
          style={({ pressed }) => [
            styles.scoreDot,
            { backgroundColor: index === value ? accent : colors.background, borderColor: index === value ? accent : colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.scoreDotText, { color: index === value ? "#FFFFFF" : colors.muted }]}>{index}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ChoicePills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: IconName }[];
}) {
  const colors = useColors();
  return (
    <View style={styles.choicePills}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.choicePill,
              { backgroundColor: selected ? `${colors.primary}16` : colors.surface, borderColor: selected ? colors.primary : colors.border },
              pressed && styles.pressed,
            ]}
          >
            {option.icon ? <MaterialIcons name={option.icon} size={18} color={selected ? colors.primary : colors.muted} /> : null}
            <Text style={[styles.choicePillText, { color: selected ? colors.primary : colors.foreground }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MultiChoicePills<T extends string>({
  values,
  onChange,
  options,
  accessibilityLabel,
}: {
  values: T[];
  onChange: (values: T[]) => void;
  options: { value: T; label: string; icon?: IconName }[];
  accessibilityLabel: string;
}) {
  const colors = useColors();
  const selectedValues = new Set(values);
  return (
    <View style={styles.choicePills} accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = selectedValues.has(option.value);
        const toggle = () => onChange(selected ? values.filter((value) => value !== option.value) : [...values, option.value]);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={toggle}
            style={({ pressed }) => [
              styles.choicePill,
              { backgroundColor: selected ? `${colors.primary}16` : colors.surface, borderColor: selected ? colors.primary : colors.border },
              pressed && styles.pressed,
            ]}
          >
            {option.icon ? <MaterialIcons name={option.icon} size={18} color={selected ? colors.primary : colors.muted} /> : null}
            <Text style={[styles.choicePillText, { color: selected ? colors.primary : colors.foreground }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  icon,
  label,
  description,
  active,
  onPress,
  tone = "primary",
}: {
  icon: IconName;
  label: string;
  description?: string;
  active: boolean;
  onPress: () => void;
  tone?: "primary" | "danger";
}) {
  const colors = useColors();
  const accent = tone === "danger" ? colors.error : colors.primary;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.toggleRow, { borderColor: active ? accent : colors.border, backgroundColor: active ? `${accent}0F` : colors.surface }, pressed && styles.pressed]}
    >
      <View style={[styles.toggleRowIcon, { backgroundColor: active ? `${accent}18` : colors.background }]}>
        <MaterialIcons name={icon} size={21} color={active ? accent : colors.muted} />
      </View>
      <View style={styles.toggleRowCopy}>
        <Text style={[styles.toggleRowLabel, { color: colors.foreground }]}>{label}</Text>
        {description ? <Text style={[styles.toggleRowDescription, { color: colors.muted }]}>{description}</Text> : null}
      </View>
      <View style={[styles.switchTrack, { backgroundColor: active ? accent : colors.border }]}>
        <View style={[styles.switchThumb, active ? styles.switchThumbOn : styles.switchThumbOff]} />
      </View>
    </Pressable>
  );
}

export function EmptyState({ title, description, icon = "auto-graph" }: { title: string; description: string; icon?: IconName }) {
  const colors = useColors();
  return (
    <Card style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}16` }]}>
        <MaterialIcons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: colors.muted }]}>{description}</Text>
    </Card>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  const colors = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segment, selected && { backgroundColor: colors.surface }, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentText, { color: selected ? colors.primary : colors.muted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LineChart({ records, metric }: { records: SleepRecord[]; metric: TrendMetric }) {
  const colors = useColors();
  const points = useMemo(
    () => records.slice().sort((a, b) => a.date.localeCompare(b.date)).map((record) => ({ date: record.date, value: getMetricValue(record, metric) })),
    [records, metric],
  );
  if (points.length < 2) return null;
  const width = 336;
  const height = 192;
  const left = 13;
  const right = 13;
  const top = 16;
  const bottom = 34;
  const rawMin = Math.min(...points.map((point) => point.value));
  const rawMax = Math.max(...points.map((point) => point.value));
  const cushion = rawMax === rawMin ? Math.max(1, rawMax * 0.08) : (rawMax - rawMin) * 0.18;
  const min = Math.max(0, rawMin - cushion);
  const max = rawMax + cushion;
  const toX = (index: number) => left + (index / Math.max(1, points.length - 1)) * (width - left - right);
  const toY = (value: number) => top + (1 - (value - min) / Math.max(1, max - min)) * (height - top - bottom);
  const line = points.map((point, index) => `${toX(index)},${toY(point.value)}`).join(" ");
  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + ratio * (height - top - bottom);
          const value = max - ratio * (max - min);
          return (
            <G key={ratio}>
              <Line x1={left} y1={y} x2={width - right} y2={y} stroke={colors.border} strokeDasharray="3 5" />
              <SvgText x={width - right} y={y - 5} fill={colors.muted} fontSize="9" textAnchor="end">
                {formatMetricValue(metric, value)}
              </SvgText>
            </G>
          );
        })}
        <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <Circle key={point.date} cx={toX(index)} cy={toY(point.value)} r="4" fill={colors.surface} stroke={colors.primary} strokeWidth="2.4" />
        ))}
        {points.map((point, index) => (
          <SvgText key={`${point.date}-label`} x={toX(index)} y={height - 10} fill={colors.muted} fontSize="9" textAnchor="middle">
            {index === 0 || index === points.length - 1 || index % 3 === 0 ? formatShortDate(point.date) : ""}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export function ScatterPlot({
  records,
  xMetric,
  yMetric,
}: {
  records: SleepRecord[];
  xMetric: TrendMetric;
  yMetric: TrendMetric;
}) {
  const colors = useColors();
  const points = records.map((record) => ({ x: getMetricValue(record, xMetric), y: getMetricValue(record, yMetric) }));
  if (points.length < 2) return null;
  const width = 336;
  const height = 218;
  const left = 37;
  const right = 18;
  const top = 18;
  const bottom = 43;
  const xMinRaw = Math.min(...points.map((point) => point.x));
  const xMaxRaw = Math.max(...points.map((point) => point.x));
  const yMinRaw = Math.min(...points.map((point) => point.y));
  const yMaxRaw = Math.max(...points.map((point) => point.y));
  const xPad = xMaxRaw === xMinRaw ? 1 : (xMaxRaw - xMinRaw) * 0.16;
  const yPad = yMaxRaw === yMinRaw ? 1 : (yMaxRaw - yMinRaw) * 0.16;
  const xMin = Math.max(0, xMinRaw - xPad);
  const xMax = xMaxRaw + xPad;
  const yMin = Math.max(0, yMinRaw - yPad);
  const yMax = yMaxRaw + yPad;
  const toX = (value: number) => left + ((value - xMin) / Math.max(1, xMax - xMin)) * (width - left - right);
  const toY = (value: number) => top + (1 - (value - yMin) / Math.max(1, yMax - yMin)) * (height - top - bottom);
  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={left} y={top} width={width - left - right} height={height - top - bottom} fill="transparent" stroke={colors.border} rx="8" />
        {[0.25, 0.5, 0.75].map((ratio) => (
          <Line key={ratio} x1={left} y1={top + ratio * (height - top - bottom)} x2={width - right} y2={top + ratio * (height - top - bottom)} stroke={colors.border} strokeDasharray="3 5" />
        ))}
        {points.map((point, index) => <Circle key={index} cx={toX(point.x)} cy={toY(point.y)} r="5" fill={`${colors.primary}9C`} />)}
        <SvgText x={left} y={height - 16} fill={colors.muted} fontSize="9">{formatMetricValue(xMetric, xMin)}</SvgText>
        <SvgText x={width - right} y={height - 16} fill={colors.muted} fontSize="9" textAnchor="end">{formatMetricValue(xMetric, xMax)}</SvgText>
        <SvgText x={left - 7} y={top + 4} fill={colors.muted} fontSize="9" textAnchor="end">{formatMetricValue(yMetric, yMax)}</SvgText>
        <SvgText x={left - 7} y={height - bottom + 3} fill={colors.muted} fontSize="9" textAnchor="end">{formatMetricValue(yMetric, yMin)}</SvgText>
        <SvgText x={(left + width - right) / 2} y={height - 2} fill={colors.muted} fontSize="10" textAnchor="middle">{getMetricLabel(xMetric)}</SvgText>
        <SvgText transform={`translate(12 ${(top + height - bottom) / 2}) rotate(-90)`} fill={colors.muted} fontSize="10" textAnchor="middle">{getMetricLabel(yMetric)}</SvgText>
      </Svg>
    </View>
  );
}

export function SmallStatus({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "warning" | "muted" }) {
  const colors = useColors();
  const color = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "muted" ? colors.muted : colors.primary;
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}16` }]}>
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  headerCopy: { flex: 1, gap: 2 },
  pageTitle: { fontSize: 27, fontWeight: "800", letterSpacing: -0.6, lineHeight: 33 },
  pageSubtitle: { fontSize: 14, lineHeight: 21 },
  iconButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  primaryButton: { minHeight: 54, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryButtonText: { fontSize: 16, fontWeight: "800", lineHeight: 21 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  card: { borderRadius: 18, borderWidth: 1, padding: 15 },
  metricCard: { flex: 1, minWidth: 0, gap: 5 },
  metricIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  metricLabel: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  metricValue: { fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.5 },
  metricCaption: { fontSize: 11, lineHeight: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 7 },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: "800" },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  fieldLabel: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  fieldHint: { fontSize: 12, lineHeight: 17 },
  textInput: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, lineHeight: 22 },
  scorePicker: { flexDirection: "row", justifyContent: "space-between", gap: 3, width: "100%" },
  scoreDot: { flex: 1, minWidth: 22, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  scoreDotText: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
  choicePills: { flexDirection: "row", gap: 9, flexWrap: "wrap" },
  choicePill: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  choicePillText: { fontSize: 14, lineHeight: 20, fontWeight: "800" },
  toggleRow: { minHeight: 68, padding: 12, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  toggleRowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  toggleRowCopy: { flex: 1, gap: 2 },
  toggleRowLabel: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  toggleRowDescription: { fontSize: 12, lineHeight: 17 },
  switchTrack: { width: 43, height: 25, borderRadius: 16, padding: 3, justifyContent: "center" },
  switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: "#FFFFFF" },
  switchThumbOn: { alignSelf: "flex-end" },
  switchThumbOff: { alignSelf: "flex-start" },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyTitle: { fontSize: 17, lineHeight: 23, fontWeight: "800", textAlign: "center" },
  emptyDescription: { fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 280 },
  segmented: { borderWidth: 1, borderRadius: 14, padding: 3, minHeight: 43, flexDirection: "row" },
  segment: { flex: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  chartWrap: { width: "100%", overflow: "hidden" },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, alignSelf: "flex-start" },
  statusText: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
});
