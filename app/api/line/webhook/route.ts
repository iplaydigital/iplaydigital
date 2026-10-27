import {
  bindingForTarget,
  describeInbox,
  eventToInbox,
  lineConfigured,
  lineProfile,
  linePush,
  lineSettings,
  pushInbox,
  verifyLineSignature,
} from "../../../../lib/line";
import { getUserByLineId } from "../../../../lib/users";
import { pool } from "../../../../lib/db-maria";

export const dynamic = "force-dynamic";

/**
 * Webhook ของ LINE Official Account
 *  1) ตรวจ x-line-signature ด้วย Channel Secret
 *  2) บันทึกข้อความเข้ากล่อง LINE ของ Workspace
 *  3) ตอบกลับผู้ส่ง (ถ้าเป็นแชทส่วนตัว) หรือส่งเข้ากลุ่ม LINE ที่ผูกไว้
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const settings = await lineSettings();
  const signature = req.headers.get("x-line-signature");

  if (settings.channelSecret && !verifyLineSignature(raw, signature, settings.channelSecret)) {
    return Response.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let payload: { events?: Record<string, unknown>[] } = {};
  try {
    payload = JSON.parse(raw) as { events?: Record<string, unknown>[] };
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const events = payload.events ?? [];
  const results: Record<string, unknown>[] = [];

  for (const event of events) {
    try {
      const msg = await eventToInbox(event);
      const saved = await pushInbox(msg);

      // ผูก LINE user ↔ Workspace user (ถ้ามีบัญชีที่เชื่อม LINE id นี้ไว้)
      const linkedUser = msg.userId ? await getUserByLineId(msg.userId) : null;

      let reply: { ok: boolean; error?: string } = { ok: false, error: "no-reply" };
      const isText = msg.type === "text" && msg.text;

      if (msg.type === "follow" && msg.userId) {
        const profile = await lineProfile(msg.userId);
        reply = await linePush(msg.userId, [
          {
            type: "text",
            text: `สวัสดี ${profile?.displayName ?? ""}! 👋\nนี่คือช่องทางแจ้งเตือนของ iPlay Digital Workspace\n${linkedUser ? `บัญชีของคุณผูกไว้แล้ว: ${linkedUser.email}` : "ยังไม่ได้ผูกบัญชี — เข้าเว็บ > โปรไฟล์ > เชื่อม LINE"}\nพิมพ์ข้อความมาได้เลย ทีมงานจะได้รับในระบบ`,
          },
        ]);
      } else if (linkedUser && isText) {
        // ผู้ใช้ที่ผูกบัญชีไว้แล้ว: ตอบรับ + ส่งข้อความเข้ากลุ่ม LINE ที่ผูกกับแชท (ถ้ามี)
        if (msg.channelId) await recordIncomingChat(msg.channelId, linkedUser.memberId ?? linkedUser.id, msg.text ?? "");
        const groupTarget = msg.groupId || msg.roomId;
        reply = groupTarget
          ? await linePush(groupTarget, [{ type: "text", text: `📥 ${linkedUser.name}: ${msg.text}` }])
          : await linePush(msg.userId ?? "", [
              {
                type: "text",
                text: `✅ ส่งเข้า Workspace แล้ว (${linkedUser.name})\nข้อความ: ${msg.text}\n\nทีมงานจะตอบกลับทางระบบ หรือพิมพ์ /help เพื่อดูคำสั่ง`,
              },
            ]);
      } else if (isText && msg.userId) {
        reply = await linePush(msg.userId, [
          {
            type: "text",
            text: "ได้รับข้อความแล้ว ✅\nหากต้องการให้ระบบรู้จักคุณ กรุณาเชื่อม LINE จากหน้าโปรไฟล์บนเว็บ Workspace ก่อนครับ",
          },
        ]);
      }

      results.push({ id: saved.id, type: msg.type, summary: describeInbox(saved), linked: linkedUser?.email ?? null, reply });
    } catch (err) {
      console.error("[line/webhook] event error", err);
      results.push({ ok: false, error: (err as Error).message });
    }
  }

  return Response.json({ ok: true, received: events.length, configured: lineConfigured(settings), results });
}

/** บันทึกข้อความ LINE ที่เข้ามาลงในห้องแชทที่ผูกไว้ (ws_messages) */
async function recordIncomingChat(channelId: string, authorId: string, text: string) {
  if (!process.env.DB_HOST) return;
  try {
    const p = pool();
    await p.query("INSERT INTO ws_messages (id, channel_id, author_id, body, kind, pinned, reactions, created_at) VALUES (?,?,?,?, 'text', 0, ?, NOW())", [
      `lm_${Date.now().toString(36)}`,
      channelId,
      authorId,
      text,
      JSON.stringify({}),
    ]);
  } catch {
    /* ห้อง/ตารางอาจยังไม่มี — ข้ามได้ ไม่ให้ webhook ล้ม */
  }
}

/** LINE ใช้ GET เพื่อตรวจสอบว่า endpoint พร้อม (ไม่บังคับ) */
export async function GET() {
  const s = await lineSettings();
  return Response.json({
    ok: true,
    service: "line-webhook",
    configured: lineConfigured(s),
    signatureRequired: Boolean(s.channelSecret),
    hint: !lineConfigured(s) ? "ตั้งค่า Channel Access Token ที่ ตั้งค่า → Login & เชื่อมต่อ → LINE Official Account" : undefined,
  });
}
