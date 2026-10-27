import { requireUser } from "../../../../lib/auth";
import { lineConfigured, lineSettings, listBindings } from "../../../../lib/line";

export const dynamic = "force-dynamic";

/** GET /api/line/status — สถานะการเชื่อม LINE OA + ลิงก์เว็บฮุค */
export async function GET(req: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const origin = new URL(req.url).origin;
  const s = await lineSettings();
  const bindings = await listBindings();
  return Response.json({
    ok: true,
    configured: lineConfigured(s),
    signatureRequired: Boolean(s.channelSecret),
    botId: s.botBasicId || null,
    webhookUrl: `${origin}/api/line/webhook`,
    userLinked: Boolean(user.linked?.line),
    userLinkedName: user.linked?.lineName ?? null,
    bindings: bindings.length,
  });
}
