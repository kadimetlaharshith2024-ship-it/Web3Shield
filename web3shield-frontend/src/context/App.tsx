import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, setDemoMode } from "../lib/api";
import type { DetectorInfo, ToolKind } from "../lib/types";
import type { Tone } from "../lib/utils";

// ------------------------------------------------------------------ history entries

export interface HistoryEntry {
  id: string;
  kind: ToolKind;
  target: string; // address or tx hash the user checked
  verdict: string; // short human label, e.g. "High risk"
  tone: Tone;
  score: number | null;
  at: string; // ISO
  demo: boolean;
  report: unknown; // the raw backend response, so it can be reopened without re-scanning
}

export type BackendStatus = "checking" | "online" | "offline" | "demo";
export type Theme = "dark" | "light";

interface AppValue {
  demo: boolean;
  setDemo: (on: boolean) => void;
  theme: Theme;
  toggleTheme: () => void;
  status: BackendStatus;
  detectors: DetectorInfo[];
  recheck: () => void;
  history: HistoryEntry[];
  addHistory: (e: Omit<HistoryEntry, "id" | "at" | "demo">) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
}

const Ctx = createContext<AppValue | null>(null);
const DEMO_KEY = "w3s.demo.v1";
const THEME_KEY = "w3s.theme.v1";
const HISTORY_KEY = "w3s.history.v1";
const HISTORY_MAX = 30;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [demo, setDemoState] = useState<boolean>(() => read(DEMO_KEY, false));
  const [theme, setTheme] = useState<Theme>(() => read<Theme>(THEME_KEY, "dark"));
  const [status, setStatus] = useState<BackendStatus>(demo ? "demo" : "checking");
  const [detectors, setDetectors] = useState<DetectorInfo[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => read(HISTORY_KEY, []));
  const demoRef = useRef(demo);

  // keep the API layer in sync *before* children fire requests
  setDemoMode(demo);
  demoRef.current = demo;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0a1622" : "#eef3f7");
  }, [theme]);

  const check = useCallback(async () => {
    if (demoRef.current) {
      setStatus("demo");
      setDetectors(await api.listDetectors());
      return;
    }
    try {
      const list = await api.listDetectors();
      if (demoRef.current) return;
      setDetectors(list);
      setStatus("online");
    } catch {
      if (demoRef.current) return;
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    setStatus(demo ? "demo" : "checking");
    void check();
    const t = setInterval(() => void check(), 30_000);
    return () => clearInterval(t);
  }, [demo, check]);

  const setDemo = useCallback((on: boolean) => {
    setDemoState(on);
    write(DEMO_KEY, on);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      write(THEME_KEY, next);
      return next;
    });
  }, []);

  const addHistory = useCallback((e: Omit<HistoryEntry, "id" | "at" | "demo">) => {
    setHistory((prev) => {
      const entry: HistoryEntry = { ...e, id: crypto.randomUUID?.() ?? String(Date.now()), at: new Date().toISOString(), demo: demoRef.current };
      const next = [entry, ...prev].slice(0, HISTORY_MAX);
      write(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      write(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    write(HISTORY_KEY, []);
  }, []);

  const value = useMemo<AppValue>(
    () => ({ demo, setDemo, theme, toggleTheme, status, detectors, recheck: () => void check(), history, addHistory, removeHistory, clearHistory }),
    [demo, setDemo, theme, toggleTheme, status, detectors, check, history, addHistory, removeHistory, clearHistory],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}
