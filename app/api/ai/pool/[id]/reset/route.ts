import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../../../lib/auth";
import { writeAudit } from "../../../../../../lib/audit";
import { roleScope } from "../../../../../../lib/rbac";
import { resetKeyUsage, toPublicKey } from "../../../../../../lib/ai-pool";

export const dynamic = "force-dynamic";

/** POST /api/ai/pool/[id]/reset — รีเซ็ตตัวนับ/ปลดสถานะรอรีเซ็ตด้วยมือ */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้น" }, { status: 403 });
  }

  const key = await resetKeyUsage(id);
  if (!key) return NextResponse.json({ error: "ไม่พบคีย์นี้" }, { status: 404 });

  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-key:${id}`,
    targetName: `${key.provider} · ${key.label}`, action: "update",
    note: "รีเซ็ตโควต้าด้วยมือ (กลับมาใช้งานได้ทันที)", ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, key: toPublicKey(key) });
}
