import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, ChoicePills, PageHeader, PrimaryButton } from "@/components/sleep-ui";
import { ScreenContainer } from "@/components/screen-container";
import {
  analyzeSleepConditionComparison,
  type CrossAnalysisOutcome,
  type CrossAnalysisQuery,
  type SleepMinutesCondition,
  type SleepMinutesOperator,
} from "@/lib/cross-analysis";
import {
  durationMinutesFromParts,
  durationPartsFromMinutes,
  formatDurationParts,
  MAX_DURATION_HOURS,
  MAX_DURATION_MINUTES,
} from "@/lib/duration-picker";
import { useSleepData } from "@/lib/sleep-store";
import { formatShortDate, type SleepRecord } from "@/lib/sleep-utils";
import { useColors } from "@/hooks/use-colors";

const OUTCOMES: { value: CrossAnalysisOutcome; label: string }[] = [
  { value: "sleepiness", label: "眠気" },
  { value: "fatigue", label: "疲労" },
  { value: "clarity", label: "冴え" },
  { value: "dailyHeadache", label: "頭痛" },
];

const OPERATORS: { value: SleepMinutesOperator; label: string }[] = [
  { value: "lt", label: "未満" },
  { value: "lte", label: "以下" },
  { value: "gt", label: "超" },
  { value: "gte", label: "以上" },
];

const OPERATOR_WORDS: Record<SleepMinutesOperator, string> = {
  lt: "未満",
  lte: "以下",
  gt: "超",
  gte: "以上",
  eq: "と同じ",
  between: "の範囲",
};

function defaultCondition(id = "sleep-1"): SleepMinutesCondition {
  // There is no approved threshold for "short sleep". Require a deliberate value.
  return { id, field: "sleepMinutes", operator: "lt", value: Number.NaN };
}

function periodFor(records: SleepRecord[]) {
  const dates = records.filter((record) => !record.isSample).map((record) => record.date).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  return dates.length ? { startDate: dates[0], endDate: dates.at(-1)! } : { startDate: "2000-01-01", endDate: "2099-12-31" };
}

function defaultQuery(records: SleepRecord[]): CrossAnalysisQuery {
  return {
    period: periodFor(records),
    conditions: [defaultCondition()],
    conditionMatch: "all",
    outcome: "sleepiness",
    alignment: "sameRecord",
  };
}

function queryKey(query: CrossAnalysisQuery) {
  return JSON.stringify(query);
}

function formatScore(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} / 10`;
}

function formatDifference(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} ポイント`;
}

function exclusionSummary(exclusions: ReturnType<typeof analyzeSleepConditionComparison>["exclusions"]) {
  const labels = [
    exclusions.sampleRecords ? `サンプル ${exclusions.sampleRecords}件` : null,
    exclusions.legacySleepDuration ? `旧定義の睡眠時間 ${exclusions.legacySleepDuration}件` : null,
    exclusions.outsidePeriod ? `期間外 ${exclusions.outsidePeriod}件` : null,
    exclusions.invalidSleepMinutes ? `睡眠時間不正 ${exclusions.invalidSleepMinutes}件` : null,
    exclusions.missingOutcome ? `結果未記録 ${exclusions.missingOutcome}件` : null,
  ].filter((value): value is string => value !== null);
  return labels.length ? labels.join("・") : "除外なし";
}

function describeConditions(conditions: SleepMinutesCondition[]) {
  if (!conditions.length) return "条件なし";
  return conditions.map((condition) => {
    if (!Number.isFinite(condition.value)) return "睡眠時間の値が未入力";
    if (condition.operator === "between") {
      return Number.isFinite(condition.upperValue)
        ? `睡眠時間 ${condition.value}〜${condition.upperValue}分`
        : "睡眠時間の範囲が未入力";
    }
    const parts = durationPartsFromMinutes(condition.value);
    const displayValue = parts ? formatDurationParts(parts) : `${condition.value}分`;
    return `睡眠時間 ${displayValue}${OPERATOR_WORDS[condition.operator]}`;
  }).join(" かつ ");
}

