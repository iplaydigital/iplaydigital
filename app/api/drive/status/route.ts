import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { driveStatus } from "../../../../lib/drive";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  return NextResponse.json({ drive: driveStatus() }, { headers: { "cache-control": "no-store" } });
}
