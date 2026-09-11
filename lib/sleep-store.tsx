import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  createSampleRecords,
  DEFAULT_SETTINGS,
  type AppSettings,
  type SleepRecord,
  sortRecords,
} from "@/lib/sleep-utils";
import {
  dailyConditionsFromSleepRecords,
  type DailyConditionRecord,
} from "@/lib/condition-model";

const STORAGE_KEY = "sleep-log.local-data.v1";

type SleepDataState = {
  records: SleepRecord[];
  settings: AppSettings;
};

type SleepDataContextValue = SleepDataState & {
  isReady: boolean;
  dailyConditions: DailyConditionRecord[];
  saveRecord: (record: SleepRecord) => void;
  removeRecord: (date: string) => void;
  importRecords: (records: SleepRecord[]) => number;
  updateSettings: (settings: Partial<AppSettings>) => void;
  removeSampleRecords: () => void;
  addSampleRecords: () => void;
  clearAllRecords: () => void;
};

const SleepDataContext = createContext<SleepDataContextValue | null>(null);

const initialState: SleepDataState = {
  records: [],
  settings: DEFAULT_SETTINGS,
};

function normalizeRecord(value: Partial<SleepRecord>): SleepRecord | null {
  if (!value.date || !value.id || !value.bedTime || !value.wakeTime) return null;
  const safeScore = (score: unknown) => Math.max(0, Math.min(10, Number(score) || 0));
  return {
    id: value.date,
    date: value.date,
    bedTime: value.bedTime,
    wakeTime: value.wakeTime,
    sleepMinutes: Math.max(0, Number(value.sleepMinutes) || 0),
    latencyMinutes: Math.max(0, Number(value.latencyMinutes) || 0),
    napMinutes: Math.max(0, Number(value.napMinutes) || 0),
    sleepiness: safeScore(value.sleepiness),
    clarity: safeScore(value.clarity),
    caffeine: Boolean(value.caffeine),
    headache: Boolean(value.headache),
    note: typeof value.note === "string" ? value.note : "",
    isSample: Boolean(value.isSample),
    createdAt: value.createdAt ?? new Date().toISOString(),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  };
}

export function SleepDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SleepDataState>(initialState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<SleepDataState>;
          const records = Array.isArray(parsed.records)
            ? parsed.records.map(normalizeRecord).filter((record): record is SleepRecord => record !== null)
            : [];
          setState({
            records: sortRecords(records),
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          });
        } else {
          setState({ records: sortRecords(createSampleRecords()), settings: DEFAULT_SETTINGS });
        }
      } catch {
        setState({ records: sortRecords(createSampleRecords()), settings: DEFAULT_SETTINGS });
      } finally {
        setIsReady(true);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isReady, state]);

  const saveRecord = useCallback((record: SleepRecord) => {
    setState((current) => ({
      ...current,
      records: sortRecords([
        { ...record, id: record.date, isSample: false, updatedAt: new Date().toISOString() },
        ...current.records.filter((item) => item.date !== record.date && item.id !== record.id),
      ]),
    }));
  }, []);

  const removeRecord = useCallback((date: string) => {
    setState((current) => ({ ...current, records: current.records.filter((record) => record.date !== date) }));
  }, []);

  const importRecords = useCallback((incoming: SleepRecord[]) => {
    const valid = incoming.map(normalizeRecord).filter((record): record is SleepRecord => record !== null);
    setState((current) => {
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
      return { ...current, records: sortRecords([...byDate.values()]) };
    });
    return valid.length;
  }, []);

  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...settings } }));
  }, []);

  const removeSampleRecords = useCallback(() => {
    setState((current) => ({ ...current, records: current.records.filter((record) => !record.isSample) }));
  }, []);

  const addSampleRecords = useCallback(() => {
    setState((current) => {
      const byDate = new Map(current.records.map((record) => [record.date, record]));
      createSampleRecords().forEach((record) => {
        if (!byDate.has(record.date)) byDate.set(record.date, record);
      });
      return { ...current, records: sortRecords([...byDate.values()]) };
    });
  }, []);

  const clearAllRecords = useCallback(() => {
    setState((current) => ({ ...current, records: [] }));
  }, []);

  const dailyConditions = useMemo(
    () => dailyConditionsFromSleepRecords(state.records),
    [state.records],
  );

  const value = useMemo(
    () => ({
      ...state,
      isReady,
      dailyConditions,
      saveRecord,
      removeRecord,
      importRecords,
      updateSettings,
      removeSampleRecords,
      addSampleRecords,
      clearAllRecords,
    }),
    [state, isReady, dailyConditions, saveRecord, removeRecord, importRecords, updateSettings, removeSampleRecords, addSampleRecords, clearAllRecords],
  );

  return <SleepDataContext.Provider value={value}>{children}</SleepDataContext.Provider>;
}

export function useSleepData() {
  const context = useContext(SleepDataContext);
  if (!context) throw new Error("useSleepData must be used within SleepDataProvider");
  return context;
}
