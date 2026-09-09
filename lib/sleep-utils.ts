export type SleepRecord = {
  id: string;
  date: string;
  bedTime: string;
  wakeTime: string;
  sleepMinutes: number;
  latencyMinutes: number;
  napMinutes: number;
  sleepiness: number;
  clarity: number;
  caffeine: boolean;
  headache: boolean;
  note: string;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  reminderEnabled: boolean;
  reminderTime: string;
};

export type TrendMetric =
  | "sleepMinutes"
  | "bedTime"
  | "wakeTime"
  | "sleepiness"
  | "clarity"
  | "napMinutes";

export const DEFAULT_SETTINGS: AppSettings = {
  reminderEnabled: false,
  reminderTime: "21:30",
};

export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function daysFromToday(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

export function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateFromKey(value);
  return dateKey(date) === value;
}

export function timeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isTime(value: string) {
  return timeToMinutes(value) !== null;
}

export function sleepMinutesFromTimes(bedTime: string, wakeTime: string) {
  const bed = timeToMinutes(bedTime);
  const wake = timeToMinutes(wakeTime);
  if (bed === null || wake === null) return null;
  const difference = wake - bed;
  return difference <= 0 ? difference + 24 * 60 : difference;
}

export function formatDuration(minutes?: number | null, compact = false) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (compact) return rest ? `${hours}時間${rest}分` : `${hours}時間`;
  return `${hours} 時間 ${rest} 分`;
}

export function formatDurationShort(minutes?: number | null) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const safeMinutes = Math.max(0, Math.round(minutes));
  return `${Math.floor(safeMinutes / 60)}h ${String(safeMinutes % 60).padStart(2, "0")}m`;
}

export function formatDate(key: string) {
  const date = dateFromKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${DAY_LABELS[date.getDay()]}）`;
}

export function formatShortDate(key: string) {
  const date = dateFromKey(key);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatMonthDay(key: string) {
  const date = dateFromKey(key);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function clockValueForChart(time: string, isBedTime = false) {
  const minutes = timeToMinutes(time);
  if (minutes === null) return 0;
  return isBedTime && minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
}

export function formatClockValue(value: number) {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function correlation(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return null;
  const xMean = average(points.map((point) => point.x));
  const yMean = average(points.map((point) => point.y));
  const numerator = points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0);
  const xSpread = Math.sqrt(points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0));
  const ySpread = Math.sqrt(points.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0));
  if (!xSpread || !ySpread) return null;
  return numerator / (xSpread * ySpread);
}

export function getMetricValue(record: SleepRecord, metric: TrendMetric) {
  switch (metric) {
    case "bedTime":
      return clockValueForChart(record.bedTime, true);
    case "wakeTime":
      return clockValueForChart(record.wakeTime);
    default:
      return record[metric];
  }
}

export function getMetricLabel(metric: TrendMetric) {
  return {
    sleepMinutes: "睡眠時間",
    bedTime: "就寝時刻",
    wakeTime: "起床時刻",
    sleepiness: "眠気",
    clarity: "頭の冴え",
    napMinutes: "昼寝時間",
  }[metric];
}

export function formatMetricValue(metric: TrendMetric, value: number) {
  if (metric === "sleepMinutes" || metric === "napMinutes") return formatDurationShort(value);
  if (metric === "bedTime" || metric === "wakeTime") return formatClockValue(value);
  return `${Math.round(value)}`;
}

export function sortRecords(records: SleepRecord[]) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

export function getSleepStats(records: SleepRecord[]) {
  return {
    averageSleepMinutes: average(records.map((record) => record.sleepMinutes)),
    averageSleepiness: average(records.map((record) => record.sleepiness)),
    averageClarity: average(records.map((record) => record.clarity)),
    napDays: records.filter((record) => record.napMinutes > 0).length,
  };
}

const sampleRows = [
  ["23:50", "07:10", 420, 25, 0, 3, 8, false, false, "課題が早く終わって、落ち着いて眠れた。"],
  ["00:20", "07:00", 370, 35, 20, 6, 5, true, false, "放課後に少し昼寝。"],
  ["23:35", "07:15", 445, 18, 0, 2, 9, false, false, "朝の目覚めがよかった。"],
  ["00:40", "06:55", 355, 45, 30, 7, 4, true, true, "テスト勉強で遅くなった。"],
  ["23:25", "07:20", 455, 20, 0, 3, 8, false, false, "いつもより早めに就寝。"],
  ["00:05", "07:05", 395, 30, 15, 5, 6, true, false, "部活のあとで少し休んだ。"],
  ["23:30", "07:30", 470, 15, 0, 2, 9, false, false, "よく眠れた感じ。"],
  ["00:15", "07:00", 380, 40, 25, 6, 5, true, false, "動画を見てしまった。"],
  ["23:45", "07:10", 410, 25, 0, 4, 7, false, false, "普通の日。"],
  ["23:20", "07:25", 475, 15, 0, 2, 9, false, false, "朝に余裕があった。"],
  ["00:30", "07:00", 360, 35, 20, 7, 4, true, true, "眠気が強かった。"],
  ["23:40", "07:15", 430, 20, 0, 3, 8, false, false, "サンプルの最新記録（昨日）。"],
] as const;

export function createSampleRecords(): SleepRecord[] {
  return sampleRows.map((row, index) => {
    // Samples end yesterday so a first launch still shows today as 未記録
    // instead of presenting demo data as something the user recorded.
    const date = daysFromToday(index - sampleRows.length);
    const [bedTime, wakeTime, sleepMinutes, latencyMinutes, napMinutes, sleepiness, clarity, caffeine, headache, note] = row;
    return {
      id: date,
      date,
      bedTime,
      wakeTime,
      sleepMinutes,
      latencyMinutes,
      napMinutes,
      sleepiness,
      clarity,
      caffeine,
      headache,
      note,
      isSample: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}
