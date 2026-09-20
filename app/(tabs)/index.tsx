import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, AppState, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { AiInsightPanel } from "@/components/ai-insight-panel";
import { Card } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { WeatherCircleScene } from "@/components/weather-circle-scene";
import { useColors } from "@/hooks/use-colors";
import { buildHomeComparison, type HomeComparisonRow } from "@/lib/home-summary";
import { homeWeatherStatusMessage, type HomeWeatherStatus } from "@/lib/home-weather";
import { hasForegroundLocationPermission, requestCurrentCoordinates } from "@/lib/location-service";
import { calculatePressureChangesForBatch, createPressureHistoryBatch, isPressureHistoryStale, type PressureHistoryBatch } from "@/lib/pressure-history";
import { usePressureHistory } from "@/lib/pressure-history-store";
import { useSleepData } from "@/lib/sleep-store";
import { formatAcquiredAt, formatDate, todayKey, type WeatherSnapshot } from "@/lib/sleep-utils";
import { fetchCurrentWeather, fetchRecentSurfacePressureHistory, WeatherError, type WeatherErrorCode } from "@/lib/weather-service";
import { weatherIconNameFromCode } from "@/lib/weather-visual";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

export default function TodayScreen() {
  const colors = useColors("light");
  const { height: windowHeight, fontScale } = useWindowDimensions();
  // Keep the normal dashboard within a typical phone viewport, while large
  // fonts and very short windows retain the ScrollView as an accessibility fallback.
  const compact = windowHeight < 860 && fontScale <= 1.15;
  const tight = windowHeight < 740 && fontScale <= 1.15;
  const { records, isReady } = useSleepData();
  const { batches: pressureBatches, isReady: pressureHistoryReady, saveBatch } = usePressureHistory();
  const today = todayKey();
  const todayRecord = records.find((item) => item.date === today && !item.isSample);
  const personalRecords = useMemo(() => records.filter((item) => !item.isSample), [records]);
  const latestWeatherRecord = useMemo(
    () => personalRecords
      .filter((item) => item.weather)
      .sort((a, b) => b.weather!.fetchedAt.localeCompare(a.weather!.fetchedAt))[0],
    [personalRecords],
  );
  const comparison = useMemo(() => buildHomeComparison(records, today), [records, today]);
  const [currentWeather, setCurrentWeather] = useState<WeatherSnapshot>();
  const [weatherStatus, setWeatherStatus] = useState<HomeWeatherStatus>();
  const [weatherErrorCode, setWeatherErrorCode] = useState<WeatherErrorCode>();
  const [currentPressureBatch, setCurrentPressureBatch] = useState<PressureHistoryBatch>();
  const weatherUpdateLock = useRef(false);
  const automaticRefreshEnabled = useRef(false);
  const displayedWeather = currentWeather ?? latestWeatherRecord?.weather;
  const displayedPressureBatch = currentPressureBatch ?? pressureBatches[0];
  const pressureChanges = useMemo(
    () => displayedPressureBatch ? calculatePressureChangesForBatch(displayedPressureBatch) : {},
    [displayedPressureBatch],
  );
  const displayedWeatherStatus = weatherStatus ?? (displayedWeather ? "cached" : "idle");
  const openRecord = useCallback(() => router.push({ pathname: "/record", params: { date: today } }), [today]);
  const openHeadache = useCallback(() => {
    router.push({
      pathname: "/headache-event",
      params: latestWeatherRecord?.weather ? { weatherDate: latestWeatherRecord.date } : {},
    });
  }, [latestWeatherRecord]);
  const updateWeather = useCallback(async (mode: "manual" | "automatic" = "manual") => {
    if (weatherUpdateLock.current) return;
    weatherUpdateLock.current = true;
    setWeatherStatus("updating");
    setWeatherErrorCode(undefined);
    try {
      const coordinates = await requestCurrentCoordinates(mode);
      const [weatherResult, historyResult] = await Promise.allSettled([
        fetchCurrentWeather(coordinates),
        fetchRecentSurfacePressureHistory(coordinates),
      ]);
      if (weatherResult.status === "rejected") throw weatherResult.reason;
      const snapshot = weatherResult.value;
      setCurrentWeather({
        pressureHpa: snapshot.pressureHpa,
        temperatureC: snapshot.temperatureC,
        condition: snapshot.condition,
        weatherCode: snapshot.weatherCode,
        fetchedAt: snapshot.fetchedAt,
        source: snapshot.source,
      });
      if (historyResult.status === "fulfilled") {
        const batch = createPressureHistoryBatch(historyResult.value);
        if (batch && await saveBatch(batch)) setCurrentPressureBatch(batch);
      }
      if (mode === "manual") automaticRefreshEnabled.current = true;
      setWeatherStatus("fresh");
    } catch (error) {
      setWeatherErrorCode(error instanceof WeatherError ? error.code : "network");
      setWeatherStatus("error");
    } finally {
      weatherUpdateLock.current = false;
    }
  }, [saveBatch]);

  useEffect(() => {
    const latestBatch = pressureBatches[0];
    if (!latestBatch || !pressureHistoryReady || !isPressureHistoryStale(latestBatch.fetchedAt, 60 * 60 * 1000)) return;
    let active = true;
    void hasForegroundLocationPermission().then((granted) => {
      if (active && granted) void updateWeather("automatic");
    });
    return () => { active = false; };
  }, [pressureBatches, pressureHistoryReady, updateWeather]);

  useEffect(() => {
    const refreshIfNeeded = () => {
      const latestBatch = pressureBatches[0];
      if (!automaticRefreshEnabled.current || !latestBatch || !isPressureHistoryStale(latestBatch.fetchedAt, 60 * 60 * 1000)) return;
      void updateWeather("automatic");
    };
    const interval = setInterval(refreshIfNeeded, 60 * 60 * 1000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refreshIfNeeded(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [pressureBatches, updateWeather]);

  const [swipeControl] = useState(() => {
    let currentScrollY = 0;
    let gestureLocked = false;
    return {
      panResponder: PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) => {
          const vertical = gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4;
          return !gestureLocked && currentScrollY <= 2 && gesture.y0 <= 125 && vertical;
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy < 68 || gesture.vy < 0.08 || gestureLocked) return;
          gestureLocked = true;
          openRecord();
          setTimeout(() => { gestureLocked = false; }, 900);
        },
        onPanResponderTerminate: () => { gestureLocked = false; },
      }),
      setScrollY(value: number) {
        currentScrollY = value;
      },
    };
  });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    swipeControl.setScrollY(event.nativeEvent.contentOffset.y);
  };

  if (!isReady || !pressureHistoryReady) return <ScreenContainer />;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} style={{ backgroundColor: colors.sleepHomeBackground }}>
      <View style={[styles.homeRoot, { backgroundColor: colors.sleepHomeBackground }]}>
        <ForestBackdrop />
        <View pointerEvents="none" style={styles.futureEffectLayer} />
        <View style={styles.normalUiLayer} {...swipeControl.panResponder.panHandlers}>
        <ScrollView
          contentContainerStyle={[styles.content, compact && styles.contentCompact, tight && styles.contentTight]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          overScrollMode="never"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="記録画面を開く"
            onPress={openRecord}
            style={({ pressed }) => [styles.swipeHint, { backgroundColor: `${colors.primary}0C` }, pressed && styles.pressed]}
          >
            <View style={[styles.swipeHandle, { backgroundColor: colors.primary }]} />
            <MaterialIcons name="south" size={15} color={colors.primary} />
            <Text style={[styles.swipeText, { color: colors.primary }]}>上端から下へスワイプして記録</Text>
          </Pressable>

          <HomeHeader date={formatDate(today)} hasTodayRecord={Boolean(todayRecord)} compact={compact} />

          <View style={styles.topGrid}>
            <WeatherAction
              weather={displayedWeather}
              status={displayedWeatherStatus}
              errorCode={weatherErrorCode}
              onPress={openHeadache}
              pressureChanges={pressureChanges}
              onUpdate={() => { void updateWeather(); }}
              compact={compact}
            />
            <ComparisonCard rows={comparison.rows} minimumRecords={comparison.minimumRecords} lookbackDays={comparison.lookbackDays} compact={compact} />
          </View>

          <AiInsightPanel
            compact={compact}
            onPress={() => Alert.alert("今後追加予定です", "AI相談・提案はまだ外部通信を行いません。本人の記録を安全に扱う設計を確認してから追加します。")}
          />

          <View style={[styles.menuArea, compact && styles.menuAreaCompact, { borderTopColor: colors.sleepHomeBorder, backgroundColor: colors.sleepHomeBackground }]}>
            <ForestMenuButton onPress={() => router.push("/menu")} />
            <Text style={[styles.menuCaption, { color: colors.muted }]}>記録・頭痛イベント・履歴・分析・設定</Text>
          </View>

          <View style={[styles.disclaimer, compact && styles.disclaimerCompact, { backgroundColor: `${colors.muted}10` }]}>
            <MaterialIcons name="info-outline" size={16} color={colors.muted} />
            <Text style={[styles.disclaimerText, { color: colors.muted }]}>表示は本人の記録を振り返るための参考情報であり、診断ではありません。</Text>
          </View>
        </ScrollView>
        </View>
      </View>
    </ScreenContainer>
  );
}

