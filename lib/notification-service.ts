type NotificationsModule = typeof import("expo-notifications");

export async function configureDailyReminder(enabled: boolean, time: string): Promise<string> {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "invalid";

  try {
    // Expo Go for Android does not include expo-notifications. Keep this import lazy
    // so the rest of Sleep Log remains usable in Expo Go; native builds can use it.
    const Notifications = (await import("expo-notifications")) as NotificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    if (process.env.EXPO_OS === "android") {
      await Notifications.setNotificationChannelAsync("sleep-log", {
        name: "Sleep Log リマインダー",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 180],
        lightColor: "#5B63D9",
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return "off";
    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";
    await Notifications.scheduleNotificationAsync({
      content: { title: "Sleep Log", body: "今日の睡眠と体調を記録しておこう。", data: { url: "/record" } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
        ...(process.env.EXPO_OS === "android" ? { channelId: "sleep-log" } : {}),
      },
    });
    return "scheduled";
  } catch {
    return "unsupported";
  }
}
