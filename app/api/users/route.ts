import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../lib/auth";
import { StaffError, createStaff, listStaff } from "../../../lib/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireUser();
  if (error || !user) return error;
  try {
    const data = await listStaff(user);
    return NextResponse.json({ users: data.users, scope: data.scope, stats: data.stats, departments: data.departments, teams: data.teams });
  } catch (err) {
    if (err instanceof StaffError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
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
    if (err instanceof StaffError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
