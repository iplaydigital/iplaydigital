import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { roleScope } from "../../../../lib/rbac";
import { PROVIDERS, type AiProvider } from "../../../../lib/ai-agents";
import {
  KEY_STATUS_META, addKey, deleteKey, listKeys, poolSummary, toPublicKey, updateKey,
} from "../../../../lib/ai-pool";

export const dynamic = "force-dynamic";

/** GET /api/ai/pool — รายการคีย์ (ปิดบัง secret) + สรุปโควต้า/สถานะ */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [keys, summary] = await Promise.all([listKeys(), poolSummary()]);
  return NextResponse.json(
    {
      ok: true,
      providers: PROVIDERS,
      statuses: KEY_STATUS_META,
      keys: keys.map(toPublicKey),
      summary,
      canEdit: roleScope(user.role).manageStaff,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** POST /api/ai/pool — เพิ่ม/แก้ไขคีย์ */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้นที่จัดการ API pool ได้" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = String(body.provider ?? "") as AiProvider;
  if (!PROVIDERS.some((p) => p.key === provider)) {
    return NextResponse.json({ error: "ผู้ให้บริการไม่ถูกต้อง" }, { status: 400 });
  }

  const numeric = (key: string) => (body[key] === undefined ? undefined : Math.max(0, Number(body[key]) || 0));
  const id = typeof body.id === "string" ? body.id : null;

  if (id) {
    const patch: Record<string, unknown> = {
      provider,
      label: typeof body.label === "string" ? body.label.trim() : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined,
      defaultModel: typeof body.defaultModel === "string" ? body.defaultModel.trim() : undefined,
      dailyQuota: numeric("dailyQuota"),
      dailyRequests: numeric("dailyRequests"),
      monthlyQuota: numeric("monthlyQuota"),
      resetHour: body.resetHour === undefined ? undefined : Math.max(0, Math.min(23, Number(body.resetHour) || 0)),
      priority: body.priority === undefined ? undefined : Number(body.priority) || 0,
      status: typeof body.status === "string" ? body.status : undefined,
    };
    if (typeof body.apiKey === "string" && body.apiKey.trim()) patch.apiKey = body.apiKey.trim();
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    const updated = await updateKey(id, patch);
    if (!updated) return NextResponse.json({ error: "ไม่พบคีย์นี้" }, { status: 404 });

    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-key:${updated.id}`,
      targetName: `${updated.provider} · ${updated.label}`, action: "update",
      note: `แก้ไข API key (โควต้า ${updated.dailyQuota || "ไม่จำกัด"} tokens/วัน, รีเซ็ต ${updated.resetHour}:00)`,
      ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, key: toPublicKey(updated) });
  }

  const apiKey = String(body.apiKey ?? "").trim();
  if (!apiKey) return NextResponse.json({ error: "ต้องใส่ API key" }, { status: 400 });

  const created = await addKey({
    provider,
    label: typeof body.label === "string" ? body.label : "",
    apiKey,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : "",
    defaultModel: typeof body.defaultModel === "string" ? body.defaultModel : "",
    dailyQuota: numeric("dailyQuota") ?? 0,
    dailyRequests: numeric("dailyRequests") ?? 0,
    monthlyQuota: numeric("monthlyQuota") ?? 0,
    resetHour: body.resetHour === undefined ? 0 : Number(body.resetHour) || 0,
    priority: body.priority === undefined ? 0 : Number(body.priority) || 0,
  });

  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-key:${created.id}`,
    targetName: `${created.provider} · ${created.label}`, action: "create",
    note: `เพิ่ม API key เข้า pool (${created.provider}) โควต้า ${created.dailyQuota || "ไม่จำกัด"} tokens/วัน`,
    ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, key: toPublicKey(created) });
}

/** DELETE /api/ai/pool?id=... */
export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้นที่ลบคีย์ได้" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
  await deleteKey(id);
  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-key:${id}`,
    targetName: "API pool", action: "delete", note: "ลบ API key ออกจาก pool", ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true });
}
