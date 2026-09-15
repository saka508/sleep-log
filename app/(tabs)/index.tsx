import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { AiInsightPanel } from "@/components/ai-insight-panel";
import { Card } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { buildHomeComparison, type HomeComparisonRow } from "@/lib/home-summary";
import { homeWeatherStatusMessage, type HomeWeatherStatus } from "@/lib/home-weather";
import { useSleepData } from "@/lib/sleep-store";
import { formatAcquiredAt, formatDate, todayKey, type WeatherSnapshot } from "@/lib/sleep-utils";
import { fetchWeatherForCurrentLocation, WeatherError, type WeatherErrorCode } from "@/lib/weather-service";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

export default function TodayScreen() {
  const colors = useColors("light");
  const { records, isReady } = useSleepData();
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
  const weatherUpdateLock = useRef(false);
  const displayedWeather = currentWeather ?? latestWeatherRecord?.weather;
  const displayedWeatherStatus = weatherStatus ?? (displayedWeather ? "cached" : "idle");
  const openRecord = useCallback(() => router.push({ pathname: "/record", params: { date: today } }), [today]);
  const openHeadache = useCallback(() => {
    router.push({
      pathname: "/headache-event",
      params: latestWeatherRecord?.weather ? { weatherDate: latestWeatherRecord.date } : {},
    });
  }, [latestWeatherRecord]);
  const updateWeather = useCallback(async () => {
    if (weatherUpdateLock.current) return;
    weatherUpdateLock.current = true;
    setWeatherStatus("updating");
    setWeatherErrorCode(undefined);
    try {
      const snapshot = await fetchWeatherForCurrentLocation();
      setCurrentWeather({
        pressureHpa: snapshot.pressureHpa,
        temperatureC: snapshot.temperatureC,
        condition: snapshot.condition,
        weatherCode: snapshot.weatherCode,
        fetchedAt: snapshot.fetchedAt,
        source: snapshot.source,
      });
      setWeatherStatus("fresh");
    } catch (error) {
      setWeatherErrorCode(error instanceof WeatherError ? error.code : "network");
      setWeatherStatus("error");
    } finally {
      weatherUpdateLock.current = false;
    }
  }, []);

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

  if (!isReady) return <ScreenContainer />;

  return (
    <ScreenContainer style={{ backgroundColor: colors.sleepHomeBackground }}>
      <View style={[styles.homeRoot, { backgroundColor: colors.sleepHomeBackground }]}>
        <ForestBackdrop />
        <View pointerEvents="none" style={styles.futureEffectLayer} />
        <View style={styles.normalUiLayer} {...swipeControl.panResponder.panHandlers}>
        <ScrollView
          contentContainerStyle={styles.content}
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

          <HomeHeader date={formatDate(today)} hasTodayRecord={Boolean(todayRecord)} />

          <View style={styles.topGrid}>
            <WeatherAction
              weather={displayedWeather}
              status={displayedWeatherStatus}
              errorCode={weatherErrorCode}
              onPress={openHeadache}
              onUpdate={updateWeather}
            />
            <ComparisonCard rows={comparison.rows} minimumRecords={comparison.minimumRecords} lookbackDays={comparison.lookbackDays} />
          </View>

          <AiInsightPanel
            onPress={() => Alert.alert("今後追加予定です", "AI相談・提案はまだ外部通信を行いません。本人の記録を安全に扱う設計を確認してから追加します。")}
          />

          <View style={[styles.menuArea, { borderTopColor: colors.sleepHomeBorder, backgroundColor: colors.sleepHomeBackground }]}>
            <ForestMenuButton onPress={() => router.push("/menu")} />
            <Text style={[styles.menuCaption, { color: colors.muted }]}>記録・頭痛イベント・履歴・分析・設定</Text>
          </View>

          <View style={[styles.disclaimer, { backgroundColor: `${colors.muted}10` }]}>
            <MaterialIcons name="info-outline" size={16} color={colors.muted} />
            <Text style={[styles.disclaimerText, { color: colors.muted }]}>表示は本人の記録を振り返るための参考情報であり、診断ではありません。</Text>
          </View>
        </ScrollView>
        </View>
      </View>
    </ScreenContainer>
  );
}