export default function AdvancedAnalysisConditionsScreen() {
  const colors = useColors();
  const { records, isReady } = useSleepData();
  const initialized = useRef(false);
  const nextConditionId = useRef(2);
  const [draft, setDraft] = useState<CrossAnalysisQuery>(() => defaultQuery([]));
  const [applied, setApplied] = useState<CrossAnalysisQuery>(() => defaultQuery([]));

  useEffect(() => {
    if (!isReady || initialized.current) return;
    const query = defaultQuery(records);
    setDraft(query);
    setApplied(query);
    initialized.current = true;
  }, [isReady, records]);

  const dirty = queryKey(draft) !== queryKey(applied);
  const result = useMemo(() => analyzeSleepConditionComparison(records, applied), [records, applied]);
  const outcome = OUTCOMES.find((item) => item.value === applied.outcome) ?? OUTCOMES[0];

  const updateCondition = (id: string, patch: Partial<SleepMinutesCondition>) => {
    setDraft((current) => ({ ...current, conditions: current.conditions.map((condition) => condition.id === id ? { ...condition, ...patch } : condition) }));
  };
  const addCondition = () => {
    const id = `sleep-${nextConditionId.current++}`;
    setDraft((current) => ({ ...current, conditions: [...current.conditions, defaultCondition(id)] }));
  };
  const removeCondition = (id: string) => {
    setDraft((current) => ({ ...current, conditions: current.conditions.filter((condition) => condition.id !== id) }));
  };

  if (!isReady) return <ScreenContainer />;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          title="条件分析"
          subtitle="保存済みの本人記録を比較"
          action={<PrimaryButton label="高度な分析" secondary onPress={() => router.back()} />}
        />

        <Card style={styles.conditionCard}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>調べる条件</Text>
          <Text style={[styles.cardHint, { color: colors.muted }]}>複数条件を追加した場合は、すべて満たす記録を条件内にします。</Text>

          {draft.conditions.map((condition, index) => (
            <View key={condition.id} style={[styles.conditionRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
              <View style={styles.conditionHeading}>
                <Text style={[styles.conditionLabel, { color: colors.foreground }]}>睡眠時間</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`条件 ${index + 1} を削除`} onPress={() => removeCondition(condition.id)} hitSlop={8}>
                  <Text style={[styles.removeText, { color: colors.error }]}>削除</Text>
                </Pressable>
              </View>
              <View style={styles.operatorRow}>
                {OPERATORS.map((operator) => {
                  const selected = condition.operator === operator.value;
                  return (
                    <Pressable
                      key={operator.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => updateCondition(condition.id, { operator: operator.value })}
                      style={({ pressed }) => [styles.operator, { backgroundColor: selected ? `${colors.primary}18` : colors.background, borderColor: selected ? colors.primary : colors.border }, pressed && styles.pressed]}
                    >
                      <Text style={[styles.operatorText, { color: selected ? colors.primary : colors.muted }]}>{operator.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <SleepDurationWheel
                key={`${condition.id}-${String(condition.value)}`}
                value={condition.value}
                onConfirm={(value) => updateCondition(condition.id, { value })}
                conditionIndex={index}
              />
            </View>
          ))}

          <Pressable accessibilityRole="button" accessibilityLabel="睡眠時間の条件を追加" onPress={addCondition} style={({ pressed }) => [styles.addButton, { borderColor: colors.primary }, pressed && styles.pressed]}>
            <Text style={[styles.addSymbol, { color: colors.primary }]}>＋</Text>
            <Text style={[styles.addText, { color: colors.primary }]}>条件を追加</Text>
          </Pressable>

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>比較する項目</Text>
          <ChoicePills
            value={draft.outcome}
            onChange={(outcome) => setDraft((current) => ({ ...current, outcome }))}
            options={OUTCOMES}
          />
          <Text style={[styles.cardHint, { color: colors.muted }]}>日時対応は同じ日次記録のみです。翌日対応は、記録日の意味が未確定なため利用できません。比較対象は同じ期間の条件外かつ結果項目が記録された本人記録です。</Text>
          <PrimaryButton label="この条件で再分析" onPress={() => setApplied(draft)} />
        </Card>

        {dirty ? (
          <Card style={[styles.changedCard, { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}45` }]}>
          <Text style={[styles.statusSymbol, { color: colors.warning }]}>!</Text>
            <View style={styles.changedCopy}>
              <Text style={[styles.changedTitle, { color: colors.foreground }]}>条件が変更されています</Text>
              <Text style={[styles.changedBody, { color: colors.muted }]}>前回の結果は表示していません。「この条件で再分析」を押すと、保存済み記録から再計算します。</Text>
            </View>
          </Card>
        ) : (
          <AnalysisResult result={result} outcomeLabel={outcome.label} conditionText={describeConditions(applied.conditions)} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const WHEEL_ITEM_HEIGHT = 42;

function SleepDurationWheel({
  value,
  onConfirm,
  conditionIndex,
}: {
  value: number;
  onConfirm: (value: number) => void;
  conditionIndex: number;
}) {
  const colors = useColors();
  const initialParts = Number.isInteger(value) && value >= 0 ? durationPartsFromMinutes(value) : null;
  const initialHours = initialParts?.hours ?? 0;
  const initialMinutes = initialParts?.minutes ?? 0;
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [status, setStatus] = useState("");
  const hoursWheelRef = useRef<ScrollView>(null);
  const minutesWheelRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      hoursWheelRef.current?.scrollTo({ y: initialHours * WHEEL_ITEM_HEIGHT, animated: false });
      minutesWheelRef.current?.scrollTo({ y: initialMinutes * WHEEL_ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [initialHours, initialMinutes]);

  const maxMinutes = hours === MAX_DURATION_HOURS ? 0 : MAX_DURATION_MINUTES;
  const commit = () => {
    const total = durationMinutesFromParts(hours, minutes);
    if (total === null) {
      setStatus("選択範囲を確認してください。");
      return;
    }
    onConfirm(total);
    setStatus("条件に反映しました。再分析ボタンで結果を更新します。");
  };
  const cancel = () => {
    const parts = Number.isInteger(value) && value >= 0 ? durationPartsFromMinutes(value) : null;
    setHours(parts?.hours ?? 0);
    setMinutes(parts?.minutes ?? 0);
    setStatus("キャンセルしました。条件は変更していません。");
  };
  const selectHours = (next: number) => {
    const clamped = Math.max(0, Math.min(MAX_DURATION_HOURS, next));
    setHours(clamped);
    if (clamped === MAX_DURATION_HOURS) {
      setMinutes(0);
      minutesWheelRef.current?.scrollTo({ y: 0, animated: true });
    }
    hoursWheelRef.current?.scrollTo({ y: clamped * WHEEL_ITEM_HEIGHT, animated: true });
  };
  const selectMinutes = (next: number) => {
    const clamped = Math.max(0, Math.min(maxMinutes, next));
    setMinutes(clamped);
    minutesWheelRef.current?.scrollTo({ y: clamped * WHEEL_ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={styles.durationPicker}>
      <View style={styles.durationSummary}>
        <Text style={[styles.durationSummaryLabel, { color: colors.muted }]}>選択中</Text>
        <Text style={[styles.durationSummaryValue, { color: colors.foreground }]} accessibilityLiveRegion="polite">{formatDurationParts({ hours, minutes })}</Text>
        <Text style={[styles.durationSummaryHint, { color: colors.muted }]}>確定時のみ分析条件へ反映</Text>
      </View>
      <View style={styles.wheelRow}>
        <DurationWheelColumn
          label="時間"
          value={hours}
          max={MAX_DURATION_HOURS}
          unit="時間"
          scrollRef={hoursWheelRef}
          conditionIndex={conditionIndex}
          onChange={selectHours}
        />
        <DurationWheelColumn
          label="分"
          value={minutes}
          max={maxMinutes}
          unit="分"
          scrollRef={minutesWheelRef}
          conditionIndex={conditionIndex}
          onChange={selectMinutes}
        />
      </View>
      <Text style={[styles.wheelHint, { color: colors.muted }]}>上下にスワイプして中央の値を選択。0〜24時間、0〜59分（24時間時は0分のみ）</Text>
      <View style={styles.durationActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`条件 ${conditionIndex + 1} の睡眠時間をキャンセル`} onPress={cancel} style={({ pressed }) => [styles.durationCancel, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}>
          <Text style={[styles.durationActionText, { color: colors.muted }]}>キャンセル</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`条件 ${conditionIndex + 1} の睡眠時間を確定`} onPress={commit} style={({ pressed }) => [styles.durationConfirm, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          <Text style={[styles.durationActionText, { color: colors.background }]}>この値を確定</Text>
        </Pressable>
      </View>
      {status ? <Text style={[styles.durationStatus, { color: colors.muted }]} accessibilityLiveRegion="polite">{status}</Text> : null}
    </View>
  );
}

function DurationWheelColumn({
  label,
  value,
  max,
  unit,
  scrollRef,
  conditionIndex,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  scrollRef: RefObject<ScrollView | null>;
  conditionIndex: number;
  onChange: (value: number) => void;
}) {
  const colors = useColors();
  const values = Array.from({ length: max + 1 }, (_, index) => index);
  const offsetRef = useRef(0);
  const momentumRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const momentumResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    if (momentumResetTimerRef.current) clearTimeout(momentumResetTimerRef.current);
  }, []);

  const clearSettleTimer = () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  };
  const settleToNearest = () => {
    if (momentumRef.current) return;
    const next = Math.max(0, Math.min(max, Math.round(offsetRef.current / WHEEL_ITEM_HEIGHT)));
    const targetOffset = next * WHEEL_ITEM_HEIGHT;
    if (Math.abs(offsetRef.current - targetOffset) > 0.5) {
      scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => {
        offsetRef.current = targetOffset;
        onChange(next);
      }, 180);
      return;
    }
    onChange(next);
  };
  const scheduleSettle = () => {
    clearSettleTimer();
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      settleToNearest();
    }, 180);
  };
  return (
    <View style={styles.wheelColumn}>
      <Text style={[styles.wheelColumnLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[styles.wheelViewport, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.wheelScroll}
          contentContainerStyle={styles.wheelContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          scrollEventThrottle={16}
          snapToInterval={WHEEL_ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onScrollBeginDrag={() => {
            momentumRef.current = false;
            clearSettleTimer();
            if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
          }}
          onScroll={(event) => {
            offsetRef.current = event.nativeEvent.contentOffset.y;
            // Web scroll containers do not reliably emit the native drag-end
            // callbacks. Debouncing every scroll event also covers wheel and
            // touch scrolling while momentum-end remains authoritative on
            // native platforms.
            if (momentumRef.current) {
              if (momentumResetTimerRef.current) clearTimeout(momentumResetTimerRef.current);
              momentumResetTimerRef.current = setTimeout(() => {
                momentumResetTimerRef.current = null;
                momentumRef.current = false;
                scheduleSettle();
              }, 220);
            }
            scheduleSettle();
          }}
          onScrollEndDrag={() => {
            scheduleSettle();
          }}
          onMomentumScrollBegin={() => {
            momentumRef.current = true;
            clearSettleTimer();
            if (momentumResetTimerRef.current) clearTimeout(momentumResetTimerRef.current);
          }}
          onMomentumScrollEnd={(event) => {
            momentumRef.current = false;
            if (momentumResetTimerRef.current) clearTimeout(momentumResetTimerRef.current);
            momentumResetTimerRef.current = null;
            offsetRef.current = event.nativeEvent.contentOffset.y;
            clearSettleTimer();
            settleToNearest();
          }}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max, now: value, text: `${value}${unit}` }}
          accessibilityLabel={`条件 ${conditionIndex + 1} の${label}ホイール`}
        >
          {values.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: item === value }}
              accessibilityLabel={`${item}${unit}`}
              onPress={() => onChange(item)}
              style={styles.wheelItem}
            >
              <Text style={[styles.wheelItemText, { color: item === value ? colors.foreground : colors.muted, fontWeight: item === value ? "900" : "600" }]}>{item}{unit}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View pointerEvents="none" style={[styles.selectionFrame, { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]} />
      </View>
    </View>
  );
}

function AnalysisResult({ result, outcomeLabel, conditionText }: { result: ReturnType<typeof analyzeSleepConditionComparison>; outcomeLabel: string; conditionText: string }) {
  const colors = useColors();
  const ready = result.status === "ready";
  const maximum = 10;
  const matchedHeight: `${number}%` = result.groups.matched.average === null ? "0%" : `${Math.max(4, result.groups.matched.average / maximum * 100)}%`;
  const comparisonHeight: `${number}%` = result.groups.comparison.average === null ? "0%" : `${Math.max(4, result.groups.comparison.average / maximum * 100)}%`;

  return (
    <View style={styles.resultStack}>
      <Card style={[styles.resultCard, { borderLeftColor: colors.primary }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>結果</Text>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{outcomeLabel}の比較</Text>
        {ready ? (
          <>
            <View style={styles.summaryGrid}>
              <SummaryBox label="条件内" count={result.groups.matched.count} value={formatScore(result.groups.matched.average)} />
              <SummaryBox label="条件外" count={result.groups.comparison.count} value={formatScore(result.groups.comparison.average)} />
            </View>
            <View style={[styles.differenceRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.differenceLabel, { color: colors.muted }]}>平均値の差（条件内 − 条件外）</Text>
              <Text style={[styles.differenceValue, { color: colors.primary }]}>{formatDifference(result.averageDifference)}</Text>
            </View>
            <Text style={[styles.resultNote, { color: colors.muted }]}>中央値：条件内 {formatScore(result.groups.matched.median)} ／ 条件外 {formatScore(result.groups.comparison.median)}</Text>
          </>
        ) : (
          <View style={[styles.emptyResult, { backgroundColor: colors.background }]}>
            <Text style={[styles.statusSymbol, { color: colors.warning }]}>i</Text>
            <View style={styles.changedCopy}>
              <Text style={[styles.changedTitle, { color: colors.foreground }]}>{result.reason ?? "比較できません"}</Text>
              <Text style={[styles.changedBody, { color: colors.muted }]}>条件内 {result.groups.matched.count}件、条件外 {result.groups.comparison.count}件です。記録を補うか、条件を変更して再分析できます。</Text>
            </View>
          </View>
        )}
        <Text style={[styles.resultNote, { color: colors.muted }]}>最低件数と傾向判定の基準は未決定です。差は因果関係や診断を示しません。</Text>
      </Card>

      <Card>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>グラフ</Text>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{outcomeLabel}の平均（0〜10）</Text>
        {ready ? (
          <View style={styles.chart} accessibilityLabel={`${outcomeLabel}の平均グラフ`}>
            <View style={styles.axis}><Text style={[styles.axisText, { color: colors.muted }]}>10</Text><Text style={[styles.axisText, { color: colors.muted }]}>5</Text><Text style={[styles.axisText, { color: colors.muted }]}>0</Text></View>
            <View style={[styles.plot, { borderBottomColor: colors.border }]}>
              <ChartBar label="条件内" count={result.groups.matched.count} value={formatScore(result.groups.matched.average)} height={matchedHeight} color={colors.primary} />
              <ChartBar label="条件外" count={result.groups.comparison.count} value={formatScore(result.groups.comparison.average)} height={comparisonHeight} color={colors.muted} />
            </View>
          </View>
        ) : <Text style={[styles.cardHint, { color: colors.muted }]}>比較できる2群がそろうまで、グラフは表示しません。</Text>}
      </Card>

      <Card>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>根拠</Text>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>何を使って計算したか</Text>
        <EvidenceRow label="条件" value={conditionText} />
        <EvidenceRow label="期間" value={result.query.period.startDate === "2000-01-01" ? "本人記録なし" : `${formatShortDate(result.query.period.startDate)}〜${formatShortDate(result.query.period.endDate)}`} />
        <EvidenceRow label="日時対応" value={result.alignmentEvidence.description} />
        <EvidenceRow label="比較対象" value="同期間の条件外かつ結果項目あり" />
        <EvidenceRow label="使用日付" value={result.evidence.usedConditionDates.length ? result.evidence.usedConditionDates.map(formatShortDate).join("、") : "なし"} />
        <EvidenceRow label="除外" value={exclusionSummary(result.exclusions)} />
        <EvidenceRow label="計算" value="各群の件数・平均・中央値・平均差" />
        <Text style={[styles.resultNote, { color: colors.muted }]}>分析結果は保存せず、画面を開くたび・再分析するたびに現在の記録から計算します。</Text>
      </Card>
    </View>
  );
}

function SummaryBox({ label, count, value }: { label: string; count: number; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.summaryBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}・{count}件</Text>
      <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function ChartBar({ label, count, value, height, color }: { label: string; count: number; value: string; height: `${number}%`; color: string }) {
  const colors = useColors();
  return (
    <View style={styles.barGroup}>
      <Text style={[styles.barValue, { color: colors.foreground }]}>{value}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.background }]}><View style={[styles.bar, { height, backgroundColor: color }]} /></View>
      <Text style={[styles.barLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.barCount, { color: colors.muted }]}>{count}件</Text>
    </View>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={styles.evidenceRow}><Text style={[styles.evidenceLabel, { color: colors.muted }]}>{label}</Text><Text style={[styles.evidenceValue, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 30, gap: 12 },
  conditionCard: { gap: 8, padding: 14 },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: "900" },
  cardHint: { fontSize: 12, lineHeight: 18 },
  conditionRow: { paddingTop: 8, gap: 8 },
  conditionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  conditionLabel: { fontSize: 14, lineHeight: 20, fontWeight: "900" },
  removeText: { fontSize: 13, lineHeight: 20, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 4 },
  operatorRow: { flexDirection: "row", gap: 6, alignItems: "stretch" },
  operator: { minWidth: 43, minHeight: 42, paddingHorizontal: 7, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  operatorText: { fontSize: 12, fontWeight: "800" },
  durationPicker: { gap: 8, paddingTop: 2 },
  durationSummary: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  durationSummaryLabel: { fontSize: 11, fontWeight: "800" },
  durationSummaryValue: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
  durationSummaryHint: { flexBasis: "100%", fontSize: 11, lineHeight: 16 },
  wheelRow: { flexDirection: "row", gap: 8 },
  wheelColumn: { flex: 1, minWidth: 0, gap: 5 },
  wheelColumnLabel: { fontSize: 11, lineHeight: 16, fontWeight: "900" },
  wheelViewport: { height: 210, borderWidth: 1, borderRadius: 12, overflow: "hidden", position: "relative" },
  wheelScroll: { flex: 1 },
  wheelContent: { paddingVertical: 84 },
  wheelItem: { height: 42, alignItems: "center", justifyContent: "center" },
  wheelItemText: { fontSize: 14, lineHeight: 20 },
  selectionFrame: { position: "absolute", top: 84, left: 0, right: 0, height: 42, borderTopWidth: 1, borderBottomWidth: 1 },
  wheelHint: { fontSize: 11, lineHeight: 16 },
  durationActions: { flexDirection: "row", gap: 8 },
  durationCancel: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  durationConfirm: { flex: 1.25, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  durationActionText: { fontSize: 13, fontWeight: "900" },
  durationStatus: { fontSize: 11, lineHeight: 16 },
  addButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  addSymbol: { fontSize: 20, lineHeight: 24, fontWeight: "900" },
  addText: { fontSize: 14, fontWeight: "900" },
  fieldLabel: { fontSize: 14, lineHeight: 20, fontWeight: "900", marginTop: 2 },
  changedCard: { padding: 14, flexDirection: "row", gap: 10 },
  statusSymbol: { width: 24, height: 24, textAlign: "center", fontSize: 18, lineHeight: 24, fontWeight: "900" },
  changedCopy: { flex: 1, gap: 2 },
  changedTitle: { fontSize: 14, lineHeight: 20, fontWeight: "900" },
  changedBody: { fontSize: 12, lineHeight: 18 },
  resultStack: { gap: 12 },
  resultCard: { borderLeftWidth: 4, paddingLeft: 13, gap: 8 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 0.8 },
  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryBox: { flex: 1, borderWidth: 1, borderRadius: 13, padding: 11, gap: 3 },
  summaryLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  summaryValue: { fontSize: 18, lineHeight: 25, fontWeight: "900" },
  differenceRow: { paddingTop: 9, borderTopWidth: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  differenceLabel: { flex: 1, fontSize: 12, lineHeight: 18 },
  differenceValue: { fontSize: 14, lineHeight: 20, fontWeight: "900" },
  resultNote: { fontSize: 11, lineHeight: 17 },
  emptyResult: { flexDirection: "row", gap: 9, padding: 11, borderRadius: 12 },
  chart: { height: 174, flexDirection: "row", gap: 7, marginTop: 4 },
  axis: { width: 22, justifyContent: "space-between", paddingBottom: 30, alignItems: "flex-end" },
  axisText: { fontSize: 10, lineHeight: 14 },
  plot: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-evenly", borderBottomWidth: 1, paddingHorizontal: 16 },
  barGroup: { width: "38%", alignItems: "center", alignSelf: "stretch", justifyContent: "flex-end", paddingTop: 2 },
  barValue: { fontSize: 13, lineHeight: 19, fontWeight: "900", marginBottom: 4 },
  barTrack: { height: 112, width: "58%", minWidth: 34, borderRadius: 8, overflow: "hidden", justifyContent: "flex-end" },
  bar: { width: "100%", minHeight: 4, borderRadius: 8 },
  barLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 5 },
  barCount: { fontSize: 11, lineHeight: 15 },
  evidenceRow: { flexDirection: "row", gap: 10, paddingTop: 7 },
  evidenceLabel: { width: 67, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  evidenceValue: { flex: 1, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
});
