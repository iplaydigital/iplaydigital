import { NextResponse } from "next/server";
import { isApprover, isManager, requireModule } from "../../../../lib/auth";
import { deleteReport, getReport, updateReport } from "../../../../lib/reports";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireModule("reports");
  if (error || !user) return error;

  const current = await getReport(id);
  if (!current) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  if (current.authorId !== user.id && current.authorId !== user.memberId && !isManager(user)) {
    return NextResponse.json({ error: "แก้ไขได้เฉพาะรายงานของตนเอง (หรือ Admin/Support)" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.status === "approved" && !isApprover(user)) {
    return NextResponse.json({ error: "เฉพาะหัวหน้า/ผู้บริหารเท่านั้นที่อนุมัติรายงานได้" }, { status: 403 });
  }
  const patch: Parameters<typeof updateReport>[1] = {};
  for (const key of ["title", "period", "summary", "driveUrl", "status", "projectId", "attachments"] as const) {
    if (body[key] !== undefined) (patch as Record<string, unknown>)[key] = body[key];
  }
  const updated = await updateReport(id, patch);
  return NextResponse.json({ ok: true, report: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireModule("reports");
  if (error || !user) return error;
  const current = await getReport(id);
  if (!current) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  if (current.authorId !== user.id && current.authorId !== user.memberId && !isManager(user)) {
    return NextResponse.json({ error: "ลบได้เฉพาะรายงานของตนเอง (หรือ Admin/Support)" }, { status: 403 });
  }
  await deleteReport(id);
  return NextResponse.json({ ok: true });
}
