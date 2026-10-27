// ─────────────────────────────────────────────────────────────
//  ประวัติการแก้ไขข้อมูล (Audit trail) + ประวัติการเข้าใช้ระบบ
//  เก็บใน MariaDB: ws_audit_logs / ws_login_logs
//  ถ้าฐานข้อมูลไม่พร้อม → เก็บไฟล์ .data/audit.json, .data/logins.json
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AuditAction, AuditEntry, LoginLog } from "./types";

const AUDIT_FILE = path.join(process.cwd(), ".data", "audit.json");
const LOGIN_FILE = path.join(process.cwd(), ".data", "logins.json");

const g = globalThis as unknown as {
  __ipwAudit?: AuditEntry[];
  __ipwLogins?: LoginLog[];
};

function readJson<T>(file: string, key: "__ipwAudit" | "__ipwLogins"): T[] {
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

function writeJson<T>(file: string, key: "__ipwAudit" | "__ipwLogins", rows: T[]) {
  (g[key] as T[]) = rows;
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(rows.slice(0, 2000), null, 2));
  } catch {
    /* read-only */
  }
}

async function maria() {
  if (!process.env.DB_HOST) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_audit_logs (
      id VARCHAR(40) PRIMARY KEY,
      at_time VARCHAR(32) NOT NULL,
      actor_id VARCHAR(40) NULL,
      actor_name VARCHAR(160) NOT NULL DEFAULT '',
      target_type VARCHAR(24) NOT NULL DEFAULT 'user',
      target_id VARCHAR(40) NULL,
      target_name VARCHAR(200) NOT NULL DEFAULT '',
      action VARCHAR(24) NOT NULL DEFAULT 'update',
      field_name VARCHAR(64) NULL,
      from_value TEXT NULL,
      to_value TEXT NULL,
      note TEXT NULL,
      ip VARCHAR(64) NULL,
      KEY idx_ws_audit_target (target_type, target_id),
      KEY idx_ws_audit_at (at_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await p.query(`CREATE TABLE IF NOT EXISTS ws_login_logs (
      id VARCHAR(40) PRIMARY KEY,
      at_time VARCHAR(32) NOT NULL,
      user_id VARCHAR(40) NULL,
      email VARCHAR(190) NOT NULL DEFAULT '',
      provider VARCHAR(24) NOT NULL DEFAULT 'password',
      ok TINYINT(1) NOT NULL DEFAULT 1,
      ip VARCHAR(64) NULL,
      agent VARCHAR(255) NULL,
      reason VARCHAR(160) NULL,
      KEY idx_ws_login_user (user_id),
      KEY idx_ws_login_at (at_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    return p;
  } catch {
    return null;
  }
}

// ── เขียน log ───────────────────────────────────────────────
export async function writeAudit(input: {
  actorId: string;
  actorName: string;
  targetType: AuditEntry["targetType"];
  targetId: string;
  targetName: string;
  action: AuditAction;
  field?: string;
  from?: string;
  to?: string;
  note?: string;
  ip?: string;
}): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: `au_${crypto.randomBytes(6).toString("hex")}`,
    at: new Date().toISOString(),
    ...input,
  };

  const p = await maria();
  if (p) {
    try {
      await p.query(
        `INSERT INTO ws_audit_logs (id,at_time,actor_id,actor_name,target_type,target_id,target_name,action,field_name,from_value,to_value,note,ip)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [entry.id, entry.at, entry.actorId, entry.actorName, entry.targetType, entry.targetId,
          entry.targetName, entry.action, entry.field ?? null, entry.from ?? null, entry.to ?? null,
          entry.note ?? null, entry.ip ?? null],
      );
      return entry;
    } catch {
      /* fall through */
    }
  }
  const rows = readJson<AuditEntry>(AUDIT_FILE, "__ipwAudit");
  writeJson(AUDIT_FILE, "__ipwAudit", [entry, ...rows]);
  return entry;
}

/** บันทึกหลายฟิลด์พร้อมกัน (เช่นตอนแก้โปรไฟล์) */
export async function writeAuditDiff(input: {
  actorId: string;
  actorName: string;
  targetType: AuditEntry["targetType"];
  targetId: string;
  targetName: string;
  changes: { field: string; from?: string | null; to?: string | null; label?: string }[];
  note?: string;
  ip?: string;
}) {
  const out: AuditEntry[] = [];
  for (const c of input.changes) {
    const from = c.from == null ? "" : String(c.from);
    const to = c.to == null ? "" : String(c.to);
    if (from === to) continue;
    out.push(
      await writeAudit({
        actorId: input.actorId,
        actorName: input.actorName,
        targetType: input.targetType,
        targetId: input.targetId,
        targetName: input.targetName,
        action: c.field === "role" ? "role" : c.field === "active" ? "status" : c.field === "departmentId" ? "department" : "update",
        field: c.label ?? c.field,
        from,
        to,
        note: input.note,
        ip: input.ip,
      }),
    );
  }
  return out;
}