function HomeHeader({ date, hasTodayRecord, compact }: { date: string; hasTodayRecord: boolean; compact: boolean }) {
  const colors = useColors("light");
  return (
    <View style={[styles.homeHeader, compact && styles.homeHeaderCompact]}>
      <View>
        <Text style={[styles.homeTitle, compact && styles.homeTitleCompact, { color: colors.sleepHomeForeground }]}>Sleep Log</Text>
        <Text style={[styles.homeDate, compact && styles.homeDateCompact, { color: colors.sleepHomeMuted }]}>{date}</Text>
      </View>
      <View style={[styles.recordStatus, compact && styles.recordStatusCompact, { backgroundColor: hasTodayRecord ? `${colors.sleepForest}16` : `${colors.sleepHomeMuted}12` }]}>
        <MaterialIcons name="calendar-today" size={14} color={hasTodayRecord ? colors.sleepForest : colors.sleepHomeMuted} />
        <Text style={[styles.recordStatusText, compact && styles.recordStatusTextCompact, { color: hasTodayRecord ? colors.sleepForest : colors.sleepHomeMuted }]}>{hasTodayRecord ? "今日の記録あり" : "今日の記録なし"}</Text>
      </View>
    </View>
  );
}

function ForestBackdrop() {
  return (
    <View pointerEvents="none" style={styles.forestBackdrop}>
      <Image
        source={require("../../assets/images/sleep-home-forest-v1.png")}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
        style={styles.forestBackgroundImage}
      />
    </View>
  );
}

