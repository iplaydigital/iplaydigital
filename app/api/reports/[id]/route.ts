import { NextResponse } from "next/server";
import { canEditReport, canManageReports, isApprover, requireModule } from "../../../../lib/auth";
import { deleteReport, getReport, updateReport } from "../../../../lib/reports";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireModule("reports");
  if (error || !user) return error;

  const current = await getReport(id);
  if (!current) return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  if (!canEditReport(user, current)) {
    return NextResponse.json({ error: "แก้ไขได้เฉพาะรายงานของตนเอง หรือผู้จัดการขึ้นไป (Manager / Admin / Support)" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // เช็คเฉพาะตอน "เปลี่ยนเป็นอนุมัติ" — การแก้ฟิลด์อื่นในรายงานที่อนุมัติแล้วต้องทำได้
  const promotesToApproved = body.status === "approved" && current.status !== "approved";
  if (promotesToApproved && !isApprover(user) && !canManageReports(user)) {
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
  if (!canEditReport(user, current)) {
    return NextResponse.json({ error: "ลบได้เฉพาะรายงานของตนเอง หรือผู้จัดการขึ้นไป (Manager / Admin / Support)" }, { status: 403 });
  }
  await deleteReport(id);
  return NextResponse.json({ ok: true });
}
