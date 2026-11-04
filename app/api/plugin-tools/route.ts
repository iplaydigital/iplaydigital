import { NextResponse } from "next/server";
import { requestMeta, requireModule, requireUser } from "../../../lib/auth";
import { writeAudit } from "../../../lib/audit";
import { roleScope } from "../../../lib/rbac";
import {
  listTools, saveTool, deleteTool, processDueTools, toolSummary, toPublicTool,
  TOOL_KIND_META, TOOL_STATUS_META, SCHEDULE_META, type ToolKind, type ToolSchedule,
} from "../../../lib/plugin-tools";
import { listSkills } from "../../../lib/ai-skills";
import { listAgentConfigs, toPublic as toPublicAgent } from "../../../lib/ai-agents";

export const dynamic = "force-dynamic";

/** GET /api/plugin-tools — เครื่องมือทั้งหมด + ประวัติรัน + ภาพที่แคป + ตัวเลือก skill/AI */
export async function GET(req: Request) {
  const { user, error } = await requireModule("tools");
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const auto = url.searchParams.get("auto") !== "0";

  // งานที่ถึงกำหนดเวลาจะถูกสั่งทำงานทันทีเมื่อมีคนเปิดหน้านี้ (ไม่ต้องพึ่ง cron ภายนอก)
  let dueInfo: { ran: { ok: boolean; message: string }[]; due: number } | null = null;
  if (auto) {
    try {
      const result = await processDueTools(3);
      dueInfo = { ran: result.ran.map((r) => ({ ok: r.ok, message: `[${r.tool.name}] ${r.message}` })), due: result.due };
    } catch {
      dueInfo = null;
    }
  }

  const [tools, skills, agents] = await Promise.all([listTools(), listSkills(), listAgentConfigs()]);
  return NextResponse.json(
    {
      ok: true,
      tools: tools.map(toPublicTool),
      summary: toolSummary(tools),
      kinds: TOOL_KIND_META,
      statuses: TOOL_STATUS_META,
      schedules: SCHEDULE_META,
      skills: skills.filter((s) => s.enabled),
      agents: agents.map(toPublicAgent),
      canEdit: roleScope(user.role).manageStaff || user.role === "manager" || user.role === "member",
      canDelete: roleScope(user.role).manageStaff || user.role === "manager",
      due: dueInfo,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** POST /api/plugin-tools — สร้าง/แก้ไขเครื่องมือ (รวมตั้งวันเวลาให้งานออนไลน์) */
export async function POST(req: Request) {
  const { user, error } = await requireModule("tools");
  if (error || !user) return error;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const isNew = !body.id;
  if (isNew && !roleScope(user.role).manageStaff && user.role !== "manager" && user.role !== "member") {
    return NextResponse.json({ error: "บทบาทของคุณไม่มีสิทธิ์สร้างเครื่องมือ" }, { status: 403 });
  }

  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);
  const kind = str("kind") as ToolKind | undefined;
  if (kind && !(kind in TOOL_KIND_META)) return NextResponse.json({ error: "ประเภทเครื่องมือไม่ถูกต้อง" }, { status: 400 });
  const schedule = str("schedule") as ToolSchedule | undefined;
  if (schedule && !(schedule in SCHEDULE_META)) return NextResponse.json({ error: "รูปแบบตารางเวลาไม่ถูกต้อง" }, { status: 400 });

  const tool = await saveTool({
    id: str("id"),
    name: str("name"),
    kind,
    description: str("description"),
    targetUrl: str("targetUrl"),
    publishUrl: str("publishUrl"),
    method: (str("method") as "POST" | "PUT" | "GET" | undefined) ?? undefined,
    contentType: str("contentType"),
    headers: str("headers"),
    payload: str("payload"),
    loginUrl: str("loginUrl"),
    loginUser: str("loginUser"),
    loginPassword: str("loginPassword"),
    loginNote: str("loginNote"),
    skillId: body.skillId === undefined ? undefined : (body.skillId ? String(body.skillId) : null),
    agentId: body.agentId === undefined ? undefined : (body.agentId ? String(body.agentId) : null),
    taskId: body.taskId === undefined ? undefined : (body.taskId ? String(body.taskId) : null),
    projectId: body.projectId === undefined ? undefined : (body.projectId ? String(body.projectId) : null),
    schedule,
    runAt: body.runAt === undefined ? undefined : (body.runAt ? String(body.runAt) : null),
    enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
    captureEnabled: body.captureEnabled === undefined ? undefined : Boolean(body.captureEnabled),
    createReport: body.createReport === undefined ? undefined : Boolean(body.createReport),
    rotateToken: body.rotateToken === true,
  });

  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    targetType: "settings",
    targetId: `tool:${tool.id}`,
    targetName: tool.name,
    action: isNew ? "create" : "update",
    note: `Plugin Tool · ${TOOL_KIND_META[tool.kind].label} · ${tool.targetUrl || "-"} · ตั้งเวลา ${tool.runAt ?? "ไม่ตั้ง"}`,
    ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, tool: toPublicTool(tool) });
}

/** DELETE /api/plugin-tools?id=... */
export async function DELETE(req: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff && user.role !== "manager") {
    return NextResponse.json({ error: "เฉพาะ Manager / Admin / Support เท่านั้นที่ลบเครื่องมือได้" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
  await deleteTool(id);
  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `tool:${id}`,
    targetName: id, action: "delete", note: "ลบ Plugin Tool", ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true });
}
