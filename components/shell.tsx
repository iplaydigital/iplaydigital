"use client";

import React, { useMemo } from "react";
import {
  Bell, Bot, CalendarDays, ChevronRight, Clock, Columns3, Command, LayoutDashboard,
  MessageSquare, MonitorPlay, Moon, Plus, Search, Settings, Sparkles, Users, Zap, Cloud,
} from "lucide-react";
import { useApp, type View } from "./providers";
import { Dashboard } from "./dashboard";
import { CalendarView } from "./calendar-view";
import { TasksView } from "./tasks-view";
import { AiWorkforce } from "./ai-workforce";
import { HrView } from "./hr-view";
import { LedView } from "./led-view";
import { SettingsView } from "./settings-view";
import { ChatDock, ChatWorkspace } from "./chat-panel";
import { DbBanner } from "./db-status";
import { EventModal, GlobalSearch, NewTaskModal, TaskDrawer } from "./task-ui";
import { Avatar } from "./ui";
import { cls, thaiFull, thaiTime } from "../lib/utils";

const NAV: { group: string; items: { key: View; label: string; icon: React.ReactNode; meta?: string }[] }[] = [
  {
    group: "Workspace",
    items: [
      { key: "dashboard", label: "แดชบอร์ด", icon: <LayoutDashboard size={16} /> },
      { key: "calendar", label: "ปฏิทิน", icon: <CalendarDays size={16} /> },
      { key: "tasks", label: "งาน & Kanban", icon: <Columns3 size={16} />, meta: "tasks" },
      { key: "ai", label: "AI Workforce", icon: <Bot size={16} />, meta: "ai" },
      { key: "chat", label: "แชท & Drive", icon: <MessageSquare size={16} />, meta: "chat" },
      { key: "hr", label: "HR & ลงเวลา", icon: <Users size={16} /> },
    ],
  },
  {
    group: "จอแสดงผล",
    items: [{ key: "led", label: "LED Wall · Park Silom", icon: <MonitorPlay size={16} /> }],
  },
  {
    group: "ระบบ",
    items: [{ key: "settings", label: "ตั้งค่า", icon: <Settings size={16} /> }],
  },
];

const TITLES: Record<View, { title: string; sub: string }> = {
  dashboard: { title: "แดชบอร์ด", sub: "ภาพรวมทีม งาน และ AI ในที่เดียว" },
  calendar: { title: "ปฏิทินทีม", sub: "เดือน / สัปดาห์ / วัน / กำหนดการ · ลากย้ายได้" },
  tasks: { title: "งาน & Kanban", sub: "4 สถานะ · งานย่อย · AI รับงานได้" },
  ai: { title: "AI Workforce", sub: "เอเจนต์ทำงานเหมือนคน พร้อม run log และ token" },
  chat: { title: "แชท & Google Drive", sub: "กลุ่ม · ปักหมุด · แชร์เอกสาร · AI ช่วยตอบ" },
  hr: { title: "HR & ลงเวลา", sub: "เช็คอินนอกสถานที่ · ลา · จองห้องประชุม" },
  led: { title: "LED Wall", sub: "เชื่อมจอ Playwall Park Silom" },
  settings: { title: "ตั้งค่า", sub: "องค์กร · AI · ฐานข้อมูล · การเชื่อมต่อ" },
};