function HomeHeader({ date, hasTodayRecord }: { date: string; hasTodayRecord: boolean }) {
  const colors = useColors("light");
  return (
    <View style={styles.homeHeader}>
      <View>
        <Text style={[styles.homeTitle, { color: colors.sleepHomeForeground }]}>Sleep Log</Text>
        <Text style={[styles.homeDate, { color: colors.sleepHomeMuted }]}>{date}</Text>
      </View>
      <View style={[styles.recordStatus, { backgroundColor: hasTodayRecord ? `${colors.sleepForest}16` : `${colors.sleepHomeMuted}12` }]}>
        <MaterialIcons name="calendar-today" size={14} color={hasTodayRecord ? colors.sleepForest : colors.sleepHomeMuted} />
        <Text style={[styles.recordStatusText, { color: hasTodayRecord ? colors.sleepForest : colors.sleepHomeMuted }]}>{hasTodayRecord ? "今日の記録あり" : "今日の記録なし"}</Text>
      </View>
    </View>
  );
}

function ForestBackdrop() {
  return (
    <View pointerEvents="none" style={styles.forestBackdrop}>
      <Image
        source={require("../../assets/images/sleep-home-forest-v1.png")}
        resizeMode="cover"
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
      style={({ pressed }) => [styles.forestMenuButton, { backgroundColor: colors.sleepForest }, pressed && styles.pressed]}
    >
      <MaterialIcons name="menu" size={23} color={colors.sleepHomeSurface} />
      <Text style={[styles.forestMenuText, { color: colors.sleepHomeSurface }]}>メニューを開く</Text>
      <View pointerEvents="none" style={styles.menuLeaf}>
        <MaterialIcons name="eco" size={31} color={colors.sleepHomeSurface} />
      </View>
    </Pressable>
  );
}

function WeatherScene() {
  const colors = useColors("light");
  return (
    <View pointerEvents="none" style={styles.weatherScene}>
      <Svg width="100%" height="100%" viewBox="0 0 160 160">
        <Defs>
          <LinearGradient id="weatherSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.sleepSky} stopOpacity={0.58} />
            <Stop offset="0.56" stopColor={colors.sleepHomeSurface} stopOpacity={0.36} />
            <Stop offset="1" stopColor={colors.sleepTeal} stopOpacity={0.38} />
          </LinearGradient>
        </Defs>
        <Circle cx="80" cy="80" r="80" fill="url(#weatherSky)" />
        <Circle cx="116" cy="40" r="12" fill={colors.sleepHomeSurface} fillOpacity={0.72} />
        <Path d="M-8 94 L31 58 L63 87 L91 48 L128 91 L170 58 V116 H-8 Z" fill={colors.sleepSky} fillOpacity={0.48} />
        <Path d="M-5 108 C35 100 67 114 102 105 C126 98 148 105 166 99 V168 H-5 Z" fill={colors.sleepTeal} fillOpacity={0.32} />
        <Path d="M0 125 L10 103 L20 125 L32 94 L44 125 L57 105 L68 125 L81 90 L94 125 L108 104 L120 125 L135 92 L149 125 L160 102 V166 H0 Z" fill={colors.sleepForest} fillOpacity={0.48} />
      </Svg>
    </View>
  );
}

