// ─────────────────────────────────────────────────────────────
//  ผู้ใช้ระบบ (พนักงาน) — MariaDB (ws_users) หรือไฟล์สำรอง
//  รหัสผ่านเก็บเป็น scrypt hash · มีแผนก/ทีม/ตำแหน่ง/ระดับ
//  ทุกการเปลี่ยนแปลงถูกบันทึกใน audit trail (lib/audit.ts)
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AuthProvider, SessionUser, UserRole } from "./types";
import { writeAudit, writeAuditDiff } from "./audit";
import { superAdminEmails } from "./oauth-config";
import { allowedDomains, isAllowedEmail } from "./identity";

export interface User extends SessionUser {
  passwordHash?: string | null;
  phone?: string;
  // ── บัญชีที่เชื่อมต่อ (ไม่ส่งความลับออกฝั่ง client) ──
  googleSub?: string | null;
  googleEmail?: string | null;
  googleConnectedAt?: string | null;
  lineUserId?: string | null;
  lineDisplay?: string | null;
  linePicture?: string | null;
  lineLinkedAt?: string | null;
  /** refresh token ของ Google Drive (ของผู้ใช้เอง) — ห้ามส่งออก client */
  driveRefreshToken?: string | null;
  driveEmail?: string | null;
  driveConnectedAt?: string | null;
}

const FILE = path.join(process.cwd(), ".data", "users.json");

const g = globalThis as unknown as {
  __ipwUsers?: User[];
  __ipwUsersMaria?: { ok: boolean; at: number };
};

/** true = ใช้ MariaDB ได้ · false = ถอยไปใช้ไฟล์ (จำผล 60 วิ กันรอ connection) */
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
    role          ENUM('admin','support','manager','ai','member') NOT NULL DEFAULT 'member',
    provider      ENUM('password','google','line') NOT NULL DEFAULT 'password',
    password_hash VARCHAR(255) NULL,
    color         VARCHAR(16)  NOT NULL DEFAULT '#7100DD',
    initials      VARCHAR(6)   NOT NULL DEFAULT '',
    active        TINYINT(1)   NOT NULL DEFAULT 1,
    position      VARCHAR(120) NOT NULL DEFAULT '',
    member_id     VARCHAR(32)  NULL,
    dept_id       VARCHAR(32)  NULL,
    team_id       VARCHAR(32)  NULL,
    job_title     VARCHAR(160) NOT NULL DEFAULT '',
    level         VARCHAR(24)  NOT NULL DEFAULT '',
    extra_modules TEXT NULL,
    created_at    VARCHAR(32)  NOT NULL,
    updated_at    VARCHAR(32)  NULL,
    last_login_at VARCHAR(32)  NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // อัปเกรดตารางเดิม (ข้ามถ้ามีคอลัมน์อยู่แล้ว)
  const alters = [
    "ALTER TABLE ws_users MODIFY COLUMN role ENUM('admin','support','manager','ai','member') NOT NULL DEFAULT 'member'",
    "ALTER TABLE ws_users ADD COLUMN dept_id VARCHAR(32) NULL",
    "ALTER TABLE ws_users ADD COLUMN team_id VARCHAR(32) NULL",
    "ALTER TABLE ws_users ADD COLUMN job_title VARCHAR(160) NOT NULL DEFAULT ''",
    "ALTER TABLE ws_users ADD COLUMN level VARCHAR(24) NOT NULL DEFAULT ''",
    "ALTER TABLE ws_users ADD COLUMN extra_modules TEXT NULL",
    "ALTER TABLE ws_users ADD COLUMN updated_at VARCHAR(32) NULL",
    "ALTER TABLE ws_users ADD COLUMN google_sub VARCHAR(120) NULL",
    "ALTER TABLE ws_users ADD COLUMN google_email VARCHAR(190) NULL",
    "ALTER TABLE ws_users ADD COLUMN google_connected_at VARCHAR(32) NULL",
    "ALTER TABLE ws_users ADD COLUMN line_user_id VARCHAR(64) NULL",
    "ALTER TABLE ws_users ADD COLUMN line_display VARCHAR(120) NULL",
    "ALTER TABLE ws_users ADD COLUMN line_picture TEXT NULL",
    "ALTER TABLE ws_users ADD COLUMN line_linked_at VARCHAR(32) NULL",
    "ALTER TABLE ws_users ADD COLUMN drive_refresh_token TEXT NULL",
    "ALTER TABLE ws_users ADD COLUMN drive_email VARCHAR(190) NULL",
    "ALTER TABLE ws_users ADD COLUMN drive_connected_at VARCHAR(32) NULL",
  ];
  for (const sql of alters) {
    try {
      await p.query(sql);
    } catch {
      /* มีอยู่แล้ว */
    }
  }
}

