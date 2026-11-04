import { NextResponse } from "next/server";
import { requireModule } from "../../../../lib/auth";
import { getTool, toPublicTool } from "../../../../lib/plugin-tools";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/** GET /api/plugin-tools/[id] — รายละเอียดเครื่องมือ + ประวัติรัน/แคป */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { error } = await requireModule("tools");
  if (error) return error;
  const tool = await getTool(id);
  if (!tool) return NextResponse.json({ error: "ไม่พบเครื่องมือนี้" }, { status: 404 });
  return NextResponse.json(
    { ok: true, tool: toPublicTool(tool) },
    { headers: { "cache-control": "no-store" } },
  );
}