function WeatherAction({
  weather,
  status,
  errorCode,
  onPress,
  onUpdate,
}: {
  weather?: WeatherSnapshot;
  status: HomeWeatherStatus;
  errorCode?: WeatherErrorCode;
  onPress: () => void;
  onUpdate: () => void;
}) {
  const colors = useColors("light");
  const isUpdating = status === "updating";
  const icon = weatherIcon(weather?.weatherCode);
  const label = weather
    ? `${weather.condition}、${weather.temperatureC}度、${weather.pressureHpa}ヘクトパスカル。タップして頭痛イベントを記録`
    : "天候未取得。タップして頭痛イベントを記録";

  return (
    <View style={styles.weatherColumn}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.weatherCircle,
          { backgroundColor: colors.sleepHomeSurface, borderColor: `${colors.sleepSky}88` },
          pressed && styles.pressed,
        ]}
      >
        <WeatherScene />
        <View style={styles.weatherContent}>
        <MaterialIcons name={icon} size={31} color={weather ? colors.sleepBlue : colors.sleepHomeMuted} />
        {weather ? (
          <>
            <Text style={[styles.weatherCondition, { color: colors.sleepHomeForeground }]}>{weather.condition}</Text>
            <Text style={[styles.temperature, { color: colors.sleepHomeForeground }]}>{weather.temperatureC}℃</Text>
            <Text style={[styles.pressure, { color: colors.sleepHomeMuted }]}>{weather.pressureHpa} hPa</Text>
            <View style={[styles.headacheCue, { backgroundColor: `${colors.sleepHeadache}16` }]}>
              <MaterialIcons name="healing" size={13} color={colors.sleepHeadache} />
              <Text style={[styles.headacheCueText, { color: colors.sleepHeadache }]}>頭痛を記録</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.temperature, { color: colors.sleepHomeForeground }]}>--</Text>
            <Text style={[styles.pressure, { color: colors.sleepHomeMuted }]}>天候未取得</Text>
            <View style={[styles.headacheCue, { backgroundColor: `${colors.sleepHeadache}16` }]}>
              <MaterialIcons name="healing" size={13} color={colors.sleepHeadache} />
              <Text style={[styles.headacheCueText, { color: colors.sleepHeadache }]}>頭痛を記録</Text>
            </View>
          </>
        )}
        </View>
      </Pressable>
      <Text style={[styles.weatherTime, { color: colors.sleepHomeMuted }]}>
        {weather ? `取得 ${formatAcquiredAt(weather.fetchedAt)}` : "保存済み天候なし"}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isUpdating ? "天候を更新中" : weather ? "天候を更新" : "天候を取得"}
        accessibilityState={{ busy: isUpdating, disabled: isUpdating }}
        disabled={isUpdating}
        onPress={onUpdate}
        style={({ pressed }) => [styles.updateButton, pressed && !isUpdating && styles.pressed]}
      >
        {isUpdating ? <ActivityIndicator size="small" color={colors.sleepBlue} /> : <MaterialIcons name="refresh" size={15} color={colors.sleepBlue} />}
        <Text style={[styles.updateText, { color: colors.sleepBlue }]}>{isUpdating ? "更新中…" : weather ? "天候を更新" : "天候を取得"}</Text>
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.weatherStatus, { color: status === "error" ? colors.sleepHeadache : colors.sleepHomeMuted }]}
      >
        {homeWeatherStatusMessage(status, Boolean(weather), errorCode)}
      </Text>
    </View>
  );
}

function ComparisonCard({ rows, minimumRecords, lookbackDays }: { rows: HomeComparisonRow[]; minimumRecords: number; lookbackDays: number }) {
  const colors = useColors("light");
  return (
    <Card style={[styles.comparisonCard, { backgroundColor: colors.sleepHomeSurface, borderColor: colors.sleepHomeBorder }]}>
      <View style={styles.comparisonHeading}>
        <MaterialIcons name="bar-chart" size={19} color={colors.sleepTeal} />
        <Text style={[styles.comparisonTitle, { color: colors.sleepHomeForeground }]}>本人の記録と比較</Text>
        <MaterialIcons name="info-outline" size={15} color={colors.sleepHomeMuted} />
      </View>
      <View style={[styles.tableHeader, { backgroundColor: `${colors.sleepTeal}10`, borderBottomColor: colors.sleepHomeBorder }]}>
        <Text style={[styles.metricColumn, styles.tableHeaderText, { color: colors.sleepHomeMuted }]}>項目</Text>
        <Text style={[styles.valueColumn, styles.tableHeaderText, { color: colors.sleepHomeMuted }]}>いつもの目安</Text>
        <Text style={[styles.valueColumn, styles.tableHeaderText, { color: colors.sleepHomeMuted }]}>今日</Text>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={[styles.tableRow, { borderBottomColor: colors.sleepHomeBorder }]}>
          <View style={styles.metricColumn}>
            <MaterialIcons name={comparisonIcon(row.key)} size={15} color={comparisonAccent(row.key, colors)} />
            <Text style={[styles.metricLabel, { color: colors.sleepHomeForeground }]}>{row.label}</Text>
          </View>
          <Text style={[styles.valueColumn, styles.metricValue, { color: row.usual === "データ不足" || !row.supported ? colors.sleepHomeMuted : colors.sleepBlue }]}>{row.usual}</Text>
          <Text style={[styles.valueColumn, styles.metricValue, { color: row.today === "未記録" || row.today === "記録なし" || !row.supported ? colors.sleepHomeMuted : colors.sleepHomeForeground }]}>{row.today}</Text>
        </View>
      ))}
      <Text style={[styles.comparisonMeta, { color: colors.sleepHomeMuted }]}>過去{lookbackDays}日（今日・サンプル除外）の中央値。各項目{minimumRecords}件以上で表示。</Text>
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

