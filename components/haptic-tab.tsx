import * as Haptics from "expo-haptics";
import type { BottomTabBarButtonProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import { Pressable, type PressableProps } from "react-native";

export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPressIn, ...pressableProps } = props;
  return (
    <Pressable
      {...(pressableProps as unknown as PressableProps)}
      onPressIn={(event) => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(event);
      }}
    />
  );
}
