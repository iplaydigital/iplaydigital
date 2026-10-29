// ─────────────────────────────────────────────────────────────
//  Usage log ของ AI — ใช้ทำแดชบอร์ดปริมาณการใช้ + ประเมินราคา
//  เก็บใน MariaDB (ws_ai_usage) หรือ .data/ai-usage.json
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AiProvider } from "./ai-agents";

export interface UsageEntry {
  id: string;
  at: string;
  agentId: string;
  agentName: string;
  provider: AiProvider;
  model: string;
  keyId: string | null;
  keyLabel: string | null;
  tokensIn: number;
  tokensOut: number;
  costThb: number;
  source: string;
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  ok: boolean;
  error: string | null;
}

const FILE = path.join(process.cwd(), ".data", "ai-usage.json");
const g = globalThis as unknown as { __ipwUsage?: UsageEntry[]; __ipwUsageMaria?: { ok: boolean; at: number } };
const MAX = 5000;

function readFile(): UsageEntry[] {
  if (g.__ipwUsage) return g.__ipwUsage;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as UsageEntry[];
      if (Array.isArray(raw)) {
        g.__ipwUsage = raw;
        return raw;
      }
    }
  } catch {
    /* ignore */
  }
  g.__ipwUsage = [];
  return g.__ipwUsage;
}

function writeFile(rows: UsageEntry[]) {
  const capped = rows.slice(0, MAX);
  g.__ipwUsage = capped;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(capped), { mode: 0o600 });
  } catch {
    /* read-only */
  }
}

