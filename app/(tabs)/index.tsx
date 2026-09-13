import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { Alert, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { AiInsightPanel } from "@/components/ai-insight-panel";
import { Card } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { buildHomeComparison, type HomeComparisonRow } from "@/lib/home-summary";
import { useSleepData } from "@/lib/sleep-store";
import { formatAcquiredAt, formatDate, todayKey, type SleepRecord } from "@/lib/sleep-utils";

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
  const openRecord = useCallback(() => router.push({ pathname: "/record", params: { date: today } }), [today]);
  const openHeadache = useCallback(() => {
    router.push({
      pathname: "/headache-event",
      params: latestWeatherRecord?.weather ? { weatherDate: latestWeatherRecord.date } : {},
    });
  }, [latestWeatherRecord]);

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
            <WeatherAction weatherRecord={latestWeatherRecord} onPress={openHeadache} onUpdate={openRecord} />
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
  const colors = useColors("light");
  return (
    <View pointerEvents="none" style={styles.forestBackdrop}>
      <Svg width="100%" height="100%" viewBox="0 0 390 900" preserveAspectRatio="xMidYMin slice">
        <Defs>
          <LinearGradient id="homeMist" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.sleepSky} stopOpacity={0.16} />
            <Stop offset="0.48" stopColor={colors.sleepHomeSurface} stopOpacity={0.05} />
            <Stop offset="1" stopColor={colors.sleepForest} stopOpacity={0.08} />
          </LinearGradient>
          <LinearGradient id="homeWater" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.sleepSky} stopOpacity={0} />
            <Stop offset="0.38" stopColor={colors.sleepSky} stopOpacity={0.07} />
            <Stop offset="1" stopColor={colors.sleepTeal} stopOpacity={0.14} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="390" height="900" fill="url(#homeMist)" />
        <G fill={colors.sleepForest} fillOpacity={0.13}>
          <Path d="M-2 55 C18 38 37 42 42 61 C25 72 8 70-2 55Z" />
          <Path d="M22 29 C33 8 53 7 62 24 C51 40 36 44 22 29Z" />
          <Path d="M58 6 C75-9 94-2 96 16 C80 27 66 24 58 6Z" />
          <Path d="M-5 119 C12 98 32 103 36 123 C19 134 4 132-5 119Z" />
          <Path d="M348 16 C358-4 380-4 389 14 C378 31 360 32 348 16Z" />
          <Path d="M370 49 C386 30 405 38 410 57 C394 68 380 65 370 49Z" />
          <Path d="M348 91 C363 70 385 76 390 96 C373 109 358 106 348 91Z" />
          <Path d="M-4 388 C13 368 33 373 38 392 C22 405 6 403-4 388Z" />
          <Path d="M7 424 C24 406 44 412 48 431 C31 443 16 441 7 424Z" />
          <Path d="M357 548 C373 528 394 535 398 555 C381 568 366 564 357 548Z" />
          <Path d="M375 586 C391 568 409 575 414 594 C398 607 383 603 375 586Z" />
        </G>
        <Rect x="0" y="570" width="390" height="330" fill="url(#homeWater)" />
        <Path d="M0 720 L18 684 L34 720 L53 668 L72 720 L92 680 L111 720 L132 657 L154 720 L177 676 L197 720 L219 665 L241 720 L265 681 L285 720 L307 655 L332 720 L354 674 L375 720 L397 663 L416 720 V900 H0 Z" fill={colors.sleepForest} fillOpacity={0.035} />
        <Path d="M0 790 L22 742 L42 790 L64 722 L86 790 L111 739 L133 790 L157 714 L182 790 L207 742 L230 790 L253 722 L277 790 L305 736 L327 790 L351 709 L378 790 L402 737 L420 790 V900 H0 Z" fill={colors.sleepForest} fillOpacity={0.075} />
      </Svg>
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

function WeatherAction({ weatherRecord, onPress, onUpdate }: { weatherRecord?: SleepRecord; onPress: () => void; onUpdate: () => void }) {
  const colors = useColors("light");
  const weather = weatherRecord?.weather;
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
      <Pressable accessibilityRole="button" onPress={onUpdate} style={({ pressed }) => [styles.updateButton, pressed && styles.pressed]}>
        <MaterialIcons name="refresh" size={15} color={colors.sleepBlue} />
        <Text style={[styles.updateText, { color: colors.sleepBlue }]}>{weather ? "天候を更新" : "天候を取得"}</Text>
      </Pressable>
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
