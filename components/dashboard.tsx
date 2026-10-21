"use client";

import React, { useMemo, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, Bot, CalendarDays, CheckCircle2, Clock,
  Flame, FolderKanban, Gauge, ListTodo, Plus, Sparkles, TrendingUp, Users, Wallet, Zap,
} from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Empty, Meter, PriorityPill, StatusPill } from "./ui";
import { BarChart, Donut, LineChart, Spark, WorkloadBars } from "./charts";
import { PRIORITY_META, STATUS_META, STATUS_ORDER, TH_DOW, addDays, d2s, relDay, relTime, startOfWeek, thaiDate, thaiFull, thaiShort, money, cls } from "../lib/utils";
import { agentStatusText } from "../lib/ai";

export function Dashboard() {
  const { data, go, openTask, openEvent, now } = useApp();
  const [chart, setChart] = useState<"work" | "revenue">("work");
  if (!data) return null;

  const openTasks = data.tasks.filter((t) => t.status !== "done");
  const urgent = openTasks.filter((t) => t.priority === "urgent");
  const overdue = openTasks.filter((t) => new Date(t.due + "T23:59:59") < now);
  const dueSoon = openTasks.filter((t) => {
    const diff = (new Date(t.due + "T23:59:59").getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff <= 3;
  });
  const todayEvents = data.events.filter((e) => e.date === data.today).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const agents = data.members.filter((m) => m.kind === "ai");
  const humans = data.members.filter((m) => m.kind === "human");
  const running = agents.filter((a) => !a.paused && a.state === "working");
  const featured = [...data.projects].filter((p) => p.status !== "done").sort((a, b) => b.progress - a.progress).slice(0, 3);
  const stCount = STATUS_ORDER.map((s) => data.tasks.filter((t) => t.status === s).length);
  const todayDone = data.tasks.filter((t) => t.status === "done").length;

  const weekStart = startOfWeek(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => d2s(addDays(weekStart, i)));

  return (
    <div className="page">
      {/* ── KPI ─────────────────────────────────────────── */}
      <div className="kpi-grid">
        <Kpi icon={<FolderKanban size={17} />} grad="var(--grad-violet)" glow="rgba(139,124,255,.3)" value={data.projects.filter((p) => p.status !== "done").length} label="โปรเจกต์ที่กำลังทำ" trend={`+${data.projects.length} ทั้งหมด`} />
        <Kpi icon={<ListTodo size={17} />} grad="var(--grad-cyan)" glow="rgba(76,195,255,.28)" value={openTasks.length} label={`งานคงค้าง · ${overdue.length} เลยกำหนด`} trend={`${todayDone} ปิดแล้ว`} />
        <Kpi icon={<Flame size={17} />} grad="var(--grad-amber)" glow="rgba(255,194,77,.28)" value={dueSoon.length} label="ใกล้เดดไลน์ (≤ 3 วัน)" trend={dueSoon.length ? "ต้องเร่ง" : "โล่ง"} down={!dueSoon.length} />
        <Kpi icon={<Bot size={17} />} grad="var(--grad-mint)" glow="rgba(53,224,161,.3)" value={agents.length} label={`AI agents · ${running.length} กำลังทำงาน`} trend={`${data.aiRuns.filter((r) => r.status === "success").length} runs วันนี้`} />
      </div>

      {/* ── AI strip ────────────────────────────────────── */}
      <div className="ai-strip">
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minWidth: 176 }}>
          <div className="row" style={{ gap: 6, fontSize: 12, fontWeight: 700 }}>
            <span className="pulse" /> AI กำลังทำงาน
          </div>
          <div className="tiny muted">เอเจนต์ลงมือทำงานเหมือนคน — มีงาน มี log มี token</div>
          <button className="link-btn" style={{ marginTop: 3 }} onClick={() => go("ai")}>
            เปิด AI Workforce <ArrowRight size={11} />
          </button>
        </div>
        {agents.map((a) => {
          const task = data.tasks.find((t) => t.id === a.currentTaskId);
          return (
            <button key={a.id} className="agent-card" onClick={() => go("ai")}>
              <Avatar member={a} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="spread">
                  <b>{a.name}</b>
                  <span className="tiny" style={{ color: a.paused ? "var(--amber)" : "var(--mint)" }}>{a.paused ? "พัก" : "live"}</span>
                </span>
                <small>{agentStatusText(data, a)}</small>
                {task && <span className="a-task"><Zap size={9} /> {task.code}</span>}
              </span>
              {!a.paused && (
                <span className="wave">{[0, 1, 2, 3].map((i) => <i key={i} style={{ animationDelay: `${i * 0.16}s` }} />)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── urgent + trend chart ────────────────────────── */}
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Flame size={14} /> งานเร่งด่วน</div>
            <div className="right">
              <button className="link-btn" onClick={() => go("tasks")}>ดูทั้งหมด <ArrowRight size={11} /></button>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {urgent.slice(0, 5).map((t) => {
              const p = data.projects.find((x) => x.id === t.projectId);
              const u = data.members.find((m) => m.id === t.assigneeId);
              return (
                <button key={t.id} className="list-row" onClick={() => openTask(t.id)}>
                  <span className="lr-ico" style={{ background: p?.color }}>{p?.code}</span>
                  <span className="lr-main">
                    <b>{t.title}</b>
                    <small>{t.code} · <PriorityPill priority={t.priority} /> <span className="muted">{p?.name}</span></small>
                  </span>
                  <span className="lr-right">
                    <b style={{ color: relDay(t.due).includes("เลย") ? "var(--red)" : "var(--amber)" }}>{relDay(t.due)}</b>
                    <small><Avatar member={u} size="sm" /></small>
                  </span>
                </button>
              );
            })}
            {!urgent.length && <Empty icon={<CheckCircle2 size={24} />} text="ไม่มีงานด่วน — เคลียร์หมดแล้ว 🎉" />}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><TrendingUp size={14} /> แนวโน้มงาน & รายได้</div>
            <div className="right">
              <div className="seg">
                <button className={chart === "work" ? "on" : ""} onClick={() => setChart("work")}>งาน</button>
                <button className={chart === "revenue" ? "on" : ""} onClick={() => setChart("revenue")}>รายได้</button>
              </div>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {chart === "work" ? (
              <>
                <LineChart series={[data.trend.created, data.trend.done]} labels={data.trend.labels} />
                <div className="row" style={{ gap: 14, marginTop: 6, fontSize: 10.5, color: "var(--muted)" }}>
                  <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9, background: "#8B7CFF", marginRight: 5 }} />งานสร้างใหม่</span>
                  <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9, background: "#35E0A1", marginRight: 5 }} />ปิดงานแล้ว</span>
                </div>
              </>
            ) : (
              <>
                <BarChart values={data.trend.revenue} labels={data.trend.labels} color="#35E0A1" yFmt={(v) => `฿${v}k`} />
                <div className="row" style={{ marginTop: 6, fontSize: 10.5, color: "var(--muted)" }}>
                  รายได้ต่อเดือน (พันบาท) · ปี {thaiDate(data.today, {}).split(" ").slice(-1)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── projects ────────────────────────────────────── */}
      <div className="spread">
        <div className="card-title" style={{ fontSize: 13.5 }}><Sparkles size={14} /> โปรเจกต์เด่น <span className="tiny muted" style={{ fontWeight: 400 }}>คลิกเพื่อดูงานในโปรเจกต์</span></div>
        <button className="link-btn" onClick={() => go("tasks")}>ไปที่บอร์ดงาน <ArrowRight size={11} /></button>
      </div>
      <div className="feat-row">
        {featured.map((p) => {
          const pend = data.tasks.filter((t) => t.projectId === p.id && t.status !== "done").length;
          return (
            <button key={p.id} className="feat-card" style={{ background: p.grad }} onClick={() => go("tasks")}>
              <div className="fc-top">
                <div className="fc-logo">{p.code}</div>
                <div style={{ minWidth: 0 }}>
                  <b>{p.name}</b>
                  <small>{p.client}</small>
                </div>
              </div>
              <div className="fc-tags">
                <span>{STATUS_META[p.status === "planning" ? "todo" : p.status === "doing" ? "doing" : "review"].label}</span>
                <span>{p.members.length} คน</span>
                <span>{pend} งานคงค้าง</span>
              </div>
              <div className="fc-bottom">
                <b>{money(p.budget)}</b>
                <span>ส่ง {thaiShort(p.due)} · {Math.max(0, Math.ceil((new Date(p.due).getTime() - now.getTime()) / 86400000))} วัน</span>
              </div>
              <div className="fc-prog"><i style={{ width: `${p.progress}%` }} /></div>
            </button>
          );
        })}
      </div>

      {/* ── week + donut ────────────────────────────────── */}
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title"><CalendarDays size={14} /> ปฏิทินสัปดาห์นี้</div>
            <div className="right">
              <button className="link-btn" onClick={() => go("calendar")}>เปิดปฏิทินเต็มจอ <ArrowRight size={11} /></button>
            </div>
          </div>
          <div className="mini-week">
            {weekDays.map((ds) => {
              const d = new Date(ds + "T12:00:00");
              const evs = data.events.filter((e) => e.date === ds);
              return (
                <button key={ds} className={cls("mw-day", ds === data.today && "today")} onClick={() => openEvent({ date: ds })}>
                  <div className="dow">{TH_DOW[d.getDay()]}</div>
                  <div className="num">{d.getDate()}</div>
                  {evs.slice(0, 3).map((e) => (
                    <div key={e.id} className="mw-ev" style={{ background: ["work", "meeting", "delivery", "finance", "holiday", "personal"].includes(e.cat) ? { work: "#8B7CFF", meeting: "#4CC3FF", delivery: "#35E0A1", finance: "#FFC24D", holiday: "#FF7BA9", personal: "#9AA7C7" }[e.cat] : "#9AA7C7" }} title={e.title} />
                  ))}
                  {evs.length > 3 && <div className="tiny muted">+{evs.length - 3}</div>}
                  {!evs.length && <div className="mw-empty">ว่าง</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><Gauge size={14} /> สถานะงานทั้งหมด</div>
            <div className="right tiny muted">{data.tasks.length} งาน</div>
          </div>
          <div className="card-body row" style={{ gap: 18, alignItems: "center" }}>
            <Donut
              items={STATUS_ORDER.map((s) => ({ label: STATUS_META[s].label, value: stCount[STATUS_ORDER.indexOf(s)], color: STATUS_META[s].color }))}
              centerTop={data.tasks.length}
              centerBottom="งานในระบบ"
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {STATUS_ORDER.map((s) => (
                <div key={s} className="row" style={{ fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 9, background: STATUS_META[s].color }} />
                  <span style={{ flex: 1, color: "var(--text-2)" }}>{STATUS_META[s].label}</span>
                  <b>{data.tasks.filter((t) => t.status === s).length}</b>
                </div>
              ))}
              <div className="divider" style={{ margin: "3px 0" }} />
              <div className="row" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                <Clock size={10} /> งานเลยกำหนด {overdue.length} · วันนี้ {todayEvents.length} นัด
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── workload + feed ─────────────────────────────── */}
      <div className="grid-3">
        <div className="card">
          <div className="card-head"><div className="card-title"><Users size={14} /> ภาระงานทีม</div><div className="right tiny muted">ชม./สัปดาห์</div></div>
          <div className="card-body">
            <WorkloadBars
              rows={humans.map((m) => ({ name: m.name, role: m.role, color: m.color, value: m.load ?? 0, initials: m.initials }))}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title"><Bot size={14} /> AI utilization</div><div className="right tiny muted">tokens วันนี้</div></div>
          <div className="card-body">
            <WorkloadBars
              rows={agents.map((m) => ({ name: m.name, role: m.role, color: m.color, value: Math.min(100, Math.round((m.tokensToday ?? 0) / 5000)), initials: m.initials, ai: true }))}
            />
            <div className="divider" style={{ margin: "10px 0" }} />
            <div className="row" style={{ gap: 8, fontSize: 10.5, color: "var(--muted)" }}>
              <Sparkles size={11} /> งานที่ AI ปิดแล้ว {data.tasks.filter((t) => t.status === "done" && t.aiGenerated).length} · run วันนี้ {data.aiRuns.length}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title"><Activity size={14} /> กิจกรรมล่าสุด</div></div>
          <div className="card-body" style={{ maxHeight: 268, overflowY: "auto" }}>
            {data.activity.slice(0, 9).map((a) => {
              const m = data.members.find((x) => x.id === a.actorId);
              return (
                <div key={a.id} className="feed-item">
                  <span className="feed-dot" style={{ color: m?.color }}><Avatar member={m} size="sm" /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p>{a.text}</p>
                    <small>{m?.nickname} · {relTime(a.at)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 18 }}>📅</span>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 12 }}>วันนี้ · {thaiFull(data.today)}</b>
          <div className="tiny muted">นัดหมาย {todayEvents.length} รายการ · งานด่วน {urgent.length} · AI กำลังทำงาน {running.length} ตัว</div>
        </div>
        <button className="btn btn-sm" onClick={() => openEvent({ date: data.today })}><Plus size={12} /> เพิ่มนัด</button>
        <button className="btn btn-sm btn-primary" onClick={() => go("calendar")}><CalendarDays size={12} /> เปิดปฏิทิน</button>
      </div>
    </div>
  );
}

function Kpi({
  icon, grad, glow, value, label, trend, down,
}: { icon: React.ReactNode; grad: string; glow: string; value: number | string; label: string; trend: string; down?: boolean }) {
  return (
    <div className="kpi" style={{ ["--glow" as string]: glow }}>
      <div className="k-top">
        <span className="kpi-ico" style={{ background: grad }}>{icon}</span>
        <span className="kpi-trend" style={down ? { background: "rgba(255,255,255,.06)", color: "var(--muted)" } : undefined}>{trend}</span>
      </div>
      <div>
        <div className="kpi-val">{value}</div>
        <div className="kpi-lbl">{label}</div>
      </div>
    </div>
  );
}
