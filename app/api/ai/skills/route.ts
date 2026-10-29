import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { roleScope } from "../../../../lib/rbac";
import {
  RUNTIME_META, deleteSkill, listMcp, listSkills, saveSkill, toPublicMcp, type SkillKind, type SkillRuntime,
} from "../../../../lib/ai-skills";

export const dynamic = "force-dynamic";

/** GET /api/ai/skills — คลัง skill/plugin + MCP server */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [skills, mcp] = await Promise.all([listSkills(), listMcp()]);
  return NextResponse.json(
    {
      ok: true,
      skills,
      mcp: mcp.map(toPublicMcp),
      runtimes: RUNTIME_META,
      categories: [...new Set(skills.map((s) => s.category))],
      canEdit: roleScope(user.role).manageStaff,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** POST /api/ai/skills — เพิ่ม/แก้ไข skill หรือ plugin */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้นที่แก้ไขคลัง skill ได้" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "ต้องตั้งชื่อ skill" }, { status: 400 });

  const runtime = String(body.runtime ?? "prompt") as SkillRuntime;
  if (!(runtime in RUNTIME_META)) return NextResponse.json({ error: "runtime ไม่ถูกต้อง" }, { status: 400 });

  const skill = await saveSkill({
    id: typeof body.id === "string" ? body.id : undefined,
    kind: (body.kind as SkillKind) ?? "skill",
    name,
    category: typeof body.category === "string" ? body.category : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    capabilities: Array.isArray(body.capabilities) ? body.capabilities.map(String) : undefined,
    runtime,
    entry: typeof body.entry === "string" ? body.entry : undefined,
    code: typeof body.code === "string" ? body.code : undefined,
    prompt: typeof body.prompt === "string" ? body.prompt : undefined,
    mcpServerId: typeof body.mcpServerId === "string" && body.mcpServerId ? body.mcpServerId : undefined,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
  });

  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-skill:${skill.id}`,
    targetName: skill.name, action: body.id ? "update" : "create",
    note: `${skill.kind === "plugin" ? "Plugin" : "Skill"} · ${RUNTIME_META[skill.runtime].label} · ${skill.category}`,
    ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, skill });
}

/** DELETE /api/ai/skills?id=... */
export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้น" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
  try {
    await deleteSkill(id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-skill:${id}`,
    targetName: id, action: "delete", note: "ลบ skill ออกจากคลัง", ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true });
}
