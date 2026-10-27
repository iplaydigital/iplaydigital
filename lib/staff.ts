// ─────────────────────────────────────────────────────────────
//  บริการจัดการพนักงาน — ใช้ร่วมกันระหว่าง /api/staff และ /api/users
//  บังคับขอบเขตตามบทบาท (RBAC) + บันทึก audit ทุกครั้ง
// ─────────────────────────────────────────────────────────────
import type { AuditEntry, LoginLog, SessionUser, UserRole } from "./types";
import { canAccess, roleScope } from "./rbac";
import { DEPARTMENTS, TEAMS } from "./org";
import {
  createUser, deleteUser, getUserById, hashPassword, isAllowedEmail, listUsers, normEmail,
  toClient, updateUser, type User,
} from "./users";
import { listAudit, listLogins } from "./audit";

export class StaffError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertCanManage(actor: SessionUser) {
  if (!roleScope(actor.role).manageStaff) throw new StaffError("บทบาทของคุณไม่มีสิทธิ์จัดการพนักงาน", 403);
}

/** ตรวจว่าผู้กระทำเห็น/แก้ไขพนักงานคนนี้ได้หรือไม่ */
export function canTouchUser(actor: SessionUser, target: User): boolean {
  const s = roleScope(actor.role);
  if (s.allDepartments) return true;
  // manager: เฉพาะแผนกตัวเอง และต้องไม่ใช่บัญชีระดับผู้บริหาร
  if (target.role === "admin" || target.role === "support") return false;
  return !!target.departmentId && target.departmentId === actor.departmentId;
}

export function visibleStaff(actor: SessionUser, users: User[]): User[] {
  const s = roleScope(actor.role);
  if (s.allDepartments) return users;
  return users.filter((u) => canTouchUser(actor, u));
}

export interface StaffPayload {
  users: SessionUser[];
  departments: typeof DEPARTMENTS;
  teams: typeof TEAMS;
  scope: {
    role: UserRole;
    allDepartments: boolean;
    manageStaff: boolean;
    deleteStaff: boolean;
    grantAdmin: boolean;
    departmentId: string | null;
  };
  stats: { total: number; active: number; suspended: number; admins: number; managers: number; oauth: number };
}

export async function listStaff(actor: SessionUser): Promise<StaffPayload> {
  if (!canAccess(actor.role, "staff")) throw new StaffError("บทบาทของคุณไม่มีสิทธิ์เข้าถึงทะเบียนพนักงาน", 403);
  const all = await listUsers();
  const scoped = visibleStaff(actor, all);
  const s = roleScope(actor.role);

  return {
    users: scoped.map(toClient),
    departments: DEPARTMENTS,
    teams: TEAMS,
    scope: {
      role: actor.role,
      allDepartments: s.allDepartments,
      manageStaff: s.manageStaff,
      deleteStaff: s.deleteStaff,
      grantAdmin: s.grantAdmin,
      departmentId: actor.departmentId ?? null,
    },
    stats: {
      total: scoped.length,
      active: scoped.filter((u) => u.active).length,
      suspended: scoped.filter((u) => !u.active).length,
      admins: scoped.filter((u) => u.role === "admin").length,
      managers: scoped.filter((u) => u.role === "manager").length,
      oauth: scoped.filter((u) => u.provider !== "password").length,
    },
  };
}

export async function createStaff(
  actor: SessionUser,
  input: {
    email?: string; name?: string; nickname?: string; role?: UserRole; password?: string;
    position?: string; jobTitle?: string; level?: string; departmentId?: string | null; teamId?: string | null;
    extraModules?: string[];
  },
  meta?: { ip?: string },
): Promise<{ user: SessionUser; initialPassword: string }> {
  assertCanManage(actor);
  if (!input.email || !input.name) throw new StaffError("ต้องมีชื่อและอีเมล");
  if (!isAllowedEmail(input.email)) throw new StaffError("อีเมลต้องอยู่ในโดเมนของบริษัท");
  if (input.role === "admin" && !roleScope(actor.role).grantAdmin) {
    throw new StaffError("เฉพาะสิทธิ์ Admin เท่านั้นที่สร้างบัญชี Admin ได้", 403);
  }
  const dept = input.departmentId || actor.departmentId || null;
  if (!roleScope(actor.role).allDepartments && dept !== actor.departmentId) {
    throw new StaffError("สร้างพนักงานได้เฉพาะในแผนกของคุณ", 403);
  }

  const password = input.password && input.password.length >= 6 ? input.password : "iplay@2026";
  const created = await createUser(
    {
      email: normEmail(input.email),
      name: input.name,
      nickname: input.nickname,
      role: input.role || "member",
      passwordHash: hashPassword(password),
      position: input.position || input.jobTitle || "",
      jobTitle: input.jobTitle || input.position || "",
      level: input.level || "",
      departmentId: dept,
      teamId: input.teamId ?? null,
      extraModules: input.extraModules ?? [],
      provider: "password",
    },
    { actor: { id: actor.id, name: actor.name }, ip: meta?.ip },
  );
  return { user: toClient(created), initialPassword: password };
}

