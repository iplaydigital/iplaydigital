import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser, requestMeta } from "../../../../lib/auth";
import { writeAudit, writeLogin } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  const { ip, agent } = requestMeta(req);
  if (user) {
    await writeLogin({ userId: user.id, email: user.email, provider: "session", ok: true, ip, agent, reason: "ออกจากระบบ" });
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "user", targetId: user.id,
      targetName: `${user.name} (${user.email})`, action: "logout", note: "ออกจากระบบ", ip,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
