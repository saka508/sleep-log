import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppTextInput, Card, ChoicePills, FieldLabel, MultiChoicePills, PageHeader, PrimaryButton, ScorePicker, SectionLabel } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSleepData } from "@/lib/sleep-store";
import { formatDate, HEADACHE_FEATURE_OPTIONS, isDateKey, isTime, sleepMinutesFromTimes, todayKey, type HeadacheFeature, type SleepRecord } from "@/lib/sleep-utils";

type BoolChoice = "yes" | "no";

export default function RecordScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ date?: string }>();
  const targetDate = typeof params.date === "string" && isDateKey(params.date) ? params.date : todayKey();
  const { records, saveRecord, isReady } = useSleepData();
  const existing = useMemo(() => records.find((record) => record.date === targetDate), [records, targetDate]);
  const [date, setDate] = useState(targetDate);
  const [bedTime, setBedTime] = useState("23:30");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepMinutes, setSleepMinutes] = useState("450");
  const [latencyMinutes, setLatencyMinutes] = useState("20");
  const [napMinutes, setNapMinutes] = useState("0");
  const [nap, setNap] = useState<BoolChoice>("no");
  const [sleepiness, setSleepiness] = useState(4);
  const [clarity, setClarity] = useState(7);
  const [caffeine, setCaffeine] = useState<BoolChoice>("no");
  const [caffeineTime, setCaffeineTime] = useState("");
  const [caffeineNote, setCaffeineNote] = useState("");
  const [headache, setHeadache] = useState<BoolChoice>("no");
  const [headacheIntensity, setHeadacheIntensity] = useState(0);
  const [headacheFeatures, setHeadacheFeatures] = useState<HeadacheFeature[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    const source = existing;
    if (!source) {
      // The route date selects a different form document, so all local fields
      // intentionally reset together when that route input changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(targetDate);
      setBedTime("23:30");
      setWakeTime("07:00");
      setSleepMinutes("450");
      setLatencyMinutes("20");
      setNapMinutes("0");
      setNap("no");
      setSleepiness(4);
      setClarity(7);
      setCaffeine("no");
      setCaffeineTime("");
      setCaffeineNote("");
      setHeadache("no");
      setHeadacheIntensity(0);
      setHeadacheFeatures([]);
      setNote("");
      return;
    }
    setDate(source.date);
    setBedTime(source.bedTime);
    setWakeTime(source.wakeTime);
    setSleepMinutes(String(source.sleepMinutes));
    setLatencyMinutes(String(source.latencyMinutes));
    setNapMinutes(String(source.napMinutes));
    setNap(source.napMinutes > 0 ? "yes" : "no");
    setSleepiness(source.sleepiness);
    setClarity(source.clarity);
    setCaffeine(source.caffeine ? "yes" : "no");
    setCaffeineTime(source.caffeineTime ?? "");
    setCaffeineNote(source.caffeineNote ?? "");
    setHeadache(source.headache ? "yes" : "no");
    setHeadacheIntensity(source.headacheIntensity ?? 0);
    setHeadacheFeatures(source.headacheFeatures ?? []);
    setNote(source.note);
  }, [existing, targetDate]);

  const calculatedMinutes = sleepMinutesFromTimes(bedTime, wakeTime);
  const recalculate = () => {
    if (calculatedMinutes !== null) setSleepMinutes(String(calculatedMinutes));
  };
  const updateBed = (value: string) => {
    setBedTime(value);
    const next = sleepMinutesFromTimes(value, wakeTime);
    if (next !== null) setSleepMinutes(String(next));
  };
  const updateWake = (value: string) => {
    setWakeTime(value);
    const next = sleepMinutesFromTimes(bedTime, value);
    if (next !== null) setSleepMinutes(String(next));
  };

  const save = () => {
    const minutes = Number(sleepMinutes);
    const latency = Number(latencyMinutes);
    const napDuration = nap === "yes" ? Number(napMinutes) : 0;
    if (!isDateKey(date)) {
      Alert.alert("日付を確認してください", "YYYY-MM-DD の形式で入力してください。");
      return;
    }
    if (!isTime(bedTime) || !isTime(wakeTime)) {
      Alert.alert("時刻を確認してください", "就寝・起床時刻は HH:MM の24時間表記で入力してください。");
      return;
    }
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(latency) || latency < 0 || !Number.isFinite(napDuration) || (nap === "yes" && napDuration <= 0)) {
      Alert.alert("数値を確認してください", "睡眠時間は1分以上、寝つきは0分以上、昼寝ありの場合は1分以上で入力してください。");
      return;
    }
    if (caffeine === "yes" && caffeineTime.trim() && !isTime(caffeineTime)) {
      Alert.alert("摂取時刻を確認してください", "HH:MM の24時間表記で入力するか、空欄にしてください。");
      return;
    }
    const now = new Date().toISOString();
    const clashing = date !== targetDate ? records.find((record) => record.date === date) : undefined;
    const next: SleepRecord = {
      id: date,
      date,
      bedTime,
      wakeTime,
      sleepMinutes: Math.round(minutes),
      latencyMinutes: Math.round(latency),
      napMinutes: Math.round(napDuration),
      sleepiness,
      clarity,
      caffeine: caffeine === "yes",
      caffeineTime: caffeine === "yes" ? caffeineTime.trim() : "",
      caffeineNote: caffeine === "yes" ? caffeineNote.trim() : "",
      headache: headache === "yes",
      headacheIntensity: headache === "yes" ? headacheIntensity : 0,
      headacheFeatures: headache === "yes" ? headacheFeatures : [],
      note: note.trim(),
      isSample: false,
      createdAt: clashing?.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };
    const commit = () => {
      saveRecord(next);
      Alert.alert("保存しました", "記録を端末内に保存しました。", [
        { text: "OK", onPress: () => router.replace({ pathname: "/detail/[date]", params: { date } }) },
      ]);
    };
    // Records are keyed by date, so saving onto a date that already has one
    // replaces it. Ask first instead of losing the existing entry silently.
    if (clashing) {
      Alert.alert("その日の記録を上書きしますか？", `${formatDate(date)} には既に記録があります。上書きすると元の内容は戻せません。`, [
        { text: "キャンセル", style: "cancel" },
        { text: "上書きする", style: "destructive", onPress: commit },
      ]);
      return;
    }
    commit();
  };

  if (!isReady) return <ScreenContainer />;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <PageHeader
            title={existing ? "記録を編集" : "1日の記録"}
            subtitle={formatDate(targetDate)}
            action={<PrimaryButton label="閉じる" secondary onPress={() => router.back()} />}
          />

          <Card style={styles.autoCard}>
            <View style={[styles.autoIcon, { backgroundColor: `${colors.primary}16` }]}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
            </View>
            <View style={styles.autoCopy}>
              <Text style={[styles.autoTitle, { color: colors.foreground }]}>睡眠時間を自動計算</Text>
              <Text style={[styles.autoText, { color: colors.muted }]}>就寝・起床時刻を入力すると計算されます。実際に眠った時間は下で修正できます。</Text>
            </View>
          </Card>

          <SectionLabel title="睡眠" />
          <Card style={styles.formCard}>
            <View style={styles.formGroup}>
              <FieldLabel label="日付" hint="睡眠をとった日" />
              <AppTextInput value={date} onChangeText={setDate} placeholder="2026-09-09" autoCapitalize="none" />
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.flexField}>
                <FieldLabel label="就寝時刻" />
                <AppTextInput value={bedTime} onChangeText={updateBed} placeholder="23:30" keyboardType="numbers-and-punctuation" />
              </View>
              <View style={styles.flexField}>
                <FieldLabel label="起床時刻" />
                <AppTextInput value={wakeTime} onChangeText={updateWake} placeholder="07:00" keyboardType="numbers-and-punctuation" />
              </View>
            </View>
            <View style={styles.formGroup}>
              <FieldLabel label="実睡眠時間" hint={calculatedMinutes !== null ? `時刻から ${Math.floor(calculatedMinutes / 60)}時間${calculatedMinutes % 60}分` : "手動で入力"} />
              <View style={styles.withUnit}>
                <AppTextInput style={styles.numberInput} value={sleepMinutes} onChangeText={setSleepMinutes} keyboardType="number-pad" />
                <Text style={[styles.unit, { color: colors.muted }]}>分</Text>
                <PrimaryButton label="再計算" secondary onPress={recalculate} />
              </View>
            </View>
            <View style={styles.formGroup}>
              <FieldLabel label="寝つくまで" />
              <View style={styles.withUnit}>
                <AppTextInput style={styles.numberInput} value={latencyMinutes} onChangeText={setLatencyMinutes} keyboardType="number-pad" />
                <Text style={[styles.unit, { color: colors.muted }]}>分</Text>
              </View>
            </View>
            <View style={styles.formGroup}>
              <FieldLabel label="昼寝" />
              <ChoicePills value={nap} onChange={setNap} options={[{ value: "no", label: "なし", icon: "block" }, { value: "yes", label: "あり", icon: "hotel" }]} />
            </View>
            {nap === "yes" ? (
              <View style={[styles.conditionalFields, { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}28` }]}>
                <FieldLabel label="昼寝時間" hint="合計時間" />
                <View style={styles.withUnit}>
                  <AppTextInput style={styles.numberInput} value={napMinutes} onChangeText={setNapMinutes} keyboardType="number-pad" />
                  <Text style={[styles.unit, { color: colors.muted }]}>分</Text>
                </View>
              </View>
            ) : null}
          </Card>

          <SectionLabel title="日中のようす" />
          <Card style={styles.formCard}>
            <View style={styles.formGroup}>
              <FieldLabel label="眠気" hint={`${sleepiness} / 10`} />
              <ScorePicker value={sleepiness} onChange={setSleepiness} accent="#8B5CF6" accessibilityLabel="眠気を選択" />
              <View style={styles.scoreLegend}><Text style={[styles.legendText, { color: colors.muted }]}>眠くない</Text><Text style={[styles.legendText, { color: colors.muted }]}>とても眠い</Text></View>
            </View>
            <View style={styles.formGroup}>
              <FieldLabel label="頭の冴え" hint={`${clarity} / 10`} />
              <ScorePicker value={clarity} onChange={setClarity} accent="#189B87" accessibilityLabel="頭の冴えを選択" />
              <View style={styles.scoreLegend}><Text style={[styles.legendText, { color: colors.muted }]}>ぼんやり</Text><Text style={[styles.legendText, { color: colors.muted }]}>よく冴えている</Text></View>
            </View>
            <View style={styles.formGroup}>
              <FieldLabel label="カフェイン" />
              <ChoicePills value={caffeine} onChange={setCaffeine} options={[{ value: "no", label: "なし", icon: "block" }, { value: "yes", label: "あり", icon: "local-cafe" }]} />
            </View>
            {caffeine === "yes" ? (
              <View style={[styles.conditionalFields, { backgroundColor: `${colors.warning}09`, borderColor: `${colors.warning}28` }]}>
                <View style={styles.formGroup}>
                  <FieldLabel label="摂取時刻" hint="任意" />
                  <AppTextInput accessibilityLabel="カフェインの摂取時刻" value={caffeineTime} onChangeText={setCaffeineTime} placeholder="例：14:30" keyboardType="numbers-and-punctuation" />
                </View>
                <View style={styles.formGroup}>
                  <FieldLabel label="飲み物・量" hint="任意" />
                  <AppTextInput accessibilityLabel="カフェインの飲み物または量" value={caffeineNote} onChangeText={setCaffeineNote} placeholder="例：コーヒー 1杯" />
                </View>
              </View>
            ) : null}
            <View style={styles.formGroup}>
              <FieldLabel label="頭痛" />
              <ChoicePills value={headache} onChange={setHeadache} options={[{ value: "no", label: "なし", icon: "sentiment-satisfied" }, { value: "yes", label: "あり", icon: "healing" }]} />
            </View>
            {headache === "yes" ? (
              <View style={[styles.conditionalFields, { backgroundColor: `${colors.error}08`, borderColor: `${colors.error}24` }]}>
                <View style={styles.formGroup}>
                  <FieldLabel label="頭痛の強さ" hint={`${headacheIntensity} / 10`} />
                  <ScorePicker value={headacheIntensity} onChange={setHeadacheIntensity} accent={colors.error} accessibilityLabel="頭痛の強さを選択" />
                </View>
                <View style={styles.formGroup}>
                  <FieldLabel label="頭痛の特徴" hint="複数選択可" />
                  <MultiChoicePills values={headacheFeatures} onChange={setHeadacheFeatures} options={[...HEADACHE_FEATURE_OPTIONS]} accessibilityLabel="頭痛の特徴" />
                </View>
              </View>
            ) : null}
          </Card>

          <SectionLabel title="その日の体調メモ" />
          <Card>
            <AppTextInput value={note} onChangeText={setNote} placeholder="例：部活のあとで少し昼寝。朝は目覚めがよかった。" multiline textAlignVertical="top" style={styles.noteInput} />
          </Card>

          <PrimaryButton label="この内容で保存" icon="check" onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 11 },
  autoCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 15 },
  autoIcon: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  autoCopy: { flex: 1, gap: 3 },
  autoTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  autoText: { fontSize: 12, lineHeight: 18 },
  formCard: { gap: 14 },
  formGroup: { gap: 0 },
  conditionalFields: { gap: 12, padding: 12, borderWidth: 1, borderRadius: 14 },
  twoColumns: { flexDirection: "row", gap: 12 },
  flexField: { flex: 1 },
  withUnit: { flexDirection: "row", alignItems: "center", gap: 7 },
  numberInput: { flex: 1 },
  unit: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  scoreLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  legendText: { fontSize: 11, lineHeight: 15 },
  noteInput: { height: 110, paddingTop: 12 },
});
