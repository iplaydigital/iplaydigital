// ─────────────────────────────────────────────────────────────
//  การมองเห็นข้อมูลตามบทบาท — “เห็นเฉพาะงานที่เกี่ยวข้อง”
//   admin / support   → เห็นทั้งหมด
//   manager           → งานของคนในแผนกตัวเอง + งานที่ตัวเองเกี่ยวข้อง
//   member / ai       → เฉพาะงานที่ตัวเองรับผิดชอบ / สร้าง / คอมเมนต์ /
//                        ถูกแท็ก (tag = รหัสพนักงาน, แผนก, ทีม, อีเมล, ชื่อ)
//                        หรืออยู่ในโปรเจกต์ที่เป็นสมาชิก
//   ใช้ทั้งฝั่ง server (กรองก่อนส่งให้ client) และฝั่ง client (ป้ายบอกขอบเขต)
// ─────────────────────────────────────────────────────────────
import type { Bootstrap, CalendarEvent, Member, Project, SessionUser, Task, UserRole } from "./types";
import { roleScope } from "./rbac";

export interface Viewer {
  /** usr_* (บัญชีผู้ใช้) */
  userId: string | null;
  /** u_* (ทะเบียนพนักงาน) — ใช้เทียบกับ assignee/tags/members */
  memberId: string | null;
  role: UserRole;
  departmentId: string | null;
  teamId: string | null;
  email: string | null;
  name: string | null;
  /** เห็นทุกแผนก */
  full: boolean;
  /** เห็นทั้งแผนกของตัวเอง */
  departmentWide: boolean;
}

export type ScopeLevel = "all" | "department" | "related";

export function viewerOf(user: SessionUser | null | undefined): Viewer {
  if (!user) {
    return {
      userId: null, memberId: null, role: "member", departmentId: null, teamId: null,
      email: null, name: null, full: false, departmentWide: false,
    };
  }
  const scope = roleScope(user.role);
  return {
    userId: user.id,
    memberId: user.memberId ?? null,
    role: user.role,
    departmentId: user.departmentId ?? null,
    teamId: user.teamId ?? null,
    email: user.email ?? null,
    name: user.name ?? null,
    full: scope.allDepartments,
    departmentWide: user.role === "manager",
  };
}

export function scopeLevel(viewer: Viewer): ScopeLevel {
  if (viewer.full) return "all";
  if (viewer.departmentWide) return "department";
  return "related";
}

export const SCOPE_META: Record<ScopeLevel, { label: string; short: string; hint: string; color: string }> = {
  all: {
    label: "เห็นทุกแผนก",
    short: "ทั้งหมด",
    hint: "บทบาทนี้เห็นงาน โปรเจกต์ และปฏิทินทั้งหมดขององค์กร",
    color: "#7100DD",
  },
  department: {
    label: "เห็นทั้งแผนกของฉัน",
    short: "ทั้งแผนก",
    hint: "เห็นงานของทุกคนในแผนกที่สังกัด + งานที่ตัวเองเกี่ยวข้อง",
    color: "#149C74",
  },
  related: {
    label: "เห็นเฉพาะงานที่เกี่ยวข้อง",
    short: "ที่เกี่ยวข้อง",
    hint: "เห็นงานที่ตัวเองรับผิดชอบ/สร้าง/คอมเมนต์/ถูกแท็ก และโปรเจกต์ที่เป็นสมาชิก",
    color: "#2F7BF0",
  },
};

/** ค่าที่ใช้เทียบ tag ว่าผูกกับผู้ใช้คนนี้หรือไม่ */
function tagKeys(viewer: Viewer): string[] {
  const keys = [viewer.memberId, viewer.userId, viewer.departmentId, viewer.teamId, viewer.email]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase());
  if (viewer.name) keys.push(viewer.name.toLowerCase());
  return keys;
}

function tagMatches(task: Task, keys: string[]) {
  if (!keys.length || !Array.isArray(task.tags)) return false;
  return task.tags.some((tag) => {
    const t = String(tag).trim().toLowerCase();
    if (!t) return false;
    return keys.some((k) => k === t || t.includes(k));
  });
}

/** ข้อมูลประกอบที่ต้องใช้ในการตัดสิน (สร้างครั้งเดียวต่อการกรอง) */
export interface VisibilityContext {
  members: Map<string, Member>;
  /** โปรเจกต์ที่ผู้ใช้เป็นสมาชิก */
  myProjectIds: Set<string>;
  /** แผนกของสมาชิกแต่ละคน (u_*) */
  memberDept: Map<string, string | null>;
}

export function buildContext(data: Pick<Bootstrap, "members" | "projects">, viewer: Viewer): VisibilityContext {
  const members = new Map(data.members.map((m) => [m.id, m]));
  const myProjectIds = new Set<string>();
  for (const p of data.projects) {
    if (viewer.memberId && (p.members ?? []).includes(viewer.memberId)) myProjectIds.add(p.id);
  }
  const memberDept = new Map<string, string | null>();
  for (const m of data.members) memberDept.set(m.id, m.departmentId ?? null);
  return { members, myProjectIds, memberDept };
}

