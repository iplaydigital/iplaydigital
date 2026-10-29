"use client";

// ─────────────────────────────────────────────────────────────
//  คลัง Skill / Plugin + MCP Server
//   runtime: prompt · Python · Node.js · HTTP API · MCP
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check, Code2, Layers, Loader2, Pencil, Plug, Plus, RefreshCw, Search, Terminal, Trash2, Wifi,
} from "lucide-react";
import { Empty, Modal } from "./ui";
import { useApp } from "./providers";
import { RUNTIME_META, type SkillKind, type SkillRuntime } from "../lib/ai-shared";
import { cls, relTime } from "../lib/utils";

interface SkillRow {
  id: string;
  kind: SkillKind;
  name: string;
  category: string;
  description: string;
  capabilities: string[];
  runtime: SkillRuntime;
  entry: string;
  code: string;
  prompt: string;
  mcpServerId: string | null;
  tags: string[];
  builtin: boolean;
  enabled: boolean;
  updatedAt: string | null;
}

interface McpRow {
  id: string;
  name: string;
  url: string;
  transport: "sse" | "http" | "stdio";
  tools: string[];
  enabled: boolean;
  tokenSet: boolean;
  lastPingAt?: string | null;
  lastPingOk?: boolean | null;
  lastPingMessage?: string | null;
}

const SKILL_TEMPLATES: Record<SkillRuntime, { entry: string; code: string }> = {
  prompt: { entry: "", code: "" },
  python: {
    entry: "scripts/report.py",
    code: `# skill Python — รับ JSON ทาง stdin คืน JSON ทาง stdout\nimport json, sys\n\ndata = json.load(sys.stdin)\nprint(json.dumps({"summary": f"งาน {len(data.get('tasks', []))} รายการ"}))`,
  },
  node: {
    entry: "scripts/run.mjs",
    code: `// skill Node.js — รับ JSON ทาง stdin คืน JSON ทาง stdout\nconst chunks = [];\nfor await (const c of process.stdin) chunks.push(c);\nconst data = JSON.parse(Buffer.concat(chunks).toString() || "{}");\nconsole.log(JSON.stringify({ summary: \`งาน \${(data.tasks ?? []).length} รายการ\` }));`,
  },
  http: {
    entry: "https://api.example.com/hook",
    code: `{ "method": "POST", "headers": { "authorization": "Bearer ${"<token>"}" } }`,
  },
  mcp: { entry: "", code: "" },
};

const emptySkill = {
  id: "",
  kind: "skill" as SkillKind,
  name: "",
  category: "ทั่วไป",
  description: "",
  kernel: [] as string[],
  runtime: "prompt" as SkillRuntime,
  entry: "",
  code: "",
  prompt: "",
  mcpServerId: "",
  tags: "",
  enabled: true,
};

