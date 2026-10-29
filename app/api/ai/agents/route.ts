import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { PROVIDERS, listAgentConfigs, saveAgentConfig, toPublic, type AgentConfig, type AiProvider } from "../../../../lib/ai-agents";
import { roleScope } from "../../../../lib/rbac";

export const dynamic = "force-dynamic";

/** GET /api/ai/agents — การตั้งค่า AI ทุกตัว (ปิดบัง API key) */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const agents = await listAgentConfigs();
  return NextResponse.json(
    {
      ok: true,
      providers: PROVIDERS,
      agents: agents.map(toPublic),
      canEdit: roleScope(user.role).manageStaff,
      totals: {
        tokens: agents.reduce((s, a) => s + a.tokensMonth, 0),
        cost: Number(agents.reduce((s, a) => s + a.costMonth, 0).toFixed(2)),
        budget: Number(agents.reduce((s, a) => s + a.budget, 0).toFixed(2)),
        connected: agents.filter((a) => a.provider === "local" || a.apiKey).length,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** POST /api/ai/agents — บันทึกการตั้งค่า AI ตัวหนึ่ง */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้นที่แก้ไขการตั้งค่า AI ได้" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<AgentConfig> & { id?: string };
  if (!body.id) return NextResponse.json({ error: "ต้องระบุ id ของ AI" }, { status: 400 });

  const patch: Partial<AgentConfig> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.role === "string") patch.role = body.role.trim();
  if (typeof body.provider === "string") {
    if (!PROVIDERS.some((p) => p.key === body.provider)) {
      return NextResponse.json({ error: "ผู้ให้บริการไม่ถูกต้อง" }, { status: 400 });
    }
    patch.provider = body.provider as AiProvider;
  }
  if (typeof body.baseUrl === "string") patch.baseUrl = body.baseUrl.trim();
  if (typeof body.model === "string") patch.model = body.model.trim();
  if (typeof body.apiKey === "string" && body.apiKey.trim()) patch.apiKey = body.apiKey.trim();
  if (body.apiKey === "") patch.apiKey = "";
  if (body.temperature !== undefined) patch.temperature = Math.max(0, Math.min(2, Number(body.temperature) || 0));
  if (body.maxTokens !== undefined) patch.maxTokens = Math.max(64, Math.min(16000, Number(body.maxTokens) || 1200));
  if (typeof body.systemPrompt === "string") patch.systemPrompt = body.systemPrompt;
  if (body.costIn !== undefined) patch.costIn = Math.max(0, Number(body.costIn) || 0);
  if (body.costOut !== undefined) patch.costOut = Math.max(0, Number(body.costOut) || 0);
  if (body.budget !== undefined) patch.budget = Math.max(0, Number(body.budget) || 0);
  if (body.chatEnabled !== undefined) patch.chatEnabled = Boolean(body.chatEnabled);
  if (body.autoReply !== undefined) patch.autoReply = Boolean(body.autoReply);

  try {
    const saved = await saveAgentConfig(body.id, patch);
    await writeAudit({
      actorId: user.id,
      actorName: user.name,
      targetType: "settings",
      targetId: `ai:${saved.id}`,
      targetName: `AI Agent ${saved.name}`,
      action: "update",
      note: `ตั้งค่า AI: ${saved.provider} · ${saved.model || "—"} · งบ ${saved.budget} บาท/เดือน · แชท${saved.chatEnabled ? "เปิด" : "ปิด"}`,
      ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, agent: toPublic(saved) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
