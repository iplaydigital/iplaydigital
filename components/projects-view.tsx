"use client";

// ─────────────────────────────────────────────────────────────
//  บริหารจัดการโปรเจกต์ — เพิ่ม / แก้ไข / ลบ / ติดตามงบ & ความคืบหน้า
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Check, CircleDollarSign, FolderKanban, Loader2, Pencil, Plus, RefreshCw, Search,
  Trash2, TrendingUp, Users, X,
} from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Empty, Modal } from "./ui";
import { cls, money, thaiDate } from "../lib/utils";
import type { Project } from "../lib/types";

const STATUS: { key: Project["status"]; label: string; color: string; soft: string }[] = [
  { key: "planning", label: "วางแผน", color: "#8A8FB1", soft: "rgba(138,143,177,.16)" },
  { key: "doing", label: "กำลังทำ", color: "#2F7BF0", soft: "rgba(59,167,255,.16)" },
  { key: "review", label: "ตรวจสอบ", color: "#B4761A", soft: "rgba(255,176,32,.18)" },
  { key: "done", label: "เสร็จสิ้น", color: "#149C74", soft: "rgba(34,199,147,.16)" },
];

const GRADS = [
  "linear-gradient(135deg,#7100DD,#B37CFF)",
  "linear-gradient(135deg,#2F7BF0,#6FD3FF)",
  "linear-gradient(135deg,#149C74,#5BE3B4)",
  "linear-gradient(135deg,#D6337A,#FFA1C4)",
  "linear-gradient(135deg,#B4761A,#FFD37A)",
];

interface Draft {
  id?: string;
  code: string;
  name: string;
  client: string;
  status: Project["status"];
  progress: number;
  start: string;
  due: string;
  budget: string;
  spent: string;
  grad: string;
  members: string[];
}

const emptyDraft = (): Draft => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    code: "", name: "", client: "", status: "planning", progress: 0,
    start: today, due: today, budget: "0", spent: "0", grad: GRADS[0], members: [],
  };
};

