import { NextResponse } from "next/server";
import { isManager, requireManager } from "../../../../lib/auth";
import { deleteUser, getUserById, hashPassword, normEmail, toClient, updateUser } from "../../../../lib/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireManager();
  if (error) return error;

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  if (target.role === "admin" && user?.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้นที่แก้ไขบัญชี Admin ได้" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string; nickname?: string; role?: "admin" | "support" | "member";
    password?: string; active?: boolean; position?: string; phone?: string; email?: string;
  };
  if (body.role === "admin" && user?.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้นที่ตั้งสิทธิ์ Admin ได้" }, { status: 403 });
  }
  if (body.active === false && target.id === user?.id) {
    return NextResponse.json({ error: "ระงับบัญชีของตัวเองไม่ได้" }, { status: 400 });
  }

  const patch: Parameters<typeof updateUser>[1] = {
    name: body.name, nickname: body.nickname, role: body.role,
    active: body.active, position: body.position, phone: body.phone,
  };
  if (body.email) patch.email = normEmail(body.email);
  if (body.password && body.password.length >= 6) patch.passwordHash = hashPassword(body.password);

  const updated = await updateUser(id, patch);
  if (!updated) return NextResponse.json({ error: "อัปเดตไม่สำเร็จ" }, { status: 400 });
  return NextResponse.json({ ok: true, user: toClient(updated) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireManager();
  if (error) return error;
  if (!isManager(user)) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  if (id === user?.id) return NextResponse.json({ error: "ลบบัญชีของตัวเองไม่ได้" }, { status: 400 });

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  if (target.role === "admin" && user?.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้นที่ลบบัญชี Admin ได้" }, { status: 403 });
  }
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
