
import { addBinding, listBindings, removeBinding } from "../../../../lib/line";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

/** GET /api/line/bindings — รายการแชทที่ผูกกับ LINE group */
export async function GET() {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return Response.json({ ok: true, items: await listBindings() });
}

/** POST /api/line/bindings { channelId, targetId, targetType, label } */
export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    channelId?: string;
    targetId?: string;
    targetType?: "group" | "room" | "user";
    label?: string;
  };
  const channelId = (body.channelId ?? "").trim();
  const targetId = (body.targetId ?? "").trim();
  if (!channelId || !targetId) {
    return Response.json({ ok: false, error: "ต้องระบุ channelId และ targetId" }, { status: 400 });
  }

  const binding = await addBinding({
    channelId,
    targetId,
    targetType: body.targetType ?? (targetId.startsWith("C") ? "group" : targetId.startsWith("R") ? "room" : "user"),
    label: body.label?.trim() || undefined,
    createdBy: user.name,
  });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    targetType: "chat",
    targetId: channelId,
    targetName: binding.label ?? binding.targetId,
    action: "update",
    note: `ผูกแชทกับ LINE ${binding.targetType} ${binding.targetId}`,
    ip: requestMeta(req).ip,
  });
  return Response.json({ ok: true, binding });
}

/** DELETE /api/line/bindings?id=... */
export async function DELETE(req: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ ok: false, error: "ต้องระบุ id" }, { status: 400 });
  const removed = await removeBinding(id);
  if (removed) {
    await writeAudit({
      actorId: user.id,
      actorName: user.name,
      targetType: "chat",
      targetId: id,
      targetName: id,
      action: "delete",
      note: "ยกเลิกการผูกแชทกับ LINE",
      ip: requestMeta(req).ip,
    });
  }
  return Response.json({ ok: removed });
}