async function maria() {
  if (!process.env.DB_HOST) return null;
  const st = g.__ipwUsageMaria;
  if (st && !st.ok && Date.now() - st.at < 60_000) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_ai_usage (
      id VARCHAR(40) PRIMARY KEY,
      at_time VARCHAR(32) NOT NULL,
      agent_id VARCHAR(40) NULL,
      agent_name VARCHAR(80) NULL,
      provider VARCHAR(24) NULL,
      model VARCHAR(120) NULL,
      key_id VARCHAR(40) NULL,
      key_label VARCHAR(120) NULL,
      tokens_in INT NOT NULL DEFAULT 0,
      tokens_out INT NOT NULL DEFAULT 0,
      cost_thb DECIMAL(12,4) NOT NULL DEFAULT 0,
      source VARCHAR(24) NULL,
      project_id VARCHAR(40) NULL,
      project_name VARCHAR(200) NULL,
      task_id VARCHAR(40) NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      error TEXT NULL,
      KEY idx_ws_ai_usage_at (at_time),
      KEY idx_ws_ai_usage_agent (agent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    g.__ipwUsageMaria = { ok: true, at: Date.now() };
    return p;
  } catch {
    g.__ipwUsageMaria = { ok: false, at: Date.now() };
    return null;
  }
}

function rowToEntry(r: Record<string, unknown>): UsageEntry {
  return {
    id: String(r.id),
    at: String(r.at_time),
    agentId: String(r.agent_id ?? ""),
    agentName: String(r.agent_name ?? ""),
    provider: (r.provider as AiProvider) ?? "local",
    model: String(r.model ?? ""),
    keyId: (r.key_id as string | null) ?? null,
    keyLabel: (r.key_label as string | null) ?? null,
    tokensIn: Number(r.tokens_in ?? 0),
    tokensOut: Number(r.tokens_out ?? 0),
    costThb: Number(r.cost_thb ?? 0),
    source: String(r.source ?? ""),
    projectId: (r.project_id as string | null) ?? null,
    projectName: (r.project_name as string | null) ?? null,
    taskId: (r.task_id as string | null) ?? null,
    ok: r.ok === undefined ? true : !!r.ok,
    error: (r.error as string | null) ?? null,
  };
}

export async function recordUsage(input: Omit<UsageEntry, "id" | "at">): Promise<UsageEntry> {
  const entry: UsageEntry = { ...input, id: `us_${crypto.randomBytes(4).toString("hex")}`, at: new Date().toISOString() };
  const p = await maria();
  if (p) {
    try {
      await p.query(
        `INSERT INTO ws_ai_usage (id,at_time,agent_id,agent_name,provider,model,key_id,key_label,tokens_in,tokens_out,
           cost_thb,source,project_id,project_name,task_id,ok,error)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [entry.id, entry.at, entry.agentId, entry.agentName, entry.provider, entry.model, entry.keyId, entry.keyLabel,
          entry.tokensIn, entry.tokensOut, entry.costThb, entry.source, entry.projectId, entry.projectName,
          entry.taskId, entry.ok ? 1 : 0, entry.error],
      );
    } catch {
      /* fall through */
    }
  }
  writeFile([entry, ...readFile()]);
  return entry;
}

export async function listUsage(limit = 300, sinceDays?: number): Promise<UsageEntry[]> {
  const p = await maria();
  if (p) {
    try {
      const [rows] = (await p.query(
        "SELECT * FROM ws_ai_usage ORDER BY at_time DESC LIMIT ?",
        [Math.min(2000, limit)],
      )) as unknown as [Record<string, unknown>[]];
      if (rows.length) {
        const list = rows.map(rowToEntry);
        return sinceDays ? list.filter((e) => Date.now() - new Date(e.at).getTime() <= sinceDays * 86400_000) : list;
      }
    } catch {
      /* fall through */
    }
  }
  const file = readFile().slice(0, limit);
  return sinceDays ? file.filter((e) => Date.now() - new Date(e.at).getTime() <= sinceDays * 86400_000) : file;
}

export interface UsageBucket {
  key: string;
  label: string;
  tokensIn: number;
  tokensOut: number;
  tokens: number;
  cost: number;
  calls: number;
}

export interface UsageStats {
  today: { tokens: number; cost: number; calls: number };
  month: { tokens: number; cost: number; calls: number };
  last7d: { tokens: number; cost: number; calls: number };
  byAgent: UsageBucket[];
  byModel: UsageBucket[];
  byProvider: UsageBucket[];
  byProject: UsageBucket[];
  daily: { date: string; tokens: number; cost: number; calls: number }[];
  recent: UsageEntry[];
  total: { tokens: number; cost: number; calls: number };
}

function bucketize(list: UsageEntry[], keyOf: (e: UsageEntry) => string, labelOf: (e: UsageEntry) => string): UsageBucket[] {
  const map = new Map<string, UsageBucket>();
  for (const e of list) {
    const key = keyOf(e) || "-";
    const found = map.get(key) ?? { key, label: labelOf(e) || key, tokensIn: 0, tokensOut: 0, tokens: 0, cost: 0, calls: 0 };
    found.tokensIn += e.tokensIn;
    found.tokensOut += e.tokensOut;
    found.tokens += e.tokensIn + e.tokensOut;
    found.cost += e.costThb;
    found.calls += 1;
    map.set(key, found);
  }
  return [...map.values()].sort((a, b) => b.tokens - a.tokens);
}

export async function usageStats(days = 30): Promise<UsageStats> {
  const all = await listUsage(2000);
  const dayKey = (iso: string) => iso.slice(0, 10);
  const today = dayKey(new Date().toISOString());
  const month = today.slice(0, 7);
  const since7 = Date.now() - 7 * 86400_000;

  const sum = (list: UsageEntry[]) => ({
    tokens: list.reduce((s, e) => s + e.tokensIn + e.tokensOut, 0),
    cost: Number(list.reduce((s, e) => s + e.costThb, 0).toFixed(2)),
    calls: list.length,
  });

  const dailyMap = new Map<string, { tokens: number; cost: number; calls: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    dailyMap.set(d, { tokens: 0, cost: 0, calls: 0 });
  }
  for (const e of all) {
    const d = dayKey(e.at);
    if (!dailyMap.has(d)) continue;
    const cur = dailyMap.get(d)!;
    cur.tokens += e.tokensIn + e.tokensOut;
    cur.cost += e.costThb;
    cur.calls += 1;
  }

  return {
    today: sum(all.filter((e) => dayKey(e.at) === today)),
    month: sum(all.filter((e) => dayKey(e.at).slice(0, 7) === month)),
    last7d: sum(all.filter((e) => new Date(e.at).getTime() >= since7)),
    byAgent: bucketize(all, (e) => e.agentId, (e) => e.agentName),
    byModel: bucketize(all, (e) => `${e.provider}:${e.model}`, (e) => e.model || e.provider),
    byProvider: bucketize(all, (e) => e.provider, (e) => e.provider),
    byProject: bucketize(all, (e) => e.projectId ?? "none", (e) => e.projectName ?? "ไม่ระบุโปรเจกต์"),
    daily: [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })),
    recent: all.slice(0, 40),
    total: sum(all),
  };
}