/** งานนี้ “เกี่ยวข้องกับผู้ใช้” หรือไม่ */
export function isTaskRelated(task: Task, viewer: Viewer, ctx: VisibilityContext): boolean {
  if (!viewer.memberId && !viewer.userId) return false;

  // 1) ผู้รับผิดชอบ / ผู้สร้าง
  if (viewer.memberId && task.assigneeId === viewer.memberId) return true;
  if (viewer.memberId && task.createdBy === viewer.memberId) return true;

  // 2) ผู้เกี่ยวข้องในงานย่อย / คอมเมนต์
  if (viewer.memberId) {
    if ((task.subtasks ?? []).some((s) => s.by === viewer.memberId)) return true;
    if ((task.comments ?? []).some((c) => c.authorId === viewer.memberId)) return true;
  }

  // 3) tag ที่ผูกกับตัวเอง/แผนก/ทีม
  if (tagMatches(task, tagKeys(viewer))) return true;

  // หมายเหตุ: การเป็นสมาชิกโปรเจกต์อย่างเดียว “ไม่พอ” ให้เห็นงานทุกชิ้นในโปรเจกต์
  // (เดิมกว้างเกินไป — สมาชิกโปรเจกต์ 3 โปรเจกต์จะเห็นงานเกือบทั้งบริษัท)
  return false;
}

export function isTaskVisible(task: Task, viewer: Viewer, ctx: VisibilityContext): boolean {
  if (viewer.full) return true;
  if (isTaskRelated(task, viewer, ctx)) return true;
  if (viewer.departmentWide && viewer.departmentId) {
    const dept = ctx.memberDept.get(task.assigneeId);
    if (dept && dept === viewer.departmentId) return true;
  }
  return false;
}

export function isProjectVisible(
  project: Project,
  viewer: Viewer,
  ctx: VisibilityContext,
  visibleTaskProjectIds: Set<string>,
): boolean {
  if (viewer.full) return true;
  if (viewer.memberId && (project.members ?? []).includes(viewer.memberId)) return true;
  if (visibleTaskProjectIds.has(project.id)) return true;
  if (viewer.departmentWide && viewer.departmentId) {
    const hasDeptMember = (project.members ?? []).some((id) => ctx.memberDept.get(id) === viewer.departmentId);
    if (hasDeptMember) return true;
  }
  return false;
}

export function isEventVisible(
  event: CalendarEvent,
  viewer: Viewer,
  ctx: VisibilityContext,
  visibleTaskIds: Set<string>,
  visibleProjectIds: Set<string>,
): boolean {
  if (viewer.full) return true;
  // วันหยุดของบริษัทเป็นข้อมูลที่ทุกคนเห็นร่วมกัน
  if (event.cat === "holiday") return true;
  if (viewer.memberId && event.ownerId === viewer.memberId) return true;
  if (event.taskId && visibleTaskIds.has(event.taskId)) return true;
  if (event.projectId && visibleProjectIds.has(event.projectId)) return true;
  if (viewer.departmentWide && viewer.departmentId && event.ownerId) {
    if (ctx.memberDept.get(event.ownerId) === viewer.departmentId) return true;
  }
  return false;
}

/** ตัวเลขสรุปของการกรอง (ใช้แสดงบนหัวหน้า Kanban / ปฏิทิน) */
export interface ScopeStats {
  level: ScopeLevel;
  label: string;
  hint: string;
  tasks: { visible: number; total: number };
  projects: { visible: number; total: number };
  events: { visible: number; total: number };
}

/**
 * กรอง bootstrap ให้เหลือเฉพาะข้อมูลที่ผู้ใช้คนนี้มีสิทธิ์เห็น
 * ใช้เฉพาะก่อนส่งให้ client — logic ภายใน (AI, เครื่องมือ, cron) ยังใช้ข้อมูลเต็ม
 */
export function filterBootstrapFor(data: Bootstrap, viewer: Viewer): Bootstrap {
  // meId ต้องตรงกับผู้ใช้ที่ล็อกอิน (เดิมติดค่าตัวอย่าง u_me ทำให้ “งานของฉัน” ผิดคน)
  const meId = viewer.memberId ?? data.meId;
  const base: Bootstrap = meId === data.meId ? data : { ...data, meId };
  if (viewer.full) return base;

  const ctx = buildContext(data, viewer);

  const tasks = base.tasks.filter((t) => isTaskVisible(t, viewer, ctx));
  const visibleTaskIds = new Set(tasks.map((t) => t.id));

  const visibleTaskProjectIds = new Set(tasks.map((t) => t.projectId).filter(Boolean) as string[]);
  const projects = base.projects.filter((p) => isProjectVisible(p, viewer, ctx, visibleTaskProjectIds));
  const visibleProjectIds = new Set(projects.map((p) => p.id));

  const events = base.events.filter((e) => isEventVisible(e, viewer, ctx, visibleTaskIds, visibleProjectIds));

  const aiRuns = (base.aiRuns ?? []).filter(
    (r) => !r.taskId || visibleTaskIds.has(r.taskId) || viewer.full,
  );

  return { ...base, tasks, projects, events, aiRuns };
}

/** สถิติขอบเขตการมองเห็น — ใช้โชว์บนหัวหน้า Kanban/ปฏิทิน/โปรเจกต์ */
export function scopeStats(all: Bootstrap, viewer: Viewer): ScopeStats {
  const level = scopeLevel(viewer);
  const filtered = filterBootstrapFor(all, viewer);
  return {
    level,
    label: SCOPE_META[level].label,
    hint: SCOPE_META[level].hint,
    tasks: { visible: filtered.tasks.length, total: all.tasks.length },
    projects: { visible: filtered.projects.length, total: all.projects.length },
    events: { visible: filtered.events.length, total: all.events.length },
  };
}
