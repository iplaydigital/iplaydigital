"use client";

// ─────────────────────────────────────────────────────────────
//  API Pool — รวมคีย์หลายเส้น + โควต้า + สลับอัตโนมัติ
//  Models — ดูความสามารถ/ราคาของทุกโมเดลในผู้ให้บริการที่เลือก
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Check, Coins, Gauge, KeyRound, Loader2, Plus, RefreshCw,
  RotateCcw, Server, Trash2, Zap,
} from "lucide-react";
import { Empty, Meter, Modal } from "./ui";
import { useApp } from "./providers";
import {
  CAPABILITY_META, KEY_STATUS_META, PROVIDERS, shortTokens, thb,
  type AiProvider, type Capability, type KeyStatus,
} from "../lib/ai-shared";
import { cls, relTime } from "../lib/utils";

export interface PoolKeyPublic {
  id: string;
  provider: AiProvider;
  label: string;
  baseUrl: string;
  defaultModel: string;
  dailyQuota: number;
  dailyRequests: number;
  monthlyQuota: number;
  usedTokensToday: number;
  usedRequestsToday: number;
  usedTokensMonth: number;
  resetHour: number;
  status: KeyStatus;
  cooldownUntil: string | null;
  lastError: string | null;
  lastUsedAt: string | null;
  priority: number;
  updatedAt: string | null;
  apiKeyMasked: string;
  apiKeySet: boolean;
}

interface PoolStatusRow {
  provider: AiProvider;
  keys: number;
  active: number;
  exhausted: number;
  waiting: number;
  disabled: number;
  error: number;
  quotaToday: number;
  usedToday: number;
  remainingToday: number;
  usedMonth: number;
  nextResetAt: string | null;
  canUse: boolean;
}

interface PoolSummary {
  rows: PoolStatusRow[];
  totals: { keys: number; active: number; quotaToday: number; usedToday: number; remainingToday: number; usedMonth: number };
  nextResetAt: string | null;
}

const providerLabel = (key: AiProvider) => PROVIDERS.find((p) => p.key === key)?.label ?? key;

const emptyForm = {
  id: "",
  provider: "openai" as AiProvider,
  label: "",
  apiKey: "",
  baseUrl: "",
  defaultModel: "",
  dailyQuota: 0,
  dailyRequests: 0,
  monthlyQuota: 0,
  resetHour: 0,
  priority: 0,
};

