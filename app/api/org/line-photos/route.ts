import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { listUsers, updateUser } from "../../../../lib/users";
import { imageUrlAsDataUrl } from "../../../../lib/line";
import { roleScope } from "../../../../lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/org/line-photos — ดึงรูปจาก LINE ของทุกคนที่ยังไม่มีรูป (ครั้งเดียวทั้งทีม) */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support / Manager เท่านั้น" }, { status: 403 });
  }

  const users = await listUsers();
  const targets = users.filter((u) => u.active && u.linePicture && !u.avatar);
  const results: { id: string; name: string; ok: boolean }[] = [];

  for (const u of targets) {
    const dataUrl = await imageUrlAsDataUrl(u.linePicture as string);
    if (!dataUrl) {
      results.push({ id: u.id, name: u.name, ok: false });
      continue;
    }
    await updateUser(u.id, { avatar: dataUrl, avatarSource: "line" }, { silent: true });
    results.push({ id: u.id, name: u.name, ok: true });
  }

  const ok = results.filter((r) => r.ok).length;
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    targetType: "user",
    targetId: "line-photos",
    targetName: "ดึงรูปจาก LINE",
    action: "update",
    note: `ดึงรูปจาก LINE สำเร็จ ${ok}/${targets.length} คน`,
    ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, updated: ok, skipped: targets.length - ok, results });
}
