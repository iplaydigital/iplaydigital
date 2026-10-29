"use client";

// ─────────────────────────────────────────────────────────────
//  Dashboard การใช้ AI + ต้นทุนต่อโปรเจกต์ + ประเมินราคา
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Calculator, Coins, Gauge, Loader2, RefreshCw, Sparkles, Zap,
} from "lucide-react";
import { Empty, Meter } from "./ui";
import { Spark } from "./charts";
import { useApp } from "./providers";
import { PROVIDERS, shortTokens, thb, type AiProvider } from "../lib/ai-shared";
import { cls, relTime } from "../lib/utils";

interface Bucket { key: string; label: string; tokensIn: number; tokensOut: number; tokens: number; cost: number; calls: number }
interface Sum { tokens: number; cost: number; calls: number }
interface UsageStats {
  today: Sum; last7d: Sum; month: Sum; total: Sum;
  byAgent: Bucket[]; byModel: Bucket[]; byProvider: Bucket[]; byProject: Bucket[];
  daily: { date: string; tokens: number; cost: number; calls: number }[];
  recent: { id: string; at: string; agentId: string; agentName: string; provider: string; model: string; tokensIn: number; tokensOut: number; costThb: number; projectId: string | null; ok: boolean }[];
}
interface DashboardBody {
  stats: UsageStats;
  pool: { summary: { rows: { provider: AiProvider; keys: number; canUse: boolean; remainingToday: number; nextResetAt: string | null }[]; nextResetAt: string | null } };
  agents: { id: string; name: string; costIn: number; costOut: number }[];
  budgets: { agentMonthly: number; spentMonth: number; projectedMonth: number };
  days: number;
}

interface EstimateResult {
  ok: boolean;
  model: { id: string; label: string; priceIn: number; priceOut: number };
  provider: AiProvider;
  complexity: "low" | "med" | "high";
  tasks: number;
  projectName: string | null;
  tokensIn: number;
  tokensOut: number;
  tokens: number;
  costUsd: number;
  costThb: number;
  costPerTaskThb: number;
  rows: { id: string; code: string; title: string; status: string; complexity: string; tokensIn: number; tokensOut: number; costThb: number }[];
  quota: { remainingToday: number | null; fitToday: boolean | null; dailyRunsNeeded: number | null; nextResetAt: string | null; note: string };
  message: string;
}

interface ModelOption { id: string; label: string; priceInThbPerM: number; priceOutThbPerM: number }

