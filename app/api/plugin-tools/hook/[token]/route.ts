import { NextResponse } from "next/server";
import { findByToken, runTool, toPublicTool } from "../../../../../lib/plugin-tools";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ token: string }> };

/**
 * ลิ้งสั่งงาน — ให้ AI / Python / PHP / cron ยิงเข้ามาเพื่อสั่งงานทันที
 *   GET  /api/plugin-tools/hook/<token>
 *   POST /api/plugin-tools/hook/<token>   (JSON ใด ๆ ก็ได้)
 * ไม่ต้องใช้ session — ป้องกันด้วย token key ของเครื่องมือ
 */
async function handle(req: Request, { params }: Params) {
  const { token } = await params;
  const tool = await findByToken(token);
  if (!tool) return NextResponse.json({ ok: false, error: "token ไม่ถูกต้อง" }, { status: 401 });
  if (!tool.enabled) return NextResponse.json({ ok: false, error: "เครื่องมือนี้ถูกปิดใช้งาน" }, { status: 403 });

  const url = new URL(req.url);
  const quiet = url.searchParams.get("quiet") === "1";
  const outcome = await runTool(tool.id, { trigger: "webhook", actorName: "webhook" });
  if (!outcome) return NextResponse.json({ ok: false, error: "สั่งงานไม่สำเร็จ" }, { status: 500 });

  if (quiet) {
    return NextResponse.json({ ok: outcome.ok, message: outcome.message });
  }

  return NextResponse.json({
    ok: outcome.ok,
    tool: { id: tool.id, name: tool.name, kind: tool.kind },
    message: outcome.message,
    run: outcome.run,
    capture: outcome.tool.captures[0] ?? null,
    nextRunAt: outcome.tool.nextRunAt,
    toolState: toPublicTool(outcome.tool).status,
  });
}

export async function GET(req: Request, ctx: Params) {
  return handle(req, ctx);
}

export async function POST(req: Request, ctx: Params) {
  return handle(req, ctx);
}
