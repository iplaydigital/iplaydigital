import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { StaffError, removeStaff, updateStaff } from "../../../../lib/staff";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  if (err instanceof StaffError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[staff/:id]", err);
  return NextResponse.json({ error: (err as Error).message }, { status: 500 });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return error;
  try {
    const patch = await req.json().catch(() => ({}));
    const updated = await updateStaff(user, id, patch, requestMeta(req));
    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return error;
  try {
    await removeStaff(user, id, requestMeta(req));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
