import { NextResponse } from "next/server";
import { requireSuperAdmin, requestMeta } from "../../../../lib/auth";
import { getOAuthConfig, oauthPublicInfo, saveOAuthConfig } from "../../../../lib/oauth-config";
import { writeAudit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

/** ดูสถานะการเชื่อมต่อ Login (Google / LINE) — Super Admin เท่านั้น */
export async function GET() {
  const { user, error } = await requireSuperAdmin();
  if (error) return error;
  const info = await oauthPublicInfo();
  return NextResponse.json({ ...info, updatedBy: user?.email }, { headers: { "cache-control": "no-store" } });
}

/**
 * บันทึกค่า OAuth จากหน้าเว็บ (ไม่ต้องแก้ .env / restart)
 * body: { googleId?, googleSecret?, lineId?, lineSecret?, publicUrl? }
 * ส่งค่าว่าง "" = ล้างค่า (กลับไปใช้ env)
 */
export async function POST(req: Request) {
  const { user, error } = await requireSuperAdmin();
  if (error || !user) return error;

  const body = (await req.json().catch(() => ({}))) as Record<string, string | undefined>;
  const map: Record<string, keyof Awaited<ReturnType<typeof getOAuthConfig>>> = {
    googleId: "googleId",
    googleSecret: "googleSecret",
    lineId: "lineId",
    lineSecret: "lineSecret",
    publicUrl: "publicUrl",
  };

  const patch: Record<string, string> = {};
  for (const [key, field] of Object.entries(map)) {
    if (body[key] !== undefined) patch[field] = String(body[key] ?? "");
  }
  if (patch.publicUrl && !/^https?:\/\/[^/]+/.test(patch.publicUrl)) {
    return NextResponse.json({ error: "Public URL ต้องขึ้นต้นด้วย http:// หรือ https://" }, { status: 400 });
  }
  if (patch.publicUrl) patch.publicUrl = patch.publicUrl.replace(/\/+$/, "");

  await saveOAuthConfig(patch);

  const { ip } = requestMeta(req);
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    targetType: "settings",
    targetId: "oauth",
    targetName: "การเชื่อมต่อ Google / LINE Login",
    action: "update",
    note: `แก้ไข: ${Object.keys(patch).join(", ") || "ไม่มีการเปลี่ยนแปลง"}`,
    ip,
  });

  const info = await oauthPublicInfo();
  return NextResponse.json({ ok: true, ...info });
}
