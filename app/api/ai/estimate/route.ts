import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import type { AiProvider } from "../../../../lib/ai-agents";
import { estimate, type Complexity } from "../../../../lib/ai-estimate";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/estimate — ประเมินราคา AI ของงาน/โปรเจกต์
 * body: { provider, model, projectId?, taskIds?, tasks?, complexity?, contextTokens?, outputRatio?, includeDone? }
 */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = (String(body.provider ?? "local") as AiProvider);
  const model = String(body.model ?? "rule-engine");
  const complexity = (body.complexity as Complexity) ?? "med";

  try {
    const result = await estimate({
      provider,
      model,
      projectId: typeof body.projectId === "string" && body.projectId ? body.projectId : null,
      taskIds: Array.isArray(body.taskIds) ? body.taskIds.map(String) : undefined,
      tasks: body.tasks === undefined ? undefined : Number(body.tasks),
      complexity,
      contextTokens: body.contextTokens === undefined ? undefined : Number(body.contextTokens),
      outputRatio: body.outputRatio === undefined ? undefined : Number(body.outputRatio),
      includeDone: Boolean(body.includeDone),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
