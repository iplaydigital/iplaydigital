// ─────────────────────────────────────────────────────────────
//  ตั้งค่า AI แต่ละตัว (AI Workforce)
//   • เชื่อมต่อ API: provider / base URL / model / API key
//   • ค่าใช้จ่าย: ราคาต่อ 1K tokens (เข้า/ออก) + งบต่อเดือน + ใช้ไปแล้ว
//   • การทำงาน: เปิด–ปิดการตอบในแชท, system prompt, temperature, max tokens
//  เก็บใน MariaDB (ws_ai_agents) หรือ .data/ai-agents.json
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";

export type AiProvider = "local" | "openai" | "anthropic" | "google" | "custom" | "gateway";

export const PROVIDERS: { key: AiProvider; label: string; baseUrl: string; model: string; hint: string }[] = [
  { key: "local", label: "ในระบบ (rule engine)", baseUrl: "", model: "", hint: "ใช้ข้อมูล Workspace ตอบเอง ไม่มีค่าใช้จ่าย" },
  { key: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", hint: "ราคาอ้างอิง USD→บาท ตั้งได้เอง" },
  { key: "anthropic", label: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5", hint: "ใช้ /v1/messages" },
  { key: "google", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", hint: "ใส่ API key ใน query" },
  { key: "custom", label: "OpenAI-compatible (อื่น ๆ)", baseUrl: "", model: "", hint: "เช่น OpenRouter, Typhoon, Ollama, vLLM" },
  { key: "gateway", label: "AI Gateway ของบริษัท", baseUrl: "", model: "", hint: "ใช้ AI_GATEWAY_URL + AI_GATEWAY_KEY จาก env" },
];

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  provider: AiProvider;
  baseUrl: string;
  model: string;
  /** เก็บลับ ไม่ส่งออก client */
  apiKey: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  /** ราคาต่อ 1,000 tokens (บาท) */
  costIn: number;
  costOut: number;
  /** งบต่อเดือน (บาท) — 0 = ไม่จำกัด */
  budget: number;
  tokensMonth: number;
  costMonth: number;
  chatEnabled: boolean;
  autoReply: boolean;
  updatedAt: string | null;
}

export type AgentConfigPublic = Omit<AgentConfig, "apiKey"> & { apiKeySet: boolean };

const FILE = path.join(process.cwd(), ".data", "ai-agents.json");
const g = globalThis as unknown as { __ipwAgents?: AgentConfig[] };

const SEED: AgentConfig[] = [
  {
    id: "ai_nova", name: "NOVA", role: "AI Project Coordinator",
    provider: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5",
    apiKey: "", temperature: 0.4, maxTokens: 1200,
    systemPrompt: "คุณคือ NOVA ผู้ประสานงานโปรเจกต์ของ iPlay Digital ตอบภาษาไทย กระชับ ลงมือทำได้จริง และสรุปเป็นข้อ ๆ",
    costIn: 0.12, costOut: 0.36, budget: 1500, tokensMonth: 0, costMonth: 0, chatEnabled: true, autoReply: true, updatedAt: null,
  },
  {
    id: "ai_pixel", name: "PIXEL", role: "AI Creative Designer",
    provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini",
    apiKey: "", temperature: 0.8, maxTokens: 1000,
    systemPrompt: "คุณคือ PIXEL ดีไซเนอร์ครีเอทีฟ ตอบเรื่อง key visual, layout, social size และแนวคิดภาพ",
    costIn: 0.06, costOut: 0.18, budget: 800, tokensMonth: 0, costMonth: 0, chatEnabled: true, autoReply: true, updatedAt: null,
  },
  {
    id: "ai_byte", name: "BYTE", role: "AI Full-stack Engineer",
    provider: "custom", baseUrl: "", model: "claude-code",
    apiKey: "", temperature: 0.2, maxTokens: 2000,
    systemPrompt: "คุณคือ BYTE วิศวกรฟูลสแตก ตอบเป็นขั้นตอน พร้อมโค้ดสั้น ๆ ที่ใช้งานได้จริง",
    costIn: 0.1, costOut: 0.3, budget: 2000, tokensMonth: 0, costMonth: 0, chatEnabled: true, autoReply: true, updatedAt: null,
  },
  {
    id: "ai_echo", name: "ECHO", role: "AI Comms & QA",
    provider: "google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash",
    apiKey: "", temperature: 0.5, maxTokens: 900,
    systemPrompt: "คุณคือ ECHO ตรวจข้อความและตอบลูกค้า ภาษาไทยสุภาพ กระชับ",
    costIn: 0.02, costOut: 0.06, budget: 500, tokensMonth: 0, costMonth: 0, chatEnabled: true, autoReply: true, updatedAt: null,
  },
  {
    id: "ai_orbit", name: "ORBIT", role: "AI Data Analyst",
    provider: "local", baseUrl: "", model: "rule-engine",
    apiKey: "", temperature: 0.3, maxTokens: 1000,
    systemPrompt: "คุณคือ ORBIT นักวิเคราะห์ข้อมูล สรุปตัวเลขและข้อเสนอแนะ",
    costIn: 0, costOut: 0, budget: 0, tokensMonth: 0, costMonth: 0, chatEnabled: true, autoReply: false, updatedAt: null,
  },
];

function readFile(): AgentConfig[] {
  if (g.__ipwAgents) return g.__ipwAgents;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as AgentConfig[];
      if (Array.isArray(raw) && raw.length) {
        g.__ipwAgents = mergeWithSeed(raw);
        return g.__ipwAgents;
      }
    }
  } catch {
    /* ignore */
  }
  g.__ipwAgents = SEED.map((a) => ({ ...a }));
  return g.__ipwAgents;
}

