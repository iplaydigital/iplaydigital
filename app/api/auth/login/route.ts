import { NextResponse } from "next/server";
import { requestMeta, setSessionCookie } from "../../../../lib/auth";
import { ensureSeedUsers, getUserByEmail, isAllowedEmail, verifyCredentials } from "../../../../lib/users";
import { writeAudit, writeLogin } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const { ip, agent } = requestMeta(req);

  if (!email || !password) {
    return NextResponse.json({ error: "กรอกอีเมลและรหัสผ่านให้ครบ" }, { status: 400 });
  }

  await ensureSeedUsers();
  const user = await verifyCredentials(email, password);

  if (!user) {
    const existing = await getUserByEmail(email);
    await writeLogin({
      userId: existing?.id, email, provider: "password", ok: false, ip, agent,
      reason: existing ? (existing.active ? "รหัสผ่านไม่ถูกต้อง" : "บัญชีถูกระงับ") : "ไม่พบบัญชีนี้ในระบบ",
    });
    return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  if (!isAllowedEmail(user.email) && user.role !== "admin") {
    await writeLogin({ userId: user.id, email, provider: "password", ok: false, ip, agent, reason: "โดเมนไม่ได้รับอนุญาต" });
    return NextResponse.json({ error: "บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน" }, { status: 403 });
  }

  await setSessionCookie(user.id);
  await writeLogin({ userId: user.id, email, provider: "password", ok: true, ip, agent });
  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "user", targetId: user.id,
    targetName: `${user.name} (${user.email})`, action: "login", note: `เข้าสู่ระบบด้วยอีเมล · ${ip}`, ip,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, departmentId: user.departmentId },
  });
}