export function SkillLibrary() {
  const { toast } = useApp();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [mcp, setMcp] = useState<McpRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | SkillKind>("all");
  const [runtime, setRuntime] = useState<"all" | SkillRuntime>("all");
  const [form, setForm] = useState<typeof emptySkill | null>(null);
  const [mcpForm, setMcpForm] = useState<{ id: string; name: string; url: string; transport: "sse" | "http" | "stdio"; token: string; tools: string; enabled: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/skills", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { skills?: SkillRow[]; mcp?: McpRow[]; canEdit?: boolean };
      setSkills(body.skills ?? []);
      setMcp(body.mcp ?? []);
      setCanEdit(Boolean(body.canEdit));
    } catch {
      toast("โหลดคลัง skill ไม่สำเร็จ", "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return skills.filter((s) => {
      if (kind !== "all" && s.kind !== kind) return false;
      if (runtime !== "all" && s.runtime !== runtime) return false;
      if (!term) return true;
      return `${s.name} ${s.category} ${s.description} ${s.tags.join(" ")}`.toLowerCase().includes(term);
    });
  }, [skills, q, kind, runtime]);

  const remove = async (s: SkillRow) => {
    if (!confirm(`ลบ “${s.name}” ออกจากคลัง?`)) return;
    setBusy(s.id);
    try {
      const res = await fetch(`/api/ai/skills?id=${encodeURIComponent(s.id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "ลบไม่สำเร็จ");
      toast("ลบแล้ว", "ok");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const saveSkill = async () => {
    if (!form) return;
    try {
      const res = await fetch("/api/ai/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: form.id || undefined,
          kind: form.kind,
          name: form.name,
          category: form.category,
          description: form.description,
          capabilities: form.kernel,
          runtime: form.runtime,
          entry: form.entry,
          code: form.code,
          prompt: form.prompt,
          mcpServerId: form.mcpServerId || undefined,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          enabled: form.enabled,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast(form.id ? "แก้ไข skill แล้ว" : "เพิ่ม skill เข้าคลังแล้ว", "ok");
      setForm(null);
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  };

  const saveMcp = async () => {
    if (!mcpForm) return;
    try {
      const res = await fetch("/api/ai/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: mcpForm.id || undefined,
          name: mcpForm.name,
          url: mcpForm.url,
          transport: mcpForm.transport,
          token: mcpForm.token || undefined,
          tools: mcpForm.tools.split(",").map((t) => t.trim()).filter(Boolean),
          enabled: mcpForm.enabled,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast("บันทึก MCP server แล้ว", "ok");
      setMcpForm(null);
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    }
  };

  const pingMcp = async (id: string) => {
    setBusy(`mcp:${id}`);
    try {
      const res = await fetch("/api/ai/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: id }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      toast(body.message || body.error || "ทดสอบแล้ว", body.ok ? "ok" : "err");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const removeMcp = async (id: string) => {
    if (!confirm("ลบ MCP server นี้?")) return;
    setBusy(`mcp:${id}`);
    try {
      const res = await fetch(`/api/ai/mcp?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "ลบไม่สำเร็จ");
      toast("ลบ MCP server แล้ว", "ok");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="spread">
        <div>
          <div className="card-title" style={{ fontSize: 13.5 }}><Layers size={14} /> ถังความสามารถของทีม AI</div>
          <p className="tiny muted" style={{ marginTop: 3 }}>
            Skill = ความสามารถที่เรียกใช้ได้ (Prompt · Python · Node.js · HTTP) · Plugin = ตัวเชื่อมระบบภายนอกผ่าน MCP
          </p>
        </div>
        <div className="row">
          <div className="searchbox" style={{ width: 200 }}>
            <Search size={12} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา skill…" />
          </div>
          <button className="btn btn-sm" onClick={() => void load()}><RefreshCw size={12} /> รีเฟรช</button>
          <button className="btn btn-sm btn-primary" disabled={!canEdit} onClick={() => setForm({ ...emptySkill })}><Plus size={12} /> เพิ่ม skill</button>
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="seg">
          {(["all", "skill", "plugin"] as const).map((k) => (
            <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
              {k === "all" ? "ทั้งหมด" : k === "skill" ? "Skill" : "Plugin"}
            </button>
          ))}
        </div>
        <div className="seg">
          {(["all", "prompt", "python", "node", "http", "mcp"] as const).map((r) => (
            <button key={r} className={runtime === r ? "on" : ""} onClick={() => setRuntime(r)}>
              {r === "all" ? "ทุก runtime" : RUNTIME_META[r].label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="tiny muted"><Loader2 size={12} className="spin" /> กำลังโหลด…</div>}

      <div className="skill-grid">
        {filtered.map((s) => {
          const meta = RUNTIME_META[s.runtime];
          return (
            <div key={s.id} className={cls("skill-card", !s.enabled && "off")}>
              <div className="spread">
                <div className="row" style={{ gap: 6 }}>
                  <span className="rt-badge" style={{ background: meta.color }}>{meta.label}</span>
                  <span className="pill" style={{ fontSize: 9 }}>{s.kind === "plugin" ? "Plugin" : "Skill"}</span>
                  {s.builtin && <span className="pill" style={{ fontSize: 9 }}>ในระบบ</span>}
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <button className="icon-btn" title="แก้ไข" disabled={!canEdit} onClick={() => setForm({
                    id: s.id, kind: s.kind, name: s.name, category: s.category, description: s.description,
                    kernel: s.capabilities, runtime: s.runtime, entry: s.entry, code: s.code, prompt: s.prompt,
                    mcpServerId: s.mcpServerId ?? "", tags: s.tags.join(", "), enabled: s.enabled,
                  })}><Pencil size={12} /></button>
                  <button className="icon-btn" title={s.builtin ? "ลบไม่ได้ (skill ในระบบ)" : "ลบ"} disabled={!canEdit || s.builtin || busy === s.id} onClick={() => void remove(s)}>
                    {busy === s.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              </div>
              <b style={{ fontSize: 12.5 }}>{s.name}</b>
              <div className="tiny muted">{s.category} · {meta.hint}</div>
              <p className="tiny" style={{ margin: 0, lineHeight: 1.55 }}>{s.description}</p>
              <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                {s.capabilities.slice(0, 5).map((c) => <span key={c} className="cap-chip">{c}</span>)}
                {s.tags.slice(0, 3).map((t) => <span key={t} className="pill" style={{ fontSize: 9 }}>#{t}</span>)}
              </div>
              <div className="tiny muted">{s.entry ? `${s.entry} · ` : ""}{s.updatedAt ? `แก้ไข ${relTime(s.updatedAt)}` : "ค่าเริ่มต้น"}</div>
            </div>
          );
        })}
      </div>
      {!loading && !filtered.length && <Empty icon={<Layers size={22} />} text="ไม่พบ skill ตามเงื่อนไขที่กรอง" />}

      <div className="card">
        <div className="card-head">
          <div className="card-title"><Plug size={14} /> MCP Server — เชื่อมระบบภายนอก</div>
          <div className="right">
            <button className="btn btn-sm" disabled={!canEdit} onClick={() => setMcpForm({ id: "", name: "", url: "", transport: "http", token: "", tools: "", enabled: true })}>
              <Plus size={12} /> เชื่อม MCP
            </button>
          </div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!mcp.length && <Empty icon={<Plug size={22} />} text="ยังไม่มี MCP server — เชื่อม เช่น Google Drive, Notion, GitHub" />}
          {mcp.map((m) => (
            <div key={m.id} className="mcp-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <b style={{ fontSize: 12 }}>{m.name}</b>
                  <span className="pill" style={{ fontSize: 9 }}>{m.transport.toUpperCase()}</span>
                  {m.lastPingOk === true && <span className="pill ok" style={{ fontSize: 9 }}>เชื่อมต่อได้</span>}
                  {m.lastPingOk === false && <span className="pill warn" style={{ fontSize: 9 }}>เชื่อมต่อไม่ได้</span>}
                  {!m.enabled && <span className="pill" style={{ fontSize: 9 }}>ปิด</span>}
                </div>
                <div className="tiny muted">{m.url || "—"}{m.tools.length ? ` · tools: ${m.tools.join(", ")}` : ""}</div>
                {m.lastPingMessage && <div className="tiny muted">ล่าสุด: {m.lastPingMessage}</div>}
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button className="btn btn-sm" disabled={!canEdit || busy === `mcp:${m.id}`} onClick={() => void pingMcp(m.id)}>
                  {busy === `mcp:${m.id}` ? <Loader2 size={11} className="spin" /> : <Wifi size={11} />} ทดสอบ
                </button>
                <button className="icon-btn" title="แก้ไข" disabled={!canEdit} onClick={() => setMcpForm({
                  id: m.id, name: m.name, url: m.url, transport: m.transport, token: "", tools: m.tools.join(", "), enabled: m.enabled,
                })}><Pencil size={12} /></button>
                <button className="icon-btn" title="ลบ" disabled={!canEdit} onClick={() => void removeMcp(m.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {form && (
        <Modal
          wide
          title={form.id ? `แก้ไข ${form.name}` : "เพิ่ม Skill / Plugin"}
          subtitle="เลือก runtime ให้ตรงกับงาน — Python และ Node.js จะถูกรันผ่าน worker"
          icon={<Code2 size={16} />}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setForm(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => void saveSkill()} disabled={!form.name.trim()}><Check size={13} /> บันทึก</button>
            </>
          }
        >
          <div className="ai-config-grid">
            <label className="field">
              <span className="label">ชื่อ</span>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น สรุปงานประชุมเป็นภาษาไทย" />
            </label>
            <label className="field">
              <span className="label">ชนิด</span>
              <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SkillKind })}>
                <option value="skill">Skill — ความสามารถที่ AI เรียกใช้</option>
                <option value="plugin">Plugin — ตัวเชื่อมระบบภายนอก</option>
              </select>
            </label>
            <label className="field">
              <span className="label">หมวด</span>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="สรุป / วิเคราะห์ / เอกสาร" />
            </label>
            <label className="field">
              <span className="label">Runtime</span>
              <select className="select" value={form.runtime} onChange={(e) => {
                const rt = e.target.value as SkillRuntime;
                const tpl = SKILL_TEMPLATES[rt];
                setForm({ ...form, runtime: rt, entry: form.entry || tpl.entry, code: form.code || tpl.code });
              }}>
                {(Object.keys(RUNTIME_META) as SkillRuntime[]).map((r) => (
                  <option key={r} value={r}>{RUNTIME_META[r].label} — {RUNTIME_META[r].hint}</option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span className="label">คำอธิบาย</span>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="อธิบายสั้น ๆ ว่า skill นี้ทำอะไร" />
            </label>
            <label className="field">
              <span className="label">Entry (ไฟล์/URL)</span>
              <input className="input" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} placeholder="scripts/report.py" />
            </label>
            <label className="field">
              <span className="label">Tags (คั่นด้วย ,)</span>
              <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="สรุป, ประชุม, ไทย" />
            </label>
            {form.runtime === "mcp" && (
              <label className="field full">
                <span className="label">MCP server ที่ใช้</span>
                <select className="select" value={form.mcpServerId} onChange={(e) => setForm({ ...form, mcpServerId: e.target.value })}>
                  <option value="">— เลือก —</option>
                  {mcp.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            )}
            <label className="field full">
              <span className="label">{form.runtime === "prompt" ? "Prompt / คำสั่ง" : "โค้ด"}</span>
              <textarea
                className="textarea mono"
                rows={7}
                value={form.runtime === "prompt" ? form.prompt : form.code}
                onChange={(e) => setForm({ ...form, [form.runtime === "prompt" ? "prompt" : "code"]: e.target.value })}
                placeholder={form.runtime === "prompt" ? "คุณคือผู้ช่วยสรุปงาน… ตอบเป็นภาษาไทย…" : "รับ JSON ทาง stdin คืน JSON ทาง stdout"}
              />
            </label>
            <label className="field full" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              <span className="tiny">เปิดใช้งาน skill นี้</span>
            </label>
          </div>
          <div className="side-card" style={{ fontSize: 11.5 }}>
            <b><Terminal size={12} /> runtime ที่รองรับ</b>
            <div>• Prompt — ส่งคำสั่งตรงให้โมเดล (ไม่มีค่าใช้จ่ายเพิ่ม)</div>
            <div>• Python / Node.js — รันสคริปต์ใน worker แล้วแนบผลลัพธ์ให้โมเดลสรุป</div>
            <div>• HTTP API — เรียก endpoint ภายนอกพร้อม token</div>
            <div>• MCP — เรียกเครื่องมือของ MCP server (Google Drive, Notion, GitHub …)</div>
          </div>
        </Modal>
      )}

      {mcpForm && (
        <Modal
          title={mcpForm.id ? `แก้ไข ${mcpForm.name}` : "เชื่อม MCP Server"}
          subtitle="ใช้ MCP เพื่อให้ AI เรียกเครื่องมือภายนอกได้จริง"
          icon={<Plug size={16} />}
          onClose={() => setMcpForm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setMcpForm(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => void saveMcp()} disabled={!mcpForm.name.trim()}><Check size={13} /> บันทึก</button>
            </>
          }
        >
          <div className="ai-config-grid">
            <label className="field">
              <span className="label">ชื่อ</span>
              <input className="input" value={mcpForm.name} onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })} placeholder="Google Drive" />
            </label>
            <label className="field">
              <span className="label">Transport</span>
              <select className="select" value={mcpForm.transport} onChange={(e) => setMcpForm({ ...mcpForm, transport: e.target.value as "sse" | "http" | "stdio" })}>
                <option value="http">HTTP</option>
                <option value="sse">SSE</option>
                <option value="stdio">stdio (local)</option>
              </select>
            </label>
            <label className="field full">
              <span className="label">URL</span>
              <input className="input" value={mcpForm.url} onChange={(e) => setMcpForm({ ...mcpForm, url: e.target.value })} placeholder="https://mcp.example.com/sse" />
            </label>
            <label className="field">
              <span className="label">Token {mcpForm.id && <span className="tiny muted">(เว้นว่าง = คงเดิม)</span>}</span>
              <input className="input" type="password" value={mcpForm.token} onChange={(e) => setMcpForm({ ...mcpForm, token: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Tools (คั่นด้วย ,)</span>
              <input className="input" value={mcpForm.tools} onChange={(e) => setMcpForm({ ...mcpForm, tools: e.target.value })} placeholder="files.list, files.get" />
            </label>
            <label className="field full" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={mcpForm.enabled} onChange={(e) => setMcpForm({ ...mcpForm, enabled: e.target.checked })} />
              <span className="tiny">เปิดใช้งาน</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
