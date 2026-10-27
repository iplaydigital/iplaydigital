import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../lib/auth";
import { StaffError, createStaff, listStaff } from "../../../lib/staff";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof StaffError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[staff]", err);
  return NextResponse.json({ error: (err as Error).message }, { status: 500 });
}

export async function GET() {
  const { user, error } = await requireUser();
  if (error || !user) return error;
  try {
    return NextResponse.json(await listStaff(user), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error;
  try {
    const body = await req.json().catch(() => ({}));
    const out = await createStaff(user, body, requestMeta(req));
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return fail(err);
  }
}
