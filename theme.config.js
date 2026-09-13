/** @type {const} */
const themeColors = {
  primary: { light: "#5B63D9", dark: "#A5ACFF" },
  background: { light: "#F7F8FC", dark: "#10121B" },
  surface: { light: "#FFFFFF", dark: "#1B2030" },
  foreground: { light: "#1E2433", dark: "#F0F2FF" },
  muted: { light: "#667085", dark: "#A7AFC4" },
  border: { light: "#E3E7F1", dark: "#31394D" },
  success: { light: "#16806B", dark: "#54D5B5" },
  warning: { light: "#B66911", dark: "#FFC46D" },
  error: { light: "#C6455B", dark: "#FF94A6" },
  workout: { light: "#D82032", dark: "#FF4054" },
  workoutDark: { light: "#090A0D", dark: "#050609" },
  workoutMetal: { light: "#181B21", dark: "#11141A" },
  workoutHot: { light: "#FF5A1F", dark: "#FF7138" },
  workoutGold: { light: "#FFB020", dark: "#FFD166" },
  // The Sleep Log home is intentionally a daylight forest scene in both app
  // schemes. Other screens continue to follow the selected light/dark theme.
  sleepHomeBackground: { light: "#F4F9F7", dark: "#F4F9F7" },
  sleepHomeSurface: { light: "#FFFFFF", dark: "#FFFFFF" },
  sleepHomeForeground: { light: "#0D2943", dark: "#0D2943" },
  sleepHomeMuted: { light: "#667984", dark: "#667984" },
  sleepHomeBorder: { light: "#D4E4DE", dark: "#D4E4DE" },
  sleepForest: { light: "#1E7657", dark: "#1E7657" },
  sleepSky: { light: "#75C5E5", dark: "#75C5E5" },
  sleepTeal: { light: "#268E80", dark: "#268E80" },
  sleepBlue: { light: "#2878C9", dark: "#2878C9" },
  sleepHeadache: { light: "#DF3C66", dark: "#DF3C66" },
};

module.exports = { themeColors };