function ForestMenuButton({ onPress }: { onPress: () => void }) {
  const colors = useColors("light");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="メニューを開く"
      onPress={onPress}
      style={({ pressed }) => [styles.forestMenuButton, { backgroundColor: colors.sleepForest, shadowColor: colors.sleepForest }, pressed && styles.pressed]}
    >
      <View pointerEvents="none" style={styles.menuLeafLeft}>
        <MaterialIcons name="eco" size={31} color={colors.sleepHomeSurface} />
      </View>
      <MaterialIcons name="menu" size={23} color={colors.sleepHomeSurface} />
      <Text style={[styles.forestMenuText, { color: colors.sleepHomeSurface }]}>メニューを開く</Text>
      <View pointerEvents="none" style={styles.menuLeaf}>
        <MaterialIcons name="eco" size={31} color={colors.sleepHomeSurface} />
      </View>
    </Pressable>
  );
}

function WeatherAction({
  weather,
  status,
  errorCode,
  pressureChanges,
  onPress,
  onUpdate,
  compact,
}: {
  weather?: WeatherSnapshot;
  status: HomeWeatherStatus;
  errorCode?: WeatherErrorCode;
  pressureChanges: ReturnType<typeof calculatePressureChangesForBatch>;
  onPress: () => void;
  onUpdate: () => void;
  compact: boolean;
}) {
  const colors = useColors("light");
  const isUpdating = status === "updating";
  const icon = weatherIconNameFromCode(weather?.weatherCode);
  const label = weather
    ? `${weather.condition}、${weather.temperatureC}度、${weather.pressureHpa}ヘクトパスカル。${pressureChangeLabel("3時間", pressureChanges.change3Hours)}。${pressureChangeLabel("24時間", pressureChanges.change24Hours)}。タップして頭痛イベントを記録`
    : "天候未取得。タップして頭痛イベントを記録";

  return (
    <View style={[styles.weatherColumn, compact && styles.weatherColumnCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.weatherCircle,
          compact && styles.weatherCircleCompact,
          { backgroundColor: colors.sleepHomeSurface, borderColor: `${colors.sleepSky}88`, shadowColor: colors.sleepForest },
          pressed && styles.pressed,
        ]}
      >
        <WeatherCircleScene weatherCode={weather?.weatherCode} />
        <View style={[styles.weatherContent, compact && styles.weatherContentCompact, { backgroundColor: `${colors.sleepHomeSurface}B8` }]}>
        <MaterialIcons name={icon} size={31} color={weather ? colors.sleepBlue : colors.sleepHomeMuted} />
        {weather ? (
          <>
            <Text style={[styles.weatherCondition, { color: colors.sleepHomeForeground }]}>{weather.condition}</Text>
            <Text style={[styles.temperature, { color: colors.sleepHomeForeground }]}>{weather.temperatureC}℃</Text>
            <Text style={[styles.pressure, { color: colors.sleepHomeMuted }]}>{weather.pressureHpa} hPa</Text>
            <View style={[styles.pressureChangeBand, compact && styles.pressureChangeBandCompact, { backgroundColor: `${colors.sleepHomeSurface}D8` }]}>
              <Text style={[styles.pressureChangeText, { color: colors.sleepBlue }]}>{pressureChangeLabel("3h", pressureChanges.change3Hours)}</Text>
              <Text style={[styles.pressureChangeText, { color: colors.sleepBlue }]}>{pressureChangeLabel("24h", pressureChanges.change24Hours)}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.temperature, { color: colors.sleepHomeForeground }]}>--</Text>
            <Text style={[styles.pressure, { color: colors.sleepHomeMuted }]}>天候未取得</Text>
            <Text style={[styles.pressureChangeMissing, { color: colors.sleepHomeMuted }]}>気圧変化：データ不足</Text>
          </>
        )}
        </View>
      </Pressable>
      <Text style={[styles.headacheActionHint, compact && styles.headacheActionHintCompact, { color: colors.sleepHeadache }]}>タップして頭痛を記録</Text>
      <Text style={[styles.weatherTime, compact && styles.weatherTimeCompact, { color: colors.sleepHomeMuted }]}>
        {weather ? `取得 ${formatAcquiredAt(weather.fetchedAt)}` : "保存済み天候なし"}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isUpdating ? "天候を更新中" : weather ? "天候を更新" : "天候を取得"}
        accessibilityState={{ busy: isUpdating, disabled: isUpdating }}
        disabled={isUpdating}
        onPress={onUpdate}
        style={({ pressed }) => [styles.updateButton, compact && styles.updateButtonCompact, pressed && !isUpdating && styles.pressed]}
      >
        {isUpdating ? <ActivityIndicator size="small" color={colors.sleepBlue} /> : <MaterialIcons name="refresh" size={15} color={colors.sleepBlue} />}
        <Text style={[styles.updateText, { color: colors.sleepBlue }]}>{isUpdating ? "更新中…" : weather ? "天候を更新" : "天候を取得"}</Text>
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.weatherStatus, compact && styles.weatherStatusCompact, { color: status === "error" ? colors.sleepHeadache : colors.sleepHomeMuted }]}
      >
        {homeWeatherStatusMessage(status, Boolean(weather), errorCode)}
      </Text>
    </View>
  );
}

