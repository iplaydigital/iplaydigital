import { NextResponse } from "next/server";
import { requestMeta, setSessionCookie } from "../../../../lib/auth";
import { ensureSeedUsers, getUserByEmail, isAllowedEmail, verifyCredentials } from "../../../../lib/users";
import { writeAudit, writeLogin } from "../../../../lib/audit";
import { LOGIN_LIMIT, rateLimit, resetRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const { ip, agent } = requestMeta(req);

  if (!email || !password) {
    return NextResponse.json({ error: "กรอกอีเมลและรหัสผ่านให้ครบ" }, { status: 400 });
  }

  // กัน brute force: จำกัดจำนวนครั้งต่อ IP และต่อบัญชี
  const ipKey = `login:ip:${ip}`;
  const accountKey = `login:acct:${email}`;
  // ถ้าอ่าน IP จริงไม่ได้ (nginx ไม่ได้ส่ง x-forwarded-for) ทุกคนจะใช้ bucket เดียวกัน
  // → ขยายเพดานขึ้น 10 เท่าเพื่อไม่ให้ล็อกทั้งบริษัท (ยังกัน brute force ระดับหนึ่ง)
  const sharedIp = ip === "local" || ip === "unknown";
  const ipMax = sharedIp ? LOGIN_LIMIT.ip.limit * 10 : LOGIN_LIMIT.ip.limit;
  const ipLimit = rateLimit(ipKey, ipMax, LOGIN_LIMIT.ip.windowMs);
  if (!ipLimit.ok) {
    await writeLogin({ email, provider: "password", ok: false, ip, agent, reason: "ถูกจำกัดจำนวนครั้ง (rate limit)" });
    return NextResponse.json(
      { error: `ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${Math.ceil(ipLimit.retryAfter / 60)} นาที` },
      { status: 429, headers: { "retry-after": String(ipLimit.retryAfter) } },
    );
  }

  await ensureSeedUsers();
  const user = await verifyCredentials(email, password);

  if (!user) {
    const existing = await getUserByEmail(email);
    const acctLimit = rateLimit(accountKey, LOGIN_LIMIT.account.limit, LOGIN_LIMIT.account.windowMs);
    if (!acctLimit.ok) {
      await writeLogin({ userId: existing?.id, email, provider: "password", ok: false, ip, agent, reason: "บัญชีถูกล็อกชั่วคราว (rate limit)" });
      return NextResponse.json(
        { error: `บัญชีนี้ถูกจำกัดการเข้าสู่ระบบชั่วคราว กรุณารอ ${Math.ceil(acctLimit.retryAfter / 60)} นาที` },
        { status: 429, headers: { "retry-after": String(acctLimit.retryAfter) } },
      );
    }
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

  resetRateLimit(accountKey);
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
