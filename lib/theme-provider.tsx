import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

const THEME_KEY = "sleep-log.theme";

/** What the user picked. "system" follows the device, the others pin it. */
export type ThemePreference = "system" | ColorScheme;

type ThemeContextValue = {
  /** The scheme actually in effect, after resolving "system". */
  colorScheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() === "dark" ? "dark" : "light";
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const colorScheme: ColorScheme = preference === "system" ? systemScheme : preference;

  const applyScheme = useCallback((scheme: ColorScheme) => {
    // Always hand NativeWind the resolved scheme, never "system". NativeWind
    // turns "system" into Appearance.setColorScheme(null), and RN 0.86 passes
    // that straight to AppearanceModule.setColorScheme(style: String), whose
    // parameter is non-null in Kotlin — an instant NPE on the native modules
    // thread. Since "system" is the default preference, that crashed the app on
    // first launch.
    //
    // Nothing calls Appearance.setColorScheme either: this context is the
    // source of truth for the app's colours, and overriding RN's Appearance
    // would make useSystemColorScheme report the pinned value, which is exactly
    // the signal we need to keep following the device.
    nativewindColorScheme.set(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => root.style.setProperty(`--color-${token}`, value));
    }
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (isPreference(saved)) setPreferenceState(saved);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({ colorScheme, preference, setPreference }),
    [colorScheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}><View style={[{ flex: 1 }, themeVariables]}>{children}</View></ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
