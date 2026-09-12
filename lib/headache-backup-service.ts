import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { headacheEventsToBackupJson, type HeadacheEvent } from "./headache-events";

export async function exportHeadacheEvents(events: HeadacheEvent[]) {
  const filename = `sleep-log-headache-events-${new Date().toISOString().slice(0, 10)}.json`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, headacheEventsToBackupJson(events), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "頭痛イベントのバックアップ" });
}

export async function pickAndReadHeadacheBackup() {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/json", "text/plain"], copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  return FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
}
