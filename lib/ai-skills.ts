// ─────────────────────────────────────────────────────────────
//  คลัง Skill / Plugin / MCP ของ AI Workforce
//   • Skill = ความสามารถเฉพาะด้าน (prompt / python / node / http)
//   • Plugin = ส่วนขยายที่เรียกใช้ผ่าน MCP หรือ HTTP
//   • โหลดเข้าถัง (bucket) แล้วผูกกับ AI แต่ละตัวได้
//  เก็บใน MariaDB (ws_ai_skills, ws_ai_mcp) หรือ .data/ai-skills.json
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { RUNTIME_META, type SkillKind, type SkillRuntime } from "./ai-shared";

export type { SkillKind, SkillRuntime };
export { RUNTIME_META };

export interface Skill {
  id: string;
  kind: SkillKind;
  name: string;
  category: string;
  description: string;
  capabilities: string[];
  runtime: SkillRuntime;
  /** ไฟล์ entry เช่น scripts/summary.py */
  entry: string;
  /** โค้ดตัวอย่าง/เทมเพลต (ถ้ามี) */
  code: string;
  /** คำสั่ง prompt สำหรับ skill แบบ prompt */
  prompt: string;
  /** plugin ที่ทำงานผ่าน MCP */
  mcpServerId: string | null;
  tags: string[];
  builtin: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: "sse" | "http" | "stdio";
  token: string;
  tools: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export type McpPublic = Omit<McpServer, "token"> & { tokenSet: boolean };

const SKILL_FILE = path.join(process.cwd(), ".data", "ai-skills.json");
const MCP_FILE = path.join(process.cwd(), ".data", "ai-mcp.json");

const g = globalThis as unknown as {
  __ipwSkills?: Skill[];
  __ipwMcp?: McpServer[];
  __ipwSkillsMaria?: { ok: boolean; at: number };
};

const nowIso = () => new Date().toISOString();

const SEED_SKILLS: Skill[] = [
  {
    id: "sk_summary", kind: "skill", name: "สรุปงาน & ประชุม", category: "งานประจำวัน",
    description: "สรุปงานค้าง ความคืบหน้า และ action item จากบริบท Workspace",
    capabilities: ["สรุป", "action item", "ภาษาไทย"], runtime: "prompt", entry: "", code: "",
    prompt: "สรุปงานค้าง ความคืบหน้า และ action item จากข้อมูล Workspace ให้เหลือไม่เกิน 8 ข้อ",
    mcpServerId: null, tags: ["summary", "daily"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
  {
    id: "sk_content", kind: "skill", name: "เขียนคอนเทนต์โซเชียล", category: "การตลาด",
    description: "เขียนแคปชันหลายแพลตฟอร์ม พร้อมแฮชแท็กและ CTA",
    capabilities: ["copywriting", "แคปชัน", "แฮชแท็ก"], runtime: "prompt", entry: "", code: "",
    prompt: "เขียนแคปชันภาษาไทยสำหรับ Facebook/IG/TikTok พร้อมแฮชแท็ก 5-8 คำ และ CTA 1 บรรทัด",
    mcpServerId: null, tags: ["content", "social"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
  {
    id: "sk_analyze", kind: "skill", name: "วิเคราะห์ข้อมูลยอดขาย", category: "วิเคราะห์ข้อมูล",
    description: "คำนวณแนวโน้ม สรุป Insight และข้อเสนอแนะจากข้อมูลตัวเลข",
    capabilities: ["สถิติ", "insight", "กราฟ"], runtime: "python", entry: "scripts/analyze_sales.py",
    code: "import json,sys\nrows=json.load(sys.stdin)\nprint(json.dumps({'total':sum(r.get('amount',0) for r in rows)},ensure_ascii=False))",
    prompt: "", mcpServerId: null, tags: ["data", "python"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
  {
    id: "sk_node_run", kind: "skill", name: "รันสคริปต์ Node.js", category: "Automation",
    description: "เรียกใช้สคริปต์ Node เพื่อประมวลผลไฟล์หรือยิง API ภายใน",
    capabilities: ["automation", "nodejs"], runtime: "node", entry: "scripts/task_runner.mjs",
    code: "export default async function run(ctx){ return { ok:true, agent:ctx.agent?.name, input:ctx.input } }",
    prompt: "", mcpServerId: null, tags: ["node", "automation"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
  {
    id: "sk_python_report", kind: "skill", name: "สร้างรายงานสรุป (Python)", category: "รายงาน",
    description: "รวมข้อมูลงาน/โปรเจกต์เป็นรายงานสรุปและคำนวณต้นทุน",
    capabilities: ["report", "costing"], runtime: "python", entry: "scripts/report.py",
    code: "import json,sys\nctx=json.load(sys.stdin)\nprint('รายงาน:', len(ctx.get('tasks',[])), 'งาน')",
    prompt: "", mcpServerId: null, tags: ["report", "python"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
  {
    id: "sk_qa", kind: "skill", name: "ตรวจคำตอบ & ภาษาไทย", category: "คุณภาพ",
    description: "ตรวจไวยากรณ์ ความสุภาพ และความถูกต้องก่อนส่งถึงลูกค้า",
    capabilities: ["QA", "proofread", "ภาษาไทย"], runtime: "prompt", entry: "", code: "",
    prompt: "ตรวจข้อความต่อไปนี้ แก้ไวยากรณ์และความสุภาพ แล้วส่งกลับเฉพาะข้อความที่แก้แล้ว",
    mcpServerId: null, tags: ["qa", "thai"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
  {
    id: "pl_drive", kind: "plugin", name: "Google Drive Connector", category: "เชื่อมระบบ",
    description: "อ่าน/เขียนไฟล์ใน Google Drive ของผู้ใช้ (ผ่าน MCP)",
    capabilities: ["drive", "files"], runtime: "mcp", entry: "", code: "", prompt: "",
    mcpServerId: "mcp_drive", tags: ["drive", "mcp"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
  {
    id: "pl_line", kind: "plugin", name: "LINE OA Push", category: "เชื่อมระบบ",
    description: "ส่งข้อความแจ้งเตือนเข้ากลุ่ม/ผู้ใช้ LINE ผ่าน OA",
    capabilities: ["line", "notify"], runtime: "http", entry: "/api/line/send", code: "POST { channelId, to, text }", prompt: "",
    mcpServerId: null, tags: ["line", "notify"], builtin: true, enabled: true, createdAt: nowIso(), updatedAt: null,
  },
];

const SEED_MCP: McpServer[] = [
  {
    id: "mcp_drive", name: "Google Drive (MCP)", url: process.env.GOOGLE_MCP_URL || "http://127.0.0.1:8787/mcp",
    transport: "http", token: "", tools: ["drive.list", "drive.read", "drive.upload"], enabled: true, createdAt: nowIso(),
  },
];

function readJson<T>(file: string, key: "__ipwSkills" | "__ipwMcp"): T[] {
  const cached = g[key] as T[] | undefined;
  if (cached) return cached;
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as T[];
      if (Array.isArray(raw)) {
        (g[key] as T[]) = raw;
        return raw;
      }
    }
  } catch {
    /* ignore */
  }
  (g[key] as T[]) = [];
  return [];
}

function writeJson<T>(file: string, key: "__ipwSkills" | "__ipwMcp", rows: T[]) {
  (g[key] as T[]) = rows;
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(rows, null, 2), { mode: 0o600 });
  } catch {
    /* read-only */
  }
}

async function maria() {
  if (!process.env.DB_HOST) return null;
  const st = g.__ipwSkillsMaria;
  if (st && !st.ok && Date.now() - st.at < 60_000) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_ai_skills (
      id VARCHAR(40) PRIMARY KEY,
      kind VARCHAR(16) NOT NULL DEFAULT 'skill',
      name VARCHAR(160) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT '',
      description TEXT NULL,
      capabilities JSON NULL,
      runtime VARCHAR(16) NOT NULL DEFAULT 'prompt',
      entry VARCHAR(255) NULL,
      code MEDIUMTEXT NULL,
      prompt TEXT NULL,
      mcp_server_id VARCHAR(40) NULL,
      tags JSON NULL,
      builtin TINYINT(1) NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await p.query(`CREATE TABLE IF NOT EXISTS ws_ai_mcp (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      url VARCHAR(500) NOT NULL DEFAULT '',
      transport VARCHAR(16) NOT NULL DEFAULT 'http',
      token TEXT NULL,
      tools JSON NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    g.__ipwSkillsMaria = { ok: true, at: Date.now() };
    return p;
  } catch {
    g.__ipwSkillsMaria = { ok: false, at: Date.now() };
    return null;
  }
}

const jsonArr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  try {
    const out = typeof v === "string" ? JSON.parse(v) : [];
    return Array.isArray(out) ? out.map(String) : [];
  } catch {
    return [];
  }
};

function rowToSkill(r: Record<string, unknown>): Skill {
  return {
    id: String(r.id),
    kind: (r.kind as SkillKind) ?? "skill",
    name: String(r.name),
    category: String(r.category ?? ""),
    description: String(r.description ?? ""),
    capabilities: jsonArr(r.capabilities),
    runtime: (r.runtime as SkillRuntime) ?? "prompt",
    entry: String(r.entry ?? ""),
    code: String(r.code ?? ""),
    prompt: String(r.prompt ?? ""),
    mcpServerId: (r.mcp_server_id as string | null) ?? null,
    tags: jsonArr(r.tags),
    builtin: !!r.builtin,
    enabled: r.enabled === undefined ? true : !!r.enabled,
    createdAt: String(r.created_at ?? nowIso()),
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

// ── Skills ──────────────────────────────────────────────────
export async function listSkills(): Promise<Skill[]> {
  const p = await maria();
  let rows: Skill[] = [];
  if (p) {
    try {
      const [found] = (await p.query("SELECT * FROM ws_ai_skills ORDER BY kind, category, name")) as unknown as [Record<string, unknown>[]];
      rows = found.map(rowToSkill);
    } catch {
      rows = [];
    }
  }
  if (!rows.length) {
    const file = readJson<Skill>(SKILL_FILE, "__ipwSkills");
    if (p && file.length) {
      for (const s of file) await persistSkill(s);
      return file;
    }
    if (file.length) return file;
    // seed ครั้งแรก
    for (const s of SEED_SKILLS) await persistSkill(s);
    writeJson(SKILL_FILE, "__ipwSkills", SEED_SKILLS);
    return SEED_SKILLS;
  }
  writeJson(SKILL_FILE, "__ipwSkills", rows);
  return rows;
}

async function persistSkill(skill: Skill) {
  const p = await maria();
  if (p) {
    try {
      await p.query(
        `INSERT INTO ws_ai_skills (id,kind,name,category,description,capabilities,runtime,entry,code,prompt,mcp_server_id,tags,builtin,enabled,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), description=VALUES(description),
           capabilities=VALUES(capabilities), runtime=VALUES(runtime), entry=VALUES(entry), code=VALUES(code),
           prompt=VALUES(prompt), mcp_server_id=VALUES(mcp_server_id), tags=VALUES(tags), enabled=VALUES(enabled),
           updated_at=VALUES(updated_at)`,
        [skill.id, skill.kind, skill.name, skill.category, skill.description, JSON.stringify(skill.capabilities),
          skill.runtime, skill.entry || null, skill.code || null, skill.prompt || null, skill.mcpServerId,
          JSON.stringify(skill.tags), skill.builtin ? 1 : 0, skill.enabled ? 1 : 0, skill.createdAt, skill.updatedAt],
      );
    } catch {
      /* fall through */
    }
  }
  const rows = readJson<Skill>(SKILL_FILE, "__ipwSkills").filter((s) => s.id !== skill.id);
  writeJson(SKILL_FILE, "__ipwSkills", [skill, ...rows]);
}

export async function saveSkill(input: Partial<Skill> & { name: string }): Promise<Skill> {
  const all = await listSkills();
  const existing = input.id ? all.find((s) => s.id === input.id) : undefined;
  const skill: Skill = {
    id: existing?.id ?? `sk_${crypto.randomBytes(4).toString("hex")}`,
    kind: (input.kind as SkillKind) ?? existing?.kind ?? "skill",
    name: input.name.trim(),
    category: (input.category ?? existing?.category ?? "ทั่วไป").trim(),
    description: input.description ?? existing?.description ?? "",
    capabilities: input.capabilities ?? existing?.capabilities ?? [],
    runtime: (input.runtime as SkillRuntime) ?? existing?.runtime ?? "prompt",
    entry: input.entry ?? existing?.entry ?? "",
    code: input.code ?? existing?.code ?? "",
    prompt: input.prompt ?? existing?.prompt ?? "",
    mcpServerId: input.mcpServerId !== undefined ? input.mcpServerId : existing?.mcpServerId ?? null,
    tags: input.tags ?? existing?.tags ?? [],
    builtin: existing?.builtin ?? false,
    enabled: input.enabled !== undefined ? input.enabled : existing?.enabled ?? true,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: existing ? nowIso() : null,
  };
  await persistSkill(skill);
  return skill;
}

export async function deleteSkill(id: string): Promise<boolean> {
  const skill = (await listSkills()).find((s) => s.id === id);
  if (!skill) return false;
  if (skill.builtin) throw new Error("ลบ skill ที่มากับระบบไม่ได้ — ปิดใช้งานแทนได้");
  const p = await maria();
  if (p) {
    try {
      await p.query("DELETE FROM ws_ai_skills WHERE id=?", [id]);
    } catch {
      /* fall through */
    }
  }
  writeJson(SKILL_FILE, "__ipwSkills", readJson<Skill>(SKILL_FILE, "__ipwSkills").filter((s) => s.id !== id));
  return true;
}

// ── MCP ─────────────────────────────────────────────────────
export async function listMcp(): Promise<McpServer[]> {
  const p = await maria();
  if (p) {
    try {
      const [found] = (await p.query("SELECT * FROM ws_ai_mcp ORDER BY name")) as unknown as [Record<string, unknown>[]];
      if (found.length) {
        return found.map((r) => ({
          id: String(r.id),
          name: String(r.name),
          url: String(r.url ?? ""),
          transport: ((r.transport as McpServer["transport"]) ?? "http"),
          token: String(r.token ?? ""),
          tools: jsonArr(r.tools),
          enabled: r.enabled === undefined ? true : !!r.enabled,
          createdAt: String(r.created_at ?? nowIso()),
          updatedAt: (r.updated_at as string | null) ?? null,
        }));
      }
    } catch {
      /* fall through */
    }
  }
  const file = readJson<McpServer>(MCP_FILE, "__ipwMcp");
  if (file.length) return file;
  for (const s of SEED_MCP) await persistMcp(s);
  writeJson(MCP_FILE, "__ipwMcp", SEED_MCP);
  return SEED_MCP;
}

export function toPublicMcp(s: McpServer): McpPublic {
  const { token, ...rest } = s;
  return { ...rest, tokenSet: Boolean(token) };
}

async function persistMcp(server: McpServer) {
  const p = await maria();
  if (p) {
    try {
      await p.query(
        `INSERT INTO ws_ai_mcp (id,name,url,transport,token,tools,enabled,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), url=VALUES(url), transport=VALUES(transport), token=VALUES(token),
           tools=VALUES(tools), enabled=VALUES(enabled), updated_at=VALUES(updated_at)`,
        [server.id, server.name, server.url, server.transport, server.token || null, JSON.stringify(server.tools),
          server.enabled ? 1 : 0, server.createdAt, server.updatedAt ?? null],
      );
    } catch {
      /* fall through */
    }
  }
  const rows = readJson<McpServer>(MCP_FILE, "__ipwMcp").filter((s) => s.id !== server.id);
  writeJson(MCP_FILE, "__ipwMcp", [server, ...rows]);
}

export async function saveMcp(input: Partial<McpServer> & { name: string }): Promise<McpServer> {
  const all = await listMcp();
  const existing = input.id ? all.find((s) => s.id === input.id) : undefined;
  const server: McpServer = {
    id: existing?.id ?? `mcp_${crypto.randomBytes(4).toString("hex")}`,
    name: input.name.trim(),
    url: (input.url ?? existing?.url ?? "").trim(),
    transport: (input.transport as McpServer["transport"]) ?? existing?.transport ?? "http",
    token: input.token !== undefined && input.token !== "" ? input.token : existing?.token ?? "",
    tools: input.tools ?? existing?.tools ?? [],
    enabled: input.enabled !== undefined ? input.enabled : existing?.enabled ?? true,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: existing ? nowIso() : null,
  };
  await persistMcp(server);
  return server;
}

export async function deleteMcp(id: string): Promise<boolean> {
  const p = await maria();
  if (p) {
    try {
      await p.query("DELETE FROM ws_ai_mcp WHERE id=?", [id]);
    } catch {
      /* fall through */
    }
  }
  writeJson(MCP_FILE, "__ipwMcp", readJson<McpServer>(MCP_FILE, "__ipwMcp").filter((s) => s.id !== id));
  return true;
}

/** ตรวจ MCP server ว่าตอบสนอง (best effort) */
export async function pingMcp(server: McpServer): Promise<{ ok: boolean; message: string }> {
  if (!server.url) return { ok: false, message: "ยังไม่ได้ตั้ง URL" };
  try {
    const res = await fetch(server.url, {
      method: "GET",
      headers: server.token ? { authorization: `Bearer ${server.token}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, message: res.ok ? `ตอบสนอง ${res.status}` : `ตอบกลับ ${res.status}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/** สรุป skill ที่ agent ใช้ได้ (สำหรับส่งเข้า prompt / แสดงผล) */
export function describeSkills(skills: Skill[], ids: string[]): string {
  const picked = skills.filter((s) => ids.includes(s.id) && s.enabled);
  if (!picked.length) return "";
  return picked
    .map((s) => `- ${s.name} (${s.runtime})${s.prompt ? `: ${s.prompt}` : ""}`)
    .join("\n");
}