export async function updateStaff(
  actor: SessionUser,
  id: string,
  patch: Record<string, unknown>,
  meta?: { ip?: string },
): Promise<SessionUser> {
  assertCanManage(actor);
  const target = await getUserById(id);
  if (!target) throw new StaffError("ไม่พบผู้ใช้", 404);
  if (!canTouchUser(actor, target)) throw new StaffError("คุณไม่มีสิทธิ์แก้ไขพนักงานนอกแผนกหรือบัญชีระดับบริหาร", 403);

  const changingRole = typeof patch.role === "string" && patch.role !== target.role;
  if (changingRole) {
    const nextRole = patch.role as UserRole;
    if ((target.role === "admin" || nextRole === "admin") && !roleScope(actor.role).grantAdmin) {
      throw new StaffError("เฉพาะสิทธิ์ Admin เท่านั้นที่กำหนดสิทธิ์ Admin", 403);
    }
    if (nextRole === "support" && actor.role !== "admin") {
      throw new StaffError("เฉพาะ Admin เท่านั้นที่ตั้งสิทธิ์ Support ได้", 403);
    }
  }
  if (patch.active === false && target.id === actor.id) throw new StaffError("ระงับบัญชีของตัวเองไม่ได้");

  const dept = patch.departmentId as string | null | undefined;
  if (dept !== undefined && dept !== target.departmentId && !roleScope(actor.role).allDepartments) {
    if (dept !== actor.departmentId) throw new StaffError("ย้ายพนักงานข้ามแผนกไม่ได้", 403);
  }

  const next: Parameters<typeof updateUser>[1] = {
    name: patch.name as string | undefined,
    nickname: patch.nickname as string | undefined,
    position: patch.position as string | undefined,
    jobTitle: patch.jobTitle as string | undefined,
    level: patch.level as string | undefined,
    departmentId: dept,
    teamId: patch.teamId as string | null | undefined,
    role: patch.role as UserRole | undefined,
    active: patch.active as boolean | undefined,
    extraModules: patch.extraModules as string[] | undefined,
  };
  if (typeof patch.email === "string" && patch.email) {
    if (!isAllowedEmail(patch.email)) throw new StaffError("อีเมลต้องอยู่ในโดเมนของบริษัท");
    next.email = normEmail(patch.email);
  }
  if (typeof patch.password === "string" && patch.password) {
    if (patch.password.length < 6) throw new StaffError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    next.passwordHash = hashPassword(patch.password);
  }

  const updated = await updateUser(id, next, { actor: { id: actor.id, name: actor.name }, ip: meta?.ip });
  if (!updated) throw new StaffError("อัปเดตไม่สำเร็จ", 400);
  return toClient(updated);
}

export async function removeStaff(actor: SessionUser, id: string, meta?: { ip?: string }): Promise<void> {
  assertCanManage(actor);
  if (!roleScope(actor.role).deleteStaff) throw new StaffError("บทบาทของคุณไม่มีสิทธิ์ลบพนักงาน", 403);
  if (id === actor.id) throw new StaffError("ลบบัญชีของตัวเองไม่ได้");
  const target = await getUserById(id);
  if (!target) throw new StaffError("ไม่พบผู้ใช้", 404);
  if (target.role === "admin" && !roleScope(actor.role).grantAdmin) {
    throw new StaffError("เฉพาะ Admin เท่านั้นที่ลบบัญชี Admin ได้", 403);
  }
  await deleteUser(id, { actor: { id: actor.id, name: actor.name }, ip: meta?.ip });
}

export interface StaffHistory {
  user: SessionUser;
  audit: AuditEntry[];
  logins: LoginLog[];
}

export async function staffHistory(actor: SessionUser, id: string, limit = 120): Promise<StaffHistory> {
  if (!canAccess(actor.role, "staff")) throw new StaffError("ไม่มีสิทธิ์เข้าถึงประวัตินี้", 403);
  const target = await getUserById(id);
  if (!target) throw new StaffError("ไม่พบผู้ใช้", 404);
  if (!canTouchUser(actor, target)) throw new StaffError("ดูประวัติได้เฉพาะพนักงานในแผนกของคุณ", 403);

  const [audit, logins] = await Promise.all([
    listAudit({ targetId: id, targetType: "user", limit }),
    listLogins({ userId: id, limit: 60 }),
  ]);
  return { user: toClient(target), audit, logins };
}

/** สรุปจำนวนพนักงานต่อแผนก (ใช้ในแดชบอร์ดและหน้าจัดการ) */
export async function staffByDepartment(actor: SessionUser) {
  const users = visibleStaff(actor, await listUsers());
  return DEPARTMENTS.map((d) => ({
    ...d,
    count: users.filter((u) => u.departmentId === d.id).length,
    active: users.filter((u) => u.departmentId === d.id && u.active).length,
  }));
}
