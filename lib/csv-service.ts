import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { recordsFromCsv, recordsToCsv } from "./csv-core";
import type { SleepRecord } from "./sleep-utils";

export { recordsFromCsv, recordsToCsv };

export async function exportRecords(records: SleepRecord[]) {
  const csv = recordsToCsv(records);
  const filename = `sleep-log-${new Date().toISOString().slice(0, 10)}.csv`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Sleep Log の記録を共有" });
  }
}

export async function pickAndReadCsv() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
}