export async function writeLogin(input: {
  userId?: string;
  email: string;
  provider: LoginLog["provider"];
  ok: boolean;
  ip?: string;
  agent?: string;
  reason?: string;
}): Promise<LoginLog> {
  const entry: LoginLog = {
    id: `lg_${crypto.randomBytes(6).toString("hex")}`,
    at: new Date().toISOString(),
    userId: input.userId ?? "",
    email: input.email,
    provider: input.provider,
    ok: input.ok,
    ip: input.ip,
    agent: input.agent,
    reason: input.reason,
  };

  const p = await maria();
  if (p) {
    try {
      await p.query(
        `INSERT INTO ws_login_logs (id,at_time,user_id,email,provider,ok,ip,agent,reason) VALUES (?,?,?,?,?,?,?,?,?)`,
        [entry.id, entry.at, entry.userId, entry.email, entry.provider, entry.ok ? 1 : 0,
          entry.ip ?? null, entry.agent ?? null, entry.reason ?? null],
      );
      return entry;
    } catch {
      /* fall through */
    }
  }
  const rows = readJson<LoginLog>(LOGIN_FILE, "__ipwLogins");
  writeJson(LOGIN_FILE, "__ipwLogins", [entry, ...rows]);
  return entry;
}

// ── อ่าน log ────────────────────────────────────────────────
export async function listAudit(opts?: { targetId?: string; targetType?: string; actorId?: string; limit?: number }): Promise<AuditEntry[]> {
  const limit = opts?.limit ?? 200;
  const p = await maria();
  if (p) {
    try {
      const where: string[] = [];
      const args: unknown[] = [];
      if (opts?.targetId) { where.push("target_id = ?"); args.push(opts.targetId); }
      if (opts?.targetType) { where.push("target_type = ?"); args.push(opts.targetType); }
      if (opts?.actorId) { where.push("actor_id = ?"); args.push(opts.actorId); }
      const [rows] = (await p.query(
        `SELECT * FROM ws_audit_logs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY at_time DESC LIMIT ${limit}`,
        args,
      )) as unknown as [Record<string, unknown>[]];
      return rows.map((r) => ({
        id: String(r.id), at: String(r.at_time), actorId: String(r.actor_id ?? ""), actorName: String(r.actor_name ?? ""),
        targetType: r.target_type as AuditEntry["targetType"], targetId: String(r.target_id ?? ""), targetName: String(r.target_name ?? ""),
        action: r.action as AuditAction,
        field: r.field_name == null ? undefined : String(r.field_name),
        from: r.from_value == null ? undefined : String(r.from_value),
        to: r.to_value == null ? undefined : String(r.to_value),
        note: r.note == null ? undefined : String(r.note),
        ip: r.ip == null ? undefined : String(r.ip),
      }));
    } catch {
      /* fall through */
    }
  }
  return readJson<AuditEntry>(AUDIT_FILE, "__ipwAudit")
    .filter((a) => (!opts?.targetId || a.targetId === opts.targetId) && (!opts?.targetType || a.targetType === opts.targetType) && (!opts?.actorId || a.actorId === opts.actorId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export async function listLogins(opts?: { userId?: string; limit?: number }): Promise<LoginLog[]> {
  const limit = opts?.limit ?? 100;
  const p = await maria();
  if (p) {
    try {
      const [rows] = (await p.query(
        `SELECT * FROM ws_login_logs ${opts?.userId ? "WHERE user_id = ?" : ""} ORDER BY at_time DESC LIMIT ${limit}`,
        opts?.userId ? [opts.userId] : [],
      )) as unknown as [Record<string, unknown>[]];
      return rows.map((r) => ({
        id: String(r.id), at: String(r.at_time), userId: String(r.user_id ?? ""), email: String(r.email ?? ""),
        provider: r.provider as LoginLog["provider"], ok: !!r.ok,
        ip: r.ip == null ? undefined : String(r.ip),
        agent: r.agent == null ? undefined : String(r.agent),
        reason: r.reason == null ? undefined : String(r.reason),
      }));
    } catch {
      /* fall through */
    }
  }
  return readJson<LoginLog>(LOGIN_FILE, "__ipwLogins")
    .filter((l) => !opts?.userId || l.userId === opts.userId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
