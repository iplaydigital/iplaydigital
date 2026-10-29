import { NextResponse } from "next/server";
import { getBootstrap } from "../../../lib/store";
import { aiReply } from "../../../lib/ai";
import { requireUser } from "../../../lib/auth";
import { getAgentConfig, recordAgentUsage, type AgentConfig } from "../../../lib/ai-agents";

export const dynamic = "force-dynamic";

interface ChatResult {
  reply: string;
  tokensIn: number;
  tokensOut: number;
  source: string;
}

/**
 * AI agent reply engine (ใช้ค่าจากหน้าตั้งค่า AI ของแต่ละตัว)
 *  1) local            → rule/context engine ในตัว (ฟรี)
 *  2) gateway          → AI_GATEWAY_URL + AI_GATEWAY_KEY จาก env
 *  3) openai / custom  → /chat/completions (OpenAI-compatible)
 *  4) anthropic        → /messages
 *  5) google           → :generateContent
 * ถ้าติดต่อไม่ได้หรือยังไม่ตั้ง key → ถอยไปใช้ engine ในตัวพร้อมแจ้งเหตุผล
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

    const cfg = await getAgentConfig(agent.id);
    const local = aiReply(data, agent.id, text || "");

    if (cfg && !cfg.chatEnabled) {
      return NextResponse.json({
        agentId: agent.id,
        reply: `ขณะนี้ปิดการตอบในแชทของ ${agent.name} อยู่ — เปิดได้ที่ AI Workforce → ตั้งค่า ${agent.name}`,
        suggestions: local.suggestions,
        source: "disabled",
      });
    }

    const context = {
      tasks: data.tasks.filter((t) => t.status !== "done").slice(0, 30).map((t) => ({ code: t.code, title: t.title, status: t.status, due: t.due })),
      eventsToday: data.events.filter((e) => e.date === data.today).slice(0, 10),
      openTasks: data.tasks.filter((t) => t.status !== "done").length,
      agents: data.members.filter((m) => m.kind === "ai").map((m) => m.name),
    };

    const system =
      cfg?.systemPrompt?.trim() ||
      `คุณคือ ${agent.name} (${agent.role}) ของ iPlay Workspace ตอบภาษาไทย กระชับ ลงมือทำได้จริง`;

    if (cfg && cfg.provider !== "local") {
      const over = cfg.budget > 0 && cfg.costMonth >= cfg.budget;
      if (over) {
        return NextResponse.json({
          agentId: agent.id,
          reply: `${agent.name} ใช้งบเดือนนี้ครบแล้ว (${cfg.costMonth.toFixed(2)} / ${cfg.budget} บาท) — ปรับงบได้ที่หน้าตั้งค่า AI`,
          suggestions: local.suggestions,
          source: "budget",
        });
      }
      const remote = await callRemote(cfg, system, context, text || "", local.reply);
      if (remote) {
        await recordAgentUsage(agent.id, remote.tokensIn, remote.tokensOut);
        return NextResponse.json({
          agentId: agent.id,
          reply: remote.reply,
          suggestions: local.suggestions,
          source: remote.source,
        });
      }
    }

    return NextResponse.json({ agentId: agent.id, reply: local.reply, suggestions: local.suggestions, source: "local" });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const approxTokens = (s: string) => Math.max(1, Math.round(s.length / 3.2));

async function callRemote(
  cfg: AgentConfig,
  system: string,
  context: unknown,
  message: string,
  fallbackReply: string,
): Promise<ChatResult | null> {
  const userContent = `${message}\n\n[ข้อมูล Workspace]\n${JSON.stringify(context).slice(0, 6000)}`;
  try {
    // ── gateway ของบริษัท ──
    if (cfg.provider === "gateway") {
      const url = process.env.AI_GATEWAY_URL;
      const key = process.env.AI_GATEWAY_KEY || cfg.apiKey;
      if (!url || !key) return null;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: cfg.model || process.env.AI_MODEL || "claude-sonnet-4-5", system, context, message }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return null;
      const out = (await res.json()) as { reply?: string };
      if (!out.reply) return null;
      return { reply: out.reply, tokensIn: approxTokens(userContent), tokensOut: approxTokens(out.reply), source: "gateway" };
    }

    if (!cfg.apiKey) return null;

    // ── Google Gemini ──
    if (cfg.provider === "google") {
      const base = cfg.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
      const model = cfg.model || "gemini-2.5-flash";
      const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) return null;
      const out = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const reply = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!reply) return null;
      return {
        reply,
        tokensIn: out.usageMetadata?.promptTokenCount ?? approxTokens(userContent),
        tokensOut: out.usageMetadata?.candidatesTokenCount ?? approxTokens(reply),
        source: "google",
      };
    }

    // ── Anthropic ──
    if (cfg.provider === "anthropic") {
      const base = cfg.baseUrl || "https://api.anthropic.com/v1";
      const res = await fetch(`${base}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.model || "claude-sonnet-4-5",
          max_tokens: cfg.maxTokens,
          temperature: cfg.temperature,
          system,
          messages: [{ role: "user", content: userContent }],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) return null;
      const out = (await res.json()) as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const reply = out.content?.map((c) => c.text ?? "").join("").trim();
      if (!reply) return null;
      return {
        reply,
        tokensIn: out.usage?.input_tokens ?? approxTokens(userContent),
        tokensOut: out.usage?.output_tokens ?? approxTokens(reply),
        source: "anthropic",
      };
    }

    // ── OpenAI-compatible (openai / custom) ──
    const base = (cfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model || "gpt-4.1-mini",
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const reply = out.choices?.[0]?.message?.content?.trim();
    if (!reply) return null;
    return {
      reply,
      tokensIn: out.usage?.prompt_tokens ?? approxTokens(userContent),
      tokensOut: out.usage?.completion_tokens ?? approxTokens(reply),
      source: cfg.provider,
    };
  } catch (e) {
    console.warn("[ai] remote call failed, fallback to local:", (e as Error).message);
    void fallbackReply;
    return null;
  }
}
