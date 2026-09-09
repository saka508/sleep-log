import { isDateKey, isTime, type SleepRecord } from "./sleep-utils";

const HEADERS = ["日付", "就寝時刻", "起床時刻", "実睡眠時間（分）", "寝つくまで（分）", "昼寝時間（分）", "眠気（0-10）", "頭の冴え（0-10）", "カフェイン", "頭痛", "メモ"];

function escapeCsv(value: string | number | boolean) {
  const text = typeof value === "boolean" ? (value ? "あり" : "なし") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToCsv(records: SleepRecord[]) {
  const lines = records.slice().sort((a, b) => a.date.localeCompare(b.date)).map((record) => [record.date, record.bedTime, record.wakeTime, record.sleepMinutes, record.latencyMinutes, record.napMinutes, record.sleepiness, record.clarity, record.caffeine, record.headache, record.note].map(escapeCsv).join(","));
  return `\uFEFF${HEADERS.join(",")}\n${lines.join("\n")}`;
}

function rowsFromCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function toNumber(value: string) { const parsed = Number(value.trim()); return Number.isFinite(parsed) ? parsed : 0; }
function toScore(value: string) { return Math.max(0, Math.min(10, Math.round(toNumber(value)))); }
function toBoolean(value: string) { return ["あり", "true", "1", "yes", "はい"].includes(value.trim().toLowerCase()); }

export function recordsFromCsv(text: string): SleepRecord[] {
  const rows = rowsFromCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const headerIndex = new Map(rows[0].map((header, index) => [header.trim(), index]));
  const find = (...names: string[]) => names.map((name) => headerIndex.get(name)).find((index): index is number => index !== undefined) ?? -1;
  const columns = { date: find("日付", "date"), bedTime: find("就寝時刻", "bed_time"), wakeTime: find("起床時刻", "wake_time"), sleepMinutes: find("実睡眠時間（分）", "sleep_minutes"), latencyMinutes: find("寝つくまで（分）", "latency_minutes"), napMinutes: find("昼寝時間（分）", "nap_minutes"), sleepiness: find("眠気（0-10）", "sleepiness"), clarity: find("頭の冴え（0-10）", "clarity"), caffeine: find("カフェイン", "caffeine"), headache: find("頭痛", "headache"), note: find("メモ", "note") };
  if (columns.date < 0 || columns.bedTime < 0 || columns.wakeTime < 0) return [];
  const now = new Date().toISOString();
  return rows.slice(1).flatMap((row) => {
    const date = row[columns.date]?.trim();
    const bedTime = row[columns.bedTime]?.trim();
    const wakeTime = row[columns.wakeTime]?.trim();
    if (!date || !bedTime || !wakeTime || !isDateKey(date) || !isTime(bedTime) || !isTime(wakeTime)) return [];
    return [{ id: date, date, bedTime, wakeTime, sleepMinutes: Math.max(0, toNumber(row[columns.sleepMinutes] ?? "0")), latencyMinutes: Math.max(0, toNumber(row[columns.latencyMinutes] ?? "0")), napMinutes: Math.max(0, toNumber(row[columns.napMinutes] ?? "0")), sleepiness: toScore(row[columns.sleepiness] ?? "0"), clarity: toScore(row[columns.clarity] ?? "0"), caffeine: toBoolean(row[columns.caffeine] ?? ""), headache: toBoolean(row[columns.headache] ?? ""), note: row[columns.note] ?? "", isSample: false, createdAt: now, updatedAt: now }];
  });
}
