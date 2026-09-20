import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Card, PageHeader, PrimaryButton } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

/**
 * Entry point for advanced analysis. The detailed tools remain in their
 * existing analysis screens until the dedicated advanced-analysis work is
 * approved and implemented.
 */
export default function AdvancedAnalysisScreen() {
  const colors = useColors();

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        <PageHeader title="高度な分析" subtitle="複数項目を組み合わせて確認する画面" action={<PrimaryButton label="メニュー" secondary onPress={() => router.back()} />} />

        <Card style={styles.card}>
          <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}>
            <MaterialIcons name="analytics" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>高度な分析トップ（準備中）</Text>
          <Text style={[styles.body, { color: colors.muted }]}>関連分析・データ品質・参考指標をまとめる専用画面は、次の作業単位で実装します。</Text>
          <Text style={[styles.note, { color: colors.muted }]}>現在の分析結果や保存データは変更していません。</Text>
        </Card>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28, gap: 14 },
  card: { alignItems: "center", paddingHorizontal: 18, paddingVertical: 24, gap: 12 },
  icon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 19, lineHeight: 26, fontWeight: "900", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  note: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
