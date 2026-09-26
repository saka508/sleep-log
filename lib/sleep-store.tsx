import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  createSampleRecords,
  DEFAULT_SETTINGS,
  type AppSettings,
  type SleepRecord,
  normalizeSleepRecord,
  sortRecords,
} from "@/lib/sleep-utils";
import {
  dailyConditionsFromSleepRecords,
  type DailyConditionRecord,
} from "@/lib/condition-model";
import { persistJson, persistJsonAndCommit } from "@/lib/storage-persistence";

const STORAGE_KEY = "sleep-log.local-data.v1";

type SleepDataState = {
  records: SleepRecord[];
  settings: AppSettings;
};

export type StartupStorageIssue = "read-failed" | "sample-save-failed";
type SleepDataStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
export type InitialSleepDataResult = { state: SleepDataState; startupStorageIssue: StartupStorageIssue | null };

type SleepDataContextValue = SleepDataState & {
  isReady: boolean;
  startupStorageIssue: StartupStorageIssue | null;
  dailyConditions: DailyConditionRecord[];
  saveRecord: (record: SleepRecord) => Promise<boolean>;
  removeRecord: (date: string) => Promise<boolean>;
  importRecords: (records: SleepRecord[]) => Promise<number | null>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  removeSampleRecords: () => Promise<boolean>;
  addSampleRecords: () => Promise<boolean>;
  clearAllRecords: () => Promise<boolean>;
};

const SleepDataContext = createContext<SleepDataContextValue | null>(null);

const initialState: SleepDataState = {
  records: [],
  settings: DEFAULT_SETTINGS,
};

export async function loadInitialSleepData(storage: SleepDataStorage): Promise<InitialSleepDataResult> {
  let saved: string | null;
  try { saved = await storage.getItem(STORAGE_KEY); } catch { return { state: initialState, startupStorageIssue: "read-failed" }; }
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Partial<SleepDataState>;
      const records = Array.isArray(parsed.records) ? parsed.records.map(normalizeSleepRecord).filter((record): record is SleepRecord => record !== null) : [];
      return { state: { records: sortRecords(records), settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }, startupStorageIssue: null };
    } catch { return { state: initialState, startupStorageIssue: "read-failed" }; }
  }
  const sampleState: SleepDataState = { records: sortRecords(createSampleRecords()), settings: DEFAULT_SETTINGS };
  if (!await persistJson(storage, STORAGE_KEY, sampleState)) return { state: initialState, startupStorageIssue: "sample-save-failed" };
  return { state: sampleState, startupStorageIssue: null };
}

export function SleepDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SleepDataState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [startupStorageIssue, setStartupStorageIssue] = useState<StartupStorageIssue | null>(null);
  const stateRef = useRef(state);
  const storageReadFailedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await loadInitialSleepData(AsyncStorage);
        storageReadFailedRef.current = result.startupStorageIssue === "read-failed";
        stateRef.current = result.state;
        setState(result.state);
        setStartupStorageIssue(result.startupStorageIssue);
      } finally {
        setIsReady(true);
      }
    };
    void load();
  }, []);

  const saveRecord = useCallback(async (record: SleepRecord) => {
    if (storageReadFailedRef.current) return false;
    const current = stateRef.current;
    const nextState: SleepDataState = {
      ...current,
      records: sortRecords([
        { ...record, id: record.date, isSample: false, updatedAt: new Date().toISOString() },
        ...current.records.filter((item) => item.date !== record.date && item.id !== record.id),
      ]),
    };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const removeRecord = useCallback((date: string) => {
    if (storageReadFailedRef.current) return Promise.resolve(false);
    const current = stateRef.current;
    const nextState: SleepDataState = { ...current, records: current.records.filter((record) => record.date !== date) };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const importRecords = useCallback(async (incoming: SleepRecord[]) => {
    if (storageReadFailedRef.current) return null;
    const valid = incoming.map(normalizeSleepRecord).filter((record): record is SleepRecord => record !== null);
    const current = stateRef.current;
    const byDate = new Map(current.records.map((record) => [record.date, record]));
    valid.forEach((record) => {
      const existing = byDate.get(record.date);
      byDate.set(record.date, {
        ...record,
        id: record.date,
        isSample: false,
        createdAt: existing?.createdAt ?? record.createdAt,
        updatedAt: new Date().toISOString(),
      });
    });
    const nextState: SleepDataState = { ...current, records: sortRecords([...byDate.values()]) };
    const saved = await persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
    return saved ? valid.length : null;
  }, []);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    if (storageReadFailedRef.current) return Promise.resolve(false);
    const current = stateRef.current;
    const nextState: SleepDataState = { ...current, settings: { ...current.settings, ...settings } };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const removeSampleRecords = useCallback(() => {
    if (storageReadFailedRef.current) return Promise.resolve(false);
    const current = stateRef.current;
    const nextState: SleepDataState = { ...current, records: current.records.filter((record) => !record.isSample) };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const addSampleRecords = useCallback(() => {
    if (storageReadFailedRef.current) return Promise.resolve(false);
    const current = stateRef.current;
    const byDate = new Map(current.records.map((record) => [record.date, record]));
    createSampleRecords().forEach((record) => {
      if (!byDate.has(record.date)) byDate.set(record.date, record);
    });
    const nextState: SleepDataState = { ...current, records: sortRecords([...byDate.values()]) };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
      setStartupStorageIssue(null);
    });
  }, []);

  const clearAllRecords = useCallback(() => {
    if (storageReadFailedRef.current) return Promise.resolve(false);
    const current = stateRef.current;
    const nextState: SleepDataState = { ...current, records: [] };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const dailyConditions = useMemo(
    () => dailyConditionsFromSleepRecords(state.records),
    [state.records],
  );

  const value = useMemo(
    () => ({
      ...state,
      isReady,
      startupStorageIssue,
      dailyConditions,
      saveRecord,
      removeRecord,
      importRecords,
      updateSettings,
      removeSampleRecords,
      addSampleRecords,
      clearAllRecords,
    }),
    [state, isReady, startupStorageIssue, dailyConditions, saveRecord, removeRecord, importRecords, updateSettings, removeSampleRecords, addSampleRecords, clearAllRecords],
  );

  return <SleepDataContext.Provider value={value}>{children}</SleepDataContext.Provider>;
}

export function useSleepData() {
  const context = useContext(SleepDataContext);
  if (!context) throw new Error("useSleepData must be used within SleepDataProvider");
  return context;
}