// ── file store ──────────────────────────────────────────────
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
    /* read-only fs */
  }
}

// ── helpers ─────────────────────────────────────────────────
export function normEmail(email: string) {
  return (email || "").trim().toLowerCase();
}

export { allowedDomains, isAllowedEmail } from "./identity";

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
  const {
    passwordHash: _pw, phone: _phone, googleSub: _gs, driveRefreshToken: _dt, ...rest
  } = u;
  const hasLine = Boolean(u.lineUserId);
  const hasGoogle = Boolean(u.googleEmail || u.googleConnectedAt);
  return {
    ...rest,
    isSuper: u.role === "admin" && superAdminEmails().includes(u.email.toLowerCase()),
    linked: {
      google: hasGoogle,
      googleEmail: u.googleEmail || null,
      line: hasLine,
      lineName: u.lineDisplay || null,
      linePicture: u.linePicture || null,
      drive: Boolean(u.driveRefreshToken || u.driveConnectedAt),
      driveEmail: u.driveEmail || null,
    },
  };
}

/** รหัสผ่าน Super Admin (ค่าเริ่มต้น admin123) */
export function superAdminPassword() {
  return process.env.SUPER_ADMIN_PASSWORD || "admin123";
}

const LEGACY_PASSWORDS = ["iplay@2026"];

/**
 * รับประกันว่าบัญชี Super Admin มีอยู่จริงและมีสิทธิ์ Admin
 * - ยังไม่มี → สร้างให้พร้อมรหัสผ่าน SUPER_ADMIN_PASSWORD (ค่าเริ่มต้น admin123)
 * - มีแล้วแต่สิทธิ์ต่ำกว่า admin → เลื่อนเป็น admin
 * - รหัสผ่านยังเป็นค่าเริ่มต้นเดิม (iplay@2026) → ตั้งเป็นรหัส Super Admin
 *   (ถ้าผู้ใช้เปลี่ยนรหัสเองแล้ว ระบบจะไม่เขียนทับ)
 */
export async function ensureSuperAdmins(): Promise<void> {
  const emails = superAdminEmails();
  const password = superAdminPassword();
  const all = await listUsers();

  for (const email of emails) {
    const existing = all.find((u) => u.email.toLowerCase() === email);
    if (!existing) {
      const name = email.startsWith("it@") ? "ฝ่ายไอที (IT)" : email.split("@")[0];
      try {
        await createUser(
          {
            email,
            name,
            nickname: email.startsWith("it@") ? "IT" : email.split("@")[0],
            role: "admin",
            provider: "password",
            passwordHash: hashPassword(password),
            position: "Super Admin",
            jobTitle: "Super Admin",
            level: "C-level",
            departmentId: email.startsWith("it@") ? "dep_dev" : "dep_exec",
            active: true,
          },
          { silent: true },
        );
        await writeAudit({
          actorId: "system", actorName: "ระบบ (Super Admin)",
          targetType: "user", targetId: email, targetName: email,
          action: "create", note: "สร้างบัญชี Super Admin อัตโนมัติ", ip: "seed",
        });
      } catch (err) {
        console.warn(`[auth] ensureSuperAdmins: ${(err as Error).message}`);
      }
      continue;
    }

    const patch: Partial<User> = {};
    if (existing.role !== "admin") patch.role = "admin";
    if (!existing.active) patch.active = true;
    if (!existing.passwordHash || LEGACY_PASSWORDS.some((pw) => verifyPassword(pw, existing.passwordHash))) {
      patch.passwordHash = hashPassword(password);
    }
    if (Object.keys(patch).length) {
      await updateUser(existing.id, patch, { silent: true });
      console.log(`[auth] ปรับปรุง Super Admin: ${email}`);
    }
  }
}

