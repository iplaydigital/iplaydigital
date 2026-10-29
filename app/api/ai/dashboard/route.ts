import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { listAgentConfigs, toPublic } from "../../../../lib/ai-agents";
import { poolSummary, listKeys, nextResetAt, remainingTokens, toPublicKey, usedPercent } from "../../../../lib/ai-pool";
import { usageStats } from "../../../../lib/ai-usage";

export const dynamic = "force-dynamic";

/** GET /api/ai/dashboard — สถิติการใช้ + สุขภาพของ API pool + สรุปค่าใช้จ่าย */
export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 30));
  const [stats, summary, keys, agents] = await Promise.all([
    usageStats(days),
    poolSummary(),
    listKeys(),
    listAgentConfigs(),
  ]);

  return NextResponse.json(
    {
      ok: true,
      stats,
      pool: {
        summary,
        keys: keys.map((k) => ({
          ...toPublicKey(k),
          remaining: Number.isFinite(remainingTokens(k)) ? remainingTokens(k) : null,
          usedPercent: usedPercent(k),
          nextResetAt: nextResetAt(k),
        })),
      },
      agents: agents.map(toPublic),
      budgets: {
        agentMonthly: Number(agents.reduce((s, a) => s + a.budget, 0).toFixed(2)),
        spentMonth: Number(agents.reduce((s, a) => s + a.costMonth, 0).toFixed(2)),
        projectedMonth: Number(
          (stats.month.cost / Math.max(1, new Date().getUTCDate()) * new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0).getUTCDate()).toFixed(2),
        ),
      },
      days,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
