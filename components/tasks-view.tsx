"use client";

import React, { useMemo, useState } from "react";
import {
  AlarmClock, Bot, CheckCircle2, Columns3, Flag, ListFilter, Plus, Search,
  Sparkles, Table2, Timer, Zap, GripVertical, Layers, CalendarClock,
} from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Empty, Meter, PriorityPill, StatusPill } from "./ui";
import { NewTaskModal } from "./task-ui";
import type { Priority, TaskStatus } from "../lib/types";
import { PRIORITY_META, STATUS_META, STATUS_ORDER, cls, relDay, thaiShort } from "../lib/utils";

export function TasksView() {
  const { data, act, openTask, toast, search, setSearch } = useApp();
  const [mode, setMode] = useState<"board" | "table">("board");
  const [prio, setPrio] = useState<Priority | "all">("all");
  const [project, setProject] = useState<string>("all");
  const [mine, setMine] = useState(false);
  const [aiOnly, setAiOnly] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [creating, setCreating] = useState<TaskStatus | null>(null);

  const tasks = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.tasks.filter((t) => {
      if (prio !== "all" && t.priority !== prio) return false;
      if (project !== "all" && t.projectId !== project) return false;
      if (mine && t.assigneeId !== data.meId) return false;
      if (aiOnly && !t.assigneeId.startsWith("ai_")) return false;
      if (q && !(t.title + t.code + t.tags.join(" ")).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, prio, project, mine, aiOnly, search]);

  if (!data) return null;

  const drop = async (status: TaskStatus) => {
    if (!dragId) return;
    const t = data.tasks.find((x) => x.id === dragId);
    await act({ type: "task.move", id: dragId, status });
    if (t) toast(`ย้าย ${t.code} → ${STATUS_META[status].label}`, "ok");
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="page">
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="board-toolbar">
          <div className="searchbox" style={{ width: 230 }}>
            <Search size={14} />
            <input id="task-search" placeholder="ค้นหางาน / รหัส / แท็ก…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 160 }} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">ทุกโปรเจกต์</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" style={{ width: 130 }} value={prio} onChange={(e) => setPrio(e.target.value as Priority | "all")}>
            <option value="all">ทุกระดับ</option>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
          <button className={cls("chip", mine && "on")} onClick={() => setMine((v) => !v)}>งานของฉัน</button>
          <button className={cls("chip", aiOnly && "on")} onClick={() => setAiOnly((v) => !v)}><Bot size={11} /> AI รับผิดชอบ</button>
        </div>
        <div className="row">
          <div className="seg">
            <button className={mode === "board" ? "on" : ""} onClick={() => setMode("board")}><Columns3 size={12} /> บอร์ด</button>
            <button className={mode === "table" ? "on" : ""} onClick={() => setMode("table")}><Table2 size={12} /> ตาราง</button>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating("todo")}><Plus size={14} /> สร้างงาน</button>
        </div>
      </div>

      <div className="row" style={{ gap: 14, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
        <span><Layers size={11} /> {tasks.length} งานตามตัวกรอง</span>
        <span><AlarmClock size={11} /> เลยกำหนด {tasks.filter((t) => t.status !== "done" && new Date(t.due + "T23:59:59") < new Date()).length}</span>
        <span><Bot size={11} /> AI ดูแล {tasks.filter((t) => t.assigneeId.startsWith("ai_")).length}</span>
        <span><Sparkles size={11} /> AI สร้าง {tasks.filter((t) => t.aiGenerated).length}</span>
      </div>

      {mode === "board" ? (
        <div className="kanban">
          {STATUS_ORDER.map((status) => {
            const list = tasks.filter((t) => t.status === status);
            const meta = STATUS_META[status];
            return (
              <div
                key={status}
                className={cls("kcol", overCol === status && "over")}
                onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
                onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
                onDrop={(e) => { e.preventDefault(); void drop(status); }}
              >
                <div className="kcol-head">
                  <span style={{ width: 8, height: 8, borderRadius: 9, background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />
                  <b>{meta.label}</b>
                  <span className="cnt">{list.length}</span>
                  <button className="add" onClick={() => setCreating(status)} title="เพิ่มงาน"><Plus size={14} /></button>
                </div>
                {list.map((t) => {
                  const p = data.projects.find((x) => x.id === t.projectId);
                  const u = data.members.find((m) => m.id === t.assigneeId);
                  const late = new Date(t.due + "T23:59:59") < new Date() && t.status !== "done";
                  const soon = !late && (new Date(t.due + "T23:59:59").getTime() - Date.now()) / 86400000 <= 3;
                  const doneSubs = t.subtasks.filter((s) => s.done).length;
                  return (
                    <div
                      key={t.id}
                      className={cls("kcard", dragId === t.id && "dragging")}
                      draggable
                      onDragStart={(e) => { setDragId(t.id); e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onClick={() => openTask(t.id)}
                      style={{ borderTop: `2px solid ${meta.color}33` }}
                    >
                      <div className="kc-top">
                        <span className="kc-code">{t.code}</span>
                        {p && <span className="pill" style={{ background: `${p.color}22`, color: p.color, fontSize: 9 }}>{p.code}</span>}
                        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                          {t.aiGenerated && <span className="ai-flag"><Sparkles size={8} /> AI</span>}
                          <GripVertical size={12} style={{ opacity: 0.25 }} />
                        </span>
                      </div>
                      <h4>{t.title}</h4>
                      {!!t.tags.length && (
                        <div className="kc-tags">{t.tags.map((tag) => <span key={tag} className="kc-tag">#{tag}</span>)}</div>
                      )}
                      <Meter value={t.progress} tone={t.progress === 100 ? "mint" : ""} />
                      <div className="kc-foot">
                        <span className={cls("kc-meta", late && "kc-due late", soon && "kc-due soon")}>
                          <CalendarClock size={10} /> {relDay(t.due)}
                        </span>
                        {!!t.subtasks.length && <span className="kc-meta"><CheckCircle2 size={10} /> {doneSubs}/{t.subtasks.length}</span>}
                        <span className="kc-meta"><Timer size={10} /> {t.spent}/{t.estimate}ชม.</span>
                        <span style={{ marginLeft: "auto" }}><PriorityPill priority={t.priority} /></span>
                        <Avatar member={u} size="sm" />
                      </div>
                    </div>
                  );
                })}
                {!list.length && <Empty icon={<Zap size={20} />} text="ลากงานมาวางที่นี่" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ overflow: "auto" }}>
          <table className="kanban-table">
            <thead>
              <tr>
                <th>รหัส</th><th>งาน</th><th>โปรเจกต์</th><th>ผู้รับผิดชอบ</th><th>ความสำคัญ</th>
                <th>เดดไลน์</th><th>ความคืบหน้า</th><th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const p = data.projects.find((x) => x.id === t.projectId);
                const u = data.members.find((m) => m.id === t.assigneeId);
                return (
                  <tr key={t.id} onClick={() => openTask(t.id)}>
                    <td className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{t.code}</td>
                    <td>
                      <b style={{ fontSize: 12, fontWeight: 600 }}>{t.title}</b>
                      <div className="tiny muted">{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} งานย่อย · {t.comments.length} คอมเมนต์</div>
                    </td>
                    <td><span className="pill" style={{ background: `${p?.color}22`, color: p?.color }}>{p?.code}</span></td>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <Avatar member={u} size="sm" /> <span style={{ fontSize: 11.5 }}>{u?.nickname}</span>
                        {u?.kind === "ai" && <Sparkles size={10} style={{ color: "var(--mint)" }} />}
                      </span>
                    </td>
                    <td><PriorityPill priority={t.priority} /></td>
                    <td style={{ fontSize: 11 }}>
                      {thaiShort(t.due)}
                      <div className="tiny" style={{ color: new Date(t.due + "T23:59:59") < new Date() && t.status !== "done" ? "var(--red)" : "var(--muted)" }}>{relDay(t.due)}</div>
                    </td>
                    <td style={{ width: 110 }}><Meter value={t.progress} /><span className="tiny muted">{t.progress}%</span></td>
                    <td><StatusPill status={t.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!tasks.length && <Empty icon={<ListFilter size={24} />} text="ไม่พบงานตามตัวกรอง" />}
        </div>
      )}

      {creating && <NewTaskModal defaultStatus={creating} onClose={() => setCreating(null)} />}
    </div>
  );
}