function mergeWithSeed(rows: AgentConfig[]): AgentConfig[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return SEED.map((s) => ({ ...s, ...(byId.get(s.id) ?? {}) }));
}

function writeFile(rows: AgentConfig[]) {
  g.__ipwAgents = rows;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), { mode: 0o600 });
  } catch {
    /* read-only */
  }
}

async function maria() {
  if (!process.env.DB_HOST) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_ai_agents (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      role VARCHAR(160) NOT NULL DEFAULT '',
      provider VARCHAR(24) NOT NULL DEFAULT 'local',
      base_url VARCHAR(255) NULL,
      model VARCHAR(120) NULL,
      api_key TEXT NULL,
      temperature DECIMAL(4,2) NOT NULL DEFAULT 0.4,
      max_tokens INT NOT NULL DEFAULT 1200,
      system_prompt TEXT NULL,
      cost_in DECIMAL(10,4) NOT NULL DEFAULT 0,
      cost_out DECIMAL(10,4) NOT NULL DEFAULT 0,
      budget DECIMAL(12,2) NOT NULL DEFAULT 0,
      tokens_month BIGINT NOT NULL DEFAULT 0,
      cost_month DECIMAL(12,4) NOT NULL DEFAULT 0,
      chat_enabled TINYINT(1) NOT NULL DEFAULT 1,
      auto_reply TINYINT(1) NOT NULL DEFAULT 1,
      updated_at VARCHAR(32) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    return p;
  } catch {
    return null;
  }
}

