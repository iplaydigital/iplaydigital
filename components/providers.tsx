"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Action, Bootstrap, CalendarEvent, Task } from "../lib/types";

export type View = "dashboard" | "calendar" | "tasks" | "ai" | "chat" | "hr" | "led" | "settings";
type Toast = { id: number; text: string; kind: "ok" | "err" | "ai" | "info" };

export interface EventFormState {
  open: boolean;
  date?: string;
  time?: string;
  event?: CalendarEvent | null;
}

interface Ctx {
  data: Bootstrap | null;
  loading: boolean;
  error: string | null;
  act: (a: Action) => Promise<void>;
  refresh: () => Promise<void>;
  view: View;
  go: (v: View) => void;
  taskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  eventForm: EventFormState;
  openEvent: (state?: Partial<EventFormState>) => void;
  closeEvent: () => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  activeChannel: string;
  setActiveChannel: (id: string) => void;
  dockOpen: boolean;
  setDockOpen: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  now: Date;
  aiBusy: string | null;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>({ open: false });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeChannel, setActiveChannel] = useState("ch_all");
  const [dockOpen, setDockOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(new Date());
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const toastSeq = useRef(1);
  const fallbackNotified = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/bootstrap?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
        throw new Error(body.error ?? `bootstrap failed (${res.status})${body.hint ? ` — ${body.hint}` : ""}`);
      }
      const next = (await res.json()) as Bootstrap;
      setData(next);
      setError(null);
      if (next.storage === "fallback" && !fallbackNotified.current) {
        fallbackNotified.current = true;
        toast(`ฐานข้อมูลไม่พร้อม (${next.dbError?.code ?? "db"}) — ใช้ข้อมูลสำรองชั่วคราว กดที่ป้ายสถานะเพื่อดูวิธีแก้`, "err");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = useCallback(async (action: Action) => {
    // optimistic updates for drag interactions so the UI never lags
    setData((prev) => {
      if (!prev) return prev;
      if (action.type === "task.move") {
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === action.id
              ? { ...t, status: action.status, progress: action.status === "done" ? 100 : t.progress || 20 }
              : t,
          ),
        };
      }
      if (action.type === "event.move") {
        return {
          ...prev,
          events: prev.events.map((e) =>
            e.id === action.id ? { ...e, date: action.date, time: action.time ?? e.time } : e,
          ),
        };
      }
      return prev;
    });
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!res.ok) throw new Error(`action failed (${res.status})`);
      const next = (await res.json()) as Bootstrap;
      setData(next);
    } catch (e) {
      toast(`บันทึกไม่สำเร็จ: ${(e as Error).message}`, "err");
      void refresh();
    }
  }, [refresh]);

  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = toastSeq.current++;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const go = useCallback((v: View) => {
    setView(v);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${v}`);
  }, []);

  useEffect(() => {
    const hash = (typeof window !== "undefined" ? window.location.hash.replace("#", "") : "") as View;
    const valid: View[] = ["dashboard", "calendar", "tasks", "ai", "chat", "hr", "led", "settings"];
    if (valid.includes(hash)) setView(hash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTaskId(null);
        setEventForm({ open: false });
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openTask = useCallback((id: string) => setTaskId(id), []);
  const closeTask = useCallback(() => setTaskId(null), []);
  const openEvent = useCallback((s?: Partial<EventFormState>) => setEventForm({ open: true, ...s }), []);
  const closeEvent = useCallback(() => setEventForm({ open: false }), []);

  const value = useMemo<Ctx>(
    () => ({
      data, loading, error, act, refresh, view, go,
      taskId, openTask, closeTask,
      eventForm, openEvent, closeEvent,
      toast, activeChannel, setActiveChannel, dockOpen, setDockOpen,
      search, setSearch, now, aiBusy,
    }),
    [data, loading, error, act, refresh, view, go, taskId, openTask, closeTask, eventForm, openEvent, closeEvent, toast, activeChannel, dockOpen, search, now, aiBusy],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "ai" ? "🤖" : t.kind === "err" ? "⚠️" : "✅"} {t.text}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

/** helper: run an AI reply for a channel and post both bubbles */
export function useAiChat() {
  const { data, act, toast } = useApp();
  const [typing, setTyping] = useState<string | null>(null);

  const ask = useCallback(
    async (text: string, channelId: string) => {
      if (!data) return null;
      const channel = data.channels.find((c) => c.id === channelId);
      const mention = text.match(/@(nova|byte|pixel|echo|orbit)/i)?.[1]?.toLowerCase();
      const agentId = mention
        ? `ai_${mention}`
        : channel?.type === "ai"
          ? channel.members.find((m) => m.startsWith("ai_")) ?? "ai_nova"
          : "ai_nova";
      setTyping(agentId);
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, agentId }),
        });
        if (!res.ok) throw new Error("AI ตอบไม่ได้ในขณะนี้");
        const out = (await res.json()) as { reply: string; agentId: string };
        await act({ type: "chat.send", channelId, authorId: out.agentId, text: out.reply });
        return out;
      } catch (e) {
        toast((e as Error).message, "err");
        return null;
      } finally {
        setTyping(null);
      }
    },
    [data, act, toast],
  );

  return { ask, typing };
}

export function useTask(id: string | null): Task | null {
  const { data } = useApp();
  return useMemo(() => data?.tasks.find((t) => t.id === id) ?? null, [data, id]);
}
