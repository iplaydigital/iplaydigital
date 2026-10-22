import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { getUserById, hashPassword, verifyPassword } from "../../../../lib/users";

export const dynamic = "force-dynamic";

/** เปลี่ยนรหัสผ่านของตัวเอง */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error;

  const body = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  if (!body.next || body.next.length < 6) {
    return NextResponse.json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  const record = await getUserById(user.id);
  if (!record) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

  // บัญชีที่มาจาก Google/LINE อาจยังไม่มีรหัสผ่าน → ตั้งใหม่ได้เลย
  if (record.passwordHash && !verifyPassword(body.current || "", record.passwordHash)) {
    return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  }

  const { updateUser } = await import("../../../../lib/users");
  await updateUser(user.id, { passwordHash: hashPassword(body.next), provider: "password" });
  return NextResponse.json({ ok: true });
}
