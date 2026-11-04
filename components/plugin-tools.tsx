"use client";

// ─────────────────────────────────────────────────────────────
//  Plugin Tools — เครื่องมือที่ใช้คู่กับงาน
//   • เก็บข้อมูลเชื่อมต่อ: URL เว็บ, user login, token key, skill/AI
//   • ลิ้งสั่งงาน (command link) ให้ AI / Python / cron เรียกได้
//   • ตั้งวันที่ + เวลาที่จะให้งานออนไลน์ แล้วระบบทำงานเอง
//   • เมื่อสำเร็จ → อัปเดตสถานะงาน + แคปหน้าเว็บ + สร้างรายงาน
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Clock, Copy, ExternalLink,
  FileBarChart2, History, ImageIcon, KeyRound, Link2, Loader2, Pencil, Play, Plus, RefreshCw,
  Search, Send, Settings2, ShieldCheck, Sparkles, Trash2, Wrench, XCircle, Zap,
} from "lucide-react";
import { Modal } from "./ui";
import { useApp } from "./providers";
import { cls } from "../lib/utils";

type ToolKind = "web-publish" | "python" | "ai" | "http" | "custom";
type ToolSchedule = "manual" | "once" | "daily" | "weekly";
type ToolStatus = "draft" | "ready" | "scheduled" | "running" | "done" | "failed";

interface ToolStepResult { label: string; ok: boolean; detail: string }
interface ToolCapture {
  id: string; at: string; url: string; statusCode: number | null; ok: boolean;
  title: string; description: string; imageUrl: string | null; excerpt: string;
  bytes: number; mode: string; message: string; reportId: string | null;
}
interface ToolRun {
  id: string; at: string; trigger: "manual" | "schedule" | "webhook"; ok: boolean;
  message: string; durationMs: number; steps: ToolStepResult[];
  captureId: string | null; reportId: string | null; taskId: string | null; actorName: string | null;
}
interface Tool {
  id: string; name: string; kind: ToolKind; description: string;
  targetUrl: string; publishUrl: string; method: "POST" | "PUT" | "GET";
  contentType: string; headers: string; payload: string;
  loginUrl: string; loginUser: string; loginPasswordSet: boolean; loginPasswordMasked: string; loginNote: string;
  tokenKey: string; commandUrl: string; commandLink: string;
  skillId: string | null; agentId: string | null; taskId: string | null; projectId: string | null;
  schedule: ToolSchedule; runAt: string | null; nextRunAt: string | null;
  status: ToolStatus; enabled: boolean; captureEnabled: boolean; createReport: boolean;
  lastRunAt: string | null; lastMessage: string | null;
  runs: ToolRun[]; captures: ToolCapture[];
  createdAt: string; updatedAt: string | null;
}
interface KindMeta { label: string; color: string; hint: string; icon: string }
interface StatusMeta { label: string; color: string; soft: string }
interface Summary {
  tools: number; enabled: number; scheduled: number; captures: number;
  runsToday: number; runsTodayOk: number; totalRuns: number; successRate: number;
  nextRunAt: string | null; upcoming: { id: string; name: string; nextRunAt: string }[];
}

const TRIGGER_LABEL: Record<ToolRun["trigger"], string> = {
  manual: "สั่งเอง",
  schedule: "ตามกำหนดเวลา",
  webhook: "ลิ้งสั่งงาน",
};

