import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { weatherVisualTypeFromCode } from "@/lib/weather-visual";

const RAIN_STREAKS = [
  { left: "8%", top: "30%", height: 24, rotate: "18deg" },
  { left: "24%", top: "43%", height: 18, rotate: "18deg" },
  { left: "40%", top: "28%", height: 28, rotate: "18deg" },
  { left: "57%", top: "48%", height: 20, rotate: "18deg" },
  { left: "74%", top: "31%", height: 26, rotate: "18deg" },
  { left: "88%", top: "49%", height: 17, rotate: "18deg" },
  { left: "15%", top: "65%", height: 18, rotate: "18deg" },
  { left: "48%", top: "69%", height: 20, rotate: "18deg" },
  { left: "79%", top: "66%", height: 17, rotate: "18deg" },
] as const;

const SNOW_FLAKES = [
  { left: "11%", top: "27%", size: 4 },
  { left: "29%", top: "45%", size: 3 },
  { left: "47%", top: "22%", size: 5 },
  { left: "65%", top: "53%", size: 3 },
  { left: "81%", top: "33%", size: 4 },
  { left: "19%", top: "70%", size: 3 },
  { left: "54%", top: "72%", size: 4 },
  { left: "87%", top: "68%", size: 3 },
] as const;

export function WeatherCircleScene({ weatherCode }: { weatherCode?: number }) {
  const colors = useColors("light");
  const visualType = weatherVisualTypeFromCode(weatherCode);
  const isWet = visualType === "drizzle" || visualType === "rain" || visualType === "thunderstorm";

  return (
    <View pointerEvents="none" style={styles.scene}>
      <Image
        source={require("../assets/images/weather-forest-circle-v1.png")}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={styles.baseImage}
      />

      {visualType === "partlyCloudy" ? <CloudCover color={`${colors.sleepHomeSurface}2C`} /> : null}
      {visualType === "cloudy" ? <CloudCover color={`${colors.sleepHomeMuted}4A`} /> : null}
      {visualType === "drizzle" ? <CloudCover color={`${colors.sleepHomeMuted}5A`} /> : null}
      {visualType === "rain" ? <CloudCover color={`${colors.sleepHomeForeground}57`} /> : null}
      {visualType === "thunderstorm" ? <CloudCover color={`${colors.sleepHomeForeground}82`} /> : null}

      {visualType === "cloudy" || visualType === "drizzle" ? (
        <View style={[styles.tint, { backgroundColor: `${colors.sleepHomeMuted}16` }]} />
      ) : null}
      {visualType === "rain" ? <View style={[styles.tint, { backgroundColor: `${colors.sleepHomeForeground}24` }]} /> : null}
      {visualType === "thunderstorm" ? <View style={[styles.tint, { backgroundColor: `${colors.sleepHomeForeground}40` }]} /> : null}
      {visualType === "snow" ? <View style={[styles.tint, { backgroundColor: `${colors.sleepSky}30` }]} /> : null}

      {visualType === "fog" ? <FogLayer /> : null}
      {isWet ? <RainLayer color={`${colors.sleepHomeSurface}${visualType === "drizzle" ? "72" : "A6"}`} /> : null}
      {visualType === "snow" ? <SnowLayer color={`${colors.sleepHomeSurface}D6`} /> : null}
      {visualType === "thunderstorm" ? (
        <MaterialIcons name="bolt" size={28} color={`${colors.sleepHomeSurface}B8`} style={styles.lightning} />
      ) : null}
    </View>
  );
}

function CloudCover({ color }: { color: string }) {
  return (
    <View style={styles.cloudCover}>
      <View style={[styles.cloudOne, { backgroundColor: color }]} />
      <View style={[styles.cloudTwo, { backgroundColor: color }]} />
      <View style={[styles.cloudThree, { backgroundColor: color }]} />
    </View>
  );
}

function FogLayer() {
  const colors = useColors("light");
  return (
    <View style={styles.fogLayer}>
      <View style={[styles.fogBand, styles.fogBandTop, { backgroundColor: `${colors.sleepHomeSurface}7A` }]} />
      <View style={[styles.fogBand, styles.fogBandMiddle, { backgroundColor: `${colors.sleepHomeSurface}96` }]} />
      <View style={[styles.fogBand, styles.fogBandBottom, { backgroundColor: `${colors.sleepHomeSurface}78` }]} />
    </View>
  );
}

function RainLayer({ color }: { color: string }) {
  return (
    <View style={styles.particleLayer}>
      {RAIN_STREAKS.map((streak) => (
        <View
          key={`${streak.left}-${streak.top}`}
          style={[
            styles.rainStreak,
            { left: streak.left, top: streak.top, height: streak.height, backgroundColor: color, transform: [{ rotate: streak.rotate }] },
          ]}
        />
      ))}
    </View>
  );
}

function SnowLayer({ color }: { color: string }) {
  return (
    <View style={styles.particleLayer}>
      {SNOW_FLAKES.map((flake) => (
        <View
          key={`${flake.left}-${flake.top}`}
          style={[
            styles.snowFlake,
            { left: flake.left, top: flake.top, width: flake.size, height: flake.size, borderRadius: flake.size, backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  baseImage: { width: "100%", height: "100%" },
  tint: { ...StyleSheet.absoluteFill },
  cloudCover: { ...StyleSheet.absoluteFill },
  cloudOne: { position: "absolute", top: -32, left: -24, width: 112, height: 70, borderRadius: 60 },
  cloudTwo: { position: "absolute", top: -41, right: -24, width: 136, height: 78, borderRadius: 70 },
  cloudThree: { position: "absolute", top: 20, left: 44, width: 92, height: 36, borderRadius: 45 },
  fogLayer: { ...StyleSheet.absoluteFill },
  fogBand: { position: "absolute", width: "128%", left: "-14%", borderRadius: 99 },
  fogBandTop: { top: "29%", height: 21 },
  fogBandMiddle: { top: "47%", height: 26 },
  fogBandBottom: { top: "66%", height: 20 },
  particleLayer: { ...StyleSheet.absoluteFill },
  rainStreak: { position: "absolute", width: 1.5, borderRadius: 4 },
  snowFlake: { position: "absolute" },
  lightning: { position: "absolute", right: 13, top: 24, transform: [{ rotate: "14deg" }] },
});
