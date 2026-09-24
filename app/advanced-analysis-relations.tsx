import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PageHeader, PrimaryButton } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { analyzeRelation, type RelationKey } from "@/lib/condition-analysis";
import { useSleepData } from "@/lib/sleep-store";

const RELATION_KEYS: RelationKey[] = [
  "sleepSleepiness",
  "sleepClarity",
  "napSleep",
  "pressureHeadache",
  "pressureChangeHeadache",
  "caffeineTimeSleep",
  "caffeineTimeSleepiness",
];

export default function AdvancedAnalysisRelationsScreen() {
  const colors = useColors();
  const { records, isReady } = useSleepData();
  if (!isReady) return <ScreenContainer />;
  const relations = RELATION_KEYS.map((key) => analyzeRelation(records, key));

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="関連分析" subtitle="複数の本人記録を同じ日付で照合" action={<PrimaryButton label="高度な分析" secondary onPress={() => router.back()} />} />
        <Text style={[styles.intro, { color: colors.muted }]}>相関は関連の目安です。原因・診断・予測を示すものではありません。</Text>
        {relations.map((relation) => {
          const ready = relation.status === "ready" && relation.coefficient !== null;
          const detail = ready
            ? `Pearson r ${relation.coefficient! >= 0 ? "+" : ""}${relation.coefficient!.toFixed(2)} ・ ${relation.pairedCount}組`
            : relation.status === "constant"
              ? `${relation.pairedCount}組ありますが、値のばらつきがないため算出できません`
              : `比較できた組は ${relation.pairedCount} / 5 組です`;
          return <Pressable key={relation.key} accessibilityRole="button" accessibilityLabel={`${relation.label}の詳細を開く`} onPress={() => router.push({ pathname: "/advanced-analysis-relation", params: { key: relation.key } } as never)} style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
            <View style={[styles.icon, { backgroundColor: `${colors.primary}18` }]}><MaterialIcons name="insights" size={22} color={colors.primary} /></View>
            <View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{relation.label}</Text><Text style={[styles.detail, { color: ready ? colors.primary : colors.muted }]}>{detail}</Text>{relation.excludedLegacySleepRecords ? <Text style={[styles.meta, { color: colors.muted }]}>旧定義の睡眠時間 {relation.excludedLegacySleepRecords} 件を除外</Text> : null}</View>
            <MaterialIcons name="chevron-right" size={25} color={colors.muted} />
          </Pressable>;
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24, gap: 9 },
  intro: { fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
  row: { minHeight: 78, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  detail: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  meta: { fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