// ── seed ────────────────────────────────────────────────────
export const DEFAULT_PASSWORD = "iplay@2026";

const SEED_USERS: Omit<User, "passwordHash">[] = [
  {
    id: "usr_admin", email: "oak@playdigital.co.th", name: "วรพล ศรีสุวรรณ", nickname: "โอ๊ค",
    role: "admin", provider: "password", color: "#7100DD", initials: "OP",
    position: "Managing Director", jobTitle: "Managing Director", level: "C-level",
    departmentId: "dep_exec", teamId: null, active: true,
    createdAt: new Date().toISOString(), memberId: "u_me", lastLoginAt: null,
  },
  {
    id: "usr_cto", email: "jimm@playdigital.co.th", name: "จิมม์ วัฒนกุล", nickname: "จิมม์",
    role: "admin", provider: "password", color: "#5B8DEF", initials: "JM",
    position: "CTO", jobTitle: "CTO", level: "C-level",
    departmentId: "dep_exec", teamId: null, active: true,
    createdAt: new Date().toISOString(), memberId: null, lastLoginAt: null,
  },
  {
    id: "usr_it", email: "it@playdigital.co.th", name: "ฝ่ายไอที", nickname: "IT",
    role: "admin", provider: "password", color: "#2F7BF0", initials: "IT",
    position: "IT Support", jobTitle: "IT Support", level: "Mid",
    departmentId: "dep_dev", teamId: "team_web", active: true,
    createdAt: new Date().toISOString(), memberId: null, lastLoginAt: null,
  },
  {
    id: "usr_manager", email: "ploy@playdigital.co.th", name: "ณัฐริกา ใจดี", nickname: "พลอย",
    role: "manager", provider: "password", color: "#22C793", initials: "PL",
    position: "Head of Account & Project", jobTitle: "Project Manager", level: "Head",
    departmentId: "dep_account", teamId: "team_pm", active: true,
    createdAt: new Date().toISOString(), memberId: "u_ploy", lastLoginAt: null,
  },
  {
    id: "usr_devlead", email: "kan@playdigital.co.th", name: "ธนกฤต วัฒนชัย", nickname: "กัน",
    role: "manager", provider: "password", color: "#14C4B2", initials: "KN",
    position: "Tech Lead", jobTitle: "Tech Lead", level: "Lead",
    departmentId: "dep_dev", teamId: "team_web", active: true,
    createdAt: new Date().toISOString(), memberId: "u_kan", lastLoginAt: null,
  },
  {
    id: "usr_mint", email: "mint@playdigital.co.th", name: "อารยา พงษ์ไพร", nickname: "มิ้นท์",
    role: "member", provider: "password", color: "#FF9A5A", initials: "MT",
    position: "Account Executive", jobTitle: "Account Executive", level: "Mid",
    departmentId: "dep_account", teamId: "team_pm", active: true,
    createdAt: new Date().toISOString(), memberId: "u_mint", lastLoginAt: null,
  },
  {
    id: "usr_beer", email: "beer@playdigital.co.th", name: "ศุภชัย บุญมาก", nickname: "เบียร์",
    role: "member", provider: "password", color: "#3BA7FF", initials: "BR",
    position: "Full-stack Developer", jobTitle: "Full-stack Developer", level: "Mid",
    departmentId: "dep_dev", teamId: "team_web", active: true,
    createdAt: new Date().toISOString(), memberId: "u_beer", lastLoginAt: null,
  },
  {
    id: "usr_ai", email: "ai@playdigital.co.th", name: "AI Ops (ทีม AI)", nickname: "AI Ops",
    role: "ai", provider: "password", color: "#D6337A", initials: "AO",
    position: "AI Operations", jobTitle: "AI Project Coordinator", level: "Senior",
    departmentId: "dep_ai", teamId: "team_agents", active: true,
    createdAt: new Date().toISOString(), memberId: "ai_nova", lastLoginAt: null,
  },
  {
    id: "usr_member", email: "nan@playdigital.co.th", name: "ปวีณา อินทร์ทอง", nickname: "แนน",
    role: "member", provider: "password", color: "#FF6B9D", initials: "NN",
    position: "UI/UX Designer", jobTitle: "UI/UX Designer", level: "Senior",
    departmentId: "dep_creative", teamId: "team_brand", active: true,
    createdAt: new Date().toISOString(), memberId: "u_nan", lastLoginAt: null,
  },
];

