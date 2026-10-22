import { NextResponse } from "next/server";
import { getBootstrap } from "../../../lib/store";
import { aiReply } from "../../../lib/ai";
import { requireUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

/**
 * AI agent reply engine
 * - ใช้ rule/context engine ในตัว (อ่านข้อมูลจริงจาก workspace)
 * - ถ้าตั้ง AI_GATEWAY_URL + AI_GATEWAY_KEY จะส่ง context ไปยัง LLM gateway ก่อน
 */
export async function POST(req: Request) {
  const { error } = await requireUser();
  if (error) return error;
  try {
    const { text, agentId } = (await req.json()) as { text: string; agentId?: string };
    const data = await getBootstrap();
    const agent =
      data.members.find((m) => m.id === agentId && m.kind === "ai") ??
      data.members.find((m) => m.id === "ai_nova")!;

    const local = aiReply(data, agent.id, text || "");
    const gateway = process.env.AI_GATEWAY_URL;
    if (gateway && process.env.AI_GATEWAY_KEY) {
      try {
        const context = {
          tasks: data.tasks.filter((t) => t.status !== "done").slice(0, 40).map((t) => ({ code: t.code, title: t.title, status: t.status, due: t.due, assignee: t.assigneeId })),
          eventsToday: data.events.filter((e) => e.date === data.today),
          rooms: data.rooms,
          leavesPending: data.leaves.filter((l) => l.status === "pending"),
          agents: data.members.filter((m) => m.kind === "ai"),
        };
        const res = await fetch(gateway, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.AI_GATEWAY_KEY}` },
          body: JSON.stringify({
            model: process.env.AI_MODEL || "claude-sonnet-4-5",
            agent: { id: agent.id, name: agent.name, role: agent.role },
            system: "คุณคือ AI agent ของ iPlay Workspace ตอบภาษาไทย กระชับ ลงมือทำได้จริง",
            context,
            message: text,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const out = (await res.json()) as { reply?: string };
          if (out.reply) return NextResponse.json({ agentId: agent.id, reply: out.reply, suggestions: local.suggestions, source: "gateway" });
        }
      } catch (e) {
        console.warn("[ai] gateway failed, fallback to local", (e as Error).message);
      }
    }

    return NextResponse.json({ agentId: agent.id, reply: local.reply, suggestions: local.suggestions, source: "local" });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
