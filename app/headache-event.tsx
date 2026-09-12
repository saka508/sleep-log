import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppTextInput, Card, ChoicePills, FieldLabel, MultiChoicePills, PageHeader, PrimaryButton, ScorePicker, SectionLabel } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { createHeadacheEventId, localDateTimeToIso, type HeadacheEventWeatherSnapshot } from "@/lib/headache-events";
import { useHeadacheEvents } from "@/lib/headache-store";
import { formatAcquiredAt, HEADACHE_FEATURE_OPTIONS, todayKey, type HeadacheFeature } from "@/lib/sleep-utils";
import { fetchWeatherForCurrentLocation, OPEN_METEO_ATTRIBUTION_URL, WeatherError } from "@/lib/weather-service";

type SeverityChoice = "none" | "record";

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function HeadacheEventScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isReady } = useHeadacheEvents();
  if (!isReady) return <ScreenContainer />;
  return <HeadacheEventForm key={id ?? "new"} />;
}

function HeadacheEventForm() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { events, saveEvent, removeEvent } = useHeadacheEvents();
  const existing = useMemo(() => events.find((event) => event.id === id), [events, id]);
  const initialStartedAt = existing ? new Date(existing.startedAt) : null;
  const [date, setDate] = useState(existing?.date ?? todayKey());
  const [time, setTime] = useState(initialStartedAt ? `${String(initialStartedAt.getHours()).padStart(2, "0")}:${String(initialStartedAt.getMinutes()).padStart(2, "0")}` : currentTime());
  const [severity, setSeverity] = useState<number | null>(existing?.severity ?? null);
  const [symptoms, setSymptoms] = useState<HeadacheFeature[]>(existing?.symptoms ?? []);
  const [weather, setWeather] = useState<HeadacheEventWeatherSnapshot | undefined>(existing?.weatherSnapshot);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherMessage, setWeatherMessage] = useState(existing?.weatherSnapshot ? "保存済みの天候データです。" : "");

  const acquireWeather = async () => {
    setWeatherLoading(true);
    setWeatherMessage("現在地から天候を取得しています…");
    try {
      const snapshot = await fetchWeatherForCurrentLocation();
      setWeather({
        pressureHpa: snapshot.pressureHpa,
        temperatureC: snapshot.temperatureC,
        condition: snapshot.condition,
        weatherCode: snapshot.weatherCode,
        observedAt: snapshot.observedAt ?? snapshot.fetchedAt,
        fetchedAt: snapshot.fetchedAt,
        source: snapshot.source,
      });
      setWeatherMessage("取得できました。位置情報や住所は保存しません。");
    } catch (error) {
      const message = error instanceof WeatherError ? error.message : "天候データを取得できませんでした。";
      setWeatherMessage(`${message} 頭痛イベントは天候なしで保存できます。`);
    } finally {
      setWeatherLoading(false);
    }
  };

  const save = () => {
    const startedAt = localDateTimeToIso(date, time);
    if (!startedAt) {
      Alert.alert("日時を確認してください", "日付は YYYY-MM-DD、時刻は HH:MM の24時間表記で入力してください。");
      return;
    }
    const now = new Date().toISOString();
    const success = saveEvent({
      schemaVersion: 1,
      id: existing?.id ?? createHeadacheEventId(),
      date,
      startedAt,
      severity,
      symptoms,
      ...(weather ? { weatherSnapshot: weather } : {}),
      source: "manual",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (!success) {
      Alert.alert("保存できませんでした", "入力内容を確認して、もう一度お試しください。");
      return;
    }
    Alert.alert("保存しました", "頭痛イベントを端末内に保存しました。", [{ text: "OK", onPress: () => router.replace("/headache") }]);
  };

  const confirmDelete = () => existing && Alert.alert("この頭痛イベントを削除しますか？", "削除したイベントは元に戻せません。", [
    { text: "キャンセル", style: "cancel" },
    { text: "削除", style: "destructive", onPress: () => { removeEvent(existing.id); router.replace("/headache"); } },
  ]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <PageHeader title={existing ? "頭痛イベントを編集" : "頭痛イベントを記録"} subtitle="睡眠記録とは別に保存します" action={<PrimaryButton label="閉じる" secondary onPress={() => router.back()} />} />

          <SectionLabel title="発生した日時" />
          <Card style={styles.formCard}>
            <View style={styles.twoColumns}><View style={styles.flexField}><FieldLabel label="日付" /><AppTextInput value={date} onChangeText={setDate} placeholder="2026-09-13" /></View><View style={styles.flexField}><FieldLabel label="時刻" /><AppTextInput value={time} onChangeText={setTime} placeholder="14:30" keyboardType="numbers-and-punctuation" maxLength={5} /></View></View>
          </Card>

          <SectionLabel title="強さ・症状" />
          <Card style={styles.formCard}>
            <FieldLabel label="頭痛の強さ" hint={severity === null ? "未入力" : `${severity} / 10`} />
            <ChoicePills<SeverityChoice> value={severity === null ? "none" : "record"} onChange={(choice) => setSeverity(choice === "none" ? null : severity ?? 0)} options={[{ value: "none", label: "未入力", icon: "remove" }, { value: "record", label: "入力する", icon: "edit" }]} />
            {severity !== null ? <ScorePicker value={severity} onChange={setSeverity} accent={colors.error} accessibilityLabel="頭痛イベントの強さ" /> : null}
            <View style={styles.symptoms}><FieldLabel label="症状・部位" hint="任意・複数選択可" /><MultiChoicePills values={symptoms} onChange={setSymptoms} options={[...HEADACHE_FEATURE_OPTIONS]} accessibilityLabel="頭痛イベントの症状・部位" /></View>
          </Card>

          <SectionLabel title="その時点の天候" />
          <Card style={styles.formCard}>
            {weather ? <View style={[styles.weatherBox, { backgroundColor: `${colors.primary}09`, borderColor: `${colors.primary}28` }]}>
              <View style={styles.weatherValues}><WeatherValue label="気圧" value={`${weather.pressureHpa} hPa`} /><WeatherValue label="気温" value={`${weather.temperatureC} ℃`} /><WeatherValue label="天気" value={weather.condition} /></View>
              <Text style={[styles.weatherTime, { color: colors.muted }]}>観測：{formatAcquiredAt(weather.observedAt)}　取得：{formatAcquiredAt(weather.fetchedAt)}</Text>
            </View> : <Text style={[styles.message, { color: colors.muted }]}>天候は任意です。取得できなくてもイベントを保存できます。</Text>}
            <PrimaryButton label={weatherLoading ? "取得中…" : weather ? "現在地から更新" : "現在地から天候を取得"} icon={weatherLoading ? undefined : "my-location"} disabled={weatherLoading} onPress={() => { void acquireWeather(); }} />
            {weatherLoading ? <ActivityIndicator color={colors.primary} /> : null}
            {weatherMessage ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.muted }]}>{weatherMessage}</Text> : null}
            {weather ? <PrimaryButton label="天候データを外す" secondary onPress={() => { setWeather(undefined); setWeatherMessage("天候データを外しました。"); }} /> : null}
            <Text style={[styles.message, { color: colors.muted }]}>位置情報は取得操作の時だけ利用し、座標・住所は保存しません。気圧と頭痛の因果関係を示すものではありません。</Text>
            <Text accessibilityRole="link" onPress={() => { void Linking.openURL(OPEN_METEO_ATTRIBUTION_URL); }} style={[styles.link, { color: colors.primary }]}>Weather data by Open-Meteo.com</Text>
          </Card>

          <PrimaryButton label="この頭痛イベントを保存" icon="check" onPress={save} />
          {existing ? <PrimaryButton label="このイベントを削除" icon="delete-outline" secondary onPress={confirmDelete} /> : null}
          <View style={[styles.disclaimer, { backgroundColor: `${colors.muted}12` }]}><MaterialIcons name="info-outline" size={17} color={colors.muted} /><Text style={[styles.disclaimerText, { color: colors.muted }]}>この記録は本人の振り返り用であり、医学的な診断や原因の判定ではありません。</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function WeatherValue({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.weatherValue}><Text style={[styles.weatherLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.weatherNumber, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 26, gap: 12 }, formCard: { gap: 14 },
  twoColumns: { flexDirection: "row", gap: 10 }, flexField: { flex: 1, minWidth: 0 }, symptoms: { gap: 2, marginTop: 4 },
  weatherBox: { padding: 12, borderWidth: 1, borderRadius: 14, gap: 8 }, weatherValues: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  weatherValue: { minWidth: 75, flex: 1, gap: 2 }, weatherLabel: { fontSize: 11, lineHeight: 15, fontWeight: "700" }, weatherNumber: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  weatherTime: { fontSize: 10, lineHeight: 15 }, message: { fontSize: 11, lineHeight: 17 }, link: { minHeight: 32, paddingVertical: 6, alignSelf: "flex-start", fontSize: 12, lineHeight: 18, fontWeight: "800", textDecorationLine: "underline" },
  disclaimer: { flexDirection: "row", gap: 8, padding: 13, borderRadius: 14 }, disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