function pressureChangeLabel(label: string, change?: { changeHpa: number }) {
  if (!change) return `${label} データ不足`;
  const prefix = change.changeHpa > 0 ? "+" : "";
  const arrow = change.changeHpa > 0 ? "↑" : change.changeHpa < 0 ? "↓" : "→";
  return `${label} ${prefix}${change.changeHpa.toFixed(1)}hPa ${arrow}`;
}

function ComparisonCard({ rows, minimumRecords, lookbackDays, compact }: { rows: HomeComparisonRow[]; minimumRecords: number; lookbackDays: number; compact: boolean }) {
  const colors = useColors("light");
  return (
    <Card style={[styles.comparisonCard, compact && styles.comparisonCardCompact, { backgroundColor: colors.sleepHomeSurface, borderColor: colors.sleepHomeBorder, shadowColor: colors.sleepForest }]}>
      <View style={[styles.comparisonHeading, compact && styles.comparisonHeadingCompact]}>
        <MaterialIcons name="bar-chart" size={19} color={colors.sleepTeal} />
        <Text style={[styles.comparisonTitle, { color: colors.sleepHomeForeground }]}>本人の記録と比較</Text>
        <MaterialIcons name="info-outline" size={15} color={colors.sleepHomeMuted} />
      </View>
      <View style={[styles.tableHeader, compact && styles.tableHeaderCompact, { backgroundColor: `${colors.sleepTeal}10`, borderBottomColor: colors.sleepHomeBorder }]}>
        <Text style={[styles.metricColumn, styles.tableHeaderText, { color: colors.sleepHomeMuted }]}>項目</Text>
        <Text style={[styles.valueColumn, styles.tableHeaderText, { color: colors.sleepHomeMuted }]}>いつもの目安</Text>
        <Text style={[styles.valueColumn, styles.tableHeaderText, { color: colors.sleepHomeMuted }]}>今日</Text>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={[styles.tableRow, compact && styles.tableRowCompact, { borderBottomColor: colors.sleepHomeBorder }]}>
          <View style={styles.metricColumn}>
            <MaterialIcons name={comparisonIcon(row.key)} size={15} color={comparisonAccent(row.key, colors)} />
            <Text style={[styles.metricLabel, { color: colors.sleepHomeForeground }]}>{row.label}</Text>
          </View>
          <Text style={[styles.valueColumn, styles.metricValue, compact && styles.metricValueCompact, { color: row.usual === "データ不足" || !row.supported ? colors.sleepHomeMuted : colors.sleepBlue }]}>{row.usual}</Text>
          <Text style={[styles.valueColumn, styles.metricValue, compact && styles.metricValueCompact, { color: row.today === "未記録" || row.today === "記録なし" || !row.supported ? colors.sleepHomeMuted : colors.sleepHomeForeground }]}>{row.today}</Text>
        </View>
      ))}
      <Text style={[styles.comparisonMeta, compact && styles.comparisonMetaCompact, { color: colors.sleepHomeMuted }]}>過去{lookbackDays}日（今日・サンプル除外）の中央値。各項目{minimumRecords}件以上で表示。</Text>
    </Card>
  );
}