export function Shell() {
  const { data, loading, error, view, go, now, setSearch, dockOpen, setDockOpen, eventForm, taskId } = useApp();
  const [newTask, setNewTask] = React.useState(false);
  const [topQ, setTopQ] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const openTasks = data?.tasks.filter((t) => t.status !== "done").length ?? 0;
  const unread = data?.channels.reduce((s, c) => s + (c.unread ?? 0), 0) ?? 0;
  const aiLive = data?.members.filter((m) => m.kind === "ai" && !m.paused).length ?? 0;
  const tokens = useMemo(() => data?.members.filter((m) => m.kind === "ai").reduce((s, m) => s + (m.tokensToday ?? 0), 0) ?? 0, [data]);
  const pendingLeaves = data?.leaves.filter((l) => l.status === "pending").length ?? 0;
  const me = data?.members.find((m) => m.id === data?.meId);

  const badge = (meta?: string) => {
    if (meta === "tasks") return openTasks;
    if (meta === "ai") return null;
    if (meta === "chat") return unread || null;
    return null;
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">iP</div>
          <div className="brand-txt">
            <b>iPlay Workspace</b>
            <small>Digital Agency OS</small>
          </div>
        </div>

        {NAV.map((group) => (
          <React.Fragment key={group.group}>
            <div className="side-label">{group.group}</div>
            {group.items.map((item) => (
              <button key={item.key} className={cls("nav-item", view === item.key && "on")} onClick={() => go(item.key)}>
                {item.icon}
                <span>{item.label}</span>
                {item.meta === "ai" ? (
                  <span className="nav-live"><span className="pulse" /> {aiLive}</span>
                ) : item.key === "hr" && pendingLeaves ? (
                  <span className="badge soft">{pendingLeaves}</span>
                ) : (
                  !!badge(item.meta) && <span className="badge">{badge(item.meta)}</span>
                )}
              </button>
            ))}
          </React.Fragment>
        ))}

        <div className="side-foot">
          <div className="side-card">
            <b><Sparkles size={12} /> AI ใน Workspace</b>
            {aiLive} เอเจนต์ออนไลน์ · {(tokens / 1000).toFixed(0)}k tokens วันนี้
            <div className="meter mint"><i style={{ width: "68%" }} /></div>
          </div>
          <button className="nav-item" onClick={() => setDockOpen(!dockOpen)} style={{ paddingLeft: 11 }}>
            <MessageSquare size={15} />
            <span>บอร์ดแชททีม</span>
            <span className="tiny muted" style={{ marginLeft: "auto" }}>{dockOpen ? "ซ่อน" : "เปิด"}</span>
          </button>
          <div className="tiny muted" style={{ padding: "6px 10px", display: "flex", gap: 6, alignItems: "center" }}>
            <Cloud size={11} /> Drive + MCP พร้อมใช้งาน
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{TITLES[view].title}</h1>
            <p>{TITLES[view].sub}</p>
          </div>
          <div className="searchbox">
            <Search size={14} />
            <input
              id="global-search"
              placeholder="ค้นหางาน อีเวนต์ โปรเจกต์…"
              value={topQ}
              onChange={(e) => { setTopQ(e.target.value); setSearch(e.target.value); }}
              onKeyDown={(e) => { if (e.key === "Escape") { setTopQ(""); setSearch(""); (e.target as HTMLInputElement).blur(); } }}
            />
            <kbd><Command size={9} /> K</kbd>
          </div>
          <div className="topbar-right">
            <button
              className="storage-chip"
              onClick={() => go("settings")}
              title={data?.storage === "fallback" ? `${data?.dbError?.code}: ${data?.dbError?.message}` : "สถานะฐานข้อมูล"}
              style={{
                background: data?.storage === "mariadb" ? "rgba(53,224,161,.14)" : data?.storage === "fallback" ? "rgba(255,107,138,.16)" : "rgba(255,194,77,.14)",
                color: data?.storage === "mariadb" ? "var(--mint)" : data?.storage === "fallback" ? "var(--red)" : "var(--amber)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 9, background: "currentColor" }} />
              {data?.storage === "mariadb" ? "MariaDB" : data?.storage === "fallback" ? "ข้อมูลสำรอง" : "Demo"}
            </button>
            <div className="today-chip">
              <b>{mounted ? thaiFull(now) : "—"}</b>
              <small>{mounted ? `เวลา ${thaiTime(now.toISOString())}` : ""}</small>
            </div>
            <button className="icon-btn tb-bell" title="แจ้งเตือน">
              <Bell size={15} />
              {!!pendingLeaves && <span style={{ position: "absolute", width: 6, height: 6, background: "var(--pink)", borderRadius: 9, transform: "translate(7px,-8px)" }} />}
            </button>
            <button className="icon-btn" title="AI Console" onClick={() => go("ai")}><Zap size={15} /></button>
            <button className="btn tb-chat" onClick={() => setDockOpen(!dockOpen)} title="บอร์ดแชทด้านขวา">
              <MessageSquare size={14} /> แชท
              {!!unread && <span className="badge" style={{ background: "var(--violet)", color: "#fff", fontSize: 9, padding: "0 5px", borderRadius: 20 }}>{unread}</span>}
            </button>
            <button className="btn btn-primary" onClick={() => setNewTask(true)}><Plus size={14} /> สร้างงาน</button>
            {me && (
              <div className="user-chip">
                <Avatar member={me} />
                <div className="u-meta"><b>{me.nickname}</b><small>{me.role.split(" / ")[0]}</small></div>
              </div>
            )}
          </div>
        </header>

        <DbBanner />

        <div className={cls("content", (view === "calendar" || view === "chat") && "flush")}>
          {loading && <Skeleton />}
          {error && !data && (
            <div className="card" style={{ padding: 20, borderColor: "rgba(255,107,138,.4)" }}>
              <b>เชื่อมต่อข้อมูลไม่ได้</b>
              <p className="tiny muted" style={{ marginTop: 4 }}>{error} — ตรวจสอบว่าเซิร์ฟเวอร์และฐานข้อมูลทำงานอยู่</p>
            </div>
          )}
          {data && (
            <>
              {view === "dashboard" && <Dashboard />}
              {view === "calendar" && <CalendarView />}
              {view === "tasks" && <TasksView />}
              {view === "ai" && <AiWorkforce />}
              {view === "chat" && <ChatWorkspace />}
              {view === "hr" && <HrView />}
              {view === "led" && <LedView />}
              {view === "settings" && <SettingsView />}
            </>
          )}
        </div>
      </div>

      {view !== "chat" && <ChatDock />}

      <TaskDrawer key={taskId ?? "none"} />
      {eventForm.open && <EventModal />}
      <GlobalSearch />
      {newTask && <NewTaskModal onClose={() => setNewTask(false)} />}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="page">
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi" style={{ height: 108, opacity: 0.5 }}>
            <div className="meter"><i style={{ width: "40%" }} /></div>
            <div className="meter"><i style={{ width: "70%" }} /></div>
          </div>
        ))}
      </div>
      <div className="card" style={{ height: 180, display: "grid", placeItems: "center" }}>
        <div className="row muted" style={{ gap: 8 }}><span className="pulse" /> กำลังโหลด Workspace…</div>
      </div>
    </div>
  );
}
