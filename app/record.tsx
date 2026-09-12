import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppTextInput, Card, ChoicePills, FieldLabel, MultiChoicePills, PageHeader, PrimaryButton, ScorePicker, SectionLabel } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSleepData } from "@/lib/sleep-store";
import { formatAcquiredAt, formatDate, HEADACHE_FEATURE_OPTIONS, isDateKey, isTime, sleepMinutesFromTimes, todayKey, type HeadacheFeature, type SleepRecord, type WeatherSnapshot } from "@/lib/sleep-utils";
import { fetchWeatherForCurrentLocation, OPEN_METEO_ATTRIBUTION_URL, WeatherError } from "@/lib/weather-service";

type BoolChoice = "yes" | "no";
type OptionalScoreChoice = "none" | "record";

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
  const [fatigue, setFatigue] = useState<number | undefined>();
  const [clarity, setClarity] = useState(7);
  const [muscleFatigue, setMuscleFatigue] = useState<number | undefined>();
  const [caffeine, setCaffeine] = useState<BoolChoice>("no");
  const [caffeineTime, setCaffeineTime] = useState("");
  const [caffeineNote, setCaffeineNote] = useState("");
  const [headache, setHeadache] = useState<BoolChoice>("no");
  const [headacheIntensity, setHeadacheIntensity] = useState(0);
  const [headacheFeatures, setHeadacheFeatures] = useState<HeadacheFeature[]>([]);
  const [weather, setWeather] = useState<WeatherSnapshot | undefined>();
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherMessage, setWeatherMessage] = useState("");
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
      setFatigue(undefined);
      setClarity(7);
      setMuscleFatigue(undefined);
      setCaffeine("no");
      setCaffeineTime("");
      setCaffeineNote("");
      setHeadache("no");
      setHeadacheIntensity(0);
      setHeadacheFeatures([]);
      setWeather(undefined);
      setWeatherMessage("");
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
    setFatigue(source.fatigue);
    setClarity(source.clarity);
    setMuscleFatigue(source.muscleFatigue);
    setCaffeine(source.caffeine ? "yes" : "no");
    setCaffeineTime(source.caffeineTime ?? "");
    setCaffeineNote(source.caffeineNote ?? "");
    setHeadache(source.headache ? "yes" : "no");
    setHeadacheIntensity(source.headacheIntensity ?? 0);
    setHeadacheFeatures(source.headacheFeatures ?? []);
    setWeather(source.weather);
    setWeatherMessage(source.weather ? "保存済みの天候データです。更新すると現在の値に置き換わります。" : "");
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

  const acquireWeather = async () => {
    setWeatherLoading(true);
    setWeatherMessage("現在地を確認して、天候データを取得しています…");
    try {
      const snapshot = await fetchWeatherForCurrentLocation();
      setWeather(snapshot);
      setWeatherMessage("取得できました。この記録を保存すると天候データも端末内に保存されます。");
    } catch (error) {
      const message = error instanceof WeatherError ? error.message : "天候データを取得できませんでした。通信状態を確認して、もう一度お試しください。";
      setWeatherMessage(message);
      Alert.alert("天候を取得できませんでした", message);
    } finally {
      setWeatherLoading(false);
    }
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
      ...(fatigue !== undefined ? { fatigue } : {}),
      clarity,
      ...(muscleFatigue !== undefined ? { muscleFatigue } : {}),
      caffeine: caffeine === "yes",
      caffeineTime: caffeine === "yes" ? caffeineTime.trim() : "",
      caffeineNote: caffeine === "yes" ? caffeineNote.trim() : "",
      headache: headache === "yes",
      headacheIntensity: headache === "yes" ? headacheIntensity : 0,
      headacheFeatures: headache === "yes" ? headacheFeatures : [],
      ...(weather ? { weather } : {}),
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

          <SectionLabel title="天候・気圧" />
          <Card style={styles.formCard}>
            <View style={styles.privacyRow}>
              <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
              <Text style={[styles.privacyText, { color: colors.muted }]}>位置情報はボタンを押した時だけ天候取得に使用し、Open-Meteoへ送信します。座標・住所・地名は保存せず、継続追跡もしません。</Text>
            </View>
            {weather ? (
              <View style={[styles.weatherResult, { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}28` }]}>
                <View style={styles.weatherMetrics}>
                  <WeatherValue label="気圧" value={`${weather.pressureHpa} hPa`} />
                  <WeatherValue label="気温" value={`${weather.temperatureC} ℃`} />
                  <WeatherValue label="天気" value={weather.condition} />
                </View>
                <Text style={[styles.weatherTime, { color: colors.muted }]}>取得日時：{formatAcquiredAt(weather.fetchedAt)}</Text>
              </View>
            ) : null}
            <PrimaryButton
              label={weatherLoading ? "取得中…" : weather ? "現在地から更新" : "現在地から天候・気圧を取得"}
              icon={weatherLoading ? undefined : "my-location"}
              onPress={() => { void acquireWeather(); }}
              disabled={weatherLoading}
            />
            {weatherLoading ? <ActivityIndicator color={colors.primary} accessibilityLabel="天候データを取得中" /> : null}
            {weatherMessage ? <Text accessibilityLiveRegion="polite" style={[styles.weatherMessage, { color: colors.muted }]}>{weatherMessage}</Text> : null}
            {weather ? <PrimaryButton label="この記録から天候データを外す" secondary onPress={() => { setWeather(undefined); setWeatherMessage("天候データを外しました。保存すると反映されます。"); }} /> : null}
            <Text style={[styles.weatherCaution, { color: colors.muted }]}>気圧は体調との関係を振り返るための記録です。頭痛などの診断・予測には使用しません。</Text>
            <Text accessibilityRole="link" onPress={() => { void Linking.openURL(OPEN_METEO_ATTRIBUTION_URL); }} style={[styles.attribution, { color: colors.primary }]}>Weather data by Open-Meteo.com</Text>
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
            <OptionalScoreInput label="疲労" value={fatigue} onChange={setFatigue} accent="#D97706" low="疲労なし" high="とても疲れている" accessibilityLabel="疲労を選択" />
            <OptionalScoreInput label="筋肉疲労" value={muscleFatigue} onChange={setMuscleFatigue} accent="#DC2626" low="なし" high="とても強い" accessibilityLabel="筋肉疲労を選択" />
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
          <Text style={[styles.subjectiveCaution, { color: colors.muted }]}>疲労・筋肉疲労は本人の記録であり、医学的な診断ではありません。</Text>

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

function WeatherValue({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.weatherValue}><Text style={[styles.weatherValueLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.weatherValueText, { color: colors.foreground }]}>{value}</Text></View>;
}

function OptionalScoreInput({ label, value, onChange, accent, low, high, accessibilityLabel }: { label: string; value?: number; onChange: (value: number | undefined) => void; accent: string; low: string; high: string; accessibilityLabel: string }) {
  const colors = useColors();
  const choice: OptionalScoreChoice = value === undefined ? "none" : "record";
  return <View style={styles.formGroup}>
    <FieldLabel label={label} hint={value === undefined ? "任意" : `${value} / 10`} />
    <ChoicePills value={choice} onChange={(next) => onChange(next === "none" ? undefined : value ?? 0)} options={[{ value: "none", label: "未入力", icon: "remove" }, { value: "record", label: "入力する", icon: "edit" }]} />
    {value !== undefined ? <><ScorePicker value={value} onChange={onChange} accent={accent} accessibilityLabel={accessibilityLabel} /><View style={styles.scoreLegend}><Text style={[styles.legendText, { color: colors.muted }]}>{low}</Text><Text style={[styles.legendText, { color: colors.muted }]}>{high}</Text></View></> : null}
  </View>;
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
  privacyRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  weatherResult: { gap: 8, padding: 12, borderWidth: 1, borderRadius: 14 },
  weatherMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  weatherValue: { minWidth: 78, flex: 1, gap: 2 },
  weatherValueLabel: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  weatherValueText: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  weatherTime: { fontSize: 11, lineHeight: 16 },
  weatherMessage: { fontSize: 12, lineHeight: 18 },
  weatherCaution: { fontSize: 11, lineHeight: 17 },
  subjectiveCaution: { fontSize: 11, lineHeight: 17, paddingHorizontal: 3 },
  attribution: { minHeight: 32, paddingVertical: 6, alignSelf: "flex-start", fontSize: 12, lineHeight: 18, fontWeight: "800", textDecorationLine: "underline" },
});
