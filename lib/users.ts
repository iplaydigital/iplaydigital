// ─────────────────────────────────────────────────────────────
//  ผู้ใช้ระบบ (employees) — เก็บใน MariaDB (ws_users) หรือไฟล์สำรอง
//  รหัสผ่านเก็บเป็น scrypt hash ไม่เก็บ plain text
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AuthProvider, SessionUser, UserRole } from "./types";

export interface User extends SessionUser {
  passwordHash?: string | null;
  phone?: string;
}

const FILE = path.join(process.cwd(), ".data", "users.json");

const g = globalThis as unknown as {
  __ipwUsers?: User[];
  __ipwUsersMaria?: { ok: boolean; at: number };
};

/** true = ใช้ MariaDB ได้ · false = rame ไปใช้ไฟล์ (ล็อก 60 วิ กันรอ connection ทุกครั้ง) */
async function mariaReady(): Promise<boolean> {
  if (!process.env.DB_HOST) return false;
  const st = g.__ipwUsersMaria;
  if (st && !st.ok && Date.now() - st.at < 60_000) return false;
  try {
    await ensureUsersTable();
    g.__ipwUsersMaria = { ok: true, at: Date.now() };
    return true;
  } catch {
    g.__ipwUsersMaria = { ok: false, at: Date.now() };
    return false;
  }
}

async function db() {
  const { pool } = await import("./db-maria");
  return pool();
}

