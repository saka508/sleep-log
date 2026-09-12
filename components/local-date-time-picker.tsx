import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { dateKeyFromPicker, localDateForPicker, localTimeForPicker, timeFromPicker } from "@/lib/picker-utils";
import { formatDate, isDateKey, isTime } from "@/lib/sleep-utils";

type PickerButtonProps = {
  label: string;
  value: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function PickerButton({ label, value, accessibilityLabel, onPress }: PickerButtonProps) {
  const colors = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.button, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
    <View style={styles.buttonCopy}><Text style={[styles.label, { color: colors.muted }]}>{label}</Text><Text style={[styles.value, { color: colors.foreground }]}>{value}</Text></View>
    <MaterialIcons name="arrow-drop-down" size={25} color={colors.primary} />
  </Pressable>;
}

export function LocalDatePicker({ value, onChange, accessibilityLabel }: { value: string; onChange: (value: string) => void; accessibilityLabel: string }) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const selected = localDateForPicker(value);
  return <View style={styles.container}>
    <PickerButton label="日付" value={isDateKey(value) ? formatDate(value) : "日付を選択"} accessibilityLabel={accessibilityLabel} onPress={() => setVisible(true)} />
    {visible ? <DateTimePicker
      value={selected}
      mode="date"
      presentation="dialog"
      accentColor={colors.primary}
      onDismiss={() => setVisible(false)}
      onValueChange={(_, date) => { setVisible(false); onChange(dateKeyFromPicker(date)); }}
    /> : null}
  </View>;
}

export function LocalTimePicker({ label, value, onChange, accessibilityLabel }: { label: string; value: string; onChange: (value: string) => void; accessibilityLabel: string }) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  return <View style={styles.container}>
    <PickerButton label={label} value={isTime(value) ? value : "時刻を選択"} accessibilityLabel={accessibilityLabel} onPress={() => setVisible(true)} />
    {visible ? <DateTimePicker
      value={localTimeForPicker(value)}
      mode="time"
      presentation="dialog"
      is24Hour
      accentColor={colors.primary}
      onDismiss={() => setVisible(false)}
      onValueChange={(_, date) => { setVisible(false); onChange(timeFromPicker(date)); }}
    /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0 },
  button: { minHeight: 58, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  buttonCopy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  value: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  pressed: { opacity: 0.75 },
});
