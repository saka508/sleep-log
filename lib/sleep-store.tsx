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

type SleepDataContextValue = SleepDataState & {
  isReady: boolean;
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

export function SleepDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SleepDataState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<SleepDataState>;
          const records = Array.isArray(parsed.records)
            ? parsed.records.map(normalizeSleepRecord).filter((record): record is SleepRecord => record !== null)
            : [];
          const nextState = {
            records: sortRecords(records),
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          };
          stateRef.current = nextState;
          setState(nextState);
        } else {
          const nextState = { records: sortRecords(createSampleRecords()), settings: DEFAULT_SETTINGS };
          stateRef.current = nextState;
          setState(nextState);
        }
      } catch {
        const nextState = { records: sortRecords(createSampleRecords()), settings: DEFAULT_SETTINGS };
        stateRef.current = nextState;
        setState(nextState);
      } finally {
        setIsReady(true);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    stateRef.current = state;
    if (!isReady) return;
    void persistJson(AsyncStorage, STORAGE_KEY, state);
  }, [isReady, state]);

  const saveRecord = useCallback(async (record: SleepRecord) => {
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
    const current = stateRef.current;
    const nextState: SleepDataState = { ...current, records: current.records.filter((record) => record.date !== date) };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const importRecords = useCallback(async (incoming: SleepRecord[]) => {
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
    const current = stateRef.current;
    const nextState: SleepDataState = { ...current, settings: { ...current.settings, ...settings } };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const removeSampleRecords = useCallback(() => {
    const current = stateRef.current;
    const nextState: SleepDataState = { ...current, records: current.records.filter((record) => !record.isSample) };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const addSampleRecords = useCallback(() => {
    const current = stateRef.current;
    const byDate = new Map(current.records.map((record) => [record.date, record]));
    createSampleRecords().forEach((record) => {
      if (!byDate.has(record.date)) byDate.set(record.date, record);
    });
    const nextState: SleepDataState = { ...current, records: sortRecords([...byDate.values()]) };
    return persistJsonAndCommit(AsyncStorage, STORAGE_KEY, nextState, () => {
      stateRef.current = nextState;
      setState(nextState);
    });
  }, []);

  const clearAllRecords = useCallback(() => {
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
