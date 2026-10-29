// ─────────────────────────────────────────────────────────────
//  AI API Pool — รวม API Key หลายเส้นต่อผู้ให้บริการ
//   • โควต้ารายวัน (tokens / requests) + จำนวนคงเหลือ
//   • รีเซ็ตอัตโนมัติเมื่อถึงรอบ (resetHour) → กลับมา active
//   • หมดโควต้า = สลับไปคีย์ถัดไปอัตโนมัติ (rotate)
//   • หมดทุกคีย์ = สถานะ “รอรีเซ็ต” พร้อมเวลาที่จะใช้ได้อีกครั้ง
//  เก็บใน MariaDB (ws_ai_keys) หรือ .data/ai-pool.json
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AiProvider } from "./ai-agents";

export type KeyStatus = "active" | "exhausted" | "waiting" | "disabled" | "error";

export interface PoolKey {
  id: string;
  provider: AiProvider;
  label: string;
  /** ความลับ — ห้ามส่งออก client */
  apiKey: string;
  baseUrl: string;
  /** โมเดลเริ่มต้นของคีย์นี้ (ไม่บังคับ) */
  defaultModel: string;
  /** โควต้าต่อวัน (tokens) — 0 = ไม่จำกัด */
  dailyQuota: number;
  /** โควต้าต่อวัน (จำนวนคำขอ) — 0 = ไม่จำกัด */
  dailyRequests: number;
  /** โควต้าต่อเดือน (tokens) — 0 = ไม่จำกัด */
  monthlyQuota: number;
  usedTokensToday: number;
  usedRequestsToday: number;
  usedTokensMonth: number;
  /** วันที่ของตัวนับรายวัน (YYYY-MM-DD ตาม TZ) */
  dayKey: string;
  monthKey: string;
  /** ชั่วโมงรีเซ็ต (0-23) ตาม TZ ของระบบ */
  resetHour: number;
  status: KeyStatus;
  /** ใช้เมื่อสถานะ waiting/exhausted — เวลาที่จะกลับมาใช้ได้ */
  cooldownUntil: string | null;
  lastError: string | null;
  lastUsedAt: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string | null;
}

export type PoolKeyPublic = Omit<PoolKey, "apiKey"> & { apiKeyMasked: string; apiKeySet: boolean };

const FILE = path.join(process.cwd(), ".data", "ai-pool.json");
const g = globalThis as unknown as { __ipwPool?: PoolKey[]; __ipwPoolMaria?: { ok: boolean; at: number } };

export const KEY_STATUS_META: Record<KeyStatus, { label: string; color: string; soft: string }> = {
  active: { label: "พร้อมใช้", color: "#149C74", soft: "rgba(34,199,147,.14)" },
  exhausted: { label: "โควต้าหมด", color: "#D6337A", soft: "rgba(255,107,157,.16)" },
  waiting: { label: "รอรีเซ็ต", color: "#B4761A", soft: "rgba(255,176,32,.18)" },
  disabled: { label: "ปิดใช้งาน", color: "#8A8FB1", soft: "rgba(138,143,177,.16)" },
  error: { label: "เชื่อมต่อผิดพลาด", color: "#E23E5C", soft: "rgba(255,92,122,.16)" },
};

const TZ = process.env.AI_POOL_TZ || "Asia/Bangkok";

function tzParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: `${parts.year}-${parts.month}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** เวลารีเซ็ตครั้งถัดไปของคีย์ (ISO) */
export function nextResetAt(key: Pick<PoolKey, "resetHour">, from = new Date()): string {
  const p = tzParts(from);
  const hour = Math.max(0, Math.min(23, key.resetHour ?? 0));
  const passed = p.hour > hour || (p.hour === hour && p.minute >= 0);
  const target = new Date(from.getTime());
  target.setUTCHours(target.getUTCHours() + (passed ? 24 - p.hour + hour : hour - p.hour));
  target.setUTCMinutes(0, 0, 0);
  return target.toISOString();
}

export function remainingTokens(k: PoolKey) {
  if (!k.dailyQuota) return Infinity;
  return Math.max(0, k.dailyQuota - k.usedTokensToday);
}

export function remainingRequests(k: PoolKey) {
  if (!k.dailyRequests) return Infinity;
  return Math.max(0, k.dailyRequests - k.usedRequestsToday);
}

export function usedPercent(k: PoolKey) {
  const parts: number[] = [];
  if (k.dailyQuota) parts.push((k.usedTokensToday / k.dailyQuota) * 100);
  if (k.dailyRequests) parts.push((k.usedRequestsToday / k.dailyRequests) * 100);
  return parts.length ? Math.min(100, Math.round(Math.max(...parts))) : 0;
}

function maskKey(secret: string) {
  if (!secret) return "";
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 3)}••••${secret.slice(-4)}`;
}

