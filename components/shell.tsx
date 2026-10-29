"use client";

import React, { useMemo } from "react";
import {
  Bell, Bot, CalendarDays, ChevronDown, Columns3, Command, FileBarChart2, KeyRound, LayoutDashboard,
  LogOut, MessageSquare, MonitorPlay, Plus, Search, Settings, ShieldCheck, Sparkles, Users, UserCog, Zap, Cloud,
  Link2, UserCircle2, FolderKanban, Network,
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
import { ReportsView } from "./reports-view";
import { StaffView } from "./staff-view";
import { ProfileView } from "./profile-view";
import { ProjectsView } from "./projects-view";
import { OrgChartView } from "./org-chart";
import { RoleDashboard } from "./role-dashboard";
import { DbBanner } from "./db-status";
import { EventModal, GlobalSearch, NewTaskModal, TaskDrawer } from "./task-ui";
import { Avatar, Modal } from "./ui";
import { cls, thaiFull, thaiTime } from "../lib/utils";
import { ROLE_META, canAccess, type ModuleKey } from "../lib/rbac";

interface NavItem { key: View; label: string; icon: React.ReactNode; module: ModuleKey; meta?: string }

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Workspace",
    items: [
      { key: "dashboard", label: "แดชบอร์ด", icon: <LayoutDashboard size={16} />, module: "dashboard" },
      { key: "calendar", label: "ปฏิทิน", icon: <CalendarDays size={16} />, module: "calendar" },
      { key: "tasks", label: "งาน & Kanban", icon: <Columns3 size={16} />, module: "tasks", meta: "tasks" },
      { key: "ai", label: "AI Workforce", icon: <Bot size={16} />, module: "ai", meta: "ai" },
      { key: "chat", label: "แชท & Drive", icon: <MessageSquare size={16} />, module: "chat", meta: "chat" },
      { key: "reports", label: "รายงาน & Drive", icon: <FileBarChart2 size={16} />, module: "reports" },
      { key: "hr", label: "HR & ลงเวลา", icon: <Users size={16} />, module: "hr" },
    ],
  },
  {
    group: "บริหารองค์กร",
    items: [
      { key: "staff", label: "พนักงาน & สิทธิ์", icon: <UserCog size={16} />, module: "staff" },
      { key: "org", label: "ผังองค์กร", icon: <Network size={16} />, module: "staff" },
      { key: "projects", label: "โปรเจกต์", icon: <FolderKanban size={16} />, module: "tasks" },
    ],
  },
  {
    group: "จอแสดงผล",
    items: [{ key: "led", label: "LED Wall · Park Silom", icon: <MonitorPlay size={16} />, module: "led" }],
  },
  {
    group: "ระบบ",
    items: [
      { key: "profile", label: "โปรไฟล์ของฉัน", icon: <UserCircle2 size={16} />, module: "dashboard" },
      { key: "settings", label: "ตั้งค่า", icon: <Settings size={16} />, module: "settings" },
    ],
  },
];

