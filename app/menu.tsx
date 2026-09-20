import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { type ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PageHeader, PrimaryButton } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { todayKey } from "@/lib/sleep-utils";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

const MENU_ITEMS: { label: string; detail: string; icon: IconName; route: "/headache-event" | "/history" | "/analysis" | "/advanced-analysis" | "/settings" }[] = [
  { label: "頭痛イベント", detail: "発生時刻・強さ・その時点の天候を記録", icon: "healing", route: "/headache-event" },
  { label: "過去の記録・履歴", detail: "日付ごとの記録を確認・編集", icon: "calendar-month", route: "/history" },
  { label: "詳細分析", detail: "睡眠・体調・頭痛・環境を確認", icon: "insights", route: "/analysis" },
  { label: "高度な分析", detail: "関連分析・データ品質・参考指標（準備中）", icon: "analytics", route: "/advanced-analysis" },
  { label: "設定", detail: "バックアップ・復元・表示設定", icon: "settings", route: "/settings" },
];

export default function MenuScreen() {
  const colors = useColors();
  const today = todayKey();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="メニュー" subtitle="使いたい機能を選んでください" action={<PrimaryButton label="閉じる" secondary onPress={() => router.back()} />} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/record", params: { date: today } })}
          style={({ pressed }) => [styles.recordItem, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          <View style={[styles.primaryIcon, { backgroundColor: `${colors.surface}24` }]}>
            <MaterialIcons name="edit-note" size={30} color={colors.surface} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.primaryLabel, { color: colors.surface }]}>記録する</Text>
            <Text style={[styles.primaryDetail, { color: colors.surface }]}>睡眠・昼寝・眠気・疲労など</Text>
          </View>
          <MaterialIcons name="chevron-right" size={27} color={colors.surface} />
        </Pressable>

        <View style={styles.items}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.route}
              accessibilityRole="button"
              onPress={() => router.push(item.route as never)}
              style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            >
              <View style={[styles.icon, { backgroundColor: `${colors.primary}13` }]}>
                <MaterialIcons name={item.icon} size={25} color={colors.primary} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={25} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <PrimaryButton label="ホームへ戻る" icon="home" secondary onPress={() => router.replace("/")} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28, gap: 14 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  recordItem: { minHeight: 92, borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  primaryIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontSize: 20, lineHeight: 26, fontWeight: "900" },
  primaryDetail: { fontSize: 12, lineHeight: 18, opacity: 0.9 },
  items: { gap: 9 },
  item: { minHeight: 78, borderWidth: 1, borderRadius: 19, paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  detail: { fontSize: 11, lineHeight: 17 },
});