async function ensureUsersTable() {
  const p = await db();
  await p.query(`CREATE TABLE IF NOT EXISTS ws_users (
    id            VARCHAR(32) PRIMARY KEY,
    email         VARCHAR(190) NOT NULL UNIQUE,
    name          VARCHAR(160) NOT NULL,
    nickname      VARCHAR(80)  NOT NULL DEFAULT '',
    role          ENUM('admin','support','member') NOT NULL DEFAULT 'member',
    provider      ENUM('password','google','line') NOT NULL DEFAULT 'password',
    password_hash VARCHAR(255) NULL,
    color         VARCHAR(16)  NOT NULL DEFAULT '#7100DD',
    initials      VARCHAR(6)   NOT NULL DEFAULT '',
    active        TINYINT(1)   NOT NULL DEFAULT 1,
    position      VARCHAR(120) NOT NULL DEFAULT '',
    member_id     VARCHAR(32)  NULL,
    created_at    VARCHAR(32)  NOT NULL,
    last_login_at VARCHAR(32)  NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

// ── file store (โหมด demo / DB ล่ม) ──────────────────────────
function readFileStore(): User[] {
  if (g.__ipwUsers) return g.__ipwUsers;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as User[];
      if (Array.isArray(raw) && raw.length) {
        g.__ipwUsers = raw;
        return raw;
      }
    }
  } catch {
    /* ignore */
  }
  g.__ipwUsers = [];
  return g.__ipwUsers;
}

function writeFileStore(users: User[]) {
  g.__ipwUsers = users;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
  } catch {
    /* read-only fs — เก็บใน memory */
  }
}

// ── helpers ─────────────────────────────────────────────────
export function normEmail(email: string) {
  return (email || "").trim().toLowerCase();
}

export function allowedDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAIN || "iplaydigital.co,iplaydigital.co.th";
  return raw.split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}

export function isAllowedEmail(email: string) {
  const e = normEmail(email);
  if (!e.includes("@")) return false;
  const domain = e.split("@")[1];
  return allowedDomains().some((d) => domain === d || domain.endsWith("." + d));
}

const PALETTE = ["#7100DD", "#3BA7FF", "#22C793", "#FF6B9D", "#FF9A5A", "#8E7CF3", "#D98A00", "#14C4B2"];

export function pickColor(seed: string) {
  const h = crypto.createHash("md5").update(seed).digest()[0];
  return PALETTE[h % PALETTE.length];
}

export function initialsOf(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "IP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(pw: string, stored?: string | null) {
  if (!stored) return false;
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 32).toString("hex");
  const a = Buffer.from(test, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function toClient(u: User): SessionUser {
  const { passwordHash: _pw, ...rest } = u;
  return rest;
}

// ── seed ────────────────────────────────────────────────────
export const DEFAULT_PASSWORD = "iplay@2026";

const SEED_USERS: Omit<User, "passwordHash">[] = [
  {
    id: "usr_admin", email: "oak@iplaydigital.co", name: "วรพล ศรีสุวรรณ", nickname: "โอ๊ค",
    role: "admin", provider: "password", color: "#7100DD", initials: "OP",
    position: "Founder / Product Lead", active: true, createdAt: new Date().toISOString(),
    memberId: "u_me", lastLoginAt: null,
  },
  {
    id: "usr_support", email: "ploy@iplaydigital.co", name: "ณัฐริกา ใจดี", nickname: "พลอย",
    role: "support", provider: "password", color: "#3BA7FF", initials: "PL",
    position: "Project Manager / Support", active: true, createdAt: new Date().toISOString(),
    memberId: "u_ploy", lastLoginAt: null,
  },
  {
    id: "usr_member", email: "nan@iplaydigital.co", name: "ปวีณา อินทร์ทอง", nickname: "แนน",
    role: "member", provider: "password", color: "#FF6B9D", initials: "NN",
    position: "UI/UX Designer", active: true, createdAt: new Date().toISOString(),
    memberId: "u_nan", lastLoginAt: null,
  },
];

export async function ensureSeedUsers() {
  const existing = await listUsers();
  if (existing.length) return existing;
  const pw = process.env.ADMIN_INITIAL_PASSWORD || DEFAULT_PASSWORD;
  const hash = hashPassword(pw);
  const seeded: User[] = SEED_USERS.map((u) => ({ ...u, passwordHash: hash }));
  for (const u of seeded) await createUser(u);
  console.log(`[auth] seeded ${seeded.length} users (default password: ${pw === DEFAULT_PASSWORD ? DEFAULT_PASSWORD : "จาก ADMIN_INITIAL_PASSWORD"})`);
  return seeded;
}

// ── CRUD ────────────────────────────────────────────────────
export async function listUsers(): Promise<User[]> {
  if (await mariaReady()) {
    try {
      const p = await db();
      const [rows] = await p.query<import("mysql2").RowDataPacket[]>("SELECT * FROM ws_users ORDER BY role, name");
      return rows.map(rowToUser);
    } catch {
      /* fall through */
    }
  }
  return readFileStore();
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id), email: String(r.email), name: String(r.name), nickname: String(r.nickname ?? ""),
    role: r.role as UserRole, provider: r.provider as AuthProvider,
    passwordHash: (r.password_hash as string | null) ?? null,
    color: String(r.color ?? "#7100DD"), initials: String(r.initials ?? ""),
    active: !!r.active, position: String(r.position ?? ""),
    memberId: (r.member_id as string | null) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    lastLoginAt: (r.last_login_at as string | null) ?? null,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const all = await listUsers();
  return all.find((u) => u.id === id) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const e = normEmail(email);
  const all = await listUsers();
  return all.find((u) => normEmail(u.email) === e) ?? null;
}

export async function createUser(input: Partial<User> & { email: string; name: string }): Promise<User> {
  const all = await listUsers();
  if (all.some((u) => normEmail(u.email) === normEmail(input.email))) {
    throw new Error("อีเมลนี้มีผู้ใช้อยู่แล้ว");
  }
  const user: User = {
    id: input.id || `usr_${crypto.randomBytes(4).toString("hex")}`,
    email: normEmail(input.email),
    name: input.name,
    nickname: input.nickname || input.name.split(" ")[0] || "",
    role: (input.role as UserRole) || "member",
    provider: (input.provider as AuthProvider) || "password",
    passwordHash: input.passwordHash ?? null,
    color: input.color || pickColor(input.email),
    initials: input.initials || initialsOf(input.name),
    active: input.active ?? true,
    position: input.position || "",
    memberId: input.memberId ?? null,
    createdAt: input.createdAt || new Date().toISOString(),
    lastLoginAt: input.lastLoginAt ?? null,
  };
  await persistUser(user, true);
  return user;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  const current = await getUserById(id);
  if (!current) return null;
  const next: User = {
    ...current,
    ...patch,
    id: current.id,
    email: patch.email ? normEmail(patch.email) : current.email,
    passwordHash: patch.passwordHash !== undefined ? patch.passwordHash : current.passwordHash,
    initials: patch.name && !patch.initials ? initialsOf(patch.name) : patch.initials || current.initials,
  };
  if (await mariaReady()) {
    try {
      const p = await db();
      await p.query(
        `UPDATE ws_users SET email=?, name=?, nickname=?, role=?, provider=?, password_hash=?, color=?, initials=?, active=?, position=?, member_id=?, last_login_at=? WHERE id=?`,
        [next.email, next.name, next.nickname, next.role, next.provider, next.passwordHash ?? null, next.color,
          next.initials, next.active ? 1 : 0, next.position ?? "", next.memberId ?? null, next.lastLoginAt ?? null, next.id],
      );
      return next;
    } catch {
      /* fall through to file */
    }
  }
  const all = readFileStore().map((u) => (u.id === id ? next : u));
  writeFileStore(all);
  return next;
}

export async function deleteUser(id: string): Promise<boolean> {
  if (await mariaReady()) {
    try {
      const p = await db();
      await p.query("DELETE FROM ws_users WHERE id=?", [id]);
      return true;
    } catch {
      /* fall through */
    }
  }
  const all = readFileStore();
  const next = all.filter((u) => u.id !== id);
  writeFileStore(next);
  return next.length !== all.length;
}

async function persistUser(user: User, insert: boolean) {
  if (await mariaReady()) {
    try {
      const p = await db();
      if (insert) {
        await p.query(
          `INSERT INTO ws_users (id,email,name,nickname,role,provider,password_hash,color,initials,active,position,member_id,created_at,last_login_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [user.id, user.email, user.name, user.nickname, user.role, user.provider, user.passwordHash ?? null,
            user.color, user.initials, user.active ? 1 : 0, user.position ?? "", user.memberId ?? null,
            user.createdAt, user.lastLoginAt ?? null],
        );
        return;
      }
    } catch {
      /* fall through */
    }
  }
  const all = readFileStore();
  writeFileStore([...all.filter((u) => u.id !== user.id), user]);
}

export async function markLogin(id: string) {
  await updateUser(id, { lastLoginAt: new Date().toISOString() });
}

/** ตรวจ email + password → คืน user ถ้าถูก */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.active) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  await markLogin(user.id);
  return { ...user, lastLoginAt: new Date().toISOString() };
}

/** สร้าง/อัปเดตผู้ใช้จาก OAuth (Google / LINE) */
export async function upsertOAuthUser(input: {
  email: string;
  name: string;
  provider: AuthProvider;
  avatarUrl?: string;
  lineId?: string;
}): Promise<User> {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    if (!existing.active) throw new Error("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    await markLogin(existing.id);
    return { ...existing, lastLoginAt: new Date().toISOString() };
  }
  if (!isAllowedEmail(input.email)) {
    throw new Error(`อนุญาตเฉพาะอีเมลโดเมน ${allowedDomains().map((d) => "@" + d).join(" / ")}`);
  }
  return createUser({
    email: input.email,
    name: input.name,
    nickname: input.name.split(" ")[0],
    role: "member",
    provider: input.provider,
    position: "",
  });
}