export async function ensureSeedUsers() {
  const existing = await listUsers();
  if (existing.length) {
    await ensureSuperAdmins();
    return listUsers();
  }
  const pw = process.env.ADMIN_INITIAL_PASSWORD || DEFAULT_PASSWORD;
  const hash = hashPassword(pw);
  const seeded: User[] = SEED_USERS.map((u) => ({ ...u, passwordHash: hash }));
  for (const u of seeded) await createUser(u, { silent: true });
  // บันทึกประวัติเริ่มต้น เพื่อให้หน้าประวัติมีข้อมูลตั้งแต่วันติดตั้ง
  const { writeAudit, writeLogin } = await import("./audit");
  for (const u of seeded) {
    await writeAudit({
      actorId: "system", actorName: "ระบบ (ติดตั้งครั้งแรก)",
      targetType: "user", targetId: u.id, targetName: `${u.name} (${u.email})`,
      action: "create", note: `สร้างบัญชีเริ่มต้น · ${u.role}`, ip: "seed",
    });
    await writeLogin({ userId: u.id, email: u.email, provider: "password", ok: true, ip: "seed", reason: "บัญชีเริ่มต้น" });
  }
  await ensureSuperAdmins();
  console.log(`[auth] seeded ${seeded.length} users · โดเมน ${allowedDomains().join(", ")}`);
  return listUsers();
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

function parseExtra(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id), email: String(r.email), name: String(r.name), nickname: String(r.nickname ?? ""),
    role: r.role as UserRole, provider: r.provider as AuthProvider,
    passwordHash: (r.password_hash as string | null) ?? null,
    color: String(r.color ?? "#7100DD"), initials: String(r.initials ?? ""),
    active: !!r.active, position: String(r.position ?? ""),
    jobTitle: String(r.job_title ?? r.position ?? ""),
    level: String(r.level ?? ""),
    departmentId: (r.dept_id as string | null) ?? null,
    teamId: (r.team_id as string | null) ?? null,
    extraModules: parseExtra(r.extra_modules),
    memberId: (r.member_id as string | null) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: (r.updated_at as string | null) ?? null,
    lastLoginAt: (r.last_login_at as string | null) ?? null,
    googleSub: (r.google_sub as string | null) ?? null,
    googleEmail: (r.google_email as string | null) ?? null,
    googleConnectedAt: (r.google_connected_at as string | null) ?? null,
    lineUserId: (r.line_user_id as string | null) ?? null,
    lineDisplay: (r.line_display as string | null) ?? null,
    linePicture: (r.line_picture as string | null) ?? null,
    lineLinkedAt: (r.line_linked_at as string | null) ?? null,
    driveRefreshToken: (r.drive_refresh_token as string | null) ?? null,
    driveEmail: (r.drive_email as string | null) ?? null,
    driveConnectedAt: (r.drive_connected_at as string | null) ?? null,
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const all = await listUsers();
  return all.find((u) => u.id === id) ?? null;
}

export async function getUserByLineId(lineUserId: string): Promise<User | null> {
  const all = await listUsers();
  return all.find((u) => u.lineUserId === lineUserId) ?? null;
}

export async function getUserByGoogleSub(sub: string): Promise<User | null> {
  const all = await listUsers();
  return all.find((u) => u.googleSub === sub) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const e = normEmail(email);
  const all = await listUsers();
  return all.find((u) => normEmail(u.email) === e) ?? null;
}

export async function createUser(
  input: Partial<User> & { email: string; name: string },
  opts?: { silent?: boolean; actor?: { id: string; name: string }; ip?: string },
): Promise<User> {
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
    jobTitle: input.jobTitle || input.position || "",
    level: input.level || "",
    departmentId: input.departmentId ?? null,
    teamId: input.teamId ?? null,
    extraModules: input.extraModules ?? [],
    memberId: input.memberId ?? null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: input.lastLoginAt ?? null,
  };
  await persistUser(user, true);
  if (!opts?.silent) {
    await writeAudit({
      actorId: opts?.actor?.id ?? "system",
      actorName: opts?.actor?.name ?? "ระบบ",
      targetType: "user", targetId: user.id, targetName: `${user.name} (${user.email})`,
      action: "create", note: `สร้างบัญชี · สิทธิ์ ${user.role}`, ip: opts?.ip,
    });
  }
  return user;
}

