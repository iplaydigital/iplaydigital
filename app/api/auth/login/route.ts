import { NextResponse } from "next/server";
import { setSessionCookie } from "../../../../lib/auth";
import { ensureSeedUsers, isAllowedEmail, verifyCredentials } from "../../../../lib/users";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email || "").trim();
  const password = body.password || "";

  if (!email || !password) {
    return NextResponse.json({ error: "กรอกอีเมลและรหัสผ่านให้ครบ" }, { status: 400 });
  }

  await ensureSeedUsers();
  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  if (!isAllowedEmail(user.email) && user.role !== "admin") {
    return NextResponse.json({ error: "บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน" }, { status: 403 });
  }

  await setSessionCookie(user.id);
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
