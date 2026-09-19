import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  mergePressureHistoryBatches,
  normalizePressureHistoryStore,
  PRESSURE_HISTORY_STORAGE_KEY,
  type PressureHistoryBatch,
  type PressureHistoryStoreV1,
} from "@/lib/pressure-history";
import { persistJsonAndCommit } from "@/lib/storage-persistence";

type PressureHistoryContextValue = PressureHistoryStoreV1 & {
  isReady: boolean;
  saveBatch: (batch: PressureHistoryBatch) => Promise<boolean>;
  importStore: (store: PressureHistoryStoreV1) => Promise<number | null>;
};

const PressureHistoryContext = createContext<PressureHistoryContextValue | null>(null);
const EMPTY_STORE: PressureHistoryStoreV1 = { schemaVersion: 1, batches: [] };

export function PressureHistoryProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<PressureHistoryStoreV1>(EMPTY_STORE);
  const [isReady, setIsReady] = useState(false);
  const storeRef = useRef(store);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(PRESSURE_HISTORY_STORAGE_KEY);
        const nextStore = saved ? normalizePressureHistoryStore(JSON.parse(saved)) : EMPTY_STORE;
        storeRef.current = nextStore;
        setStore(nextStore);
      } catch {
        storeRef.current = EMPTY_STORE;
        setStore(EMPTY_STORE);
      } finally {
        setIsReady(true);
      }
    };
    void load();
  }, []);

  const saveBatch = useCallback((batch: PressureHistoryBatch) => {
    const current = storeRef.current;
    const nextStore: PressureHistoryStoreV1 = {
      schemaVersion: 1,
      batches: mergePressureHistoryBatches(current.batches, [batch]),
    };
    return persistJsonAndCommit(AsyncStorage, PRESSURE_HISTORY_STORAGE_KEY, nextStore, () => {
      storeRef.current = nextStore;
      setStore(nextStore);
    });
  }, []);

  const importStore = useCallback(async (incoming: PressureHistoryStoreV1) => {
    const normalized = normalizePressureHistoryStore(incoming);
    const current = storeRef.current;
    const nextStore: PressureHistoryStoreV1 = {
      schemaVersion: 1,
      batches: mergePressureHistoryBatches(current.batches, normalized.batches),
    };
    const saved = await persistJsonAndCommit(AsyncStorage, PRESSURE_HISTORY_STORAGE_KEY, nextStore, () => {
      storeRef.current = nextStore;
      setStore(nextStore);
    });
    return saved ? normalized.batches.length : null;
  }, []);

  const value = useMemo(() => ({ ...store, isReady, saveBatch, importStore }), [store, isReady, saveBatch, importStore]);
  return <PressureHistoryContext.Provider value={value}>{children}</PressureHistoryContext.Provider>;
}

export function usePressureHistory() {
  const context = useContext(PressureHistoryContext);
  if (!context) throw new Error("usePressureHistory must be used within PressureHistoryProvider");
  return context;
}
