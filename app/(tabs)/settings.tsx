import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppTextInput, Card, ChoicePills, EmptyState, PageHeader, PrimaryButton, SectionLabel, ToggleRow } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { configureDailyReminder } from "@/lib/notification-service";
import { useSleepData } from "@/lib/sleep-store";
import { useThemeContext } from "@/lib/theme-provider";
import { exportRecords, pickAndReadCsv, recordsFromCsv } from "@/lib/csv-service";

type ThemeChoice = "light" | "dark";

export default function SettingsScreen() {
  const colors = useColors();
  const { records, settings, updateSettings, importRecords, removeSampleRecords, addSampleRecords, clearAllRecords, isReady } = useSleepData();
  const { colorScheme, setColorScheme } = useThemeContext();
  const [reminderTime, setReminderTime] = useState(settings.reminderTime);
  const [busy, setBusy] = useState(false);

  const saveReminder = async (enabled: boolean) => {
    if (enabled && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
      Alert.alert("時刻を確認してください", "HH:MM の24時間表記で入力してください。");
      return;
    }
    const result = await configureDailyReminder(enabled, reminderTime);
    if (result === "denied") {
      Alert.alert("通知が許可されていません", "端末の設定で Sleep Log の通知を許可すると、毎日のリマインダーを使えます。");
      return;
    }
    if (result === "error" || result === "invalid") {
      Alert.alert("通知を設定できませんでした", "端末の通知設定を確認して、もう一度試してください。");
      return;
    }
    if (result === "unsupported") {
      Alert.alert("Expo Goでは通知を使えません", "記録・履歴・分析はそのまま使えます。通知を使う場合は、EASなどで開発ビルドを作成してください。");
      return;
    }
    updateSettings({ reminderEnabled: enabled, reminderTime });
    if (result === "web" && enabled) Alert.alert("Web版では通知は利用できません", "スマートフォン版でリマインダーを設定できます。");
  };

  const doExport = async () => {
    try {
      setBusy(true);
      await exportRecords(records);
    } catch {
      Alert.alert("エクスポートできませんでした", "もう一度試してください。");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    try {
      setBusy(true);
      const text = await pickAndReadCsv();
      if (!text) return;
      const parsed = recordsFromCsv(text);
      if (!parsed.length) {
        Alert.alert("読み込める記録がありません", "Sleep Log から書き出したCSVか、必須列（日付・就寝時刻・起床時刻）を含むCSVを選んでください。");
        return;
      }
      Alert.alert("CSVを読み込みますか？", `${parsed.length}件の記録を日付ごとに追加または更新します。`, [
        { text: "キャンセル", style: "cancel" },
        { text: "読み込む", onPress: () => { const count = importRecords(parsed); Alert.alert("読み込みました", `${count}件の記録を追加・更新しました。`); } },
      ]);
    } catch {
      Alert.alert("インポートできませんでした", "CSVファイルの形式を確認してください。");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemoveSamples = () => Alert.alert("サンプルデータを削除しますか？", "自分で入力した記録は残ります。", [
    { text: "キャンセル", style: "cancel" },
    { text: "削除", style: "destructive", onPress: removeSampleRecords },
  ]);
  const confirmClear = () => Alert.alert("すべての記録を削除しますか？", "この操作は元に戻せません。CSVに書き出してから削除することをおすすめします。", [
    { text: "キャンセル", style: "cancel" },
    { text: "すべて削除", style: "destructive", onPress: clearAllRecords },
  ]);

  if (!isReady) return <ScreenContainer />;
  const hasSamples = records.some((record) => record.isSample);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="設定" subtitle="この端末内にのみ記録を保存します" />

        <SectionLabel title="通知" />
        <Card style={styles.formCard}>
          <ToggleRow icon="notifications-none" label="毎日の記録リマインダー" description={settings.reminderEnabled ? `${settings.reminderTime} に通知します` : "記録する時間を思い出す通知"} active={settings.reminderEnabled} onPress={() => void saveReminder(!settings.reminderEnabled)} />
          <View style={styles.timeField}>
            <View style={styles.timeCopy}><Text style={[styles.timeLabel, { color: colors.foreground }]}>通知時刻</Text><Text style={[styles.timeHint, { color: colors.muted }]}>例：21:30</Text></View>
            <AppTextInput value={reminderTime} onChangeText={setReminderTime} onBlur={() => { if (settings.reminderEnabled) void saveReminder(true); }} style={styles.timeInput} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </Card>

        <SectionLabel title="表示" />
        <Card style={styles.formCard}>
          <View style={styles.themeRow}><View style={styles.timeCopy}><Text style={[styles.timeLabel, { color: colors.foreground }]}>テーマ</Text><Text style={[styles.timeHint, { color: colors.muted }]}>目にやさしい表示を選べます</Text></View><MaterialIcons name={colorScheme === "dark" ? "dark-mode" : "light-mode"} size={22} color={colors.primary} /></View>
          <ChoicePills<ThemeChoice> value={colorScheme} onChange={setColorScheme} options={[{ value: "light", label: "ライト", icon: "light-mode" }, { value: "dark", label: "ダーク", icon: "dark-mode" }]} />
        </Card>

        <SectionLabel title="データ" />
        <Card style={styles.formCard}>
          <View style={styles.dataIntro}><View style={[styles.dataIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name="lock-outline" size={21} color={colors.primary} /></View><View style={styles.timeCopy}><Text style={[styles.timeLabel, { color: colors.foreground }]}>端末内に保存</Text><Text style={[styles.timeHint, { color: colors.muted }]}>アカウント登録なし。CSVで控えを作れます。</Text></View></View>
          <PrimaryButton label={busy ? "処理中…" : "CSVを書き出す"} icon="file-download" disabled={busy || records.length === 0} onPress={() => void doExport()} />
          <PrimaryButton label={busy ? "処理中…" : "CSVを読み込む"} icon="file-upload" secondary disabled={busy} onPress={() => void doImport()} />
        </Card>

        <SectionLabel title="サンプルデータ" />
        <Card style={styles.formCard}>
          <Text style={[styles.sampleText, { color: colors.muted }]}>グラフの見え方を確認できるサンプルが {records.filter((record) => record.isSample).length} 件あります。自分の記録と区別して表示されます。</Text>
          {hasSamples ? <PrimaryButton label="サンプルを全削除" icon="delete-outline" secondary onPress={confirmRemoveSamples} /> : <PrimaryButton label="サンプルを追加" icon="add" secondary onPress={addSampleRecords} />}
        </Card>

        <SectionLabel title="危険な操作" />
        <Card style={styles.dangerCard}>
          <View style={styles.dataIntro}><View style={[styles.dataIcon, { backgroundColor: `${colors.error}16` }]}><MaterialIcons name="delete-forever" size={21} color={colors.error} /></View><View style={styles.timeCopy}><Text style={[styles.timeLabel, { color: colors.foreground }]}>すべての記録を削除</Text><Text style={[styles.timeHint, { color: colors.muted }]}>先にCSVへ書き出しておくと安心です。</Text></View></View>
          <PrimaryButton label="全記録を削除" icon="delete-forever" secondary onPress={confirmClear} />
        </Card>

        <View style={[styles.disclaimer, { backgroundColor: `${colors.muted}12` }]}><MaterialIcons name="info-outline" size={17} color={colors.muted} /><Text style={[styles.disclaimerText, { color: colors.muted }]}>Sleep Log は生活記録・傾向把握のためのアプリです。医学的な診断や治療の判断には使用しません。</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 11 },
  formCard: { gap: 13 },
  timeField: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 2 },
  timeCopy: { flex: 1, gap: 2 },
  timeLabel: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  timeHint: { fontSize: 12, lineHeight: 17 },
  timeInput: { width: 100, textAlign: "center", fontWeight: "800" },
  themeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dataIntro: { flexDirection: "row", alignItems: "center", gap: 11 },
  dataIcon: { width: 41, height: 41, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sampleText: { fontSize: 13, lineHeight: 20 },
  dangerCard: { gap: 13, borderColor: "#F1D7D7" },
  disclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 13, borderRadius: 14 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