function weatherIcon(code?: number): MaterialIconName {
  if (code === undefined) return "cloud-off";
  if (code === 0) return "wb-sunny";
  if (code <= 3) return "cloud";
  if (code >= 95) return "thunderstorm";
  if (code >= 71 && code <= 86) return "ac-unit";
  if (code >= 51 && code <= 67) return "grain";
  return "water-drop";
}

const styles = StyleSheet.create({
  homeRoot: { flex: 1 },
  forestBackdrop: { ...StyleSheet.absoluteFill },
  forestBackgroundImage: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  futureEffectLayer: { ...StyleSheet.absoluteFill },
  normalUiLayer: { flex: 1 },
  content: { width: "100%", maxWidth: 460, minHeight: "100%", alignSelf: "center", paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 13 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  swipeHint: { minHeight: 34, marginHorizontal: 42, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10 },
  swipeHandle: { position: "absolute", top: 4, width: 40, height: 3, borderRadius: 99 },
  swipeText: { fontSize: 10, lineHeight: 14, fontWeight: "800", marginTop: 4 },
  homeHeader: { minHeight: 62, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingHorizontal: 2 },
  homeTitle: { fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.7 },
  homeDate: { fontSize: 14, lineHeight: 21, fontWeight: "700" },
  recordStatus: { minHeight: 34, borderRadius: 999, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  recordStatusText: { fontSize: 10, lineHeight: 14, fontWeight: "900" },
  topGrid: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  weatherColumn: { flex: 0.39, minWidth: 0, alignItems: "center", gap: 5 },
  weatherCircle: { width: "100%", maxWidth: 150, aspectRatio: 1, borderRadius: 999, borderWidth: 1.5, alignItems: "center", justifyContent: "center", padding: 9, overflow: "hidden" },
  weatherScene: { ...StyleSheet.absoluteFill },
  weatherContent: { minWidth: "84%", alignItems: "center", borderRadius: 18, paddingHorizontal: 6, paddingVertical: 5 },
  weatherCondition: { fontSize: 9, lineHeight: 12, fontWeight: "800", textAlign: "center" },
  temperature: { fontSize: 21, lineHeight: 25, fontWeight: "900", letterSpacing: -0.5 },
  pressure: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  headacheCue: { marginTop: 5, minHeight: 24, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7 },
  headacheCueText: { fontSize: 9, lineHeight: 12, fontWeight: "900" },
  weatherTime: { fontSize: 9, lineHeight: 13, textAlign: "center" },
  updateButton: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  updateText: { fontSize: 11, lineHeight: 16, fontWeight: "800" },
  weatherStatus: { minHeight: 25, maxWidth: 145, fontSize: 9, lineHeight: 12, fontWeight: "700", textAlign: "center" },
  comparisonCard: { flex: 0.61, minWidth: 0, padding: 10, gap: 0, borderRadius: 18 },
  comparisonHeading: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  comparisonTitle: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  tableHeader: { minHeight: 26, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderRadius: 8, paddingHorizontal: 2 },
  tableHeaderText: { fontSize: 8, lineHeight: 11, fontWeight: "800", textAlign: "center" },
  tableRow: { minHeight: 39, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  metricColumn: { width: "31%", flexDirection: "row", alignItems: "center", gap: 3, minWidth: 0 },
  valueColumn: { width: "34.5%", paddingHorizontal: 2, textAlign: "center" },
  metricLabel: { fontSize: 10, lineHeight: 14, fontWeight: "800" },
  metricValue: { fontSize: 9, lineHeight: 13, fontWeight: "800" },
  comparisonMeta: { fontSize: 8, lineHeight: 12, marginTop: 6 },
  menuArea: { marginHorizontal: -12, paddingHorizontal: 12, paddingTop: 13, borderTopWidth: 1, gap: 5 },
  menuCaption: { textAlign: "center", fontSize: 10, lineHeight: 15 },
  forestMenuButton: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, overflow: "hidden" },
  forestMenuText: { fontSize: 17, lineHeight: 22, fontWeight: "900" },
  menuLeaf: { position: "absolute", right: 15, opacity: 0.15, transform: [{ rotate: "-18deg" }] },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 13, padding: 11 },
  disclaimerText: { flex: 1, fontSize: 11, lineHeight: 17 },
});
