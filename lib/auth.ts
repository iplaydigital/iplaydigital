// ─────────────────────────────────────────────────────────────
//  Session แบบ signed cookie (HMAC-SHA256) — ไม่ต้องใช้ DB session
//  ใช้งานได้ทั้ง Password / Google / LINE
// ─────────────────────────────────────────────────────────────
import crypto from "crypto";
import { cookies } from "next/headers";
import type { SessionUser, UserRole } from "./types";
import { getUserById, toClient, type User } from "./users";
import { canAccess, roleScope, type ModuleKey } from "./rbac";

export const COOKIE = "ipw_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน

function secret() {
  return process.env.AUTH_SECRET || "iplay-workspace-dev-secret-change-me";
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string | null): { uid: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid: string; exp: number };
    if (!data?.uid || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** ผู้ใช้ปัจจุบัน (server) — null ถ้ายังไม่ล็อกอิน/บัญชีถูกระงับ */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const data = readSessionToken(jar.get(COOKIE)?.value);
  if (!data) return null;
  const user = await getUserById(data.uid);
  if (!user || !user.active) return null;
  return toClient(user);
}

/** ผู้ดูแลระบบ (ตั้งค่า/จัดการบัญชีขั้นสูง) = Admin หรือ Support */
export function isManager(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "support";
}

/** หัวหน้า/ผู้บริหารที่อนุมัติได้ */
export function isApprover(user: SessionUser | null | undefined): boolean {
  return roleScope(user?.role).approve;
}

export function canManageRole(actor: SessionUser | null, target: UserRole): boolean {
  if (!actor) return false;
  if (actor.role === "admin") return true;
  // support ดู/แก้พนักงานทั่วไปได้ แต่ตั้ง admin ไม่ได้
  return actor.role === "support" && target !== "admin";
}

export const LEGACY_ROLE_META: Record<string, { label: string; color: string; tone: string; desc: string }> = {
  admin: {
    label: "Admin",
    color: "var(--violet)",
    tone: "rgba(113,0,221,.10)",
    desc: "สิทธิ์เต็ม — ตั้งค่า จัดการพนักงาน รายงาน และสิทธิ์ทั้งหมด",
  },
  support: {
    label: "Support",
    color: "var(--blue-2, #2F7BF0)",
    tone: "rgba(59,167,255,.14)",
    desc: "ดูแลพนักงาน ดูการใช้งาน และแก้ไขรายงานได้ แต่ไม่สามารถตั้งสิทธิ์ Admin",
  },
  member: {
    label: "Member",
    color: "var(--muted)",
    tone: "rgba(138,143,177,.16)",
    desc: "ใช้งานงาน/ปฏิทิน/แชท และสร้างรายงานของตนเอง",
  },
};

/** ใช้ใน API route: คืน error response ถ้าไม่มีสิทธิ์ */
export async function requireUser(): Promise<{ user: SessionUser | null; error?: Response }> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401) };
  }
  return { user };
}

export async function requireManager(): Promise<{ user: SessionUser | null; error?: Response }> {
  const { user, error } = await requireUser();
  if (error) return { user, error };
  if (!isManager(user)) return { user, error: json({ error: "ต้องมีสิทธิ์ Admin หรือ Support" }, 403) };
  return { user };
}

/** ต้องมีสิทธิ์เข้าถึงโมดูลนั้น (ตาม RBAC) */
export async function requireModule(mod: ModuleKey): Promise<{ user: SessionUser | null; error?: Response }> {
  const { user, error } = await requireUser();
  if (error) return { user, error };
  if (!canAccess(user?.role, mod)) {
    return { user, error: json({ error: `บทบาทของคุณไม่มีสิทธิ์เข้าถึงโมดูลนี้` }, 403) };
  }
  return { user };
}

/** ต้องมีสิทธิ์จัดการพนักงาน (Admin / Support / Manager) */
export async function requireStaffManager(): Promise<{ user: SessionUser | null; error?: Response }> {
  const { user, error } = await requireUser();
  if (error) return { user, error };
  if (!roleScope(user?.role).manageStaff) {
    return { user, error: json({ error: "ต้องมีสิทธิ์จัดการพนักงาน" }, 403) };
  }
  return { user };
}

/** ข้อมูล IP/UA ของคำขอ (ใช้บันทึก log) */
export function requestMeta(req: Request) {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local";
  return { ip, agent: (h.get("user-agent") || "").slice(0, 200) };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function publicUser(user: User | SessionUser) {
  const { ...rest } = "passwordHash" in user ? toClient(user as User) : (user as SessionUser);
  return rest;
}