export function toPublicKey(k: PoolKey): PoolKeyPublic {
  const { apiKey, ...rest } = k;
  return { ...rest, apiKeyMasked: maskKey(apiKey), apiKeySet: Boolean(apiKey) };
}

// ── ที่เก็บข้อมูล ────────────────────────────────────────────
function readFile(): PoolKey[] {
  if (g.__ipwPool) return g.__ipwPool;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as PoolKey[];
      if (Array.isArray(raw)) {
        g.__ipwPool = raw;
        return raw;
      }
    }
  } catch {
    /* ignore */
  }
  g.__ipwPool = [];
  return g.__ipwPool;
}

function writeFile(rows: PoolKey[]) {
  g.__ipwPool = rows;
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
  const st = g.__ipwPoolMaria;
  if (st && !st.ok && Date.now() - st.at < 60_000) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_ai_keys (
      id VARCHAR(40) PRIMARY KEY,
      provider VARCHAR(24) NOT NULL,
      label VARCHAR(120) NOT NULL DEFAULT '',
      api_key TEXT NULL,
      base_url VARCHAR(255) NULL,
      default_model VARCHAR(120) NULL,
      daily_quota BIGINT NOT NULL DEFAULT 0,
      daily_requests INT NOT NULL DEFAULT 0,
      monthly_quota BIGINT NOT NULL DEFAULT 0,
      used_tokens_today BIGINT NOT NULL DEFAULT 0,
      used_requests_today INT NOT NULL DEFAULT 0,
      used_tokens_month BIGINT NOT NULL DEFAULT 0,
      day_key VARCHAR(16) NULL,
      month_key VARCHAR(16) NULL,
      reset_hour INT NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      cooldown_until VARCHAR(32) NULL,
      last_error TEXT NULL,
      last_used_at VARCHAR(32) NULL,
      priority INT NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NULL,
      KEY idx_ws_ai_keys_provider (provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    g.__ipwPoolMaria = { ok: true, at: Date.now() };
    return p;
  } catch {
    g.__ipwPoolMaria = { ok: false, at: Date.now() };
    return null;
  }
}

function rowToKey(r: Record<string, unknown>): PoolKey {
  return {
    id: String(r.id),
    provider: r.provider as AiProvider,
    label: String(r.label ?? ""),
    apiKey: String(r.api_key ?? ""),
    baseUrl: String(r.base_url ?? ""),
    defaultModel: String(r.default_model ?? ""),
    dailyQuota: Number(r.daily_quota ?? 0),
    dailyRequests: Number(r.daily_requests ?? 0),
    monthlyQuota: Number(r.monthly_quota ?? 0),
    usedTokensToday: Number(r.used_tokens_today ?? 0),
    usedRequestsToday: Number(r.used_requests_today ?? 0),
    usedTokensMonth: Number(r.used_tokens_month ?? 0),
    dayKey: String(r.day_key ?? ""),
    monthKey: String(r.month_key ?? ""),
    resetHour: Number(r.reset_hour ?? 0),
    status: (r.status as KeyStatus) ?? "active",
    cooldownUntil: (r.cooldown_until as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    lastUsedAt: (r.last_used_at as string | null) ?? null,
    priority: Number(r.priority ?? 0),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

async function persist(key: PoolKey): Promise<void> {
  const p = await maria();
  if (p) {
    await p.query(
      `INSERT INTO ws_ai_keys (id,provider,label,api_key,base_url,default_model,daily_quota,daily_requests,monthly_quota,
         used_tokens_today,used_requests_today,used_tokens_month,day_key,month_key,reset_hour,status,cooldown_until,last_error,
         last_used_at,priority,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE provider=VALUES(provider), label=VALUES(label), api_key=VALUES(api_key), base_url=VALUES(base_url),
         default_model=VALUES(default_model), daily_quota=VALUES(daily_quota), daily_requests=VALUES(daily_requests),
         monthly_quota=VALUES(monthly_quota), used_tokens_today=VALUES(used_tokens_today),
         used_requests_today=VALUES(used_requests_today), used_tokens_month=VALUES(used_tokens_month),
         day_key=VALUES(day_key), month_key=VALUES(month_key), reset_hour=VALUES(reset_hour), status=VALUES(status),
         cooldown_until=VALUES(cooldown_until), last_error=VALUES(last_error), last_used_at=VALUES(last_used_at),
         priority=VALUES(priority), updated_at=VALUES(updated_at)`,
      [key.id, key.provider, key.label, key.apiKey || null, key.baseUrl || null, key.defaultModel || null,
        key.dailyQuota, key.dailyRequests, key.monthlyQuota, key.usedTokensToday, key.usedRequestsToday,
        key.usedTokensMonth, key.dayKey, key.monthKey, key.resetHour, key.status, key.cooldownUntil, key.lastError,
        key.lastUsedAt, key.priority, key.createdAt, key.updatedAt],
    );
  }
  const rows = readFile().filter((k) => k.id !== key.id);
  writeFile([key, ...rows]);
}

/** รีเซ็ตตัวนับเมื่อขึ้นวัน/เดือนใหม่ หรือครบเวลารอรีเซ็ต */
function rollover(k: PoolKey): { key: PoolKey; changed: boolean } {
  const now = new Date();
  const p = tzParts(now);
  let changed = false;
  const next: PoolKey = { ...k };

  if (next.dayKey !== p.date) {
    next.dayKey = p.date;
    next.usedTokensToday = 0;
    next.usedRequestsToday = 0;
    changed = true;
    if (next.status === "exhausted" || next.status === "waiting" || next.status === "error") {
      next.status = "active";
      next.cooldownUntil = null;
      next.lastError = null;
    }
  }
  if (next.monthKey !== p.month) {
    next.monthKey = p.month;
    next.usedTokensMonth = 0;
    changed = true;
  }
  if (next.cooldownUntil && new Date(next.cooldownUntil).getTime() <= now.getTime()) {
    next.status = "active";
    next.cooldownUntil = null;
    changed = true;
    if (next.dailyQuota) {
      next.usedTokensToday = 0;
      next.usedRequestsToday = 0;
    }
  }
  return { key: next, changed };
}

// ── CRUD ────────────────────────────────────────────────────
export async function listKeys(): Promise<PoolKey[]> {
  const p = await maria();
  let rows: PoolKey[] = [];
  if (p) {
    try {
      const [found] = (await p.query("SELECT * FROM ws_ai_keys ORDER BY provider, priority DESC, created_at")) as unknown as [
        Record<string, unknown>[],
      ];
      rows = found.map(rowToKey);
    } catch {
      rows = [];
    }
  }
  if (!rows.length) {
    const file = readFile();
    // sync เข้า DB ครั้งแรก (ถ้ามี DB)
    if (p && file.length) {
      for (const k of file) await persist(k);
      rows = file;
    } else {
      return file.map((k) => k);
    }
  }

  // rollover + persist เฉพาะที่เปลี่ยน
  const out: PoolKey[] = [];
  for (const k of rows) {
    const { key, changed } = rollover(k);
    out.push(key);
    if (changed) await persist(key);
  }
  out.sort((a, b) => a.provider.localeCompare(b.provider) || b.priority - a.priority);
  return out;
}

export async function keysOfProvider(provider: AiProvider): Promise<PoolKey[]> {
  const all = await listKeys();
  return all.filter((k) => k.provider === provider);
}

export async function addKey(input: {
  provider: AiProvider;
  label?: string;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  dailyQuota?: number;
  dailyRequests?: number;
  monthlyQuota?: number;
  resetHour?: number;
  priority?: number;
}): Promise<PoolKey> {
  const now = new Date();
  const p = tzParts(now);
  const key: PoolKey = {
    id: `key_${crypto.randomBytes(4).toString("hex")}`,
    provider: input.provider,
    label: (input.label ?? "").trim() || `${input.provider} key`,
    apiKey: input.apiKey.trim(),
    baseUrl: (input.baseUrl ?? "").trim(),
    defaultModel: (input.defaultModel ?? "").trim(),
    dailyQuota: Math.max(0, Number(input.dailyQuota) || 0),
    dailyRequests: Math.max(0, Number(input.dailyRequests) || 0),
    monthlyQuota: Math.max(0, Number(input.monthlyQuota) || 0),
    usedTokensToday: 0,
    usedRequestsToday: 0,
    usedTokensMonth: 0,
    dayKey: p.date,
    monthKey: p.month,
    resetHour: Math.max(0, Math.min(23, Number(input.resetHour) || 0)),
    status: "active",
    cooldownUntil: null,
    lastError: null,
    lastUsedAt: null,
    priority: Number(input.priority) || 0,
    createdAt: now.toISOString(),
    updatedAt: null,
  };
  await persist(key);
  const rows = readFile().filter((k) => k.id !== key.id);
  writeFile([key, ...rows]);
  return key;
}

export async function updateKey(id: string, patch: Partial<PoolKey>): Promise<PoolKey | null> {
  const all = await listKeys();
  const current = all.find((k) => k.id === id);
  if (!current) return null;
  const next: PoolKey = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    id,
    updatedAt: new Date().toISOString(),
  } as PoolKey;
  if (patch.apiKey !== undefined && !patch.apiKey) next.apiKey = current.apiKey;
  if (patch.status === "active") {
    next.cooldownUntil = null;
    next.lastError = null;
  }
  await persist(next);
  return next;
}

export async function deleteKey(id: string): Promise<boolean> {
  const p = await maria();
  if (p) {
    try {
      await p.query("DELETE FROM ws_ai_keys WHERE id=?", [id]);
    } catch {
      /* fall through */
    }
  }
  const rows = readFile();
  writeFile(rows.filter((k) => k.id !== id));
  return true;
}

/** รีเซ็ตตัวนับของคีย์ด้วยมือ (เช่น หลังเติมเครดิต) */
export async function resetKeyUsage(id: string): Promise<PoolKey | null> {
  return updateKey(id, {
    usedTokensToday: 0,
    usedRequestsToday: 0,
    status: "active",
    cooldownUntil: null,
    lastError: null,
  });
}

// ── การเลือกคีย์ (rotation) ─────────────────────────────────
export interface PickResult {
  ok: boolean;
  key?: PoolKey;
  reason?: "no_keys" | "all_disabled" | "quota" | "waiting";
  message: string;
  nextResetAt?: string;
  remaining?: number;
}

/** เลือกคีย์ที่ยังมีโควต้า — ถ้าหมดให้สลับเส้นถัดไปอัตโนมัติ */
export async function pickKey(provider: AiProvider): Promise<PickResult> {
  const keys = await keysOfProvider(provider);
  if (!keys.length) {
    return { ok: false, reason: "no_keys", message: `ยังไม่มี API key สำหรับ ${provider} ใน pool` };
  }
  const enabled = keys.filter((k) => k.status !== "disabled");
  if (!enabled.length) {
    return { ok: false, reason: "all_disabled", message: "คีย์ทั้งหมดถูกปิดใช้งาน" };
  }

  // คีย์ที่โควต้าหมดแล้ว → ทำเครื่องหมาย exhausted + เวลารีเซ็ต (ให้ UI เห็นสถานะจริง)
  for (const k of enabled) {
    if ((k.status === "active" || k.status === "error") && (remainingTokens(k) <= 0 || remainingRequests(k) <= 0)) {
      await updateKey(k.id, { status: "exhausted", cooldownUntil: nextResetAt(k) });
    }
  }

  const usable = enabled.filter(
    (k) =>
      (k.status === "active" || k.status === "error") &&
      remainingTokens(k) > 0 &&
      remainingRequests(k) > 0 &&
      (!k.cooldownUntil || new Date(k.cooldownUntil).getTime() <= Date.now()),
  );

  if (!usable.length) {
    const resets = enabled.filter((k) => k.cooldownUntil).map((k) => k.cooldownUntil as string).sort();
    const next = resets[0] ?? nextResetAt(enabled[0]);
    // mark waiting ถ้ายังไม่ถูกตั้ง
    for (const k of enabled) {
      if (k.status === "active" && (remainingTokens(k) <= 0 || remainingRequests(k) <= 0)) {
        await updateKey(k.id, { status: "waiting", cooldownUntil: next });
      }
    }
    return {
      ok: false,
      reason: resets.length ? "waiting" : "quota",
      message: `โควต้าทุกคีย์ของ ${provider} หมดแล้ว — รอรีเซ็ต`,
      nextResetAt: next,
    };
  }

  // เรียงตาม priority สูงก่อน แล้วใช้ไปน้อยก่อน (เกลี่ยโหลด)
  usable.sort((a, b) => b.priority - a.priority || a.usedTokensToday - b.usedTokensToday);
  const chosen = usable[0];
  return { ok: true, key: chosen, message: `ใช้คีย์ ${chosen.label}`, remaining: remainingTokens(chosen) };
}

export interface UsageUpdate {
  tokensIn: number;
  tokensOut: number;
  requests?: number;
  ok?: boolean;
  error?: string | null;
}

/** บันทึกการใช้ + ตรวจเพดาน → ตั้งสถานะ exhausted/waiting และเตรียมสลับเส้น */
export async function recordKeyUsage(keyId: string, usage: UsageUpdate): Promise<PoolKey | null> {
  const all = await listKeys();
  const current = all.find((k) => k.id === keyId);
  if (!current) return null;

  const tokens = Math.max(0, (usage.tokensIn || 0) + (usage.tokensOut || 0));
  const requests = Math.max(1, usage.requests ?? 1);
  const next: PoolKey = {
    ...current,
    usedTokensToday: current.usedTokensToday + tokens,
    usedRequestsToday: current.usedRequestsToday + requests,
    usedTokensMonth: current.usedTokensMonth + tokens,
    lastUsedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (usage.ok === false) {
    next.status = "error";
    next.lastError = usage.error ?? "เรียก API ไม่สำเร็จ";
    // 429 = โควต้าฝั่งผู้ให้บริการหมด → พักถึงรอบรีเซ็ต
    if (/429|quota|rate.?limit|insufficient/i.test(next.lastError ?? "")) {
      next.status = "exhausted";
      next.cooldownUntil = nextResetAt(next);
    }
  } else {
    next.lastError = null;
    next.status = "active";
    const overTokens = next.dailyQuota > 0 && next.usedTokensToday >= next.dailyQuota;
    const overReq = next.dailyRequests > 0 && next.usedRequestsToday >= next.dailyRequests;
    const overMonth = next.monthlyQuota > 0 && next.usedTokensMonth >= next.monthlyQuota;
    if (overTokens || overReq || overMonth) {
      next.status = "exhausted";
      next.cooldownUntil = nextResetAt(next);
    }
  }

  await persist(next);
  const rows = readFile().filter((k) => k.id !== next.id);
  writeFile([next, ...rows]);
  return next;
}

export interface PoolStatusRow {
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

export interface PoolSummary {
  rows: PoolStatusRow[];
  totals: { keys: number; active: number; quotaToday: number; usedToday: number; remainingToday: number; usedMonth: number };
  nextResetAt: string | null;
}

export async function poolSummary(): Promise<PoolSummary> {
  const keys = await listKeys();
  const byProvider = new Map<AiProvider, PoolKey[]>();
  for (const k of keys) {
    if (!byProvider.has(k.provider)) byProvider.set(k.provider, []);
    byProvider.get(k.provider)!.push(k);
  }

  const rows: PoolStatusRow[] = [];
  for (const [provider, list] of byProvider) {
    const quota = list.reduce((s, k) => s + (k.dailyQuota || 0), 0);
    const used = list.reduce((s, k) => s + k.usedTokensToday, 0);
    const usable = list.filter((k) => k.status !== "disabled" && remainingTokens(k) > 0);
    const resets = list.filter((k) => k.cooldownUntil).map((k) => k.cooldownUntil as string).sort();
    rows.push({
      provider,
      keys: list.length,
      active: list.filter((k) => k.status === "active").length,
      exhausted: list.filter((k) => k.status === "exhausted").length,
      waiting: list.filter((k) => k.status === "waiting").length,
      disabled: list.filter((k) => k.status === "disabled").length,
      error: list.filter((k) => k.status === "error").length,
      quotaToday: quota,
      usedToday: used,
      remainingToday: quota ? Math.max(0, quota - used) : Number.POSITIVE_INFINITY,
      usedMonth: list.reduce((s, k) => s + k.usedTokensMonth, 0),
      nextResetAt: resets[0] ?? (list[0] ? nextResetAt(list[0]) : null),
      canUse: usable.length > 0,
    });
  }

  const nextResets = rows.map((r) => r.nextResetAt).filter(Boolean) as string[];
  return {
    rows,
    totals: {
      keys: keys.length,
      active: keys.filter((k) => k.status === "active").length,
      quotaToday: keys.reduce((s, k) => s + (k.dailyQuota || 0), 0),
      usedToday: keys.reduce((s, k) => s + k.usedTokensToday, 0),
      remainingToday: keys.reduce((s, k) => (k.dailyQuota ? s + remainingTokens(k) : s + 0), 0),
      usedMonth: keys.reduce((s, k) => s + k.usedTokensMonth, 0),
    },
    nextResetAt: nextResets.sort()[0] ?? null,
  };
}

/** ตรวจสอบคีย์ว่ายังใช้ได้จริง (ทดสอบเชื่อมต่อผู้ให้บริการ) */
export async function testKey(key: PoolKey): Promise<{ ok: boolean; message: string }> {
  try {
    const { probeProvider } = await import("./ai-models");
    const result = await probeProvider(key.provider, key.apiKey, key.baseUrl);
    await updateKey(key.id, {
      status: result.ok ? "active" : "error",
      lastError: result.ok ? null : result.message,
    });
    return result;
  } catch (err) {
    const message = (err as Error).message;
    await updateKey(key.id, { status: "error", lastError: message });
    return { ok: false, message };
  }
}