export function ProjectsView() {
  const { data, me, toast, refresh } = useApp();
  const [list, setList] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Project["status"]>("all");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = Boolean(me && (me.role === "admin" || me.role === "support" || me.role === "manager"));
  const canDelete = Boolean(me && (me.role === "admin" || me.role === "support"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { projects?: Project[]; error?: string };
      if (!res.ok) throw new Error(body.error || "โหลดโปรเจกต์ไม่สำเร็จ");
      setList(body.projects ?? []);
    } catch (err) {
      toast((err as Error).message, "err");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const key = q.trim().toLowerCase();
    return (list ?? [])
      .filter((p) => filter === "all" || p.status === filter)
      .filter((p) => !key || `${p.code} ${p.name} ${p.client}`.toLowerCase().includes(key))
      .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  }, [list, filter, q]);

  const totals = useMemo(() => {
    const all = list ?? [];
    return {
      count: all.length,
      active: all.filter((p) => p.status !== "done").length,
      budget: all.reduce((s, p) => s + p.budget, 0),
      spent: all.reduce((s, p) => s + p.spent, 0),
    };
  }, [list]);

  const openNew = () => setDraft({ ...emptyDraft(), code: `PRJ-${String((list?.length ?? 0) + 1).padStart(2, "0")}` });
  const openEdit = (p: Project) =>
    setDraft({
      id: p.id, code: p.code, name: p.name, client: p.client, status: p.status,
      progress: p.progress, start: p.start, due: p.due,
      budget: String(p.budget ?? 0), spent: String(p.spent ?? 0),
      grad: p.grad || GRADS[0], members: [...(p.members ?? [])],
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast("ต้องตั้งชื่อโปรเจกต์", "err");
    if (!draft.code.trim()) return toast("ต้องใส่รหัสโปรเจกต์", "err");
    setSaving(true);
    try {
      const payload = {
        code: draft.code, name: draft.name, client: draft.client, status: draft.status,
        progress: Number(draft.progress) || 0, start: draft.start, due: draft.due,
        budget: Number(draft.budget) || 0, spent: Number(draft.spent) || 0,
        grad: draft.grad, color: "#7100DD", members: draft.members,
      };
      const res = await fetch(draft.id ? `/api/projects/${draft.id}` : "/api/projects", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast(draft.id ? "อัปเดตโปรเจกต์แล้ว" : "สร้างโปรเจกต์แล้ว", "ok");
      setDraft(null);
      await load();
      void refresh();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Project) => {
    if (!window.confirm(`ลบโปรเจกต์ “${p.code} · ${p.name}”?\nงานในโปรเจกต์จะถูกยกเลิกการเชื่อมโยง (ไม่ถูกลบ)`)) return;
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      return toast(b.error || "ลบไม่สำเร็จ", "err");
    }
    toast("ลบโปรเจกต์แล้ว", "info");
    await load();
    void refresh();
  };

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="kpi-grid">
        <Kpi icon={<FolderKanban size={16} />} grad="var(--grad-violet)" value={totals.count} label="โปรเจกต์ทั้งหมด" />
        <Kpi icon={<TrendingUp size={16} />} grad="var(--grad-cyan)" value={totals.active} label="ยังไม่ปิดงาน" />
        <Kpi icon={<CircleDollarSign size={16} />} grad="var(--grad-mint)" value={money(totals.budget)} label="งบรวม" />
        <Kpi icon={<CircleDollarSign size={16} />} grad="var(--grad-amber)" value={money(totals.spent)} label="ใช้ไปแล้ว" />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><FolderKanban size={14} /> บริหารจัดการโปรเจกต์</div>
          <div className="row" style={{ gap: 8 }}>
            <div className="searchbox" style={{ height: 32, width: 220 }}>
              <Search size={13} />
              <input placeholder="ค้นหารหัส / ชื่อ / ลูกค้า…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn-sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} รีเฟรช
            </button>
            {canManage && (
              <button className="btn btn-sm btn-primary" onClick={openNew}><Plus size={12} /> สร้างโปรเจกต์</button>
            )}
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="seg" style={{ alignSelf: "flex-start" }}>
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>ทั้งหมด</button>
            {STATUS.map((s) => (
              <button key={s.key} className={filter === s.key ? "on" : ""} onClick={() => setFilter(s.key)}>{s.label}</button>
            ))}
          </div>

          {loading && !list && <div className="row muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> กำลังโหลดโปรเจกต์…</div>}

          {!loading && shown.length === 0 && (
            <Empty icon={<FolderKanban size={26} />} text="ยังไม่มีโปรเจกต์ในหมวดนี้" />
          )}

          <div className="project-grid">
            {shown.map((p) => {
              const meta = STATUS.find((s) => s.key === p.status) ?? STATUS[0];
              const tasks = (data?.tasks ?? []).filter((t) => t.projectId === p.id);
              const done = tasks.filter((t) => t.status === "done").length;
              const members = (p.members ?? [])
                .map((id) => data?.members.find((m) => m.id === id))
                .filter(Boolean)
                .slice(0, 5);
              const over = p.budget > 0 && p.spent > p.budget;
              return (
                <article key={p.id} className="project-card">
                  <div className="pc-head" style={{ background: p.grad || GRADS[0] }}>
                    <span className="code-chip" style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}>{p.code}</span>
                    <span className="pill" style={{ background: "rgba(255,255,255,.9)", color: meta.color }}>{meta.label}</span>
                    <span className="pc-progress">{p.progress}%</span>
                  </div>
                  <div className="pc-body">
                    <b style={{ fontSize: 13.5 }}>{p.name}</b>
                    <div className="tiny muted">ลูกค้า: {p.client || "—"}</div>
                    <div className="pc-bar"><i style={{ width: `${p.progress}%`, background: meta.color }} /></div>
                    <div className="pc-meta">
                      <span><CalendarDays size={10} /> {p.start ? thaiDate(p.start, { short: true }) : "—"} → {p.due ? thaiDate(p.due, { short: true }) : "—"}</span>
                      <span className={cls(over && "over")}>
                        <CircleDollarSign size={10} /> {money(p.spent)} / {money(p.budget)}
                      </span>
                    </div>
                    <div className="pc-meta">
                      <span><Check size={10} /> งานเสร็จ {done}/{tasks.length}</span>
                      <span className="row" style={{ gap: 2 }}>
                        <Users size={10} /> {members.length > 0 ? "" : "ยังไม่ระบุทีม"}
                        <span className="ava-stack">
                          {members.map((m) => (m ? <Avatar key={m.id} member={m} size="sm" /> : null))}
                        </span>
                      </span>
                    </div>
                    {canManage && (
                      <div className="row" style={{ gap: 6, marginTop: 2 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(p)}><Pencil size={11} /> แก้ไข</button>
                        {canDelete && (
                          <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => void remove(p)}>
                            <Trash2 size={11} /> ลบ
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {draft && (
        <Modal
          wide
          title={draft.id ? "แก้ไขโปรเจกต์" : "สร้างโปรเจกต์ใหม่"}
          subtitle={draft.id ? draft.code : "กำหนดรหัส ลูกค้า งบประมาณ และทีมผู้รับผิดชอบ"}
          icon={<FolderKanban size={16} />}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDraft(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
                {saving ? <><Loader2 size={13} className="spin" /> กำลังบันทึก…</> : "บันทึก"}
              </button>
            </>
          }
        >
          <div className="grid-2" style={{ gap: 10 }}>
            <label className="field">
              <span className="label">รหัสโปรเจกต์</span>
              <input className="input" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="PRJ-01" />
            </label>
            <label className="field">
              <span className="label">ชื่อโปรเจกต์</span>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="เช่น ระบบ CRM ลูกค้าใหม่" />
            </label>
            <label className="field">
              <span className="label">ลูกค้า / เจ้าของงาน</span>
              <input className="input" value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="ชื่อลูกค้า หรือ Internal" />
            </label>
            <label className="field">
              <span className="label">สถานะ</span>
              <select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Project["status"] })}>
                {STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">วันเริ่ม</span>
              <input className="input" type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">กำหนดส่ง</span>
              <input className="input" type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">งบประมาณ (บาท)</span>
              <input className="input" type="number" min={0} value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">ใช้ไปแล้ว (บาท)</span>
              <input className="input" type="number" min={0} value={draft.spent} onChange={(e) => setDraft({ ...draft, spent: e.target.value })} />
            </label>
            <label className="field" style={{ gridColumn: "span 2" }}>
              <span className="label">ความคืบหน้า · {draft.progress}%</span>
              <input type="range" min={0} max={100} value={draft.progress} onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })} />
            </label>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <span className="label">สีโปรเจกต์</span>
              <div className="row" style={{ gap: 6 }}>
                {GRADS.map((g) => (
                  <button
                    key={g}
                    className={cls("grad-swatch", draft.grad === g && "on")}
                    style={{ background: g }}
                    onClick={() => setDraft({ ...draft, grad: g })}
                    aria-label="เลือกสี"
                  />
                ))}
              </div>
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <span className="label">ทีมผู้รับผิดชอบ ({draft.members.length})</span>
              <div className="member-picker">
                {(data?.members ?? []).filter((m) => m.kind === "human").map((m) => {
                  const on = draft.members.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      className={cls("member-chip", on && "on")}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          members: on ? draft.members.filter((x) => x !== m.id) : [...draft.members, m.id],
                        })
                      }
                    >
                      <Avatar member={m} size="sm" /> {m.nickname || m.name}
                      {on && <X size={9} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Kpi({ icon, grad, value, label }: { icon: React.ReactNode; grad: string; value: React.ReactNode; label: string }) {
  return (
    <div className="kpi">
      <div className="kpi-ico" style={{ background: grad }}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  );
}