export async function updateUser(
  id: string,
  patch: Partial<User>,
  opts?: { actor?: { id: string; name: string }; ip?: string; silent?: boolean },
): Promise<User | null> {
  const current = await getUserById(id);
  if (!current) return null;
  // ตัดคีย์ที่ไม่ได้ส่งมา (undefined) ออก เพื่อไม่ให้ทับข้อมูลเดิมด้วยค่าว่าง
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<User>;
  const next: User = {
    ...current,
    ...clean,
    id: current.id,
    email: clean.email ? normEmail(clean.email) : current.email,
    passwordHash: clean.passwordHash !== undefined ? clean.passwordHash : current.passwordHash,
    initials: clean.name && !clean.initials ? initialsOf(clean.name) : clean.initials || current.initials,
    updatedAt: new Date().toISOString(),
  };

  if (await mariaReady()) {
    try {
      const p = await db();
      await p.query(
        `UPDATE ws_users SET email=?, name=?, nickname=?, role=?, provider=?, password_hash=?, color=?, initials=?,
           active=?, position=?, job_title=?, level=?, dept_id=?, team_id=?, extra_modules=?, member_id=?, updated_at=?, last_login_at=?,
           google_sub=?, google_email=?, google_connected_at=?, line_user_id=?, line_display=?, line_picture=?, line_linked_at=?,
           drive_refresh_token=?, drive_email=?, drive_connected_at=?
         WHERE id=?`,
        [next.email, next.name, next.nickname, next.role, next.provider, next.passwordHash ?? null, next.color,
          next.initials, next.active ? 1 : 0, next.position ?? "", next.jobTitle ?? "", next.level ?? "",
          next.departmentId ?? null, next.teamId ?? null, JSON.stringify(next.extraModules ?? []),
          next.memberId ?? null, next.updatedAt ?? null, next.lastLoginAt ?? null,
          next.googleSub ?? null, next.googleEmail ?? null, next.googleConnectedAt ?? null,
          next.lineUserId ?? null, next.lineDisplay ?? null, next.linePicture ?? null, next.lineLinkedAt ?? null,
          next.driveRefreshToken ?? null, next.driveEmail ?? null, next.driveConnectedAt ?? null,
          next.id],
      );
      if (!opts?.silent) await auditUserChanges(current, next, opts);
      return next;
    } catch {
      /* fall through to file */
    }
  }

  const all = readFileStore().map((u) => (u.id === id ? next : u));
  writeFileStore(all);
  if (!opts?.silent) await auditUserChanges(current, next, opts);
  return next;
}

async function auditUserChanges(
  prev: User,
  next: User,
  opts?: { actor?: { id: string; name: string }; ip?: string },
) {
  const changes: { field: string; from?: string | null; to?: string | null; label?: string }[] = [
    { field: "name", from: prev.name, to: next.name, label: "ชื่อ-นามสกุล" },
    { field: "nickname", from: prev.nickname, to: next.nickname, label: "ชื่อเล่น" },
    { field: "position", from: prev.position, to: next.position, label: "ตำแหน่ง" },
    { field: "jobTitle", from: prev.jobTitle, to: next.jobTitle, label: "ตำแหน่งงาน" },
    { field: "level", from: prev.level, to: next.level, label: "ระดับ" },
    { field: "departmentId", from: prev.departmentId, to: next.departmentId, label: "แผนก" },
    { field: "teamId", from: prev.teamId, to: next.teamId, label: "ทีม" },
    { field: "role", from: prev.role, to: next.role, label: "สิทธิ์การใช้งาน" },
    { field: "active", from: prev.active ? "ใช้งาน" : "ระงับ", to: next.active ? "ใช้งาน" : "ระงับ", label: "สถานะบัญชี" },
    { field: "email", from: prev.email, to: next.email, label: "อีเมล" },
  ];
  if (prev.passwordHash !== next.passwordHash) {
    changes.push({ field: "password", from: "••••", to: "ตั้งรหัสใหม่", label: "รหัสผ่าน" });
  }
  await writeAuditDiff({
    actorId: opts?.actor?.id ?? "system",
    actorName: opts?.actor?.name ?? "ระบบ",
    targetType: "user",
    targetId: next.id,
    targetName: `${next.name} (${next.email})`,
    changes,
    ip: opts?.ip,
  });
}

