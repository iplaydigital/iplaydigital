import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../../../lib/auth";
import { writeAudit } from "../../../../../../lib/audit";
import { roleScope } from "../../../../../../lib/rbac";
import { listKeys, testKey, toPublicKey } from "../../../../../../lib/ai-pool";

export const dynamic = "force-dynamic";

/** POST /api/ai/pool/[id]/test — ทดสอบว่า API key ใช้งานได้จริง */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้น" }, { status: 403 });
  }

  const key = (await listKeys()).find((k) => k.id === id);
  if (!key) return NextResponse.json({ error: "ไม่พบคีย์นี้" }, { status: 404 });

  const result = await testKey(key);
  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-key:${id}`,
    targetName: `${key.provider} · ${key.label}`, action: "update",
    note: `ทดสอบคีย์: ${result.ok ? "ผ่าน" : "ไม่ผ่าน"} — ${result.message}`, ip: requestMeta(req).ip,
  });

  const fresh = (await listKeys()).find((k) => k.id === id)!;
  return NextResponse.json({ ok: result.ok, message: result.message, key: toPublicKey(fresh) });
}
