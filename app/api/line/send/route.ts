
import { bindingForChannel, describeInbox, lineConfigured, linePush, lineSettings, listInbox, pushInbox, newInboxId } from "../../../../lib/line";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { getUserById } from "../../../../lib/users";

export const dynamic = "force-dynamic";

/** POST /api/line/send  { channelId?, to?, text }  — ส่งข้อความออกไปยัง LINE */
export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { channelId?: string; to?: string; text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return Response.json({ ok: false, error: "ข้อความว่าง" }, { status: 400 });
  if (text.length > 4500) return Response.json({ ok: false, error: "ข้อความยาวเกิน 4,500 ตัวอักษร" }, { status: 400 });

  const settings = await lineSettings();
  if (!lineConfigured(settings)) {
    return Response.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า LINE Official Account", hint: "ตั้งค่า → Login & เชื่อมต่อ → LINE Official Account" },
      { status: 400 },
    );
  }

  const binding = body.channelId ? await bindingForChannel(body.channelId) : null;
  // ถ้าไม่ได้ระบุกลุ่ม/ผู้รับ ใช้ LINE ของผู้ใช้ที่ผูกไว้ (ส่งหาตัวเอง)
  const self = user.linked?.line ? await getUserById(user.id) : null;
  const to = (body.to || binding?.targetId || self?.lineUserId || "").trim();
  if (!to) {
    return Response.json({ ok: false, error: "ไม่พบปลายทาง LINE — ระบุ groupId / userId หรือผูก LINE ก่อน" }, { status: 400 });
  }

  const res = await linePush(to, [{ type: "text", text }]);
  if (res.ok) {
    await pushInbox({
      id: newInboxId(),
      at: new Date().toISOString(),
      type: "text",
      text: `[ส่งออก] ${user.name}: ${text}`,
      channelId: body.channelId ?? null,
    });
    await writeAudit({
      actorId: user.id,
      actorName: user.name,
      targetType: "chat",
      targetId: binding?.channelId ?? to,
      targetName: binding?.label ?? to,
      action: "create",
      note: `ส่งข้อความเข้า LINE: ${text.slice(0, 80)}`,
      ip: requestMeta(req).ip,
    });
  }

  return Response.json({ ok: res.ok, to, label: binding?.label ?? null, error: res.error, hint: res.hint }, { status: res.ok ? 200 : 502 });
}

/** GET /api/line/send — กล่องข้อความ LINE ล่าสุด */
export async function GET() {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const items = await listInbox(80);
  return Response.json({ ok: true, items: items.map((m) => ({ ...m, summary: describeInbox(m) })) });
}
