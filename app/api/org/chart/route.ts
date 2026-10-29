import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { listUsers, toClient } from "../../../../lib/users";
import { DEPARTMENTS, TEAMS } from "../../../../lib/org";
import { roleScope } from "../../../../lib/rbac";

export const dynamic = "force-dynamic";

interface OrgPerson {
  id: string;
  name: string;
  nickname: string;
  email: string;
  position: string;
  jobTitle: string;
  level: string;
  role: string;
  avatar: string | null;
  avatarSource: string | null;
  hasLine: boolean;
  linePicture: string | null;
  departmentId: string | null;
  teamId: string | null;
  managerId: string | null;
  active: boolean;
  color: string;
  initials: string;
  initialsColor: string;
  children: OrgPerson[];
}

const initialsOf = (name: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "IP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

/** GET /api/org/chart — ผังองค์กร (แผนก → หัวหน้า → ลูกทีม) */
export async function GET() {
  const { user, error } = await requireUser();
  if (error || !user) return error;

  const users = (await listUsers()).filter((u) => u.active);
  const people: OrgPerson[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    nickname: u.nickname,
    email: u.email,
    position: u.position ?? "",
    jobTitle: u.jobTitle ?? "",
    level: u.level ?? "",
    role: u.role,
    avatar: u.avatar ?? null,
    avatarSource: u.avatarSource ?? null,
    hasLine: Boolean(u.lineUserId),
    linePicture: u.linePicture ?? null,
    departmentId: u.departmentId ?? null,
    teamId: u.teamId ?? null,
    managerId: u.managerId ?? null,
    active: u.active,
    color: u.color,
    initials: u.initials || initialsOf(u.name),
    initialsColor: u.color,
    children: [],
  }));

  // สร้างความสัมพันธ์ลูกทีม
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const p of people) {
    if (!p.managerId) continue;
    const parent = byId.get(p.managerId);
    if (parent && parent.id !== p.id) parent.children.push(p);
  }

  const columns = DEPARTMENTS.map((d) => {
    const staff = people.filter((p) => p.departmentId === d.id);
    const inDept = new Set(staff.map((p) => p.id));
    // "ราก" = คนที่ไม่มีหัวหน้า หรือหัวหน้าอยู่นอกแผนก
    const roots = staff.filter((p) => !p.managerId || !inDept.has(p.managerId));
    const rank = (r: string) => (r === "admin" ? 0 : r === "support" ? 1 : r === "manager" ? 2 : 3);
    const lead =
      roots
        .slice()
        .sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name))
        .find((p) => p.role === "admin" || p.role === "support" || p.role === "manager") ?? roots[0] ?? null;
    const rootsWithLead = lead ? [lead, ...roots.filter((p) => p.id !== lead.id)] : roots;
    return {
      id: d.id,
      name: d.name,
      short: d.short,
      color: d.color,
      headId: d.headId ?? null,
      lead,
      nodes: rootsWithLead,
      total: staff.length,
      teams: TEAMS.filter((t) => t.departmentId === d.id).map((t) => ({
        ...t,
        total: staff.filter((p) => p.teamId === t.id).length,
      })),
    };
  });

  const unassigned = people.filter((p) => !p.departmentId);

  return NextResponse.json(
    {
      ok: true,
      columns,
      unassigned,
      total: people.length,
      withPhoto: people.filter((p) => p.avatar).length,
      fromLine: people.filter((p) => p.avatarSource === "line").length,
      canEdit: roleScope(user.role).manageStaff,
      me: toClient(user).id,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
