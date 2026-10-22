"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight, Bot, CalendarDays, Check, CheckCircle2, ChevronRight, Clock, Flag,
  ListChecks, MapPin, MessageSquare, Plus, Send, Sparkles, Tag, Timer, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Meter, Modal, PriorityPill, StatusPill } from "./ui";
import type { EventCat, Priority, TaskStatus } from "../lib/types";
import { CAT_META, CAT_ORDER, PRIORITY_META, STATUS_META, STATUS_ORDER, cls, relDay, thaiDate, thaiTime, uid } from "../lib/utils";

export function TaskDrawer() {
  const { data, taskId, closeTask, act, toast, openEvent } = useApp();
  const [comment, setComment] = useState("");
  const [sub, setSub] = useState("");
  const [agent, setAgent] = useState("ai_nova");
  const task = data?.tasks.find((t) => t.id === taskId);
  if (!data || !task) return null;

  const project = data.projects.find((p) => p.id === task.projectId);
  const assignee = data.members.find((m) => m.id === task.assigneeId);
  const agents = data.members.filter((m) => m.kind === "ai");
  const runs = data.aiRuns.filter((r) => r.taskId === task.id);
  const doneSubs = task.subtasks.filter((s) => s.done).length;

  const patch = (p: Record<string, unknown>) => void act({ type: "task.update", id: task.id, patch: p as never });

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeTask()}>
      <div className="drawer">
        <div className="drawer-head">
          <div style={{ flex: 1 }}>
            <small className="row" style={{ gap: 6 }}>
              <span style={{ color: project?.color, fontWeight: 700 }}>{project?.code}</span> · {task.code}
              {task.aiGenerated && <span className="pill" style={{ background: "rgba(34,199,147,.14)", color: "var(--mint)" }}><Sparkles size={9} /> AI สร้าง</span>}
            </small>
            <h3 style={{ marginTop: 4, fontSize: 16, lineHeight: 1.4 }}>{task.title}</h3>
            <small>{project?.name} · สร้าง {thaiDate(task.createdAt.slice(0, 10), { short: true })}</small>
          </div>
          <button className="icon-btn" onClick={closeTask}><X size={15} /></button>
        </div>

        <div className="drawer-body">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <StatusPill status={task.status} />
            <PriorityPill priority={task.priority} />
            <span className="pill" style={{ background: "var(--tint-2)", color: "var(--text-2)" }}>
              <CalendarDays size={9} /> {relDay(task.due)} · {thaiDate(task.due, { short: true })}
            </span>
            {task.blocked && <span className="pill" style={{ background: "rgba(255,92,122,.14)", color: "var(--red)" }}>ติด blocker</span>}
          </div>

          <div className="task-meta-grid">
            <label className="field">
              <span className="label">สถานะ</span>
              <select className="select" value={task.status} onChange={(e) => void act({ type: "task.move", id: task.id, status: e.target.value as TaskStatus })}>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">ความสำคัญ</span>
              <select className="select" value={task.priority} onChange={(e) => patch({ priority: e.target.value as Priority })}>
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">ผู้รับผิดชอบ</span>
              <select className="select" value={task.assigneeId} onChange={(e) => patch({ assigneeId: e.target.value })}>
                <optgroup label="ทีมงาน">
                  {data.members.filter((m) => m.kind === "human").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </optgroup>
                <optgroup label="AI agents">
                  {agents.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                </optgroup>
              </select>
            </label>
            <label className="field">
              <span className="label">เดดไลน์ (ขึ้นปฏิทินอัตโนมัติ)</span>
              <input className="input" type="date" value={task.due} onChange={(e) => patch({ due: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">ชั่วโมงประเมิน</span>
              <input className="input" type="number" min={0} value={task.estimate} onChange={(e) => patch({ estimate: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">ความคืบหน้า — {task.progress}%</span>
              <input type="range" min={0} max={100} step={5} value={task.progress} onChange={(e) => patch({ progress: Number(e.target.value) })} style={{ accentColor: "var(--violet)" }} />
            </label>
          </div>

          <div className="row" style={{ gap: 10, padding: "4px 0" }}>
            <Avatar member={assignee} />
            <div style={{ flex: 1 }}>
              <div className="spread"><b style={{ fontSize: 11.5 }}>{assignee?.name}</b><small className="tiny muted">{assignee?.kind === "ai" ? "AI agent" : "ทีมงาน"}</small></div>
              <Meter value={task.progress} tone={assignee?.kind === "ai" ? "mint" : ""} />
            </div>
            <div style={{ textAlign: "right" }}>
              <b style={{ fontSize: 12 }}>{task.spent}/{task.estimate} ชม.</b>
              <small className="tiny muted" style={{ display: "block" }}>ใช้ไป / ประเมิน</small>
            </div>
          </div>

          <div>
            <div className="side-h"><Tag size={11} /> รายละเอียด</div>
            <textarea className="textarea" value={task.desc} placeholder="อธิบายงาน, เกณฑ์การส่งมอบ…" onChange={(e) => patch({ desc: e.target.value })} />
          </div>

          <div>
            <div className="side-h" style={{ justifyContent: "space-between" }}>
              <span className="row" style={{ gap: 5 }}><ListChecks size={11} /> งานย่อย {doneSubs}/{task.subtasks.length}</span>
              <span className="tiny muted">{task.progress}%</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {task.subtasks.map((s) => (
                <label key={s.id} className={cls("subtask", s.done && "done")} style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => void act({ type: "task.subtask", id: task.id, subId: s.id, done: e.target.checked })}
                  />
                  <span style={{ flex: 1 }}>{s.title}</span>
                  {s.by && <Avatar member={data.members.find((m) => m.id === s.by)} size="sm" />}
                </label>
              ))}
              <div className="row" style={{ marginTop: 4 }}>
                <input
                  className="input"
                  placeholder="เพิ่มงานย่อย แล้วกด Enter"
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sub.trim()) {
                      void act({ type: "task.update", id: task.id, patch: { subtasks: [...task.subtasks, { id: uid("s"), title: sub.trim(), done: false }] } });
                      setSub("");
                    }
                  }}
                />
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    if (!sub.trim()) return;
                    void act({ type: "task.update", id: task.id, patch: { subtasks: [...task.subtasks, { id: uid("s"), title: sub.trim(), done: false }] } });
                    setSub("");
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>

          {!!task.tags.length && (
            <div className="row" style={{ flexWrap: "wrap" }}>
              {task.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
            </div>
          )}

          <div className="side-card">
            <b><Bot size={12} /> มอบงานให้ AI ทำต่อ</b>
            AI จะเริ่มทำงานทันที บันทึก run + token ไว้ใน AI Console
            <div className="row" style={{ marginTop: 7 }}>
              <select className="select" style={{ flex: 1 }} value={agent} onChange={(e) => setAgent(e.target.value)}>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
              </select>
              <button
                className="btn btn-sm btn-mint"
                onClick={async () => {
                  await act({ type: "agent.run", id: agent, taskId: task.id });
                  toast(`${data.members.find((m) => m.id === agent)?.name} เริ่มทำงาน ${task.code} แล้ว`, "ai");
                }}
              >
                <Sparkles size={12} /> สั่งงาน
              </button>
            </div>
          </div>

          <div>
            <div className="side-h" style={{ justifyContent: "space-between" }}>
              <span className="row" style={{ gap: 5 }}><MessageSquare size={11} /> คอมเมนต์ ({task.comments.length})</span>
              <button className="link-btn" onClick={() => openEvent({ date: task.due, event: { id: "", title: `เดดไลน์: ${task.title}`, date: task.due, cat: "work", projectId: task.projectId, taskId: task.id } as never })}>
                เพิ่มลงปฏิทิน <ArrowRight size={10} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {task.comments.map((c) => {
                const u = data.members.find((m) => m.id === c.authorId);
                return (
                  <div key={c.id} className="comment">
                    <Avatar member={u} size="sm" />
                    <div className="bubble" style={{ flex: 1 }}>
                      <b className="spread">{u?.name}{u?.kind === "ai" && <span className="ai-tag" style={{ fontSize: 8, color: "var(--mint)" }}>AI</span>}</b>
                      <div style={{ fontSize: 12 }}>{c.text}</div>
                      <small>{thaiTime(c.at)}</small>
                    </div>
                  </div>
                );
              })}
              <div className="row">
                <input
                  className="input"
                  placeholder="เขียนคอมเมนต์… (Enter เพื่อส่ง)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && comment.trim()) {
                      await act({ type: "task.comment", id: task.id, text: comment.trim(), authorId: data.meId });
                      setComment("");
                    }
                  }}
                />
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!comment.trim()}
                  onClick={async () => {
                    await act({ type: "task.comment", id: task.id, text: comment.trim(), authorId: data.meId });
                    setComment("");
                  }}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>

          {!!runs.length && (
            <div>
              <div className="side-h"><Timer size={11} /> AI run log</div>
              {runs.map((r) => (
                <div key={r.id} className="run-row">
                  <span className={cls("run-dot", r.status)} />
                  <div style={{ flex: 1 }}>
                    <b>{data.members.find((m) => m.id === r.agentId)?.name} — {r.action}</b>
                    <small>{r.detail}</small>
                  </div>
                  <small className="tiny muted">{r.tokens.toLocaleString()} tok</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <button
            className="btn btn-ghost"
            style={{ color: "var(--red)" }}
            onClick={async () => {
              await act({ type: "task.delete", id: task.id });
              closeTask();
              toast(`ลบงาน ${task.code} แล้ว`, "info");
            }}
          >
            <Trash2 size={13} /> ลบงาน
          </button>
          <button className="btn" onClick={closeTask}>ปิด</button>
          {task.status !== "done" ? (
            <button
              className="btn btn-primary"
              onClick={async () => {
                await act({ type: "task.move", id: task.id, status: "done" });
                toast(`ปิดงาน ${task.code} แล้ว`, "ok");
              }}
            >
              <CheckCircle2 size={14} /> ปิดงาน
            </button>
          ) : (
            <button className="btn" onClick={() => void act({ type: "task.move", id: task.id, status: "doing" })}>เปิดงานใหม่</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewTaskModal({ onClose, defaultStatus = "todo" }: { onClose: () => void; defaultStatus?: TaskStatus }) {
  const { data, act, toast } = useApp();
  const [form, setForm] = useState({
    title: "", projectId: data?.projects[0]?.id ?? "", assigneeId: data?.meId ?? "",
    priority: "med" as Priority, status: defaultStatus, due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    estimate: 4, tags: "", desc: "",
  });
  const [aiDraft, setAiDraft] = useState(false);
  if (!data) return null;

  const submit = async () => {
    if (!form.title.trim()) return;
    await act({
      type: "task.create",
      task: {
        title: form.title.trim(), projectId: form.projectId, assigneeId: form.assigneeId,
        priority: form.priority, status: form.status, due: form.due, estimate: form.estimate,
        desc: form.desc, tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        createdBy: data.meId,
      },
    });
    toast(`สร้างงานใหม่แล้ว · เดดไลน์ขึ้นปฏิทินอัตโนมัติ`, "ok");
    onClose();
  };

  const draftWithAi = () => {
    const p = data.projects.find((x) => x.id === form.projectId);
    setAiDraft(true);
    setForm((f) => ({
      ...f,
      title: f.title || `${p?.code} — งานใหม่จากบรีฟลูกค้า`,
      desc: `${p?.name}\n• เป้าหมาย: \n• ขอบเขตงาน: \n• เกณฑ์ส่งมอบ: \n• ผู้เกี่ยวข้อง: ${data.members.filter((m) => p?.members.includes(m.id)).map((m) => m.nickname).join(", ")}`,
      estimate: 6,
      tags: "AI-draft",
    }));
    toast("NOVA ร่างรายละเอียดงานให้แล้ว — ตรวจแก้ได้เลย", "ai");
  };

  return (
    <Modal
      title="สร้างงานใหม่"
      subtitle="รหัสงานและเดดไลน์บนปฏิทินถูกสร้างให้อัตโนมัติ"
      icon={<Plus size={16} />}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={!form.title.trim()}>
            <Check size={14} /> สร้างงาน
          </button>
        </>
      }
    >
      <div className="row">
        <input className="input" autoFocus placeholder="ชื่องาน เช่น ปรับหน้า Calendar ให้ลากอีเวนต์ข้ามเดือนได้" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <button className="btn btn-sm" onClick={draftWithAi}><Sparkles size={13} /> ให้ AI ร่าง</button>
      </div>
      <div className="grid-3">
        <label className="field">
          <span className="label">โปรเจกต์</span>
          <select className="select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">ผู้รับผิดชอบ</span>
          <select className="select" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <optgroup label="ทีมงาน">
              {data.members.filter((m) => m.kind === "human").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
            <optgroup label="AI agents">
              {data.members.filter((m) => m.kind === "ai").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="field">
          <span className="label">ความสำคัญ</span>
          <select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">สถานะ</span>
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">เดดไลน์</span>
          <input className="input" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">ชั่วโมงประเมิน</span>
          <input className="input" type="number" min={0} value={form.estimate} onChange={(e) => setForm({ ...form, estimate: Number(e.target.value) })} />
        </label>
      </div>
      <label className="field">
        <span className="label">แท็ก (คั่นด้วย ,)</span>
        <input className="input" placeholder="UI/UX, Calendar" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
      </label>
      <label className="field">
        <span className="label">รายละเอียด</span>
        <textarea className="textarea" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
      </label>
      {form.assigneeId.startsWith("ai_") && (
        <div className="side-card">
          <b><Bot size={12} /> AI จะเริ่มทำงานทันที</b>
          งานนี้จะถูกมอบให้ {data.members.find((m) => m.id === form.assigneeId)?.name} และบันทึก run log อัตโนมัติ
        </div>
      )}
      {aiDraft && null}
    </Modal>
  );
}

export function EventModal() {
  const { data, eventForm, closeEvent, act, toast } = useApp();
  const editing = eventForm.event && eventForm.event.id;
  const [form, setForm] = useState({
    title: eventForm.event?.title ?? "",
    date: eventForm.event?.date ?? eventForm.date ?? new Date().toISOString().slice(0, 10),
    time: eventForm.event?.time ?? eventForm.time ?? "",
    endTime: eventForm.event?.endTime ?? "",
    cat: (eventForm.event?.cat ?? "work") as EventCat,
    projectId: eventForm.event?.projectId ?? "",
    location: eventForm.event?.location ?? "",
    desc: eventForm.event?.desc ?? "",
    important: eventForm.event?.important ?? false,
  });
  if (!data || !eventForm.open) return null;

  const save = async () => {
    if (!form.title.trim()) return toast("ใส่ชื่องานก่อนนะครับ", "err");
    if (editing) {
      await act({
        type: "event.update", id: eventForm.event!.id,
        patch: {
          title: form.title, date: form.date, time: form.time || undefined, endTime: form.endTime || undefined,
          cat: form.cat, location: form.location, desc: form.desc, important: form.important,
        },
      });
      toast("อัปเดตอีเวนต์แล้ว", "ok");
    } else {
      await act({
        type: "event.create",
        event: {
          title: form.title, date: form.date, time: form.time || undefined, endTime: form.endTime || undefined,
          cat: form.cat, projectId: form.projectId || undefined, location: form.location,
          desc: form.desc, important: form.important, ownerId: data.meId,
        },
      });
      toast("เพิ่มอีเวนต์ลงปฏิทินแล้ว", "ok");
    }
    closeEvent();
  };

  return (
    <Modal
      title={editing ? "แก้ไขอีเวนต์" : "เพิ่มอีเวนต์ในปฏิทิน"}
      subtitle={thaiDate(form.date, { weekday: true })}
      icon={<CalendarDays size={16} />}
      onClose={closeEvent}
      footer={
        <>
          {editing && (
            <button
              className="btn"
              style={{ color: "var(--red)", marginRight: "auto" }}
              onClick={async () => {
                await act({ type: "event.delete", id: eventForm.event!.id });
                toast("ลบอีเวนต์แล้ว", "info");
                closeEvent();
              }}
            >
              <Trash2 size={13} /> ลบ
            </button>
          )}
          <button className="btn" onClick={closeEvent}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void save()}><Check size={14} /> บันทึก</button>
        </>
      }
    >
      <input className="input" autoFocus placeholder="ชื่ออีเวนต์" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <div className="grid-2">
        <label className="field">
          <span className="label">วันที่</span>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">หมวด</span>
          <select className="select" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value as EventCat })}>
            {CAT_ORDER.map((c) => <option key={c} value={c}>{CAT_META[c].label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">เริ่ม</span>
          <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">สิ้นสุด</span>
          <input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </label>
      </div>
      <div className="grid-2">
        <label className="field">
          <span className="label">โปรเจกต์</span>
          <select className="select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">— ไม่ระบุ —</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">สถานที่ / ลิงก์</span>
          <input className="input" placeholder="ห้องประชุม · Google Meet · พิกัด" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </label>
      </div>
      {!!form.location && (
        <a
          className="link-btn"
          href={`https://maps.google.com/?q=${encodeURIComponent(form.location)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin size={11} /> เปิด {form.location} ใน Google Maps
        </a>
      )}
      <label className="field">
        <span className="label">รายละเอียด</span>
        <textarea className="textarea" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
      </label>
      <label className="row" style={{ gap: 8, fontSize: 11.5, cursor: "pointer" }}>
        <input type="checkbox" checked={form.important} onChange={(e) => setForm({ ...form, important: e.target.checked })} style={{ accentColor: "var(--violet)" }} />
        ปักธงงานสำคัญ (แสดงขอบแดงบนปฏิทิน)
      </label>
    </Modal>
  );
}

export function GlobalSearch() {
  const { data, search, setSearch, openTask, openEvent, go } = useApp();
  if (!data || !search.trim()) return null;
  const q = search.toLowerCase();
  const tasks = data.tasks.filter((t) => (t.title + t.code).toLowerCase().includes(q)).slice(0, 5);
  const events = data.events.filter((e) => e.title.toLowerCase().includes(q)).slice(0, 4);
  const projects = data.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 3);
  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && setSearch("")} style={{ zIndex: 95 }}>
      <div className="modal" style={{ width: "min(640px, 94vw)", maxHeight: "80vh" }}>
        <div className="modal-head">
          <div style={{ flex: 1 }}><h3>ผลการค้นหาทั้งระบบ</h3><small>“{search}” — งาน · อีเวนต์ · โปรเจกต์</small></div>
          <button className="icon-btn" onClick={() => setSearch("")}><X size={15} /></button>
        </div>
        <div className="modal-body">
          {tasks.length > 0 && <div className="side-h">งาน</div>}
          {tasks.map((t) => (
            <button key={t.id} className="list-row" onClick={() => { openTask(t.id); setSearch(""); }}>
              <span className="lr-ico" style={{ background: data.projects.find((p) => p.id === t.projectId)?.color, color: "#fff" }}>{t.code.split("-")[0]}</span>
              <span className="lr-main"><b>{t.title}</b><small>{t.code} · {STATUS_META[t.status].label} · {relDay(t.due)}</small></span>
              <ChevronRight size={13} opacity={0.4} />
            </button>
          ))}
          {events.length > 0 && <div className="side-h">อีเวนต์</div>}
          {events.map((e) => (
            <button key={e.id} className="list-row" onClick={() => { openEvent({ event: e }); setSearch(""); }}>
              <span className="lr-ico" style={{ background: CAT_META[e.cat].color }}><CalendarDays size={12} /></span>
              <span className="lr-main"><b>{e.title}</b><small>{thaiDate(e.date, { short: true })} {e.time ?? "ทั้งวัน"}</small></span>
            </button>
          ))}
          {projects.length > 0 && <div className="side-h">โปรเจกต์</div>}
          {projects.map((p) => (
            <button key={p.id} className="list-row" onClick={() => { go("tasks"); setSearch(""); }}>
              <span className="lr-ico" style={{ background: p.color }}>{p.code}</span>
              <span className="lr-main"><b>{p.name}</b><small>{p.client} · {p.progress}%</small></span>
            </button>
          ))}
          {!tasks.length && !events.length && !projects.length && <div className="empty">ไม่พบผลลัพธ์</div>}
        </div>
      </div>
    </div>
  );
}
