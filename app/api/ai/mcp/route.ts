import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { roleScope } from "../../../../lib/rbac";
import { deleteMcp, listMcp, pingMcp, saveMcp, toPublicMcp, type McpServer } from "../../../../lib/ai-skills";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, mcp: (await listMcp()).map(toPublicMcp) }, { headers: { "cache-control": "no-store" } });
}

/** POST /api/ai/mcp — เพิ่ม/แก้ไข MCP server หรือทดสอบด้วย { test: id } */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้น" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.test === "string") {
    const server = (await listMcp()).find((s) => s.id === body.test);
    if (!server) return NextResponse.json({ error: "ไม่พบ MCP server" }, { status: 404 });
    const result = await pingMcp(server);
    return NextResponse.json({ ok: result.ok, message: result.message });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "ต้องตั้งชื่อ MCP server" }, { status: 400 });

  const server = await saveMcp({
    id: typeof body.id === "string" ? body.id : undefined,
    name,
    url: typeof body.url === "string" ? body.url : undefined,
    transport: (body.transport as McpServer["transport"]) ?? "http",
    token: typeof body.token === "string" ? body.token : undefined,
    tools: Array.isArray(body.tools) ? body.tools.map(String) : undefined,
    enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
  });

  await writeAudit({
    actorId: user.id, actorName: user.name, targetType: "settings", targetId: `ai-mcp:${server.id}`,
    targetName: server.name, action: body.id ? "update" : "create",
    note: `MCP ${server.transport} · ${server.url}`, ip: requestMeta(req).ip,
  });

  return NextResponse.json({ ok: true, mcp: toPublicMcp(server) });
}

export async function DELETE(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!roleScope(user.role).manageStaff) {
    return NextResponse.json({ error: "เฉพาะ Admin / Support เท่านั้น" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
  await deleteMcp(id);
  return NextResponse.json({ ok: true });
}