const TITLES: Record<View, { title: string; sub: string }> = {
  dashboard: { title: "แดชบอร์ด", sub: "ภาพรวมทีม งาน และ AI ในที่เดียว" },
  calendar: { title: "ปฏิทินทีม", sub: "เดือน / สัปดาห์ / วัน / กำหนดการ · ลากย้ายได้" },
  tasks: { title: "งาน & Kanban", sub: "4 สถานะ · งานย่อย · AI รับงานได้" },
  ai: { title: "AI Workforce", sub: "เอเจนต์ทำงานเหมือนคน พร้อม run log และ token" },
  chat: { title: "แชท & Google Drive", sub: "กลุ่ม · ปักหมุด · แชร์เอกสาร · AI ช่วยตอบ" },
  reports: { title: "รายงาน & Google Drive", sub: "สร้าง/แก้ไขรายงาน · แนบไฟล์ Drive · อนุมัติ" },
  hr: { title: "HR & ลงเวลา", sub: "เช็คอินนอกสถานที่ · ลา · จองห้องประชุม" },
  staff: { title: "พนักงาน & สิทธิ์", sub: "ทะเบียนพนักงานแยกแผนก · ประวัติแก้ไข · การเข้าใช้ระบบ" },
  led: { title: "LED Wall", sub: "เชื่อมจอ Playwall Park Silom" },
  settings: { title: "ตั้งค่า", sub: "องค์กร · พนักงาน & สิทธิ์ · รายงาน & Drive · ฐานข้อมูล" },
  profile: { title: "โปรไฟล์ของฉัน", sub: "ช่องทางเข้าสู่ระบบ · Google / LINE · Google Drive ของคุณ" },
  projects: { title: "บริหารจัดการโปรเจกต์", sub: "สร้าง/แก้ไข/ลบโปรเจกต์ · งบประมาณ · ความคืบหน้า · ทีมงาน" },
  org: { title: "ผังองค์กร", sub: "โครงสร้างทีมจากแผนกถึงรายบุคคล · รูปพนักงานจาก LINE หรืออัปโหลดเอง" },
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
  const session = useApp().me;

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/play-digital.png" alt="play digital" className="brand-logo" />
          <div className="brand-txt">
            <b>Workspace</b>
            <small>Digital Agency OS</small>
          </div>
        </div>

        {NAV.map((group) => {
          const items = group.items.filter((it) => !session || canAccess(session.role, it.module));
          if (!items.length) return null;
          return (
          <React.Fragment key={group.group}>
            <div className="side-label">{group.group}</div>
            {items.map((item) => (
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
          );
        })}

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
          {session && (
            <div className="role-foot" style={{ padding: "8px 10px", borderRadius: 12, background: ROLE_META[session.role].soft, color: ROLE_META[session.role].color, fontSize: 10.5 }}>
              <b style={{ display: "flex", alignItems: "center", gap: 5 }}><ShieldCheck size={11} /> {ROLE_META[session.role].label}</b>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>{session.departmentId ? "เห็นข้อมูลตามแผนกที่กำหนด" : ROLE_META[session.role].desc}</div>
            </div>
          )}
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
                background: data?.storage === "mariadb" ? "rgba(34,199,147,.14)" : data?.storage === "fallback" ? "rgba(255,92,122,.16)" : "rgba(255,176,32,.14)",
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
            <UserMenu />
          </div>
        </header>

        <DbBanner />

        <div className={cls("content", (view === "calendar" || view === "chat") && "flush")}>
          {loading && <Skeleton />}
          {error && !data && (
            <div className="card" style={{ padding: 20, borderColor: "rgba(255,92,122,.4)" }}>
              <b>เชื่อมต่อข้อมูลไม่ได้</b>
              <p className="tiny muted" style={{ marginTop: 4 }}>{error} — ตรวจสอบว่าเซิร์ฟเวอร์และฐานข้อมูลทำงานอยู่</p>
            </div>
          )}
          {data && (
            <>
              {view === "dashboard" && (session ? <RoleDashboard me={session} /> : <Dashboard />)}
              {view === "calendar" && <CalendarView />}
              {view === "tasks" && <TasksView />}
              {view === "ai" && <AiWorkforce />}
              {view === "chat" && <ChatWorkspace />}
              {view === "reports" && <ReportsView />}
              {view === "hr" && <HrView />}
              {view === "staff" && <StaffView />}
              {view === "led" && <LedView />}
              {view === "settings" && <SettingsView />}
              {view === "profile" && <ProfileView />}
              {view === "projects" && <ProjectsView />}
              {view === "org" && <OrgChartView />}
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


function UserMenu() {
  const { me, data, go } = useApp();
  const [open, setOpen] = React.useState(false);
  const [pwOpen, setPwOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const member = data?.members.find((m) => m.id === data?.meId);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!me) return null;
  const manager = me.role === "admin" || me.role === "support";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-chip" onClick={() => setOpen(!open)} title={me.email}>
        {member ? <Avatar member={member} /> : <span className="avatar" style={{ background: me.color, color: "#fff" }}>{me.initials}</span>}
        <div className="u-meta">
          <b>{me.nickname || me.name}</b>
          <small>{me.role === "admin" ? "Admin" : me.role === "support" ? "Support" : "Member"}</small>
        </div>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="user-pop">
          <div className="up-head">
            <b>{me.name}</b>
            <div className="tiny muted">{me.email}</div>
            {me.isSuper ? (
              <span className="role-pill super"><ShieldCheck size={10} /> SUPER ADMIN · ทุกสิทธิ์</span>
            ) : (
              <span className={`role-pill ${me.role}`}>
                <ShieldCheck size={10} /> {me.role === "admin" ? "Admin · สิทธิ์เต็ม" : me.role === "support" ? "Support" : me.role === "manager" ? "Manager" : me.role === "ai" ? "ทีม AI" : "User"}
              </span>
            )}
          </div>
          {manager && (
            <>
              <button onClick={() => { setOpen(false); go("settings"); }}>
                <Settings size={14} /> ตั้งค่าระบบ
              </button>
              <button onClick={() => { setOpen(false); go("settings"); }}>
                <UserCog size={14} /> พนักงาน & สิทธิ์
              </button>
              <button onClick={() => { setOpen(false); go("reports"); }}>
                <FileBarChart2 size={14} /> รายงานทีม
              </button>
            </>
          )}
          <button onClick={() => { setOpen(false); go("profile"); }}>
            <Link2 size={14} /> โปรไฟล์ & ช่องทาง Login
          </button>
          <button onClick={() => { setOpen(false); setPwOpen(true); }}>
            <KeyRound size={14} /> เปลี่ยนรหัสผ่าน
          </button>
          <button className="danger" onClick={() => void logout()}>
            <LogOut size={14} /> ออกจากระบบ
          </button>
        </div>
      )}
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (next.length < 6) return toast("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", "err");
    if (next !== confirm) return toast("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน", "err");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      toast("เปลี่ยนรหัสผ่านแล้ว", "ok");
      onClose();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="เปลี่ยนรหัสผ่าน"
      subtitle="ใช้สำหรับเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน"
      icon={<KeyRound size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="field"><span className="label">รหัสผ่านปัจจุบัน</span><input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="ถ้าเข้าด้วย Google/LINE เว้นว่างได้" /></label>
        <label className="field"><span className="label">รหัสผ่านใหม่</span><input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <label className="field"><span className="label">ยืนยันรหัสผ่านใหม่</span><input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      </div>
    </Modal>
  );
}
