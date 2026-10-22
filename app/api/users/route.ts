import { NextResponse } from "next/server";
import { isManager, requireManager, requireUser } from "../../../lib/auth";
import { createUser, ensureSeedUsers, hashPassword, isAllowedEmail, listUsers, normEmail, toClient } from "../../../lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  await ensureSeedUsers();
  const all = await listUsers();
  // member เห็นแค่รายชื่อทีม (ไม่เห็นสถานะ/บทบาทละเอียดของคนอื่น)
  if (!isManager(user)) return NextResponse.json({ users: all.map((u) => toClient(u)) });
  return NextResponse.json({ users: all.map((u) => toClient(u)), canManage: true });
}

export async function POST(req: Request) {
  const { user, error } = await requireManager();
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as {
    email?: string; name?: string; nickname?: string; role?: "admin" | "support" | "member";
    password?: string; position?: string; phone?: string;
  };
  if (!body.email || !body.name) return NextResponse.json({ error: "ต้องมีชื่อและอีเมล" }, { status: 400 });
  if (!isAllowedEmail(body.email)) {
    return NextResponse.json({ error: "อีเมลต้องอยู่ในโดเมนของบริษัท" }, { status: 400 });
  }
  if (body.role === "admin" && user?.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้นที่ตั้งสิทธิ์ Admin ได้" }, { status: 403 });
  }
  const password = body.password && body.password.length >= 6 ? body.password : "iplay@2026";
  try {
    const created = await createUser({
      email: normEmail(body.email),
      name: body.name,
      nickname: body.nickname,
      role: body.role || "member",
      passwordHash: hashPassword(password),
      position: body.position || "",
      provider: "password",
    });
    return NextResponse.json({ ok: true, user: toClient(created), initialPassword: password });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
