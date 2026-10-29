import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { PROVIDERS, getAgentConfig, type AiProvider } from "../../../../lib/ai-agents";
import { keysOfProvider } from "../../../../lib/ai-pool";
import { CAPABILITY_META, listModels, thbPerMillion, usdToThb } from "../../../../lib/ai-models";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/models?provider=openai&agentId=ai_nova
 * ดึงรายการโมเดลของ provider (ใช้คีย์จาก pool ก่อน แล้วค่อยคีย์ของ agent)
 * พร้อมความสามารถ + ราคาต่อ context
 */
export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const providerParam = url.searchParams.get("provider") as AiProvider | null;
  const agentId = url.searchParams.get("agentId");

  let provider: AiProvider = providerParam ?? "openai";
  if (!PROVIDERS.some((p) => p.key === provider)) {
    return NextResponse.json({ error: "ผู้ให้บริการไม่ถูกต้อง" }, { status: 400 });
  }

  const agent = agentId ? await getAgentConfig(agentId) : null;
  if (agent && !providerParam) provider = agent.provider;

  const keys = await keysOfProvider(provider);
  const usable = keys.find((k) => k.status === "active") ?? keys[0] ?? null;
  const apiKey = usable?.apiKey || agent?.apiKey || "";
  const baseUrl = usable?.baseUrl || agent?.baseUrl || "";

  const { models, live, message } = await listModels(provider, apiKey, baseUrl);

  return NextResponse.json(
    {
      ok: true,
      provider,
      live,
      message,
      keyLabel: usable?.label ?? null,
      keyPool: keys.length,
      usdRate: usdToThb(),
      capabilities: CAPABILITY_META,
      models: models.map((m) => ({
        ...m,
        priceInThbPerM: thbPerMillion(m.priceIn),
        priceOutThbPerM: thbPerMillion(m.priceOut),
        /** ค่าใช้จ่ายตัวอย่างสำหรับงาน 10k tokens (in 7k / out 3k) */
        sampleCostThb: Number(
          (((7000 / 1_000_000) * m.priceIn + (3000 / 1_000_000) * m.priceOut) * usdToThb()).toFixed(3),
        ),
        contextLabel:
          m.contextWindow >= 1_000_000
            ? `${(m.contextWindow / 1_000_000).toFixed(1)}M tokens`
            : `${Math.round(m.contextWindow / 1000)}K tokens`,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
