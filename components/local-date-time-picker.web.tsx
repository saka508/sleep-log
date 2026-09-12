import { Host, Picker } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { dateFromParts, daysInMonth, timeFromParts, timeParts } from "@/lib/picker-utils";
import { dateFromKey, isDateKey, todayKey } from "@/lib/sleep-utils";

function numberRange(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function DatePickerColumn({ label, value, values, onChange }: { label: string; value: number; values: number[]; onChange: (value: number) => void }) {
  const colors = useColors();
  return <View style={styles.column}>
    <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    <Picker selectedValue={value} onValueChange={onChange}>
      {values.map((item) => <Picker.Item key={item} value={item} label={label === "月" ? `${String(item).padStart(2, "0")}月` : label === "日" ? `${String(item).padStart(2, "0")}日` : `${item}年`} />)}
    </Picker>
  </View>;
}

function TimePickerColumn({ label, value, values, onChange }: { label: string; value: number; values: number[]; onChange: (value: number) => void }) {
  const colors = useColors();
  return <View style={styles.column}>
    <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    <Picker selectedValue={value} onValueChange={onChange}>
      {values.map((item) => <Picker.Item key={item} value={item} label={String(item).padStart(2, "0")} />)}
    </Picker>
  </View>;
}

export function LocalDatePicker({ value, onChange, accessibilityLabel: _accessibilityLabel }: { value: string; onChange: (value: string) => void; accessibilityLabel: string }) {
  const fallback = dateFromKey(todayKey());
  const selected = isDateKey(value) ? dateFromKey(value) : fallback;
  const year = selected.getFullYear();
  const month = selected.getMonth() + 1;
  const day = selected.getDate();
  const currentYear = new Date().getFullYear();
  const years = numberRange(Math.min(2000, year), Math.max(currentYear + 1, year));
  const update = (nextYear: number, nextMonth: number, nextDay: number) => {
    const next = dateFromParts(nextYear, nextMonth, Math.min(nextDay, daysInMonth(nextYear, nextMonth)));
    if (next) onChange(next);
  };
  return <View style={styles.wrapper}>
    <Host matchContents={{ vertical: true }} style={styles.host} accessibilityLabel={_accessibilityLabel}>
      <View style={styles.group}>
        <DatePickerColumn label="年" value={year} values={years} onChange={(next) => update(next, month, day)} />
        <DatePickerColumn label="月" value={month} values={numberRange(1, 12)} onChange={(next) => update(year, next, day)} />
        <DatePickerColumn label="日" value={day} values={numberRange(1, daysInMonth(year, month))} onChange={(next) => update(year, month, next)} />
      </View>
    </Host>
  </View>;
}

export function LocalTimePicker({ label, value, onChange, accessibilityLabel }: { label: string; value: string; onChange: (value: string) => void; accessibilityLabel: string }) {
  const parts = timeParts(value) ?? { hours: 0, minutes: 0 };
  const minuteValues = [...new Set([...numberRange(0, 55).filter((item) => item % 5 === 0), parts.minutes])].sort((a, b) => a - b);
  const update = (hours: number, minutes: number) => {
    const next = timeFromParts(hours, minutes);
    if (next) onChange(next);
  };
  return <View style={styles.wrapper}>
    <Host matchContents={{ vertical: true }} style={styles.host} accessibilityLabel={`${accessibilityLabel}（${label}）`}>
      <View style={styles.group}>
        <TimePickerColumn label="時" value={parts.hours} values={numberRange(0, 23)} onChange={(next) => update(next, parts.minutes)} />
        <TimePickerColumn label="分" value={parts.minutes} values={minuteValues} onChange={(next) => update(parts.hours, next)} />
      </View>
    </Host>
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, minWidth: 0 },
  host: { width: "100%" },
  group: { flexDirection: "row", gap: 7, width: "100%" },
  column: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
});
