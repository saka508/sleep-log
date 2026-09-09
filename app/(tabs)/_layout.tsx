import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 1 },
        tabBarStyle: {
          paddingTop: 7,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.75,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "今日", tabBarIcon: ({ color }) => <IconSymbol size={23} name="moon.stars.fill" color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: "履歴", tabBarIcon: ({ color }) => <IconSymbol size={23} name="calendar" color={color} /> }} />
      <Tabs.Screen name="analysis" options={{ title: "分析", tabBarIcon: ({ color }) => <IconSymbol size={23} name="chart.xyaxis.line" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "設定", tabBarIcon: ({ color }) => <IconSymbol size={23} name="gearshape.fill" color={color} /> }} />
    </Tabs>
  );
}
