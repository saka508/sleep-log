import { pressureHistoryToBackupJson, type PressureHistoryStoreV1 } from "./pressure-history";

export async function exportPressureHistory(store: PressureHistoryStoreV1) {
  const filename = `sleep-log-pressure-history-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([pressureHistoryToBackupJson(store)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function pickAndReadPressureHistoryBackup() {
  return new Promise<string | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => resolve(input.files?.[0] ? input.files[0].text() : null);
    input.click();
  });
}