function comparisonIcon(key: HomeComparisonRow["key"]): MaterialIconName {
  if (key === "sleep") return "bedtime";
  if (key === "fatigue") return "battery-alert";
  if (key === "exercise") return "directions-run";
  return "favorite";
}

function comparisonAccent(key: HomeComparisonRow["key"], colors: ReturnType<typeof useColors>) {
  if (key === "sleep") return colors.sleepBlue;
  if (key === "fatigue") return colors.sleepForest;
  if (key === "exercise") return colors.sleepForest;
  return colors.sleepTeal;
}

const styles = StyleSheet.create({
  homeRoot: { flex: 1 },
  forestBackdrop: { ...StyleSheet.absoluteFill },
  forestBackgroundImage: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  futureEffectLayer: { ...StyleSheet.absoluteFill },
  normalUiLayer: { flex: 1 },
  content: { width: "100%", maxWidth: 460, minHeight: "100%", flexGrow: 1, alignSelf: "center", paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, justifyContent: "space-between", gap: 0 },
  contentCompact: { paddingTop: 1, paddingBottom: 5, gap: 0 },
  contentTight: { paddingHorizontal: 9, gap: 4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  swipeHint: { minHeight: 34, marginHorizontal: 42, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10 },
  swipeHandle: { position: "absolute", top: 4, width: 40, height: 3, borderRadius: 99 },
  swipeText: { fontSize: 10, lineHeight: 14, fontWeight: "800", marginTop: 4 },
  homeHeader: { minHeight: 62, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingHorizontal: 2 },
  homeHeaderCompact: { minHeight: 48, gap: 6 },
  homeTitle: { fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.7 },
  homeTitleCompact: { fontSize: 24, lineHeight: 29 },
  homeDate: { fontSize: 14, lineHeight: 21, fontWeight: "700" },
  homeDateCompact: { fontSize: 12, lineHeight: 17 },
  recordStatus: { minHeight: 34, borderRadius: 999, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  recordStatusCompact: { minHeight: 30, paddingHorizontal: 8, gap: 4, marginTop: 1 },
  recordStatusText: { fontSize: 10, lineHeight: 14, fontWeight: "900" },
  recordStatusTextCompact: { fontSize: 9, lineHeight: 12 },
  topGrid: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  weatherColumn: { flex: 0.39, minWidth: 0, alignItems: "center", gap: 5 },
  weatherColumnCompact: { gap: 2 },
  weatherCircle: { width: "100%", maxWidth: 154, aspectRatio: 1, borderRadius: 999, borderWidth: 1.5, alignItems: "center", justifyContent: "center", padding: 7, overflow: "hidden", elevation: 3, shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  weatherCircleCompact: { maxWidth: 134, padding: 5 },
  weatherContent: { minWidth: "88%", alignItems: "center", borderRadius: 18, paddingHorizontal: 5, paddingVertical: 3 },
  weatherContentCompact: { minWidth: "90%", paddingHorizontal: 3, paddingVertical: 2 },
  weatherCondition: { fontSize: 9, lineHeight: 12, fontWeight: "800", textAlign: "center" },
  temperature: { fontSize: 19, lineHeight: 23, fontWeight: "900", letterSpacing: -0.5 },
  pressure: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
  pressureChangeBand: { marginTop: 2, width: "100%", minHeight: 22, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  pressureChangeBandCompact: { minHeight: 20, marginTop: 1 },
  pressureChangeText: { fontSize: 8, lineHeight: 10, fontWeight: "900", textAlign: "center" },
  pressureChangeMissing: { marginTop: 4, fontSize: 8, lineHeight: 11, fontWeight: "800", textAlign: "center" },
  headacheActionHint: { fontSize: 9, lineHeight: 13, fontWeight: "900", textAlign: "center" },
  headacheActionHintCompact: { fontSize: 8, lineHeight: 11 },
  weatherTime: { fontSize: 9, lineHeight: 13, textAlign: "center" },
  weatherTimeCompact: { fontSize: 8, lineHeight: 11 },
  updateButton: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  updateButtonCompact: { minHeight: 28 },
  updateText: { fontSize: 11, lineHeight: 16, fontWeight: "800" },
  weatherStatus: { minHeight: 25, maxWidth: 145, fontSize: 9, lineHeight: 12, fontWeight: "700", textAlign: "center" },
  weatherStatusCompact: { minHeight: 17, fontSize: 8, lineHeight: 10 },
  comparisonCard: { flex: 0.61, minWidth: 0, padding: 11, gap: 0, borderRadius: 20, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  comparisonCardCompact: { padding: 8, borderRadius: 17 },
  comparisonHeading: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  comparisonHeadingCompact: { marginBottom: 3, gap: 4 },
  comparisonTitle: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  tableHeader: { minHeight: 26, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderRadius: 8, paddingHorizontal: 2 },
  tableHeaderCompact: { minHeight: 22 },
  tableHeaderText: { fontSize: 8, lineHeight: 11, fontWeight: "800", textAlign: "center" },
  tableRow: { minHeight: 39, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  tableRowCompact: { minHeight: 31 },
  metricColumn: { width: "31%", flexDirection: "row", alignItems: "center", gap: 3, minWidth: 0 },
  valueColumn: { width: "34.5%", paddingHorizontal: 2, textAlign: "center" },
  metricLabel: { fontSize: 10, lineHeight: 14, fontWeight: "800" },
  metricValue: { fontSize: 9, lineHeight: 13, fontWeight: "800" },
  metricValueCompact: { fontSize: 8, lineHeight: 11 },
  comparisonMeta: { fontSize: 8, lineHeight: 12, marginTop: 6 },
  comparisonMetaCompact: { fontSize: 7, lineHeight: 9, marginTop: 3 },
  menuArea: { marginHorizontal: -12, paddingHorizontal: 12, paddingTop: 13, borderTopWidth: 1, gap: 5 },
  menuAreaCompact: { paddingTop: 6, gap: 2 },
  menuCaption: { textAlign: "center", fontSize: 10, lineHeight: 15 },
  forestMenuButton: { minHeight: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, overflow: "hidden", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  forestMenuText: { fontSize: 17, lineHeight: 22, fontWeight: "900" },
  menuLeafLeft: { position: "absolute", left: 15, opacity: 0.15, transform: [{ rotate: "18deg" }] },
  menuLeaf: { position: "absolute", right: 15, opacity: 0.15, transform: [{ rotate: "-18deg" }] },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 13, padding: 11 },
  disclaimerCompact: { gap: 5, borderRadius: 10, padding: 7 },
  disclaimerText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