export async function deleteUser(
  id: string,
  opts?: { actor?: { id: string; name: string }; ip?: string },
): Promise<boolean> {
  const target = await getUserById(id);
  if (await mariaReady()) {
    try {
      const p = await db();
      await p.query("DELETE FROM ws_users WHERE id=?", [id]);
      if (target) {
        await writeAudit({
          actorId: opts?.actor?.id ?? "system", actorName: opts?.actor?.name ?? "ระบบ",
          targetType: "user", targetId: id, targetName: `${target.name} (${target.email})`,
          action: "delete", note: `ลบบัญชี · สิทธิ์ ${target.role}`, ip: opts?.ip,
        });
      }
      return true;
    } catch {
      /* fall through */
    }
  }
  const all = readFileStore();
  const next = all.filter((u) => u.id !== id);
  writeFileStore(next);
  if (target) {
    await writeAudit({
      actorId: opts?.actor?.id ?? "system", actorName: opts?.actor?.name ?? "ระบบ",
      targetType: "user", targetId: id, targetName: `${target.name} (${target.email})`,
      action: "delete", note: `ลบบัญชี · สิทธิ์ ${target.role}`, ip: opts?.ip,
    });
  }
  return next.length !== all.length;
}

async function persistUser(user: User, insert: boolean) {
  if (await mariaReady()) {
    try {
      const p = await db();
      if (insert) {
        await p.query(
          `INSERT INTO ws_users (id,email,name,nickname,role,provider,password_hash,color,initials,active,position,job_title,level,dept_id,team_id,extra_modules,member_id,created_at,updated_at,last_login_at,
             google_sub,google_email,google_connected_at,line_user_id,line_display,line_picture,line_linked_at,drive_refresh_token,drive_email,drive_connected_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [user.id, user.email, user.name, user.nickname, user.role, user.provider, user.passwordHash ?? null,
            user.color, user.initials, user.active ? 1 : 0, user.position ?? "", user.jobTitle ?? "",
            user.level ?? "", user.departmentId ?? null, user.teamId ?? null, JSON.stringify(user.extraModules ?? []),
            user.memberId ?? null, user.createdAt, user.updatedAt ?? null, user.lastLoginAt ?? null,
            user.googleSub ?? null, user.googleEmail ?? null, user.googleConnectedAt ?? null,
            user.lineUserId ?? null, user.lineDisplay ?? null, user.linePicture ?? null, user.lineLinkedAt ?? null,
            user.driveRefreshToken ?? null, user.driveEmail ?? null, user.driveConnectedAt ?? null],
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
  await updateUser(id, { lastLoginAt: new Date().toISOString() }, { silent: true });
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
  lineId?: string;
  picture?: string;
}): Promise<User> {
  // ถ้า LINE user นี้ผูกกับบัญชีไว้แล้ว → เข้าเป็นบัญชีนั้นทันที (ไม่สนใจอีเมล)
  if (input.provider === "line" && input.lineId) {
    const linked = await getUserByLineId(input.lineId);
    if (linked) {
      if (!linked.active) throw new Error("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
      await markLogin(linked.id);
      return linked;
    }
  }

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
    departmentId: null,
    teamId: null,
  });
}

/** ดึง log การเข้าใช้ล่าสุดของทุกคน (สำหรับหน้าพนักงาน) */
export async function lastLoginsByUser(): Promise<Record<string, { at: string; provider: string; ok: boolean; ip?: string }>> {
  const { listLogins } = await import("./audit");
  const logs = await listLogins({ limit: 500 });
  const out: Record<string, { at: string; provider: string; ok: boolean; ip?: string }> = {};
  for (const l of logs) {
    if (!out[l.userId]) out[l.userId] = { at: l.at, provider: l.provider, ok: l.ok, ip: l.ip };
  }
  return out;
}
