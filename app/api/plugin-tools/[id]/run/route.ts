import { NextResponse } from "next/server";
import { requestMeta, requireModule } from "../../../../../lib/auth";
import { writeAudit } from "../../../../../lib/audit";
import { getTool, runTool, setSchedule, toPublicTool, type ToolSchedule } from "../../../../../lib/plugin-tools";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/plugin-tools/[id]/run
 *  - { }                        → รันทันที
 *  - { runAt, schedule }        → ตั้งวันเวลาที่จะให้งานออนไลน์
 *  - { cancel: true }           → ยกเลิกการตั้งเวลา
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireModule("tools");
  if (error || !user) return error;

  const tool = await getTool(id);
  if (!tool) return NextResponse.json({ error: "ไม่พบเครื่องมือนี้" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.cancel === true) {
    const updated = await setSchedule(id, { schedule: "manual", runAt: null });
    return NextResponse.json({ ok: true, tool: updated ? toPublicTool(updated) : null, message: "ยกเลิกการตั้งเวลาแล้ว" });
  }

  if (typeof body.runAt === "string" || typeof body.schedule === "string") {
    const runAt = typeof body.runAt === "string" && body.runAt ? body.runAt : tool.runAt;
    const schedule = (typeof body.schedule === "string" ? body.schedule : tool.schedule) as ToolSchedule;
    const updated = await setSchedule(id, { schedule, runAt });
    if (!updated) return NextResponse.json({ error: "ตั้งเวลาไม่สำเร็จ" }, { status: 400 });
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "settings", targetId: `tool:${id}`,
      targetName: tool.name, action: "update",
      note: `ตั้งเวลาให้งานออนไลน์ ${runAt ?? "-"} (${schedule})`, ip: requestMeta(req).ip,
    });
    return NextResponse.json({
      ok: true,
      tool: toPublicTool(updated),
      message: runAt
        ? `ตั้งเวลาแล้ว — งานจะทำงานอัตโนมัติ ${new Date(runAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`
        : "ยกเลิกการตั้งเวลาแล้ว",
    });
  }

  const outcome = await runTool(id, { trigger: "manual", actorName: user.name });
  if (!outcome) return NextResponse.json({ error: "รันไม่สำเร็จ" }, { status: 400 });

  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `tool:${id}`,
    targetName: tool.name, action: "update",
    note: `สั่งรันเครื่องมือด้วยมือ — ${outcome.ok ? "สำเร็จ" : "ไม่สำเร็จ"}: ${outcome.message}`,
    ip: requestMeta(req).ip,
  });

  return NextResponse.json({
    ok: outcome.ok,
    message: outcome.message,
    run: outcome.run,
    tool: toPublicTool(outcome.tool),
  });
}
