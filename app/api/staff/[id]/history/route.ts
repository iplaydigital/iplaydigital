import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/auth";
import { StaffError, staffHistory } from "../../../../../lib/staff";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error || !user) return error;
  try {
    const data = await staffHistory(user, id);
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof StaffError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[staff/history]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
