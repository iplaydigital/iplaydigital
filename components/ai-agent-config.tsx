"use client";

// ─────────────────────────────────────────────────────────────
//  ตั้งค่า AI แต่ละตัว
//   • เลือก Provider จาก API pool → โหลดโมเดล + ความสามารถ + ราคา
//   • ผูก Skill / Plugin / MCP จากคลัง
//   • เปลี่ยนรูป AI และกำหนดโปรเจกต์ที่ดูแล
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bot, Check, Coins, ImagePlus, Layers, Loader2, Plug, Save, Settings2, Sparkles, Trash2, Upload,
} from "lucide-react";
import { Modal } from "./ui";
import { useApp } from "./providers";
import {
  CAPABILITY_META, PROVIDERS, RUNTIME_META, shortTokens, thb,
  type AiProvider, type Capability, type SkillKind, type SkillRuntime,
} from "../lib/ai-shared";
import { cls } from "../lib/utils";

export interface AgentConfigPublic {
  id: string;
  name: string;
  role: string;
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKeySet: boolean;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  costIn: number;
  costOut: number;
  budget: number;
  tokensMonth: number;
  costMonth: number;
  chatEnabled: boolean;
  autoReply: boolean;
  skillIds: string[];
  pluginIds: string[];
  mcpServerIds: string[];
  avatar: string | null;
  projectIds: string[];
  updatedAt: string | null;
}

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

interface SkillRow {
  id: string;
  kind: SkillKind;
  name: string;
  category: string;
  description: string;
  runtime: SkillRuntime;
  capabilities: string[];
  enabled: boolean;
}

interface McpRow {
  id: string;
  name: string;
  url: string;
  transport: string;
  tools: string[];
  enabled: boolean;
}

interface PoolRow {
  provider: AiProvider;
  keys: number;
  active: number;
  remainingToday: number;
  canUse: boolean;
  nextResetAt: string | null;
}

const AVATAR_PRESETS = [
  { bg: "linear-gradient(135deg,#7100DD,#B37CFF)", emoji: "🤖" },
  { bg: "linear-gradient(135deg,#2F7BF0,#6FD3FF)", emoji: "🛰" },
  { bg: "linear-gradient(135deg,#149C74,#5BE3B4)", emoji: "🧩" },
  { bg: "linear-gradient(135deg,#D6337A,#FFA1C4)", emoji: "🎨" },
  { bg: "linear-gradient(135deg,#B4761A,#FFD37A)", emoji: "📊" },
  { bg: "linear-gradient(135deg,#3A3F5C,#8A8FB1)", emoji: "🧠" },
];

const presetToDataUrl = (bg: string, emoji: string) => `preset:${bg}|${emoji}`;

