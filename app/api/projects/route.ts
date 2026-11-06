import { NextResponse } from "next/server";
import { requireModule, requestMeta } from "../../../lib/auth";
import { writeAudit } from "../../../lib/audit";
import { PROJECT_GRADS, ProjectError, createProject, listProjects, type ProjectInput } from "../../../lib/projects";
import { roleScope } from "../../../lib/rbac";
import { buildContext, isProjectVisible, viewerOf } from "../../../lib/visibility";

export const dynamic = "force-dynamic";

/** GET /api/projects — เฉพาะโปรเจกต์ที่ผู้ใช้เกี่ยวข้อง (Admin/Support เห็นทั้งหมด) */
export async function GET() {
  const { user, error } = await requireModule("tasks");
  if (error) return error;
  const all = await listProjects();
  const viewer = viewerOf(user);
  if (viewer.full) return NextResponse.json({ projects: all }, { headers: { "cache-control": "no-store" } });

  // ใช้ข้อมูลงาน/สมาชิกจาก bootstrap เพื่อตัดสินว่าโปรเจกต์ใด “เกี่ยวข้อง”
  const { getBootstrap } = await import("../../../lib/store");
  const data = await getBootstrap();
  const ctx = buildContext(data, viewer);
  const myTaskProjects = new Set(
    data.tasks
      .filter((t) => t.assigneeId === viewer.memberId || t.createdBy === viewer.memberId)
      .map((t) => t.projectId)
      .filter(Boolean) as string[],
  );
  const projects = all.filter((p) => isProjectVisible(p, viewer, ctx, myTaskProjects));
  return NextResponse.json({ projects }, { headers: { "cache-control": "no-store" } });
}

/** POST /api/projects — สร้างโปรเจกต์ (Admin/Support/Manager) */
export async function POST(req: Request) {
  const { user, error } = await requireModule("tasks");
  if (error || !user) return error;
  if (!roleScope(user.role).manageStaff && user.role !== "manager") {
    return NextResponse.json({ error: "เฉพาะ Admin / Support / Manager เท่านั้นที่สร้างโปรเจกต์ได้" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as ProjectInput;
  try {
    const project = await createProject({ ...body, grad: body.grad || PROJECT_GRADS[0] });
    await writeAudit({
      actorId: user.id,
      actorName: user.name,
      targetType: "member",
      targetId: project.id,
      targetName: `${project.code} · ${project.name}`,
      action: "create",
      note: `สร้างโปรเจกต์ ${project.code} (${project.client || "ไม่ระบุลูกค้า"})`,
      ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, project });
  } catch (err) {
    if (err instanceof ProjectError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
