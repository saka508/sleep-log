export type AsyncKeyValueStorage = {
  setItem: (key: string, value: string) => Promise<void>;
};

export async function persistValue(
  storage: AsyncKeyValueStorage,
  key: string,
  value: string,
): Promise<boolean> {
  try {
    await storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serializes and writes one storage payload without leaking platform errors to
 * the UI. Callers can use the boolean result to keep form data on screen and
 * only acknowledge a save after the write completed.
 */
export async function persistJson(
  storage: AsyncKeyValueStorage,
  key: string,
  value: unknown,
): Promise<boolean> {
  try {
    return persistValue(storage, key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/**
 * Runs the in-memory commit only after the serialized payload was accepted by
 * storage. This keeps a failed write from being presented as a saved record.
 */
export async function persistJsonAndCommit(
  storage: AsyncKeyValueStorage,
  key: string,
  value: unknown,
  commit: () => void,
): Promise<boolean> {
  if (!await persistJson(storage, key, value)) return false;
  commit();
  return true;
}