export function AgentConfigModal({
  agentId,
  config,
  canEdit,
  onClose,
  onSaved,
}: {
  agentId: string;
  config: AgentConfigPublic | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { data, toast } = useApp();
  const [tab, setTab] = useState<"api" | "skills" | "work">("api");
  const [form, setForm] = useState(() => ({
    provider: config?.provider ?? "local",
    baseUrl: config?.baseUrl ?? "",
    model: config?.model ?? "",
    apiKey: "",
    temperature: config?.temperature ?? 0.4,
    maxTokens: config?.maxTokens ?? 1200,
    systemPrompt: config?.systemPrompt ?? "",
    costIn: config?.costIn ?? 0,
    costOut: config?.costOut ?? 0,
    budget: config?.budget ?? 0,
    chatEnabled: config?.chatEnabled ?? true,
    autoReply: config?.autoReply ?? true,
    skillIds: config?.skillIds ?? [],
    pluginIds: config?.pluginIds ?? [],
    mcpServerIds: config?.mcpServerIds ?? [],
    avatar: config?.avatar ?? null as string | null,
    projectIds: config?.projectIds ?? [],
  }));

  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsNote, setModelsNote] = useState("");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [mcp, setMcp] = useState<McpRow[]>([]);
  const [pool, setPool] = useState<PoolRow[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!config) return;
    setForm((f) => ({
      ...f,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      systemPrompt: config.systemPrompt,
      costIn: config.costIn,
      costOut: config.costOut,
      budget: config.budget,
      chatEnabled: config.chatEnabled,
      autoReply: config.autoReply,
      skillIds: config.skillIds ?? [],
      pluginIds: config.pluginIds ?? [],
      mcpServerIds: config.mcpServerIds ?? [],
      avatar: config.avatar,
      projectIds: config.projectIds ?? [],
    }));
  }, [config]);

  // โหลด skill/plugin/MCP + สถานะ pool
  useEffect(() => {
    void (async () => {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/ai/skills", { cache: "no-store" }),
        fetch("/api/ai/pool", { cache: "no-store" }),
      ]);
      const sBody = (await sRes.json().catch(() => ({}))) as { skills?: SkillRow[]; mcp?: McpRow[] };
      const pBody = (await pRes.json().catch(() => ({}))) as { summary?: { rows?: PoolRow[] } };
      setSkills(sBody.skills ?? []);
      setMcp(sBody.mcp ?? []);
      setPool(pBody.summary?.rows ?? []);
    })();
  }, []);

  const loadModels = useCallback(
    async (provider: AiProvider) => {
      setModelsLoading(true);
      try {
        const res = await fetch(`/api/ai/models?provider=${provider}&agentId=${agentId}`, { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { models?: ModelRow[]; message?: string; live?: boolean };
        setModels(body.models ?? []);
        setModelsNote(`${body.live ? "ดึงจากผู้ให้บริการ" : "แคตตาล็อกภายใน"}${body.message ? ` · ${body.message}` : ""}`);
      } catch {
        setModels([]);
      } finally {
        setModelsLoading(false);
      }
    },
    [agentId],
  );

  useEffect(() => {
    void loadModels(form.provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.provider]);

  const model = useMemo(() => models.find((m) => m.id === form.model) ?? null, [models, form.model]);
  const poolRow = pool.find((p) => p.provider === form.provider);
  const skillList = skills.filter((s) => s.kind === "skill");
  const pluginList = skills.filter((s) => s.kind === "plugin");

  const toggle = (field: "skillIds" | "pluginIds" | "mcpServerIds" | "projectIds", id: string) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter((x) => x !== id) : [...f[field], id],
    }));
  };

  const pickAvatar = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", 0.86);
      setForm((f) => ({ ...f, avatar: url }));
    } catch {
      toast("อ่านไฟล์รูปไม่สำเร็จ", "err");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: agentId,
        provider: form.provider,
        baseUrl: form.baseUrl,
        model: form.model,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        systemPrompt: form.systemPrompt,
        costIn: form.costIn,
        costOut: form.costOut,
        budget: form.budget,
        chatEnabled: form.chatEnabled,
        autoReply: form.autoReply,
        skillIds: form.skillIds,
        pluginIds: form.pluginIds,
        mcpServerIds: form.mcpServerIds,
        projectIds: form.projectIds,
        avatar: form.avatar ?? "",
      };
      if (form.apiKey) payload.apiKey = form.apiKey;

      const res = await fetch("/api/ai/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast("บันทึกการตั้งค่า AI แล้ว", "ok");
      await onSaved();
      onClose();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const overBudget = Boolean(config && config.budget > 0 && config.costMonth >= config.budget);

  return (
    <Modal
      wide
      title={`ตั้งค่า ${config?.name ?? "AI agent"}`}
      subtitle={config ? `${config.role} · ${PROVIDERS.find((p) => p.key === form.provider)?.label ?? form.provider}` : "กำลังโหลด…"}
      icon={<Settings2 size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !canEdit || !config}>
            {saving ? <><Loader2 size={13} className="spin" /> กำลังบันทึก…</> : <><Save size={13} /> บันทึก</>}
          </button>
        </>
      }
    >
      {!canEdit && (
        <div className="login-alert" style={{ marginBottom: 10 }}>
          <AlertTriangle size={13} />
          <span>ดูได้อย่างเดียว — เฉพาะ Admin / Support เท่านั้นที่แก้ไขการเชื่อมต่อ API และค่าใช้จ่ายได้</span>
        </div>
      )}

      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === "api" ? "on" : ""} onClick={() => setTab("api")}><Plug size={12} /> API & โมเดล</button>
        <button className={tab === "skills" ? "on" : ""} onClick={() => setTab("skills")}><Layers size={12} /> Skill · Plugin · MCP</button>
        <button className={tab === "work" ? "on" : ""} onClick={() => setTab("work")}><Bot size={12} /> รูป & งาน</button>
      </div>

      {config && tab === "api" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="ai-cost-box">
            <div><span className="tiny muted">งบเดือนนี้</span><b>{config.budget ? thb(config.budget, 0) : "ไม่จำกัด"}</b></div>
            <div><span className="tiny muted">ใช้ไปแล้ว</span><b className={cls(overBudget && "ai-row-warn")}>{thb(config.costMonth)}</b></div>
            <div><span className="tiny muted">tokens เดือนนี้</span><b>{config.tokensMonth.toLocaleString()}</b></div>
          </div>

          <div className="ai-config-grid">
            <label className="field">
              <span className="label"><Plug size={11} /> Provider (จาก API pool)</span>
              <select
                className="select"
                value={form.provider}
                disabled={!canEdit}
                onChange={(e) => {
                  const key = e.target.value as AiProvider;
                  const p = PROVIDERS.find((x) => x.key === key)!;
                  setForm({ ...form, provider: key, baseUrl: p.baseUrl, model: p.model || form.model });
                }}
              >
                {PROVIDERS.map((p) => {
                  const row = pool.find((x) => x.provider === p.key);
                  return (
                    <option key={p.key} value={p.key}>
                      {p.label}{p.key !== "local" ? ` · ${row ? `${row.keys} คีย์${row.canUse ? "" : " (รอโควต้า)"}` : "ยังไม่มีคีย์"}` : ""}
                    </option>
                  );
                })}
              </select>
              {form.provider !== "local" && (
                <span className="tiny" style={{ color: poolRow?.canUse ? "var(--mint)" : "var(--amber)" }}>
                  {poolRow
                    ? poolRow.canUse
                      ? `พร้อมใช้ · เหลือ ${shortTokens(poolRow.remainingToday)} tokens วันนี้`
                      : `โควต้าหมด — รอรีเซ็ต ${poolRow.nextResetAt ? new Date(poolRow.nextResetAt).toLocaleString("th-TH") : "-"}`
                    : "ยังไม่มีคีย์ใน pool — เพิ่มได้ที่แท็บ API Pool"}
                </span>
              )}
            </label>

            <label className="field">
              <span className="label">โมเดล {modelsLoading && <Loader2 size={10} className="spin" />}</span>
              <select className="select" value={form.model} disabled={!canEdit} onChange={(e) => {
                const picked = models.find((m) => m.id === e.target.value);
                setForm({
                  ...form,
                  model: e.target.value,
                  costIn: picked ? Number(((picked.priceIn * 36) / 1000).toFixed(4)) : form.costIn,
                  costOut: picked ? Number(((picked.priceOut * 36) / 1000).toFixed(4)) : form.costOut,
                });
              }}>
                <option value="">— เลือกโมเดล —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {m.contextLabel} · ฿{m.priceInThbPerM}/{m.priceOutThbPerM} ต่อ 1M
                  </option>
                ))}
              </select>
              <span className="tiny muted">{modelsNote}</span>
            </label>

            <label className="field">
              <span className="label">Base URL</span>
              <input className="input" value={form.baseUrl} disabled={!canEdit} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
            </label>
            <label className="field">
              <span className="label">API Key เฉพาะตัว (ถ้าไม่ใช้จาก pool)</span>
              <input className="input" type="password" value={form.apiKey} disabled={!canEdit} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={config.apiKeySet ? "•••••••• (เว้นว่าง = คงค่าเดิม)" : "เว้นว่างเพื่อใช้คีย์จาก pool"} />
            </label>
          </div>

          {model && (
            <div className="model-card">
              <div className="mc-head">
                <b>{model.label}</b>
                <span className={cls("pill", model.source === "live" ? "ok" : "")}>{model.source === "live" ? "ข้อมูลสด" : "แคตตาล็อก"}</span>
                {model.approx && <span className="pill warn">ราคาประมาณ</span>}
              </div>
              <div className="mc-cap">
                {model.capabilities.map((c) => (
                  <span key={c} className="cap-chip">{CAPABILITY_META[c]?.icon} {CAPABILITY_META[c]?.label}</span>
                ))}
              </div>
              <div className="mc-grid">
                <div><span>Context</span><b>{model.contextWindow.toLocaleString()} tokens</b></div>
                <div><span>Output สูงสุด</span><b>{model.maxOutput.toLocaleString()} tokens</b></div>
                <div><span>ราคา input</span><b>${model.priceIn}/1M · {thb(model.priceInThbPerM)}</b></div>
                <div><span>ราคา output</span><b>${model.priceOut}/1M · {thb(model.priceOutThbPerM)}</b></div>
                <div><span>งาน 10k tokens</span><b>{thb(model.sampleCostThb, 3)}</b></div>
                <div><span>ผู้ให้บริการ</span><b>{PROVIDERS.find((p) => p.key === form.provider)?.label}</b></div>
              </div>
              {model.note && <div className="tiny muted">{model.note}</div>}
            </div>
          )}

          <div className="ai-config-grid">
            <label className="field">
              <span className="label">Temperature · {form.temperature}</span>
              <input type="range" min={0} max={2} step={0.1} value={form.temperature} disabled={!canEdit} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Max tokens ต่อคำตอบ</span>
              <input className="input" type="number" min={64} max={16000} value={form.maxTokens} disabled={!canEdit} onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">งบต่อเดือน (บาท) · 0 = ไม่จำกัด</span>
              <input className="input" type="number" min={0} step={50} value={form.budget} disabled={!canEdit} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
            </label>
            <div className="field" style={{ justifyContent: "flex-end", gap: 8 }}>
              <label className="row" style={{ gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={form.chatEnabled} disabled={!canEdit} onChange={(e) => setForm({ ...form, chatEnabled: e.target.checked })} />
                ตอบในแชท
              </label>
              <label className="row" style={{ gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={form.autoReply} disabled={!canEdit} onChange={(e) => setForm({ ...form, autoReply: e.target.checked })} />
                ตอบอัตโนมัติเมื่อถูก @
              </label>
            </div>
            <label className="field full">
              <span className="label">System prompt (บุคลิกและวิธีตอบ)</span>
              <textarea className="textarea" rows={3} value={form.systemPrompt} disabled={!canEdit} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} placeholder={`คุณคือ ${config.name} …`} />
            </label>
          </div>
        </div>
      )}

      {config && tab === "skills" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="side-card" style={{ fontSize: 11.5 }}>
            <b><Layers size={12} /> ถังความสามารถ</b>
            <div>เลือก skill/plugin จากคลัง (แก้ไขหรือโหลดเพิ่มได้ที่เมนู Skill &amp; Plugin) — จะถูกส่งเป็นบริบทให้ AI ตัวนี้ทุกครั้งที่ทำงาน</div>
          </div>

          <div>
            <b style={{ fontSize: 12 }}>Skill ({form.skillIds.length})</b>
            <div className="skill-picker">
              {skillList.length === 0 && <span className="tiny muted">ยังไม่มี skill ในคลัง</span>}
              {skillList.map((sk) => {
                const on = form.skillIds.includes(sk.id);
                return (
                  <button key={sk.id} className={cls("skill-chip", on && "on")} onClick={() => toggle("skillIds", sk.id)}>
                    <span className="rt" style={{ background: RUNTIME_META[sk.runtime].color }}>{RUNTIME_META[sk.runtime].label}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{sk.name}</b>
                      <small>{sk.category}</small>
                    </span>
                    {on && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <b style={{ fontSize: 12 }}>Plugin ({form.pluginIds.length})</b>
            <div className="skill-picker">
              {pluginList.length === 0 && <span className="tiny muted">ยังไม่มี plugin</span>}
              {pluginList.map((sk) => {
                const on = form.pluginIds.includes(sk.id);
                return (
                  <button key={sk.id} className={cls("skill-chip", on && "on")} onClick={() => toggle("pluginIds", sk.id)}>
                    <span className="rt" style={{ background: RUNTIME_META[sk.runtime].color }}>{RUNTIME_META[sk.runtime].label}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{sk.name}</b>
                      <small>{sk.description.slice(0, 42)}</small>
                    </span>
                    {on && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <b style={{ fontSize: 12 }}>MCP Server ({form.mcpServerIds.length})</b>
            <div className="skill-picker">
              {mcp.length === 0 && <span className="tiny muted">ยังไม่มี MCP server — เพิ่มได้ที่เมนู Skill &amp; Plugin</span>}
              {mcp.map((m) => {
                const on = form.mcpServerIds.includes(m.id);
                return (
                  <button key={m.id} className={cls("skill-chip", on && "on")} onClick={() => toggle("mcpServerIds", m.id)}>
                    <span className="rt" style={{ background: "#D6337A" }}>MCP</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{m.name}</b>
                      <small>{m.url || "ยังไม่ตั้ง URL"}</small>
                    </span>
                    {on && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {config && tab === "work" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <span className="label"><ImagePlus size={11} /> รูปประจำตัว AI</span>
            <div className="avatar-picker">
              <div className="avatar-preview">
                <AiAvatar avatar={form.avatar} name={config.name} size={64} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {AVATAR_PRESETS.map((p) => (
                    <button
                      key={p.emoji}
                      className="avatar-swatch"
                      style={{ background: p.bg }}
                      onClick={() => setForm({ ...form, avatar: presetToDataUrl(p.bg, p.emoji) })}
                      title="ใช้รูปสำเร็จรูป"
                    >
                      {p.emoji}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
                    <Upload size={11} /> อัปโหลดรูป
                  </button>
                  {form.avatar && (
                    <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => setForm({ ...form, avatar: null })} disabled={!canEdit}>
                      <Trash2 size={11} /> ลบรูป
                    </button>
                  )}
                </div>
                <span className="tiny muted">อัปโหลดได้ (ย่อเป็น 256px อัตโนมัติ) หรือใช้รูปสำเร็จรูป</span>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickAvatar(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="field">
            <span className="label"><Sparkles size={11} /> โปรเจกต์ / งานที่ AI ตัวนี้ดูแล ({form.projectIds.length})</span>
            <div className="skill-picker">
              {(data?.projects ?? []).map((p) => {
                const on = form.projectIds.includes(p.id);
                return (
                  <button key={p.id} className={cls("skill-chip", on && "on")} onClick={() => toggle("projectIds", p.id)}>
                    <span className="rt" style={{ background: p.color || "#7100DD" }}>{p.code}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{p.name}</b>
                      <small>{p.client || "—"} · {p.progress}%</small>
                    </span>
                    {on && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="side-card" style={{ fontSize: 11.5 }}>
            <b><Coins size={12} /> ค่าใช้จ่าย & การทำงาน</b>
            <div>• งบเดือน: {config.budget ? thb(config.budget, 0) : "ไม่จำกัด"} · ใช้ไป {thb(config.costMonth)} · {config.tokensMonth.toLocaleString()} tokens</div>
            <div>• ราคาต่อ 1K tokens (จากโมเดลที่เลือก): input {thb(form.costIn, 4)} · output {thb(form.costOut, 4)}</div>
            <div>• ถ้าโควต้าคีย์หมด ระบบจะสลับคีย์อื่นใน pool ให้อัตโนมัติ และพักเป็น “รอรีเซ็ต” เมื่อทุกเส้นเต็ม</div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** รูป AI: รองรับ preset (gradient+emoji), data URL และไม่มีรูป */
export function AiAvatar({ avatar, name, size = 42 }: { avatar?: string | null; name: string; size?: number }) {
  if (avatar?.startsWith("preset:")) {
    const [, body] = avatar.split("preset:");
    const [bg, emoji] = (body ?? "").split("|");
    return (
      <span className="ai-avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}>
        {emoji || "🤖"}
      </span>
    );
  }
  if (avatar && (avatar.startsWith("data:") || avatar.startsWith("http"))) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="ai-avatar" src={avatar} alt={name} style={{ width: size, height: size, objectFit: "cover" }} />;
  }
  return (
    <span className="ai-avatar" style={{ width: size, height: size, background: "linear-gradient(135deg,#7100DD,#B37CFF)", fontSize: size * 0.34 }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
