import { NextResponse } from "next/server";
import { requestMeta, requireModule } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { ProjectError, deleteProject, updateProject, type ProjectInput } from "../../../../lib/projects";
import { roleScope } from "../../../../lib/rbac";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireModule("tasks");
  if (error || !user) return error;
  if (!roleScope(user.role).manageStaff && user.role !== "manager") {
    return NextResponse.json({ error: "เฉพาะ Admin / Support / Manager เท่านั้นที่แก้ไขโปรเจกต์ได้" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as ProjectInput;
  try {
    const project = await updateProject(id, body);
    await writeAudit({
      actorId: user.id,
      actorName: user.name,
      targetType: "member",
      targetId: project.id,
      targetName: `${project.code} · ${project.name}`,
      action: "update",
      note: `แก้ไขโปรเจกต์ ${project.code} → ${project.status} (${project.progress}%)`,
      ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, project });
  } catch (err) {
    if (err instanceof ProjectError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireModule("tasks");
  if (error || !user) return error;
  if (!roleScope(user.role).deleteStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้นที่ลบโปรเจกต์ได้" }, { status: 403 });
  }
  try {
    await deleteProject(id);
    await writeAudit({
      actorId: user.id,
      actorName: user.name,
      targetType: "member",
      targetId: id,
      targetName: id,
      action: "delete",
      note: "ลบโปรเจกต์",
      ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProjectError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
