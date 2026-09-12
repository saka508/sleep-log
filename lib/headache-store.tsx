import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  HEADACHE_EVENTS_STORAGE_KEY,
  mergeHeadacheEvents,
  normalizeHeadacheEvent,
  normalizeHeadacheEventStore,
  sortHeadacheEvents,
  type HeadacheEvent,
} from "./headache-events";

type HeadacheEventContextValue = {
  events: HeadacheEvent[];
  isReady: boolean;
  saveEvent: (event: HeadacheEvent) => boolean;
  removeEvent: (id: string) => void;
  importEvents: (events: HeadacheEvent[]) => number;
};

const HeadacheEventContext = createContext<HeadacheEventContextValue | null>(null);

export function HeadacheEventProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<HeadacheEvent[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(HEADACHE_EVENTS_STORAGE_KEY);
        if (saved) setEvents(normalizeHeadacheEventStore(JSON.parse(saved)).events);
      } catch {
        setEvents([]);
      } finally {
        setIsReady(true);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.setItem(HEADACHE_EVENTS_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, events }));
  }, [events, isReady]);

  const saveEvent = useCallback((event: HeadacheEvent) => {
    const normalized = normalizeHeadacheEvent(event);
    if (!normalized) return false;
    setEvents((current) => mergeHeadacheEvents(current, [normalized]));
    return true;
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents((current) => current.filter((event) => event.id !== id));
  }, []);

  const importEvents = useCallback((incoming: HeadacheEvent[]) => {
    const valid = incoming.map(normalizeHeadacheEvent).filter((event): event is HeadacheEvent => event !== null);
    setEvents((current) => mergeHeadacheEvents(current, valid));
    return valid.length;
  }, []);

  const value = useMemo(() => ({ events: sortHeadacheEvents(events), isReady, saveEvent, removeEvent, importEvents }), [events, isReady, saveEvent, removeEvent, importEvents]);
  return <HeadacheEventContext.Provider value={value}>{children}</HeadacheEventContext.Provider>;
}

export function useHeadacheEvents() {
  const context = useContext(HeadacheEventContext);
  if (!context) throw new Error("useHeadacheEvents must be used within HeadacheEventProvider");
  return context;
}