export function ApiPoolPanel() {
  const { toast } = useApp();
  const [keys, setKeys] = useState<PoolKeyPublic[]>([]);
  const [summary, setSummary] = useState<PoolSummary | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/pool", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        keys?: PoolKeyPublic[]; summary?: PoolSummary; canEdit?: boolean;
      };
      setKeys(body.keys ?? []);
      setSummary(body.summary ?? null);
      setCanEdit(Boolean(body.canEdit));
    } catch {
      toast("โหลด API pool ไม่สำเร็จ", "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const totals = summary?.totals;
  const allEmpty = totals ? totals.keys > 0 && totals.active === 0 : false;

  const act = async (id: string, action: "test" | "reset") => {
    setBusyId(`${id}:${action}`);
    try {
      const res = await fetch(`/api/ai/pool/${id}/${action}`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "ทำรายการไม่สำเร็จ");
      toast(action === "test" ? body.message || "ทดสอบแล้ว" : "รีเซ็ตโควต้าคีย์แล้ว", body.ok === false ? "err" : "ok");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (key: PoolKeyPublic) => {
    if (!confirm(`ลบคีย์ ${key.label || providerLabel(key.provider)} ออกจาก pool?`)) return;
    setBusyId(`${key.id}:delete`);
    try {
      const res = await fetch(`/api/ai/pool?id=${encodeURIComponent(key.id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "ลบไม่สำเร็จ");
      toast("ลบคีย์แล้ว", "ok");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusyId(null);
    }
  };

  const save = async () => {
    if (!form) return;
    try {
      const payload: Record<string, unknown> = { ...form };
      if (form.id) payload.id = form.id;
      else delete payload.id;
      if (!form.apiKey) delete payload.apiKey;
      const res = await fetch("/api/ai/pool", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast(form.id ? "แก้ไขคีย์แล้ว" : "เพิ่มคีย์เข้า pool แล้ว", "ok");
      setForm(null);
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  };

  const rows = useMemo(
    () => PROVIDERS.filter((p) => p.key !== "gateway").map((p) => ({
      provider: p.key,
      label: p.label,
      status: summary?.rows.find((r) => r.provider === p.key) ?? null,
    })),
    [summary],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {allEmpty && (
        <div className="login-alert">
          <AlertTriangle size={14} />
          <span>
            ทุกคีย์ใน pool ใช้โควต้าหมดแล้ว — ระบบจะพักงาน AI และกลับมาทำงานอัตโนมัติ
            {summary?.nextResetAt ? ` เวลา ${new Date(summary.nextResetAt).toLocaleString("th-TH")}` : ""}
          </span>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="k-top"><span className="kpi-ico" style={{ background: "var(--grad-violet)" }}><KeyRound size={16} /></span></div>
          <div><div className="kpi-val">{totals?.keys ?? 0}</div><div className="kpi-lbl">คีย์ใน pool · พร้อมใช้ {totals?.active ?? 0}</div></div>
        </div>
        <div className="kpi">
          <div className="k-top"><span className="kpi-ico" style={{ background: "var(--grad-mint)" }}><Gauge size={16} /></span></div>
          <div>
            <div className="kpi-val">{totals?.quotaToday ? shortTokens(totals.remainingToday) : "ไม่จำกัด"}</div>
            <div className="kpi-lbl">tokens คงเหลือวันนี้</div>
          </div>
        </div>
        <div className="kpi">
          <div className="k-top"><span className="kpi-ico" style={{ background: "var(--grad-cyan)" }}><Zap size={16} /></span></div>
          <div><div className="kpi-val">{shortTokens(totals?.usedToday ?? 0)}</div><div className="kpi-lbl">ใช้ไปวันนี้</div></div>
        </div>
        <div className="kpi">
          <div className="k-top"><span className="kpi-ico" style={{ background: "var(--grad-amber)" }}><RotateCcw size={16} /></span></div>
          <div>
            <div className="kpi-val" style={{ fontSize: 15 }}>
              {summary?.nextResetAt ? new Date(summary.nextResetAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </div>
            <div className="kpi-lbl">รีเซ็ตรอบถัดไป</div>
          </div>
        </div>
      </div>

      <div className="spread">
        <div>
          <div className="card-title" style={{ fontSize: 13.5 }}><Server size={14} /> สถานะผู้ให้บริการ</div>
          <p className="tiny muted" style={{ marginTop: 3 }}>เมื่อคีย์หนึ่งหมดโควต้า ระบบสลับไปคีย์ถัดไปให้อัตโนมัติ — หมดทุกเส้นจะขึ้นสถานะ “รอรีเซ็ต” พร้อมเวลา</p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => void load()}><RefreshCw size={12} /> รีเฟรช</button>
          <button className="btn btn-sm btn-primary" disabled={!canEdit} onClick={() => setForm({ ...emptyForm })}><Plus size={12} /> เพิ่ม API key</button>
        </div>
      </div>

      <div className="pool-grid">
        {rows.map((r) => {
          const pct = r.status && r.status.quotaToday ? Math.round((r.status.usedToday / r.status.quotaToday) * 100) : 0;
          return (
            <div key={r.provider} className={cls("pool-card", r.status?.canUse && "ok")}>
              <div className="spread">
                <b>{r.label}</b>
                {r.status ? (
                  <span className="pill" style={{ background: r.status.canUse ? "rgba(34,199,147,.14)" : "rgba(255,176,32,.18)", color: r.status.canUse ? "var(--mint)" : "var(--amber)" }}>
                    {r.status.canUse ? "พร้อมใช้" : "รอรีเซ็ต"}
                  </span>
                ) : <span className="pill">ยังไม่มีคีย์</span>}
              </div>
              <div className="pool-nums">
                <div><b>{r.status?.keys ?? 0}</b><small>คีย์</small></div>
                <div><b style={{ color: "var(--mint)" }}>{r.status?.active ?? 0}</b><small>พร้อม</small></div>
                <div><b style={{ color: "var(--pink)" }}>{(r.status?.exhausted ?? 0) + (r.status?.waiting ?? 0)}</b><small>เต็ม</small></div>
                <div><b>{(r.status?.error ?? 0) + (r.status?.disabled ?? 0)}</b><small>ปิด/ผิดพลาด</small></div>
              </div>
              <div>
                <div className="spread tiny muted" style={{ marginBottom: 3 }}>
                  <span>ใช้ไปวันนี้ {shortTokens(r.status?.usedToday ?? 0)}</span>
                  <span>{r.status?.quotaToday ? `${pct}%` : "ไม่จำกัด"}</span>
                </div>
                <Meter value={pct} tone={pct >= 100 ? "pink" : pct >= 80 ? "amber" : ""} />
              </div>
              {r.status?.nextResetAt && !r.status.canUse && (
                <div className="tiny" style={{ color: "var(--amber)" }}>
                  รีเซ็ต {new Date(r.status.nextResetAt).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><KeyRound size={14} /> คีย์ทั้งหมด ({keys.length})</div>
          <div className="right tiny muted">สลับอัตโนมัติตาม priority → ใช้้น้อยสุดก่อน</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading && <div className="tiny muted" style={{ padding: 16 }}><Loader2 size={12} className="spin" /> กำลังโหลด…</div>}
          {!loading && !keys.length && (
            <Empty icon={<KeyRound size={22} />} text="ยังไม่มีคีย์ใน pool — เพิ่มคีย์เพื่อให้ AI ทำงานผ่าน API จริง" />
          )}
          {keys.map((k) => {
            const meta = KEY_STATUS_META[k.status];
            const pct = k.dailyQuota ? Math.min(100, Math.round((k.usedTokensToday / k.dailyQuota) * 100)) : 0;
            return (
              <div key={k.id} className="key-row">
                <div className="kr-main">
                  <div className="row" style={{ gap: 6 }}>
                    <b>{k.label || providerLabel(k.provider)}</b>
                    <span className="pill" style={{ background: meta.soft, color: meta.color }}>{meta.label}</span>
                    <span className="pill" style={{ fontSize: 9 }}>{providerLabel(k.provider)}</span>
                    <span className="tiny muted">{k.apiKeyMasked}</span>
                  </div>
                  <div className="tiny muted">
                    {k.defaultModel || "โมเดลเริ่มต้น: ตาม agent"} · priority {k.priority} · รีเซ็ต {String(k.resetHour).padStart(2, "0")}:00
                    {k.lastUsedAt ? ` · ใช้ล่าสุด ${relTime(k.lastUsedAt)}` : " · ยังไม่เคยใช้"}
                  </div>
                  {k.lastError && <div className="tiny" style={{ color: "var(--red)" }}>{k.lastError}</div>}
                </div>
                <div className="kr-quota">
                  <div className="spread tiny muted"><span>{shortTokens(k.usedTokensToday)} / {k.dailyQuota ? shortTokens(k.dailyQuota) : "ไม่จำกัด"}</span><span>{k.usedRequestsToday}{k.dailyRequests ? ` / ${k.dailyRequests}` : ""} คำขอ</span></div>
                  <Meter value={pct} tone={pct >= 100 ? "pink" : pct >= 80 ? "amber" : ""} />
                  <div className="tiny muted">เดือนนี้ {shortTokens(k.usedTokensMonth)}{k.monthlyQuota ? ` / ${shortTokens(k.monthlyQuota)}` : ""}</div>
                </div>
                <div className="kr-actions">
                  <button className="btn btn-sm" disabled={!canEdit || busyId === `${k.id}:test`} onClick={() => void act(k.id, "test")}>
                    {busyId === `${k.id}:test` ? <Loader2 size={11} className="spin" /> : <Activity size={11} />} ทดสอบ
                  </button>
                  <button className="btn btn-sm" disabled={!canEdit || busyId === `${k.id}:reset`} onClick={() => void act(k.id, "reset")}>
                    <RotateCcw size={11} /> รีเซ็ต
                  </button>
                  <button
                    className="icon-btn"
                    title="แก้ไข"
                    disabled={!canEdit}
                    onClick={() => setForm({
                      id: k.id, provider: k.provider, label: k.label, apiKey: "", baseUrl: k.baseUrl,
                      defaultModel: k.defaultModel, dailyQuota: k.dailyQuota, dailyRequests: k.dailyRequests,
                      monthlyQuota: k.monthlyQuota, resetHour: k.resetHour, priority: k.priority,
                    })}
                  >
                    <KeyRound size={12} />
                  </button>
                  <button className="icon-btn" title="ลบ" disabled={!canEdit} onClick={() => void remove(k)}>
                    {busyId === `${k.id}:delete` ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {form && (
        <Modal
          title={form.id ? "แก้ไข API key" : "เพิ่ม API key เข้า pool"}
          subtitle="คีย์จะถูกเก็บแบบไม่ส่งกลับ client และสลับให้อัตโนมัติเมื่อโควต้าหมด"
          icon={<KeyRound size={16} />}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setForm(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => void save()}><Check size={13} /> บันทึก</button>
            </>
          }
        >
          <div className="ai-config-grid">
            <label className="field">
              <span className="label">ผู้ให้บริการ</span>
              <select className="select" value={form.provider} onChange={(e) => {
                const key = e.target.value as AiProvider;
                setForm({ ...form, provider: key, baseUrl: PROVIDERS.find((p) => p.key === key)?.baseUrl ?? "" });
              }}>
                {PROVIDERS.filter((p) => p.key !== "local").map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <span className="tiny muted">{PROVIDERS.find((p) => p.key === form.provider)?.hint}</span>
            </label>
            <label className="field">
              <span className="label">ชื่อเรียก (ให้ทีมรู้ว่าเส้นไหน)</span>
              <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="เช่น OpenAI — บัญชีบริษัท 1" />
            </label>
            <label className="field full">
              <span className="label">API key {form.id && <span className="tiny muted">(เว้นว่าง = คงค่าเดิม)</span>}</span>
              <input className="input" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-…" />
            </label>
            <label className="field">
              <span className="label">Base URL</span>
              <input className="input" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
            </label>
            <label className="field">
              <span className="label">โมเดลเริ่มต้น</span>
              <input className="input" value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} placeholder="gpt-4.1-mini" />
            </label>
            <label className="field">
              <span className="label">โควต้า tokens / วัน (0 = ไม่จำกัด)</span>
              <input className="input" type="number" min={0} step={10000} value={form.dailyQuota} onChange={(e) => setForm({ ...form, dailyQuota: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">โควต้า requests / วัน</span>
              <input className="input" type="number" min={0} step={50} value={form.dailyRequests} onChange={(e) => setForm({ ...form, dailyRequests: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">โควต้า tokens / เดือน</span>
              <input className="input" type="number" min={0} step={100000} value={form.monthlyQuota} onChange={(e) => setForm({ ...form, monthlyQuota: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">ชั่วโมงรีเซ็ต (0-23)</span>
              <input className="input" type="number" min={0} max={23} value={form.resetHour} onChange={(e) => setForm({ ...form, resetHour: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Priority (สูง = ใช้ก่อน)</span>
              <input className="input" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            </label>
          </div>
          <div className="side-card" style={{ fontSize: 11.5 }}>
            <b><Coins size={12} /> รูปแบบราคา</b>
            <div>ราคาต่อ 1M tokens ของแต่ละโมเดลดูได้ที่แท็บ “โมเดล” — ระบบใช้ราคานี้คิดค่าใช้จ่ายต่อโปรเจกต์ใน Dashboard</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── โมเดล: ความสามารถ + ราคา ──────────────────────────────────
interface ModelRow {
  id: string;
  label: string;
  contextWindow: number;
  maxOutput: number;
  priceIn: number;
  priceOut: number;
  priceInThbPerM: number;
  priceOutThbPerM: number;
  sampleCostThb: number;
  capabilities: Capability[];
  contextLabel: string;
  approx?: boolean;
  note?: string;
  source: "catalog" | "live";
}

export function ModelsPanel() {
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ live: boolean; message: string; usdRate: number }>({ live: false, message: "", usdRate: 36 });

  const load = useCallback(async (p: AiProvider) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/models?provider=${p}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        models?: ModelRow[]; live?: boolean; message?: string; usdRate?: number;
      };
      setModels(body.models ?? []);
      setMeta({ live: Boolean(body.live), message: body.message ?? "", usdRate: body.usdRate ?? 36 });
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(provider); }, [provider, load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="spread">
        <div>
          <div className="card-title" style={{ fontSize: 13.5 }}><Coins size={14} /> โมเดล · ความสามารถ · ราคา</div>
          <p className="tiny muted" style={{ marginTop: 3 }}>
            ดึงรายการโมเดลจริงจากผู้ให้บริการเมื่อมีคีย์ใน pool · แปลงราคาเป็นบาทที่อัตรา 1 USD = {meta.usdRate} บาท
            {meta.message ? ` · ${meta.message}` : ""}
          </p>
        </div>
        <div className="row">
          <select className="select" style={{ width: 220 }} value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
            {PROVIDERS.filter((p) => p.key !== "local" && p.key !== "gateway").map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => void load(provider)}><RefreshCw size={12} /> รีเฟรช</button>
        </div>
      </div>

      {loading && <div className="tiny muted"><Loader2 size={12} className="spin" /> กำลังดึงรายการโมเดล…</div>}

      <div className="model-grid">
        {models.map((m) => (
          <div key={m.id} className="model-card">
            <div className="mc-head">
              <b>{m.label}</b>
              <span className={cls("pill", m.source === "live" ? "ok" : "")}>{m.source === "live" ? "ข้อมูลสด" : "แคตตาล็อก"}</span>
              {m.approx && <span className="pill warn">ราคาประมาณ</span>}
            </div>
            <div className="tiny muted" style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{m.id}</div>
            <div className="mc-cap">
              {m.capabilities.map((c) => (
                <span key={c} className="cap-chip">{CAPABILITY_META[c]?.icon} {CAPABILITY_META[c]?.label}</span>
              ))}
            </div>
            <div className="mc-grid">
              <div><span>Context</span><b>{m.contextLabel}</b></div>
              <div><span>Output</span><b>{m.maxOutput.toLocaleString()}</b></div>
              <div><span>Input /1M</span><b>{thb(m.priceInThbPerM)}</b></div>
              <div><span>Output /1M</span><b>{thb(m.priceOutThbPerM)}</b></div>
              <div><span>งาน 10k tokens</span><b style={{ color: "var(--mint)" }}>{thb(m.sampleCostThb, 3)}</b></div>
              <div><span>USD /1M</span><b>${m.priceIn} / ${m.priceOut}</b></div>
            </div>
            {m.note && <div className="tiny muted">{m.note}</div>}
          </div>
        ))}
      </div>
      {!loading && !models.length && <Empty icon={<Coins size={22} />} text="ยังไม่มีข้อมูลโมเดลของผู้ให้บริการนี้" />}
    </div>
  );
}
