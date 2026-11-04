import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { processDueTools } from "../../../../lib/plugin-tools";

export const dynamic = "force-dynamic";

/**
 * GET /api/plugin-tools/cron — ให้ตัวตั้งเวลา (cron / PM2 / uptime robot) เรียกทุกนาที
 * ต้องมี session หรือ header x-cron-token = PLUGIN_CRON_TOKEN (ถ้าตั้ง env ไว้)
 */
async function handle(req: Request) {
  const expected = process.env.PLUGIN_CRON_TOKEN;
  const provided = req.headers.get("x-cron-token") ?? new URL(req.url).searchParams.get("token");
  const user = await getSessionUser();
  const allowed = Boolean(user) || (expected ? provided === expected : Boolean(provided));
  if (!allowed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await processDueTools(5);
  return NextResponse.json(
    {
      ok: true,
      due: result.due,
      ran: result.ran.map((r) => ({ tool: r.tool.name, ok: r.ok, message: r.message, at: r.run.at })),
      at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
