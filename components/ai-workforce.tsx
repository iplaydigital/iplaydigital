"use client";

import React, { useMemo, useState } from "react";
import {
  Activity, Bot, BrainCircuit, CheckCircle2, ChevronRight, Cpu, Gauge, Pause,
  Play, Plus, RefreshCw, ShieldCheck, Sparkles, Terminal, Timer, Coins, Zap,
} from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Empty, Meter, Modal } from "./ui";
import { Spark } from "./charts";
import { agentStatusText } from "../lib/ai";
import { cls, relTime, thaiTime } from "../lib/utils";

export function AiWorkforce() {
  const { data, act, toast, openTask } = useApp();
  const [assign, setAssign] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "running" | "success">("all");
  if (!data) return null;

  const agents = data.members.filter((m) => m.kind === "ai");
  const runs = data.aiRuns.filter((r) => filter === "all" || r.status === filter);
  const totalTokens = agents.reduce((s, a) => s + (a.tokensToday ?? 0), 0);
  const successRuns = data.aiRuns.filter((r) => r.status === "success").length;
  const running = agents.filter((a) => !a.paused && a.state === "working");
  const aiTasks = data.tasks.filter((t) => t.assigneeId.startsWith("ai_") && t.status !== "done");

  return (
    <div className="page">
      <div className="kpi-grid">
        <KpiBox icon={<Bot size={16} />} grad="var(--grad-violet)" value={`${running.length}/${agents.length}`} label="AI กำลังทำงาน / ทั้งหมด" />
        <KpiBox icon={<Zap size={16} />} grad="var(--grad-mint)" value={data.aiRuns.length} label="AI runs วันนี้" />
        <KpiBox icon={<Coins size={16} />} grad="var(--grad-cyan)" value={`${(totalTokens / 1000).toFixed(0)}k`} label="Tokens ที่ใช้" />
        <KpiBox icon={<ShieldCheck size={16} />} grad="var(--grad-amber)" value={`${Math.round((successRuns / Math.max(1, data.aiRuns.length)) * 100)}%`} label="อัตราความสำเร็จ" />
      </div>

      <div className="spread">
        <div>
          <div className="card-title" style={{ fontSize: 14 }}><Sparkles size={14} /> AI Workforce — ทีมงาน AI ที่ทำงานเหมือนคน</div>
          <p className="tiny muted" style={{ marginTop: 3 }}>แต่ละเอเจนต์มีบทบาท มีงานในมือ มี run log และโควตา token ของตัวเอง — มอบงานได้ทันทีจากบอร์ดงานหรือแชท</p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => toast("ซิงก์สถานะ AI agents แล้ว", "ai")}><RefreshCw size={12} /> ซิงก์สถานะ</button>
          <button className="btn btn-sm btn-primary" onClick={() => setAssign("ai_nova")}><Plus size={12} /> มอบงานให้ AI</button>
        </div>
      </div>

      <div className="agents-grid">
        {agents.map((a) => {
          const task = data.tasks.find((t) => t.id === a.currentTaskId);
          const agentRuns = data.aiRuns.filter((r) => r.agentId === a.id);
          const tokensSeries = [40, 62, 55, 78, 69, 88, 74, 95, 82, 70].map((v) => (v * (a.tokensToday ?? 1000)) / 95000);
          return (
            <div key={a.id} className={cls("ai-card", a.paused && "paused")} style={{ ["--accent" as string]: a.color }}>
              <div className="row" style={{ gap: 9 }}>
                <Avatar member={a} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <b style={{ fontSize: 13, letterSpacing: 0.4 }}>{a.name}</b>
                    <span className="pill" style={{ background: `${a.color}22`, color: a.color, fontSize: 9 }}>{a.model}</span>
                  </div>
                  <small className="tiny muted">{a.role}</small>
                  <div className="ai-status" style={{ color: a.paused ? "var(--amber)" : "var(--mint)", marginTop: 2 }}>
                    <span className="p" /> {agentStatusText(data, a)}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  title={a.paused ? "ปลุกให้ทำงาน" : "พักการทำงาน"}
                  onClick={() => void act({ type: "agent.toggle", id: a.id, paused: !a.paused })}
                >
                  {a.paused ? <Play size={14} /> : <Pause size={14} />}
                </button>
              </div>

              <div className="ai-metrics">
                <div className="ai-metric"><b>{a.runs}</b><small>runs ทั้งหมด</small></div>
                <div className="ai-metric"><b style={{ color: "var(--mint)" }}>{a.successRate}%</b><small>สำเร็จ</small></div>
                <div className="ai-metric"><b>{(a.tokensToday ?? 0).toLocaleString()}</b><small>tokens วันนี้</small></div>
              </div>

              <div>
                <div className="spread tiny muted" style={{ marginBottom: 3 }}>
                  <span><Gauge size={10} /> ระดับการตัดสินใจเอง (autonomy)</span>
                  <span>{a.autonomy}%</span>
                </div>
                <Meter value={a.autonomy ?? 0} />
              </div>

              <div className="row" style={{ gap: 8, background: "var(--tint-1)", borderRadius: 9, padding: "7px 9px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny muted" style={{ marginBottom: 2 }}>งานในมือ</div>
                  {task ? (
                    <button className="link-btn" style={{ fontSize: 11 }} onClick={() => openTask(task.id)}>
                      {task.code} · {task.title.slice(0, 26)}{task.title.length > 26 ? "…" : ""}
                    </button>
                  ) : <span className="tiny">ว่าง — พร้อมรับงาน</span>}
                </div>
                <Spark values={tokensSeries} color={a.color} />
              </div>

              <div className="row">
                <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setAssign(a.id)}>
                  <Sparkles size={12} /> มอบงาน
                </button>
                <button
                  className="btn btn-sm"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => { toast(`${a.name}: ${agentStatusText(data, a)} · ${agentRuns.length} runs`, "ai"); }}
                >
                  <Activity size={12} /> ดู log
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "1.15fr .85fr" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Activity size={14} /> AI Console — run ล่าสุด</div>
            <div className="right">
              <div className="seg">
                {(["all", "running", "success"] as const).map((f) => (
                  <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                    {f === "all" ? "ทั้งหมด" : f === "running" ? "กำลังรัน" : "สำเร็จ"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="card-body" style={{ maxHeight: 360, overflowY: "auto" }}>
            <div className="run-log">
              {runs.map((r) => {
                const a = data.members.find((m) => m.id === r.agentId);
                const t = data.tasks.find((x) => x.id === r.taskId);
                return (
                  <div key={r.id} className="run-row">
                    <span className={cls("run-dot", r.status)} />
                    <Avatar member={a} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{a?.name} — {r.action} {t && <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {t.code}</span>}</b>
                      <small>{r.detail}</small>
                    </div>
                    <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                      <div className="tiny" style={{ color: r.status === "success" ? "var(--mint)" : r.status === "running" ? "var(--cyan)" : "var(--amber)" }}>
                        {r.status === "success" ? "สำเร็จ" : r.status === "running" ? "กำลังรัน" : r.status === "queued" ? "รอคิว" : "ล้มเหลว"}
                      </div>
                      <small className="tiny muted">{r.durationSec}s · {r.tokens.toLocaleString()} tok · {relTime(r.at)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="card-title"><Terminal size={14} /> Execution log</div><div className="right tiny muted">live</div></div>
            <div className="card-body">
              <div className="terminal">
                {data.aiRuns.slice(0, 8).map((r) => (
                  <div key={r.id}>
                    <span className="dim">[{thaiTime(r.at)}]</span>{" "}
                    <span className="ai">{data.members.find((m) => m.id === r.agentId)?.name}</span>{" "}
                    <span className={r.status === "success" ? "ok" : r.status === "running" ? "warn" : "dim"}>
                      {r.status === "success" ? "✓" : r.status === "running" ? "▸" : "•"} {r.action}
                    </span>
                    <div className="dim" style={{ paddingLeft: 14 }}>→ {r.detail}</div>
                  </div>
                ))}
                <div><span className="dim">[system]</span> <span className="ok">workspace synced</span> · MariaDB pool ok · MCP drive connected</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title"><Timer size={14} /> งานที่ AI ดูแลอยู่</div><div className="right tiny muted">{aiTasks.length} งาน</div></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 250, overflowY: "auto" }}>
              {aiTasks.map((t) => {
                const a = data.members.find((m) => m.id === t.assigneeId);
                return (
                  <button key={t.id} className="list-row" onClick={() => openTask(t.id)}>
                    <Avatar member={a} size="sm" />
                    <span className="lr-main"><b>{t.title}</b><small>{t.code} · {a?.name} · {t.progress}%</small></span>
                    <ChevronRight size={13} style={{ opacity: 0.4 }} />
                  </button>
                );
              })}
              {!aiTasks.length && <Empty icon={<CheckCircle2 size={22} />} text="AI ยังไม่มีงานในมือ" />}
            </div>
          </div>
        </div>
      </div>

      {assign && <AssignModal agentId={assign} onClose={() => setAssign(null)} />}
    </div>
  );
}

function KpiBox({ icon, grad, value, label }: { icon: React.ReactNode; grad: string; value: React.ReactNode; label: string }) {
  return (
    <div className="kpi">
      <div className="k-top">
        <span className="kpi-ico" style={{ background: grad }}>{icon}</span>
      </div>
      <div>
        <div className="kpi-val">{value}</div>
        <div className="kpi-lbl">{label}</div>
      </div>
    </div>
  );
}

function AssignModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const { data, act, toast } = useApp();
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const agent = data.members.find((m) => m.id === agentId);
  const open = data.tasks.filter((t) => t.status !== "done");

  return (
    <Modal
      title={`มอบงานให้ ${agent?.name}`}
      subtitle={agent?.role}
      icon={<BrainCircuit size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button
            className="btn btn-mint"
            disabled={!taskId || busy}
            onClick={async () => {
              setBusy(true);
              await act({ type: "agent.run", id: agentId, taskId });
              const t = data.tasks.find((x) => x.id === taskId);
              toast(`${agent?.name} เริ่มทำงาน ${t?.code} แล้ว — ดูได้ใน AI Console`, "ai");
              setBusy(false);
              onClose();
            }}
          >
            <Sparkles size={13} /> เริ่มทำงาน
          </button>
        </>
      }
    >
      <div className="side-card" style={{ fontSize: 11 }}>
        <b><Cpu size={12} /> {agent?.model}</b>
        autonomy {agent?.autonomy}% · tokens วันนี้ {(agent?.tokensToday ?? 0).toLocaleString()} · ความสำเร็จ {agent?.successRate}%
      </div>
      <label className="field">
        <span className="label">เลือกงานที่ยังไม่ปิด ({open.length})</span>
        <select className="select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">— เลือกงาน —</option>
          {open.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.title}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="label">หรือสั่งด้วยภาษาธรรมชาติ</span>
        <textarea className="textarea" placeholder="เช่น ตรวจรีวิวโค้ดโมดูลแชทแล้วสรุปประเด็นเสี่ยง" />
      </label>
    </Modal>
  );
}
