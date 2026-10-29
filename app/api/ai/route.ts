import { NextResponse } from "next/server";
import { getBootstrap } from "../../../lib/store";
import { aiReply } from "../../../lib/ai";
import { requireUser } from "../../../lib/auth";
import { getAgentConfig, saveAgentConfig, type AgentConfig } from "../../../lib/ai-agents";
import { pickKey, recordKeyUsage } from "../../../lib/ai-pool";
import { getModelInfo, priceFor } from "../../../lib/ai-models";
import { recordUsage } from "../../../lib/ai-usage";
import { describeSkills, listSkills } from "../../../lib/ai-skills";

export const dynamic = "force-dynamic";

interface RemoteResult {
  reply: string;
  tokensIn: number;
  tokensOut: number;
  source: string;
}

/**
 * AI agent reply engine
 *  - ใช้ API pool: เลือกคีย์ที่ยังมีโควต้า → ถ้าหมดสลับเส้นถัดไปอัตโนมัติ
 *    ถ้าทุกเส้นหมด → สถานะ “รอรีเซ็ต” พร้อมบอกเวลาที่จะใช้ได้
 *  - บันทึก token/ค่าใช้จ่ายลง usage log + ลดโควต้าคีย์
 *  - ผูก skill / plugin / MCP ของ agent เข้ากับ system prompt
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

    // ── engine ภายในระบบ (ฟรี) ──
    if (!cfg || cfg.provider === "local") {
      return NextResponse.json({ agentId: agent.id, reply: local.reply, suggestions: local.suggestions, source: "local" });
    }

    // ── ตรวจงบของ agent ──
    if (cfg.budget > 0 && cfg.costMonth >= cfg.budget) {
      return NextResponse.json({
        agentId: agent.id,
        reply: `${agent.name} ใช้งบเดือนนี้ครบแล้ว (${cfg.costMonth.toFixed(2)} / ${cfg.budget} บาท) — ปรับงบได้ที่หน้าตั้งค่า AI`,
        suggestions: local.suggestions,
        source: "budget",
      });
    }

    // ── เลือกคีย์จาก pool (สลับอัตโนมัติ) ──
    const pick = await pickKey(cfg.provider);
    if (!pick.ok || !pick.key) {
      // ยังไม่มีคีย์ใน pool = ยังไม่ได้ตั้งค่า → ตอบด้วย engine ภายในไปก่อน (ไม่ทำให้งานสะดุด)
      if (pick.reason === "no_keys" || pick.reason === "all_disabled") {
        return NextResponse.json({
          agentId: agent.id,
          reply: `${local.reply}\n\n(หมายเหตุ: ${cfg.provider} ยังไม่มี API key ที่ใช้งานได้ใน pool — ตอนนี้ใช้ engine ภายในระบบไปก่อน เพิ่มคีย์ได้ที่ AI Workforce → API Pool)`,
          suggestions: local.suggestions,
          source: "local-fallback",
        });
      }
      const when = pick.nextResetAt ? new Date(pick.nextResetAt) : null;
      return NextResponse.json({
        agentId: agent.id,
        reply:
          `⏳ ${agent.name} รอโควต้า API อยู่ — ${pick.message}` +
          (when ? `\nจะกลับมาใช้งานได้ประมาณ ${when.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}` : "") +
          `\nระหว่างนี้ยังใช้ engine ภายในระบบได้`,
        suggestions: local.suggestions,
        source: "quota",
        nextResetAt: pick.nextResetAt ?? null,
      });
    }

    const modelInfo = await getModelInfo(cfg.provider, cfg.model || pick.key.defaultModel || "");
    const skills = await listSkills();
    const skillText = describeSkills(
      skills,
      [...(cfg.skillIds ?? []), ...(cfg.pluginIds ?? [])],
    );

    const system = [
      cfg.systemPrompt?.trim() || `คุณคือ ${agent.name} (${agent.role}) ของ iPlay Workspace ตอบภาษาไทย กระชับ ลงมือทำได้จริง`,
      skillText ? `\nความสามารถที่เปิดใช้:\n${skillText}` : "",
      cfg.mcpServerIds?.length ? `\nเครื่องมือภายนอก (MCP): ${cfg.mcpServerIds.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const context = {
      tasks: data.tasks.filter((t) => t.status !== "done").slice(0, 30).map((t) => ({ code: t.code, title: t.title, status: t.status, due: t.due })),
      eventsToday: data.events.filter((e) => e.date === data.today).slice(0, 10),
      openTasks: data.tasks.filter((t) => t.status !== "done").length,
      projects: data.projects.map((p) => ({ code: p.code, name: p.name, status: p.status, progress: p.progress })),
    };

    const remote = await callRemote(
      { ...cfg, apiKey: pick.key.apiKey, baseUrl: pick.key.baseUrl || cfg.baseUrl },
      system,
      context,
      text || "",
    );

    if (!remote) {
      // ผู้ให้บริการล่ม/คีย์ผิด → คืนคำตอบจาก engine ภายใน + บันทึกสถานะคีย์
      await recordKeyUsage(pick.key.id, { tokensIn: 0, tokensOut: 0, requests: 1, ok: false, error: "provider error" });
      return NextResponse.json({
        agentId: agent.id,
        reply: `${local.reply}\n\n(หมายเหตุ: เรียก ${cfg.provider} ไม่สำเร็จ ระบบสลับมาใช้ engine ภายในให้ก่อน)`,
        suggestions: local.suggestions,
        source: "local-fallback",
      });
    }

    // ── คิดค่าใช้จ่ายจริงจากราคาโมเดล ──
    const cost = priceFor(modelInfo, remote.tokensIn, remote.tokensOut).thb;
    await recordKeyUsage(pick.key.id, { tokensIn: remote.tokensIn, tokensOut: remote.tokensOut, requests: 1, ok: true });
    await recordUsage({
      agentId: agent.id,
      agentName: agent.name,
      provider: cfg.provider,
      model: cfg.model || modelInfo.id,
      keyId: pick.key.id,
      keyLabel: pick.key.label,
      tokensIn: remote.tokensIn,
      tokensOut: remote.tokensOut,
      costThb: cost,
      source: remote.source,
      projectId: cfg.projectIds?.[0] ?? null,
      projectName: data.projects.find((p) => p.id === cfg.projectIds?.[0])?.name ?? null,
      taskId: null,
      ok: true,
      error: null,
    });

    // อัปเดตยอดสะสมของ agent
    await saveAgentConfig(agent.id, {
      tokensMonth: cfg.tokensMonth + remote.tokensIn + remote.tokensOut,
      costMonth: Number((cfg.costMonth + cost).toFixed(4)),
      costIn: Number((modelInfo.priceIn * 36 / 1000).toFixed(4)),
      costOut: Number((modelInfo.priceOut * 36 / 1000).toFixed(4)),
    });

    return NextResponse.json({
      agentId: agent.id,
      reply: remote.reply,
      suggestions: local.suggestions,
      source: remote.source,
      usage: { tokensIn: remote.tokensIn, tokensOut: remote.tokensOut, costThb: cost, key: pick.key.label },
    });
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
): Promise<RemoteResult | null> {
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

    // ── OpenAI-compatible ──
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
    return null;
  }
}