function rowToConfig(r: Record<string, unknown>): AgentConfig {
  return {
    id: String(r.id),
    name: String(r.name),
    role: String(r.role ?? ""),
    provider: (r.provider as AiProvider) ?? "local",
    baseUrl: String(r.base_url ?? ""),
    model: String(r.model ?? ""),
    apiKey: String(r.api_key ?? ""),
    temperature: Number(r.temperature ?? 0.4),
    maxTokens: Number(r.max_tokens ?? 1200),
    systemPrompt: String(r.system_prompt ?? ""),
    costIn: Number(r.cost_in ?? 0),
    costOut: Number(r.cost_out ?? 0),
    budget: Number(r.budget ?? 0),
    tokensMonth: Number(r.tokens_month ?? 0),
    costMonth: Number(r.cost_month ?? 0),
    chatEnabled: !!r.chat_enabled,
    autoReply: !!r.auto_reply,
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

export async function listAgentConfigs(): Promise<AgentConfig[]> {
  const p = await maria();
  if (p) {
    try {
      const [rows] = (await p.query("SELECT * FROM ws_ai_agents")) as unknown as [Record<string, unknown>[]];
      const stored = rows.map(rowToConfig);
      const merged = SEED.map((s) => {
        const hit = stored.find((x) => x.id === s.id);
        return hit ? { ...s, ...hit, name: hit.name || s.name, role: hit.role || s.role } : s;
      });
      const extra = stored.filter((x) => !SEED.some((s) => s.id === x.id));
      const all = [...merged, ...extra];
      g.__ipwAgents = all;
      return all;
    } catch {
      /* fall through */
    }
  }
  return readFile();
}

export async function getAgentConfig(id: string): Promise<AgentConfig | null> {
  const all = await listAgentConfigs();
  return all.find((a) => a.id === id) ?? null;
}

export function toPublic(a: AgentConfig): AgentConfigPublic {
  const { apiKey, ...rest } = a;
  return { ...rest, apiKeySet: Boolean(apiKey) };
}

export async function saveAgentConfig(id: string, patch: Partial<AgentConfig>): Promise<AgentConfig> {
  const all = await listAgentConfigs();
  const current = all.find((a) => a.id === id) ?? SEED.find((s) => s.id === id);
  if (!current) throw new Error("ไม่พบ AI agent นี้");
  const next: AgentConfig = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    id,
    updatedAt: new Date().toISOString(),
  } as AgentConfig;

  const p = await maria();
  if (p) {
    await p.query(
      `INSERT INTO ws_ai_agents (id,name,role,provider,base_url,model,api_key,temperature,max_tokens,system_prompt,
         cost_in,cost_out,budget,tokens_month,cost_month,chat_enabled,auto_reply,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), provider=VALUES(provider), base_url=VALUES(base_url),
         model=VALUES(model), api_key=VALUES(api_key), temperature=VALUES(temperature), max_tokens=VALUES(max_tokens),
         system_prompt=VALUES(system_prompt), cost_in=VALUES(cost_in), cost_out=VALUES(cost_out), budget=VALUES(budget),
         chat_enabled=VALUES(chat_enabled), auto_reply=VALUES(auto_reply), updated_at=VALUES(updated_at)`,
      [next.id, next.name, next.role, next.provider, next.baseUrl || null, next.model || null, next.apiKey || null,
        next.temperature, next.maxTokens, next.systemPrompt || null, next.costIn, next.costOut, next.budget,
        next.tokensMonth, next.costMonth, next.chatEnabled ? 1 : 0, next.autoReply ? 1 : 0, next.updatedAt],
    );
    g.__ipwAgents = all.map((a) => (a.id === id ? next : a));
    return next;
  }

  const rows = readFile().map((a) => (a.id === id ? next : a));
  writeFile(rows.some((a) => a.id === id) ? rows : [...rows, next]);
  return next;
}

/** บันทึกการใช้ token + ค่าใช้จ่ายโดยประมาณ */
export async function recordAgentUsage(id: string, tokensIn: number, tokensOut: number): Promise<void> {
  const cfg = await getAgentConfig(id);
  if (!cfg) return;
  const cost = (tokensIn / 1000) * cfg.costIn + (tokensOut / 1000) * cfg.costOut;
  const tokensMonth = cfg.tokensMonth + tokensIn + tokensOut;
  const costMonth = Number((cfg.costMonth + cost).toFixed(4));
  await saveAgentConfig(id, { tokensMonth, costMonth });
}

export function estimateCost(cfg: Pick<AgentConfig, "costIn" | "costOut">, tokensIn: number, tokensOut: number) {
  return (tokensIn / 1000) * cfg.costIn + (tokensOut / 1000) * cfg.costOut;
}