// ── เวลาแบบไทย (Asia/Bangkok) ────────────────────────────────
function bkkInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function fromBkkInput(value: string) {
  if (!value) return null;
  const d = new Date(`${value.length === 16 ? `${value}:00` : value}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function thaiWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "2-digit", month: "short",
    year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function countdown(iso: string | null) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return "";
  if (diff <= 0) return "ถึงกำหนดแล้ว";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `อีก ${mins} นาที`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `อีก ${hours} ชั่วโมง`;
  return `อีก ${Math.round(hours / 24)} วัน`;
}

export function PluginToolsView() {
  const { data, toast, go, openTask } = useApp();
  const [tools, setTools] = useState<Tool[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [kinds, setKinds] = useState<Record<ToolKind, KindMeta>>({} as Record<ToolKind, KindMeta>);
  const [statuses, setStatuses] = useState<Record<ToolStatus, StatusMeta>>({} as Record<ToolStatus, StatusMeta>);
  const [skills, setSkills] = useState<{ id: string; name: string; runtime: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; provider: string; model: string }[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "scheduled" | "done" | "failed">("all");
  const [editing, setEditing] = useState<Tool | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Tool | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Tool | null>(null);
  const [confirmDel, setConfirmDel] = useState<Tool | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/plugin-tools", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        tools?: Tool[]; summary?: Summary; kinds?: Record<ToolKind, KindMeta>;
        statuses?: Record<ToolStatus, StatusMeta>; skills?: { id: string; name: string; runtime: string }[];
        agents?: { id: string; name: string; provider: string; model: string }[];
        due?: { ran: { ok: boolean; message: string }[]; due: number } | null;
        canDelete?: boolean; canEdit?: boolean; error?: string;
      };
      if (body.error) throw new Error(body.error);
      setTools(body.tools ?? []);
      setSummary(body.summary ?? null);
      if (body.kinds) setKinds(body.kinds);
      if (body.statuses) setStatuses(body.statuses);
      setCanDelete(Boolean(body.canDelete));
      setSkills(body.skills ?? []);
      setAgents(body.agents ?? []);
      const ran = body.due?.ran ?? [];
      if (ran.length) {
        toast(`ทำงานตามกำหนดเวลา ${ran.length} รายการ — ${ran.map((r) => r.message).join(" · ").slice(0, 160)}`, ran.every((r) => r.ok) ? "ok" : "err");
      }
    } catch (err) {
      if (!silent) toast((err as Error).message || "โหลด Plugin Tools ไม่ได้", "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // ตรวจงานที่ถึงกำหนดซ้ำทุก 60 วินาที ขณะเปิดหน้านี้อยู่
  useEffect(() => {
    const id = setInterval(() => { void load(true); }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const runNow = async (tool: Tool) => {
    setBusy(`run:${tool.id}`);
    try {
      const res = await fetch(`/api/plugin-tools/${tool.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (body.error) throw new Error(body.error);
      toast(body.message || (body.ok ? "ทำงานสำเร็จ" : "ทำงานไม่สำเร็จ"), body.ok ? "ok" : "err");
      await load(true);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (tool: Tool) => {
    const url = `${window.location.origin}${tool.commandUrl}?key=${tool.tokenKey}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("คัดลอกลิ้งสั่งงานแล้ว — เอาไปวางใน AI / Python / cron ได้", "ok");
    } catch {
      window.prompt("คัดลอกลิ้งสั่งงานนี้", url);
    }
  };

  const remove = async (tool: Tool) => {
    setBusy(`del:${tool.id}`);
    try {
      const res = await fetch(`/api/plugin-tools?id=${encodeURIComponent(tool.id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) throw new Error(body.error || "ลบไม่สำเร็จ");
      toast("ลบเครื่องมือแล้ว", "ok");
      setConfirmDel(null);
      await load(true);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async (tool: Tool) => {
    setBusy(`toggle:${tool.id}`);
    try {
      const res = await fetch("/api/plugin-tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: tool.id, enabled: !tool.enabled }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast(tool.enabled ? "ปิดใช้งานเครื่องมือแล้ว" : "เปิดใช้งานเครื่องมือแล้ว", "ok");
      await load(true);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tools.filter((t) => {
      if (filter === "scheduled" && !t.nextRunAt) return false;
      if (filter === "done" && t.status !== "done") return false;
      if (filter === "failed" && t.status !== "failed") return false;
      if (!term) return true;
      return `${t.name} ${t.description} ${t.targetUrl} ${t.loginUser} ${t.skillId ?? ""}`.toLowerCase().includes(term);
    });
  }, [tools, q, filter]);

  const skillName = (id: string | null) => skills.find((s) => s.id === id)?.name ?? id ?? "—";
  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? id ?? "—";
  const taskOf = (id: string | null) => data?.tasks.find((t) => t.id === id) ?? null;

  return (
    <div className="page">
      <div className="kpi-grid">
        <Kpi icon={<Wrench size={16} />} grad="var(--grad-violet)" value={summary?.tools ?? 0} label={`เครื่องมือ · เปิดใช้ ${summary?.enabled ?? 0}`} />
        <Kpi icon={<CalendarClock size={16} />} grad="var(--grad-amber)" value={summary?.scheduled ?? 0} label={summary?.nextRunAt ? `ตั้งเวลาไว้ · ถัดไป ${countdown(summary.nextRunAt)}` : "ตั้งเวลาไว้"} />
        <Kpi icon={<Zap size={16} />} grad="var(--grad-mint)" value={summary?.runsToday ?? 0} label={`รันวันนี้ · สำเร็จ ${summary?.runsTodayOk ?? 0}`} />
        <Kpi icon={<ImageIcon size={16} />} grad="var(--grad-cyan)" value={summary?.captures ?? 0} label={`แคปหน้าเว็บ · อัตราสำเร็จ ${summary?.successRate ?? 0}%`} />
      </div>

      <div className="spread">
        <div>
          <div className="card-title" style={{ fontSize: 14 }}><Wrench size={14} /> Plugin Tools — เครื่องมือที่ใช้คู่กับงาน</div>
          <p className="tiny muted" style={{ marginTop: 3 }}>
            เก็บ login ของเว็บปลายทาง + token + skill ให้พร้อม · มีลิ้งสั่งงานให้ AI/Python เรียก · ตั้งวันเวลาให้งานออนไลน์ แล้วระบบอัปเดตงาน + แคปหน้าเว็บทำรายงานให้
          </p>
        </div>
        <div className="row">
          <div className="searchbox" style={{ width: 190 }}>
            <Search size={12} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเครื่องมือ…" />
          </div>
          <button className="btn btn-sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} รีเฟรช
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}><Plus size={12} /> เพิ่มเครื่องมือ</button>
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="seg">
          {([["all", "ทั้งหมด"], ["scheduled", "ตั้งเวลา"], ["done", "สำเร็จ"], ["failed", "ล้มเหลว"]] as const).map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        {summary?.upcoming.length ? (
          <span className="pill" style={{ background: "var(--yellow-soft)", color: "#b47600" }}>
            <Clock size={10} /> งานถัดไป: {summary.upcoming[0].name} · {thaiWhen(summary.upcoming[0].nextRunAt)}
          </span>
        ) : null}
      </div>

      {loading && <div className="row muted" style={{ gap: 8, padding: 8 }}><Loader2 size={14} className="spin" /> กำลังโหลดเครื่องมือ…</div>}

      <div className="tool-grid">
        {shown.map((t) => {
          const kind = kinds[t.kind];
          const meta = statuses[t.status];
          const cap = t.captures[0] ?? null;
          const task = taskOf(t.taskId);
          return (
            <article key={t.id} className={cls("tool-card", !t.enabled && "off")}>
              <div className="tc-thumb" onClick={() => setDetail(t)} title="ดูแคปหน้าเว็บ / ประวัติ">
                {cap?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cap.imageUrl} alt={cap.title || t.name} />
                ) : (
                  <div className="tc-thumb-empty"><ImageIcon size={20} /><span>ยังไม่มีแคป</span></div>
                )}
                <span className="tc-kind" style={{ background: kind?.color ?? "#8A8FB1" }}>{kind?.icon} {kind?.label}</span>
                {cap && <span className={cls("tc-cap", cap.ok ? "ok" : "bad")}>{cap.statusCode ? `HTTP ${cap.statusCode}` : "แคปไม่สำเร็จ"}</span>}
              </div>

              <div className="tc-body">
                <div className="spread">
                  <b style={{ fontSize: 12.5 }}>{t.name}</b>
                  <span className="pill" style={{ background: meta?.soft, color: meta?.color, fontSize: 9.5 }}>{meta?.label}</span>
                </div>
                <div className="tiny muted tc-url">{t.targetUrl || t.publishUrl || "— ไม่ระบุเว็บปลายทาง —"}</div>
                <p className="tc-desc">{t.description || "—"}</p>

                <div className="tc-meta">
                  <span><ShieldCheck size={10} /> {t.loginUser || "ยังไม่ใส่ login"}</span>
                  <span><Sparkles size={10} /> {skillName(t.skillId)}</span>
                  <span><CalendarClock size={10} /> {t.nextRunAt ? `${thaiWhen(t.nextRunAt)} · ${countdown(t.nextRunAt)}` : "สั่งเอง / ผ่านลิ้ง"}</span>
                  {task && (
                    <button className="link-btn" style={{ fontSize: 10.5 }} onClick={() => openTask(task.id)}>
                      <Link2 size={10} /> {task.code} · {task.title.slice(0, 20)}
                    </button>
                  )}
                </div>

                {t.lastMessage && (
                  <div className={cls("tc-last", t.status === "failed" && "bad")}>
                    {t.status === "failed" ? <XCircle size={11} /> : <CheckCircle2 size={11} />} {t.lastMessage.slice(0, 120)}
                  </div>
                )}

                <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
                  <button className="btn btn-sm btn-primary" onClick={() => void runNow(t)} disabled={busy === `run:${t.id}`}>
                    {busy === `run:${t.id}` ? <Loader2 size={11} className="spin" /> : <Play size={11} />} รันเลย
                  </button>
                  <button className="btn btn-sm" onClick={() => setScheduleFor(t)}><CalendarClock size={11} /> ตั้งเวลา</button>
                  <button className="btn btn-sm" onClick={() => void copyLink(t)}><Link2 size={11} /> ลิ้งสั่งงาน</button>
                  <button className="icon-btn" title="ดูรายละเอียด" onClick={() => setDetail(t)}><ChevronRight size={13} /></button>
                  <button className="icon-btn" title="แก้ไข" onClick={() => setEditing(t)}><Pencil size={12} /></button>
                  <button className="icon-btn" title={t.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"} onClick={() => void toggleEnabled(t)} disabled={busy === `toggle:${t.id}`}>
                    {t.enabled ? <CheckCircle2 size={12} style={{ color: "var(--mint)" }} /> : <XCircle size={12} style={{ color: "var(--muted)" }} />}
                  </button>
                  {canDelete && (
                    <button className="icon-btn" title="ลบ" onClick={() => setConfirmDel(t)}><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && !shown.length && (
        <div className="card" style={{ padding: 18 }}>
          <div className="empty"><Wrench size={24} /><p>ยังไม่มีเครื่องมือในหมวดนี้ — กด “เพิ่มเครื่องมือ” เพื่อเชื่อมเว็บปลายทาง</p></div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title"><History size={14} /> ประวัติการทำงานล่าสุด</div>
          <div className="right tiny muted">ทุกครั้งที่มีการรัน (สั่งเอง / ตั้งเวลา / ลิ้งสั่งงาน)</div>
        </div>
        <div className="card-body" style={{ padding: 0, maxHeight: 260, overflowY: "auto" }}>
          {tools.flatMap((t) => t.runs.map((r) => ({ tool: t, run: r })))
            .sort((a, b) => b.run.at.localeCompare(a.run.at))
            .slice(0, 12)
            .map(({ tool, run }) => (
              <div key={run.id} className="run-row">
                <span className={cls("run-dot", run.ok ? "success" : "failed")} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 12 }}>{tool.name} <span className="tiny muted">· {TRIGGER_LABEL[run.trigger]}</span></b>
                  <div className="tiny muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.message}</div>
                </div>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div className="tiny" style={{ color: run.ok ? "var(--mint)" : "var(--pink)" }}>{run.ok ? "สำเร็จ" : "ไม่สำเร็จ"}</div>
                  <div className="tiny muted">{thaiWhen(run.at)} · {(run.durationMs / 1000).toFixed(1)}s</div>
                </div>
              </div>
            ))}
          {!tools.some((t) => t.runs.length) && (
            <div className="empty"><History size={22} /><p>ยังไม่มีประวัติ — กด “รันเลย” เพื่อลองครั้งแรก</p></div>
          )}
        </div>
      </div>

      {/* ── สร้าง / แก้ไข ── */}
      {(creating || editing) && (
        <ToolEditor
          tool={editing}
          skills={skills}
          agents={agents}
          tasks={(data?.tasks ?? []).filter((t) => t.status !== "done")}
          projects={data?.projects ?? []}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await load(true); }}
        />
      )}

      {/* ── ตั้งเวลา ── */}
      {scheduleFor && (
        <ScheduleModal
          tool={scheduleFor}
          onClose={() => setScheduleFor(null)}
          onSaved={async () => { setScheduleFor(null); await load(true); }}
        />
      )}

      {/* ── รายละเอียด ── */}
      {detail && (
        <ToolDetail
          tool={detail}
          kinds={kinds}
          statuses={statuses}
          skillName={skillName}
          agentName={agentName}
          onClose={() => setDetail(null)}
          onRun={async () => { await runNow(detail); const fresh = await fetch(`/api/plugin-tools/${detail.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null) as { tool?: Tool } | null; if (fresh?.tool) setDetail(fresh.tool); }}
          onEdit={() => { setEditing(detail); setDetail(null); }}
          onCopy={() => void copyLink(detail)}
          onReports={() => go("reports")}
        />
      )}

      {/* ── ยืนยันลบ ── */}
      {confirmDel && (
        <Modal
          title="ลบเครื่องมือ"
          subtitle={confirmDel.name}
          icon={<Trash2 size={16} />}
          onClose={() => setConfirmDel(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDel(null)}>ยกเลิก</button>
              <button
                className="btn"
                style={{ background: "var(--red)", color: "#fff", border: 0, fontWeight: 600 }}
                disabled={busy === `del:${confirmDel.id}`}
                onClick={() => void remove(confirmDel)}
              >
                {busy === `del:${confirmDel.id}` ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} ลบเครื่องมือ
              </button>
            </>
          }
        >
          <p style={{ fontSize: 12.5, lineHeight: 1.7 }}>
            ต้องการลบ <b>“{confirmDel.name}”</b> ใช่หรือไม่?<br />
            <span className="tiny muted">ลิ้งสั่งงานของเครื่องมือนี้จะใช้ไม่ได้ทันที — รายงานที่สร้างไว้แล้วยังอยู่</span>
          </p>
        </Modal>
      )}
    </div>
  );
}

function Kpi({ icon, grad, value, label }: { icon: React.ReactNode; grad: string; value: React.ReactNode; label: string }) {
  return (
    <div className="kpi">
      <div className="k-top"><span className="kpi-ico" style={{ background: grad }}>{icon}</span></div>
      <div><div className="kpi-val">{value}</div><div className="kpi-lbl">{label}</div></div>
    </div>
  );
}

// ── ฟอร์มสร้าง/แก้ไข ─────────────────────────────────────────
function ToolEditor({
  tool, skills, agents, tasks, projects, onClose, onSaved,
}: {
  tool: Tool | null;
  skills: { id: string; name: string; runtime: string }[];
  agents: { id: string; name: string; provider: string; model: string }[];
  tasks: { id: string; code: string; title: string }[];
  projects: { id: string; code: string; name: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useApp();
  const [tab, setTab] = useState<"connect" | "command" | "schedule">("connect");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: tool?.name ?? "",
    kind: (tool?.kind ?? "web-publish") as ToolKind,
    description: tool?.description ?? "",
    targetUrl: tool?.targetUrl ?? "",
    publishUrl: tool?.publishUrl ?? "",
    loginUrl: tool?.loginUrl ?? "",
    loginUser: tool?.loginUser ?? "",
    loginPassword: "",
    loginNote: tool?.loginNote ?? "",
    skillId: tool?.skillId ?? "",
    agentId: tool?.agentId ?? "",
    method: (tool?.method ?? "POST") as "POST" | "PUT" | "GET",
    contentType: tool?.contentType ?? "application/json",
    headers: tool?.headers ?? '{\n  "authorization": "Bearer {{token}}"\n}',
    payload: tool?.payload ?? '{\n  "title": "{{title}}",\n  "body": "{{summary}}",\n  "publishAt": "{{runAt}}"\n}',
    taskId: tool?.taskId ?? "",
    projectId: tool?.projectId ?? "",
    schedule: (tool?.schedule ?? "once") as ToolSchedule,
    runAtInput: bkkInput(tool?.runAt ?? null),
    enabled: tool?.enabled ?? true,
    captureEnabled: tool?.captureEnabled ?? true,
    createReport: tool?.createReport ?? true,
  }));

  const save = async () => {
    if (!form.name.trim()) {
      toast("ต้องตั้งชื่อเครื่องมือก่อน", "err");
      setTab("connect");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/plugin-tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: tool?.id,
          name: form.name,
          kind: form.kind,
          description: form.description,
          targetUrl: form.targetUrl,
          publishUrl: form.publishUrl,
          loginUrl: form.loginUrl,
          loginUser: form.loginUser,
          loginPassword: form.loginPassword || undefined,
          loginNote: form.loginNote,
          skillId: form.skillId || null,
          agentId: form.agentId || null,
          method: form.method,
          contentType: form.contentType,
          headers: form.headers,
          payload: form.payload,
          taskId: form.taskId || null,
          projectId: form.projectId || null,
          schedule: form.schedule,
          runAt: fromBkkInput(form.runAtInput),
          enabled: form.enabled,
          captureEnabled: form.captureEnabled,
          createReport: form.createReport,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast(tool ? "บันทึกการแก้ไขแล้ว" : "เพิ่มเครื่องมือแล้ว", "ok");
      await onSaved();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={tool ? `แก้ไข ${tool.name}` : "เพิ่ม Plugin Tool"}
      subtitle="เชื่อมเว็บปลายทาง · เตรียมลิ้งสั่งงาน · ตั้งวันเวลาให้งานออนไลน์"
      icon={<Wrench size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? <><Loader2 size={13} className="spin" /> กำลังบันทึก…</> : "บันทึก"}
          </button>
        </>
      }
    >
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === "connect" ? "on" : ""} onClick={() => setTab("connect")}><ShieldCheck size={12} /> เชื่อมต่อ & login</button>
        <button className={tab === "command" ? "on" : ""} onClick={() => setTab("command")}><Send size={12} /> สั่งงานไปปลายทาง</button>
        <button className={tab === "schedule" ? "on" : ""} onClick={() => setTab("schedule")}><CalendarClock size={12} /> ตั้งเวลา & รายงาน</button>
      </div>

      {tab === "connect" && (
        <div className="ai-config-grid">
          <label className="field">
            <span className="label">ชื่อเครื่องมือ</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ลงบทความ Afterklass" />
          </label>
          <label className="field">
            <span className="label">ประเภท</span>
            <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ToolKind })}>
              <option value="web-publish">ลงเว็บ / บทความ (มี login)</option>
              <option value="python">Python script</option>
              <option value="ai">AI / Skill</option>
              <option value="http">HTTP API</option>
              <option value="custom">กำหนดเอง</option>
            </select>
          </label>
          <label className="field full">
            <span className="label">คำอธิบายสั้น ๆ</span>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ทำอะไร ใช้กับงานแบบไหน" />
          </label>
          <label className="field full">
            <span className="label">URL เว็บปลายทาง (ใช้แคปหน้าจอ + ตรวจสถานะ)</span>
            <input className="input" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} placeholder="https://www.afterklass.com/" />
          </label>
          <label className="field">
            <span className="label">หน้าล็อกอินของเว็บ</span>
            <input className="input" value={form.loginUrl} onChange={(e) => setForm({ ...form, loginUrl: e.target.value })} placeholder="https://www.afterklass.com/login" />
          </label>
          <label className="field">
            <span className="label">ผู้ใช้ (email / username)</span>
            <input className="input" value={form.loginUser} onChange={(e) => setForm({ ...form, loginUser: e.target.value })} placeholder="editor@playdigital.co.th" />
          </label>
          <label className="field">
            <span className="label">รหัสผ่าน {tool?.loginPasswordSet && <span className="tiny muted">(เว้นว่าง = ค่าเดิม {tool.loginPasswordMasked})</span>}</span>
            <input className="input" type="password" value={form.loginPassword} onChange={(e) => setForm({ ...form, loginPassword: e.target.value })} placeholder="••••••••" autoComplete="new-password" />
          </label>
          <label className="field">
            <span className="label">หมายเหตุบัญชี</span>
            <input className="input" value={form.loginNote} onChange={(e) => setForm({ ...form, loginNote: e.target.value })} placeholder="เช่น บัญชีทีมคอนเทนต์ / ต้องยืนยัน 2 ชั้น" />
          </label>
          <label className="field">
            <span className="label">Skill ที่ใช้</span>
            <select className="select" value={form.skillId} onChange={(e) => setForm({ ...form, skillId: e.target.value })}>
              <option value="">— ไม่ใช้ —</option>
              {skills.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.runtime})</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">AI ที่ทำงานนี้</span>
            <select className="select" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
              <option value="">— ไม่ระบุ —</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.model}</option>)}
            </select>
          </label>
          {tool && (
            <div className="side-card full" style={{ fontSize: 11.5 }}>
              <b><KeyRound size={12} /> ลิ้งสั่งงาน & token</b>
              <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, wordBreak: "break-all" }}>
                POST {typeof window !== "undefined" ? window.location.origin : ""}{tool.commandUrl}?key={tool.tokenKey}
              </div>
              <div className="tiny muted">เครื่องมือนี้มี token พร้อมใช้แล้ว — ใช้ได้กับ AI, Python, cron หรือปุ่มบนเว็บอื่น</div>
            </div>
          )}
        </div>
      )}

      {tab === "command" && (
        <div className="ai-config-grid">
          <label className="field">
            <span className="label">URL สำหรับส่งงาน (ไม่ใส่ = สั่งผ่านลิ้ง/สคริปต์ปลายทาง)</span>
            <input className="input" value={form.publishUrl} onChange={(e) => setForm({ ...form, publishUrl: e.target.value })} placeholder="https://www.afterklass.com/api/posts" />
          </label>
          <label className="field">
            <span className="label">Method</span>
            <select className="select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as "POST" | "PUT" | "GET" })}>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="GET">GET</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Content-Type</span>
            <input className="input" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })} placeholder="application/json" />
          </label>
          <label className="field">
            <span className="label">งานที่จะอัปเดตสถานะเมื่อสำเร็จ</span>
            <select className="select" value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })}>
              <option value="">— ไม่ผูกกับงาน —</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.title}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">โปรเจกต์ (ใช้กับรายงาน)</span>
            <select className="select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">— ไม่ระบุ —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </label>
          <label className="field full">
            <span className="label">Headers (JSON) — ใช้ {"{{token}}"} แทน token key ได้</span>
            <textarea className="textarea mono" rows={3} value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} />
          </label>
          <label className="field full">
            <span className="label">เนื้อหาที่ส่ง (template) — ใช้ {"{{title}} {{summary}} {{date}} {{runAt}} {{token}}"}</span>
            <textarea className="textarea mono" rows={5} value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} />
          </label>
        </div>
      )}

      {tab === "schedule" && (
        <div className="ai-config-grid">
          <label className="field">
            <span className="label">รูปแบบตาราง</span>
            <select className="select" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value as ToolSchedule })}>
              <option value="once">ครั้งเดียวตามวันเวลา</option>
              <option value="daily">ทุกวัน</option>
              <option value="weekly">ทุกสัปดาห์</option>
              <option value="manual">สั่งเอง / ผ่านลิ้งเท่านั้น</option>
            </select>
          </label>
          <label className="field">
            <span className="label">วันที่ + เวลาที่จะให้งานออนไลน์ (เวลาไทย)</span>
            <input className="input" type="datetime-local" value={form.runAtInput} disabled={form.schedule === "manual"} onChange={(e) => setForm({ ...form, runAtInput: e.target.value })} />
          </label>
          <div className="field full" style={{ gap: 8 }}>
            <label className="row" style={{ gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              เปิดใช้งานเครื่องมือนี้
            </label>
            <label className="row" style={{ gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={form.captureEnabled} onChange={(e) => setForm({ ...form, captureEnabled: e.target.checked })} />
              แคปหน้าเว็บหลังทำงาน (เก็บภาพ + ข้อความ)
            </label>
            <label className="row" style={{ gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={form.createReport} onChange={(e) => setForm({ ...form, createReport: e.target.checked })} />
              สร้างรายงานอัตโนมัติ พร้อมภาพที่แคป
            </label>
          </div>
          <div className="side-card full" style={{ fontSize: 11.5 }}>
            <b><Sparkles size={12} /> ลำดับการทำงาน</b>
            <div>1) ตรวจข้อมูลเชื่อมต่อ + login ปลายทาง → 2) ส่งงานไป URL ที่ตั้งไว้ (ถ้ามี) → 3) แคปหน้าเว็บ → 4) สร้างรายงาน → 5) อัปเดตงานเป็น “เสร็จสิ้น” + คอมเมนต์หลักฐาน</div>
            <div className="tiny muted">ถ้าไม่ตั้ง URL ส่งงาน ระบบจะทำงานเป็น “โหมดเตรียมเนื้อหา” แล้วแคปหน้าเว็บ + ทำรายงานให้</div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── ตั้งเวลาเร็ว ─────────────────────────────────────────────
function ScheduleModal({ tool, onClose, onSaved }: { tool: Tool; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast } = useApp();
  const [runAt, setRunAt] = useState(bkkInput(tool.runAt ?? null) || bkkInput(new Date(Date.now() + 3600_000).toISOString()));
  const [schedule, setSchedule] = useState<ToolSchedule>(tool.schedule === "manual" ? "once" : tool.schedule);
  const [busy, setBusy] = useState(false);

  const send = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/plugin-tools/${tool.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || body.ok === false) throw new Error(body.error || "ทำรายการไม่สำเร็จ");
      toast(body.message || message, "ok");
      await onSaved();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`ตั้งเวลา · ${tool.name}`}
      subtitle="เลือกวันที่ + เวลาที่ต้องการให้งานออนไลน์"
      icon={<CalendarClock size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ปิด</button>
          {tool.nextRunAt && (
            <button className="btn" onClick={() => void send({ cancel: true }, "ยกเลิกการตั้งเวลาแล้ว")} disabled={busy}>
              ยกเลิกการตั้งเวลา
            </button>
          )}
          <button
            className="btn btn-primary"
            disabled={busy || !runAt}
            onClick={() => void send({ runAt: fromBkkInput(runAt), schedule }, "ตั้งเวลาแล้ว")}
          >
            {busy ? <Loader2 size={13} className="spin" /> : <CalendarClock size={13} />} ตั้งเวลา
          </button>
        </>
      }
    >
      <div className="ai-config-grid">
        <label className="field">
          <span className="label">วันที่ + เวลา (เวลาไทย)</span>
          <input className="input" type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">ทำซ้ำ</span>
          <select className="select" value={schedule} onChange={(e) => setSchedule(e.target.value as ToolSchedule)}>
            <option value="once">ครั้งเดียว</option>
            <option value="daily">ทุกวัน</option>
            <option value="weekly">ทุกสัปดาห์</option>
          </select>
        </label>
      </div>
      <div className="side-card" style={{ fontSize: 11.5 }}>
        <b><Clock size={12} /> ระบบจะทำงานให้อัตโนมัติ</b>
        <div>เมื่อถึงเวลา ระบบจะรันเครื่องมือ: ส่งงาน → แคปหน้าเว็บ → สร้างรายงาน → อัปเดตสถานะงาน{tool.taskId ? " (ผูกกับงานไว้แล้ว)" : ""}</div>
        <div className="tiny muted">ถ้าไม่มีใครเปิดหน้านี้อยู่ cron ที่ยิง <code>/api/plugin-tools/cron</code> จะเก็บงานที่ถึงกำหนดให้</div>
      </div>
    </Modal>
  );
}

// ── รายละเอียด ───────────────────────────────────────────────
function ToolDetail({
  tool, kinds, statuses, skillName, agentName, onClose, onRun, onEdit, onCopy, onReports,
}: {
  tool: Tool;
  kinds: Record<ToolKind, KindMeta>;
  statuses: Record<ToolStatus, StatusMeta>;
  skillName: (id: string | null) => string;
  agentName: (id: string | null) => string;
  onClose: () => void;
  onRun: () => Promise<void>;
  onEdit: () => void;
  onCopy: () => void;
  onReports: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "runs" | "captures">("overview");
  const [busy, setBusy] = useState(false);
  const kind = kinds[tool.kind];
  const meta = statuses[tool.status];

  return (
    <Modal
      wide
      title={tool.name}
      subtitle={`${kind?.label ?? tool.kind} · ${meta?.label ?? tool.status}`}
      icon={<Wrench size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onEdit}><Pencil size={13} /> แก้ไข</button>
          <button className="btn" onClick={onCopy}><Copy size={13} /> คัดลอกลิ้งสั่งงาน</button>
          <button className="btn" onClick={onReports}><FileBarChart2 size={13} /> ไปที่รายงาน</button>
          <button className="btn btn-primary" onClick={async () => { setBusy(true); await onRun(); setBusy(false); }} disabled={busy}>
            {busy ? <><Loader2 size={13} className="spin" /> กำลังทำงาน…</> : <><Play size={13} /> รันเลย</>}
          </button>
        </>
      }
    >
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}><Settings2 size={12} /> ภาพรวม</button>
        <button className={tab === "runs" ? "on" : ""} onClick={() => setTab("runs")}><History size={12} /> ประวัติ ({tool.runs.length})</button>
        <button className={tab === "captures" ? "on" : ""} onClick={() => setTab("captures")}><ImageIcon size={12} /> แคปหน้าเว็บ ({tool.captures.length})</button>
      </div>

      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="tool-facts">
            <div><span>เว็บปลายทาง</span><b>{tool.targetUrl ? <a href={tool.targetUrl} target="_blank" rel="noreferrer">{tool.targetUrl}<ExternalLink size={9} /></a> : "—"}</b></div>
            <div><span>หน้าล็อกอิน</span><b>{tool.loginUrl || "—"}</b></div>
            <div><span>บัญชีที่ใช้</span><b>{tool.loginUser || "—"} {tool.loginPasswordSet ? "· มีรหัสผ่านแล้ว" : "· ยังไม่ใส่รหัสผ่าน"}</b></div>
            <div><span>Skill / AI</span><b>{skillName(tool.skillId)} · {agentName(tool.agentId)}</b></div>
            <div><span>ตารางเวลา</span><b>{tool.nextRunAt ? `${thaiWhen(tool.nextRunAt)} (${countdown(tool.nextRunAt)})` : "สั่งเอง / ผ่านลิ้ง"}</b></div>
            <div><span>แคป + รายงาน</span><b>{tool.captureEnabled ? "แคปทุกครั้ง" : "ไม่แคป"} · {tool.createReport ? "สร้างรายงาน" : "ไม่สร้างรายงาน"}</b></div>
          </div>

          <div className="side-card" style={{ fontSize: 11.5 }}>
            <b><KeyRound size={12} /> ลิ้งสั่งงาน (command link)</b>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, wordBreak: "break-all" }}>
              {typeof window !== "undefined" ? window.location.origin : ""}{tool.commandUrl}?key={tool.tokenKey}
            </div>
            <div className="tiny muted">ยิงได้ทั้ง GET และ POST — AI หรือ Python เรียกแล้วงานจะทำงานทันทีและได้ผลลัพธ์กลับเป็น JSON</div>
            <pre className="cmd-example">{`curl -X POST "${typeof window !== "undefined" ? window.location.origin : ""}${tool.commandUrl}?key=${tool.tokenKey}"`}</pre>
          </div>

          {tool.runs[0] && (
            <div className="card" style={{ boxShadow: "none" }}>
              <div className="card-head">
                <div className="card-title">ผลการทำงานล่าสุด <span className="tiny muted">· {TRIGGER_LABEL[tool.runs[0].trigger]} · {thaiWhen(tool.runs[0].at)}</span></div>
                <span className={cls("pill", tool.runs[0].ok ? "ok" : "warn")}>{tool.runs[0].ok ? "สำเร็จ" : "ไม่สำเร็จ"}</span>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tool.runs[0].steps.map((s, i) => (
                  <div key={`${s.label}-${i}`} className="step-row">
                    {s.ok ? <CheckCircle2 size={12} style={{ color: "var(--mint)" }} /> : <AlertTriangle size={12} style={{ color: "var(--amber)" }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{s.label}</b>
                      <div className="tiny muted">{s.detail}</div>
                    </div>
                  </div>
                ))}
                {tool.runs[0].reportId && (
                  <button className="link-btn" style={{ fontSize: 11 }} onClick={onReports}>
                    <FileBarChart2 size={11} /> เปิดรายงานที่สร้างอัตโนมัติ ({tool.runs[0].reportId})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "runs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {!tool.runs.length && <div className="empty"><History size={22} /><p>ยังไม่มีประวัติการทำงาน</p></div>}
          {tool.runs.map((r) => (
            <div key={r.id} className="run-card">
              <div className="spread">
                <b style={{ fontSize: 12 }}>{TRIGGER_LABEL[r.trigger]} · {thaiWhen(r.at)}</b>
                <span className={cls("pill", r.ok ? "ok" : "warn")} style={{ fontSize: 9.5 }}>{r.ok ? "สำเร็จ" : "ไม่สำเร็จ"}</span>
              </div>
              <div className="tiny muted">{r.message}</div>
              <div className="tiny muted">ใช้เวลา {(r.durationMs / 1000).toFixed(1)}s{r.actorName ? ` · โดย ${r.actorName}` : ""}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "captures" && (
        <div className="cap-grid">
          {!tool.captures.length && <div className="empty"><ImageIcon size={22} /><p>ยังไม่มีการแคปหน้าเว็บ</p></div>}
          {tool.captures.map((c) => (
            <div key={c.id} className="cap-card">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={c.title || "capture"} />
              ) : (
                <div className="cap-empty"><ImageIcon size={18} /></div>
              )}
              <div className="cap-body">
                <b>{c.title || c.url}</b>
                <div className="tiny muted">{c.message}</div>
                <div className="tiny muted">{thaiWhen(c.at)}</div>
                {c.excerpt && <p className="tiny">{c.excerpt.slice(0, 160)}…</p>}
                <div className="row" style={{ gap: 5 }}>
                  <a className="btn btn-sm" href={c.url} target="_blank" rel="noreferrer"><ExternalLink size={10} /> เปิดหน้าเว็บ</a>
                  {c.reportId && <button className="btn btn-sm" onClick={onReports}><FileBarChart2 size={10} /> รายงาน</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