export function UsageDashboard() {
  const { data, toast } = useApp();
  const [body, setBody] = useState<DashboardBody | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/dashboard?days=${d}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as DashboardBody & { error?: string };
      if (json.error) throw new Error(json.error);
      setBody(json);
    } catch (err) {
      toast((err as Error).message || "โหลด dashboard ไม่สำเร็จ", "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(days); }, [days, load]);

  const stats = body?.stats;
  const dailyTokens = useMemo(() => (stats?.daily ?? []).map((d) => d.tokens), [stats]);
  const dailyCost = useMemo(() => (stats?.daily ?? []).map((d) => d.cost), [stats]);
  const maxCost = Math.max(0.0001, ...dailyCost);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="spread">
        <div>
          <div className="card-title" style={{ fontSize: 13.5 }}><BarChart3 size={14} /> การใช้ AI และต้นทุนจริง</div>
          <p className="tiny muted" style={{ marginTop: 3 }}>นับทุกครั้งที่ AI ทำงานผ่าน API — แยกตามเอเจนต์ โมเดล ผู้ให้บริการ และโปรเจกต์</p>
        </div>
        <div className="row">
          <div className="seg">
            {[7, 30, 90].map((d) => (
              <button key={d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d} วัน</button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => void load(days)}>{loading ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} รีเฟรช</button>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi icon={<Zap size={16} />} grad="var(--grad-violet)" value={shortTokens(stats?.today.tokens ?? 0)} label={`tokens วันนี้ · ${stats?.today.calls ?? 0} ครั้ง`} />
        <Kpi icon={<Coins size={16} />} grad="var(--grad-mint)" value={thb(stats?.today.cost ?? 0)} label="ค่าใช้จ่ายวันนี้" />
        <Kpi icon={<Activity size={16} />} grad="var(--grad-cyan)" value={shortTokens(stats?.month.tokens ?? 0)} label={`tokens เดือนนี้ · ${thb(stats?.month.cost ?? 0)}`} />
        <Kpi icon={<Gauge size={16} />} grad="var(--grad-amber)" value={thb(body?.budgets.projectedMonth ?? 0)} label={`คาดการณ์ทั้งเดือน · งบ ${body?.budgets.agentMonthly ? thb(body.budgets.agentMonthly, 0) : "ไม่จำกัด"}`} />
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "1.1fr .9fr" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Activity size={14} /> ปริมาณการใช้รายวัน</div>
            <div className="right tiny muted">tokens · สูงสุด {shortTokens(Math.max(0, ...dailyTokens))}</div>
          </div>
          <div className="card-body">
            {dailyTokens.some((v) => v > 0) ? (
              <div style={{ height: 110 }}><Spark values={dailyTokens} color="#7100DD" /></div>
            ) : (
              <Empty icon={<BarChart3 size={22} />} text="ยังไม่มีการเรียกใช้ API — ตัวเลขจะขึ้นเมื่อ AI ทำงาน" />
            )}
            <div className="spread tiny muted" style={{ marginTop: 6 }}>
              <span>{stats?.daily[0]?.date ?? ""}</span>
              <span>{stats?.daily[stats.daily.length - 1]?.date ?? ""}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><Coins size={14} /> ต้นทุนต่อโปรเจกต์</div>
            <div className="right tiny muted">{thb(stats?.byProject.reduce((s, p) => s + p.cost, 0) ?? 0)}</div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
            {!(stats?.byProject ?? []).length && <Empty icon={<Coins size={22} />} text="ยังไม่มีข้อมูลต้นทุนตามโปรเจกต์" />}
            {(stats?.byProject ?? []).map((p) => (
              <div key={p.key}>
                <div className="spread tiny">
                  <b>{p.label}</b>
                  <span>{thb(p.cost)} · {shortTokens(p.tokens)} tok · {p.calls} ครั้ง</span>
                </div>
                <Meter value={(p.cost / Math.max(0.0001, Math.max(...(stats?.byProject ?? [{ cost: 1 }]).map((x) => x.cost)))) * 100}  />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <BucketTable title="แยกตาม AI agent" icon={<Sparkles size={14} />} rows={stats?.byAgent ?? []} />
        <BucketTable title="แยกตามโมเดล" icon={<Gauge size={14} />} rows={stats?.byModel ?? []} />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><Activity size={14} /> รายการล่าสุด</div>
          <div className="right tiny muted">{stats?.recent.length ?? 0} รายการ</div>
        </div>
        <div className="card-body" style={{ padding: 0, maxHeight: 260, overflowY: "auto" }}>
          {!(stats?.recent ?? []).length && <Empty icon={<Activity size={22} />} text="ยังไม่มีการใช้งาน" />}
          {(stats?.recent ?? []).map((r) => (
            <div key={r.id} className="usage-row">
              <span className={cls("run-dot", r.ok ? "success" : "failed")} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 12 }}>{r.agentName || r.agentId}</b>
                <div className="tiny muted">{r.provider} · {r.model} · {r.tokensIn.toLocaleString()}→{r.tokensOut.toLocaleString()} tok</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <b style={{ fontSize: 12, color: "var(--mint)" }}>{thb(r.costThb, 3)}</b>
                <div className="tiny muted">{relTime(r.at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <EstimateBox projects={data?.projects ?? []} />
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

function BucketTable({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: Bucket[] }) {
  const top = rows.slice(0, 6);
  const max = Math.max(0.0001, ...top.map((r) => r.cost));
  return (
    <div className="card">
      <div className="card-head"><div className="card-title">{icon} {title}</div><div className="right tiny muted">{rows.length} รายการ</div></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {!top.length && <Empty icon={<Coins size={20} />} text="ยังไม่มีข้อมูล" />}
        {top.map((r) => (
          <div key={r.key}>
            <div className="spread tiny">
              <b>{r.label}</b>
              <span>{thb(r.cost)} · {shortTokens(r.tokens)} tok · {r.calls} ครั้ง</span>
            </div>
            <Meter value={(r.cost / max) * 100}  />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ประเมินราคางาน/โปรเจกต์ ────────────────────────────────────
function EstimateBox({ projects }: { projects: { id: string; code: string; name: string; client?: string }[] }) {
  const { toast } = useApp();
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [complexity, setComplexity] = useState<"low" | "med" | "high">("med");
  const [tasks, setTasks] = useState(0);
  const [includeDone, setIncludeDone] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/ai/models?provider=${provider}`, { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { models?: ModelOption[] };
        const list = body.models ?? [];
        setModels(list);
        if (list.length && !list.some((m) => m.id === model)) setModel(list[0].id);
      } catch {
        setModels([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          projectId: projectId || null,
          tasks: projectId ? undefined : tasks || undefined,
          complexity,
          includeDone,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as EstimateResult & { error?: string };
      if (!res.ok || body.error) throw new Error(body.error || "ประเมินไม่สำเร็จ");
      setResult(body);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const modelInfo = models.find((m) => m.id === model);

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><Calculator size={14} /> ประเมินราคาจากงาน/โปรเจกต์จริง</div>
        <div className="right tiny muted">คำนวณจากจำนวนงาน + ความยาก + ราคาโมเดล</div>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="ai-config-grid">
          <label className="field">
            <span className="label">ผู้ให้บริการ</span>
            <select className="select" value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
              {PROVIDERS.filter((p) => p.key !== "gateway").map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">โมเดล</span>
            <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
              {!models.length && <option value="rule-engine">rule-engine (ในระบบ)</option>}
              {models.map((m) => <option key={m.id} value={m.id}>{m.label} · ฿{m.priceInThbPerM}/{m.priceOutThbPerM}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">โปรเจกต์</span>
            <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— ใช้จำนวนงานที่กรอกเอง —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">ความยาก</span>
            <select className="select" value={complexity} onChange={(e) => setComplexity(e.target.value as "low" | "med" | "high")}>
              <option value="low">ต่ำ — บริบทสั้น</option>
              <option value="med">กลาง — งานทั่วไป</option>
              <option value="high">สูง — งานซับซ้อน</option>
            </select>
          </label>
          {!projectId && (
            <label className="field">
              <span className="label">จำนวนงาน (ชิ้น)</span>
              <input className="input" type="number" min={0} value={tasks || ""} onChange={(e) => setTasks(Number(e.target.value))} placeholder="เช่น 20" />
            </label>
          )}
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <label className="row" style={{ gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
              รวมงานที่ปิดแล้ว
            </label>
          </div>
        </div>

        <div className="row">
          <button className="btn btn-primary" onClick={() => void run()} disabled={busy || !projectId && !tasks}>
            {busy ? <><Loader2 size={13} className="spin" /> กำลังประเมิน…</> : <><Calculator size={13} /> ประเมินราคา</>}
          </button>
          {modelInfo && <span className="tiny muted">โมเดลละ ฿{modelInfo.priceInThbPerM}/1M input · ฿{modelInfo.priceOutThbPerM}/1M output</span>}
        </div>

        {result && (
          <>
            <div className="estimate-box">
              <div className="est-main">
                <div className="tiny muted">ราคาประเมินรวม</div>
                <b>{thb(result.costThb)}</b>
                <small>≈ ${result.costUsd.toFixed(4)} · {result.model.label}</small>
              </div>
              <div className="est-grid">
                <div><span>งาน</span><b>{result.tasks} ชิ้น</b></div>
                <div><span>ราคา/งาน</span><b>{thb(result.costPerTaskThb, 3)}</b></div>
                <div><span>tokens รวม</span><b>{result.tokens.toLocaleString()}</b></div>
                <div><span>in / out</span><b>{result.tokensIn.toLocaleString()} / {result.tokensOut.toLocaleString()}</b></div>
                <div><span>โควต้าคงเหลือวันนี้</span><b>{result.quota.remainingToday === null ? "ไม่จำกัด" : shortTokens(result.quota.remainingToday)}</b></div>
                <div><span>ใช้ได้วันนี้</span><b style={{ color: result.quota.fitToday === false ? "var(--red)" : "var(--mint)" }}>{result.quota.fitToday === null ? "—" : result.quota.fitToday ? "พอ" : "ไม่พอ"}</b></div>
              </div>
            </div>

            <div className={cls("side-card", result.quota.fitToday === false && "warn")} style={{ fontSize: 11.5 }}>
              {result.quota.fitToday === false ? <AlertTriangle size={12} /> : <Sparkles size={12} />} {result.quota.note}
              {result.quota.dailyRunsNeeded && result.quota.dailyRunsNeeded > 1 ? ` (ต้องใช้ ${result.quota.dailyRunsNeeded} รอบวัน)` : ""}
              {result.quota.nextResetAt ? ` · รีเซ็ต ${new Date(result.quota.nextResetAt).toLocaleString("th-TH")}` : ""}
            </div>

            {result.rows.length > 0 && (
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                <div className="est-table">
                  <div className="est-th"><span>งาน</span><span>ความยาก</span><span>tokens</span><span>ราคา</span></div>
                  {result.rows.map((r) => (
                    <div key={r.id} className="est-tr">
                      <span><b>{r.code}</b> {r.title}</span>
                      <span>{r.complexity}</span>
                      <span>{(r.tokensIn + r.tokensOut).toLocaleString()}</span>
                      <span style={{ color: "var(--mint)" }}>{thb(r.costThb, 3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="tiny muted">{result.message}</div>
          </>
        )}
      </div>
    </div>
  );
}
