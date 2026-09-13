export const themeColors: {
  primary: { light: string; dark: string };
  background: { light: string; dark: string };
  surface: { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  border: { light: string; dark: string };
  success: { light: string; dark: string };
  warning: { light: string; dark: string };
  error: { light: string; dark: string };
  workout: { light: string; dark: string };
  workoutDark: { light: string; dark: string };
  workoutMetal: { light: string; dark: string };
  workoutHot: { light: string; dark: string };
  workoutGold: { light: string; dark: string };
  sleepHomeBackground: { light: string; dark: string };
  sleepHomeSurface: { light: string; dark: string };
  sleepHomeForeground: { light: string; dark: string };
  sleepHomeMuted: { light: string; dark: string };
  sleepHomeBorder: { light: string; dark: string };
  sleepForest: { light: string; dark: string };
  sleepSky: { light: string; dark: string };
  sleepTeal: { light: string; dark: string };
  sleepBlue: { light: string; dark: string };
  sleepHeadache: { light: string; dark: string };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
};

export default themeConfig;
