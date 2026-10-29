// ─────────────────────────────────────────────────────────────
//  ประเมินราคา AI ต่อ “งาน” และ “โปรเจกต์”
//   • คำนวณ token ที่ต้องใช้ (input = บริบทงาน + output = คำตอบ)
//   • แปลงเป็นราคาบาทตามโมเดลที่เลือก
//   • เทียบกับโควต้าคงเหลือใน pool (พอใช้วันนี้ไหม / ต้องรอกี่รอบ)
// ─────────────────────────────────────────────────────────────
import type { AiProvider } from "./ai-agents";
import { getModelInfo, priceFor, usdToThb, type ModelInfo } from "./ai-models";
import { getBootstrap } from "./store";

export type Complexity = "low" | "med" | "high";

export interface EstimateInput {
  provider: AiProvider;
  model: string;
  projectId?: string | null;
  taskIds?: string[];
  /** จำนวนงาน (ถ้าไม่ระบุ projectId) */
  tasks?: number;
  complexity?: Complexity;
  /** tokens บริบทต่อคำขอ (ถ้าไม่ระบุใช้ค่าตาม complexity) */
  contextTokens?: number;
  /** สัดส่วน output ต่อ input (ค่าเริ่มต้น 0.45) */
  outputRatio?: number;
  /** รวมงานที่เสร็จแล้วด้วยหรือไม่ */
  includeDone?: boolean;
}

export interface EstimateTaskRow {
  id: string;
  code: string;
  title: string;
  status: string;
  complexity: Complexity;
  tokensIn: number;
  tokensOut: number;
  costThb: number;
}

export interface EstimateResult {
  ok: boolean;
  model: ModelInfo;
  provider: AiProvider;
  complexity: Complexity;
  tasks: number;
  projectId: string | null;
  projectName: string | null;
  tokensIn: number;
  tokensOut: number;
  tokens: number;
  costUsd: number;
  costThb: number;
  costPerTaskThb: number;
  rows: EstimateTaskRow[];
  quota: {
    remainingToday: number | null;
    fitToday: boolean | null;
    dailyRunsNeeded: number | null;
    nextResetAt: string | null;
    note: string;
  };
  usdRate: number;
  message: string;
}

const BASE_CONTEXT: Record<Complexity, number> = { low: 1500, med: 4000, high: 9000 };

function complexityOf(priority?: string, estimateHrs?: number): Complexity {
  if (priority === "urgent" || priority === "high") return "high";
  if ((estimateHrs ?? 0) >= 16) return "high";
  if (priority === "low" || (estimateHrs ?? 0) <= 4) return "low";
  return "med";
}

/** ประเมินราคางาน/โปรเจกต์ */
export async function estimate(input: EstimateInput): Promise<EstimateResult> {
  const model = await getModelInfo(input.provider, input.model);
  const complexity: Complexity = input.complexity ?? "med";
  const outputRatio = input.outputRatio ?? 0.45;
  const data = await getBootstrap();

  let rows: EstimateTaskRow[] = [];
  let projectName: string | null = null;

  if (input.projectId) {
    projectName = data.projects.find((p) => p.id === input.projectId)?.name ?? null;
    const list = data.tasks
      .filter((t) => t.projectId === input.projectId)
      .filter((t) => input.includeDone || t.status !== "done")
      .filter((t) => !input.taskIds?.length || input.taskIds.includes(t.id));

    rows = list.map((t) => {
      const cx = complexityOf(t.priority, t.estimate);
      const tokensIn = Math.round((input.contextTokens ?? BASE_CONTEXT[cx]) + (t.estimate ?? 0) * 320);
      const tokensOut = Math.round(tokensIn * outputRatio);
      return {
        id: t.id,
        code: t.code,
        title: t.title,
        status: t.status,
        complexity: cx,
        tokensIn,
        tokensOut,
        costThb: priceFor(model, tokensIn, tokensOut).thb,
      };
    });
  } else {
    const n = Math.max(1, Math.min(500, Number(input.tasks) || 1));
    const tokensIn = Math.round(input.contextTokens ?? BASE_CONTEXT[complexity]);
    const tokensOut = Math.round(tokensIn * outputRatio);
    rows = Array.from({ length: n }, (_, i) => ({
      id: `est_${i + 1}`,
      code: `EST-${i + 1}`,
      title: `งานประเมิน #${i + 1}`,
      status: "estimate",
      complexity,
      tokensIn,
      tokensOut,
      costThb: priceFor(model, tokensIn, tokensOut).thb,
    }));
  }

  const tokensIn = rows.reduce((s, r) => s + r.tokensIn, 0);
  const tokensOut = rows.reduce((s, r) => s + r.tokensOut, 0);
  const tokens = tokensIn + tokensOut;
  const costUsd = (tokensIn / 1_000_000) * model.priceIn + (tokensOut / 1_000_000) * model.priceOut;
  const costThb = Number((costUsd * usdToThb()).toFixed(2));

  // เทียบกับโควต้าคงเหลือของ pool
  let quota: EstimateResult["quota"] = {
    remainingToday: null,
    fitToday: null,
    dailyRunsNeeded: null,
    nextResetAt: null,
    note: "ยังไม่มี API pool — ประเมินเฉพาะค่าใช้จ่าย",
  };
  try {
    const { poolSummary } = await import("./ai-pool");
    const summary = await poolSummary();
    const row = summary.rows.find((r) => r.provider === input.provider);
    if (row) {
      const remaining = Number.isFinite(row.remainingToday) ? row.remainingToday : null;
      quota = {
        remainingToday: remaining,
        fitToday: remaining === null ? true : tokens <= remaining,
        dailyRunsNeeded: remaining && remaining > 0 ? Math.ceil(tokens / remaining) : null,
        nextResetAt: row.nextResetAt,
        note:
          remaining === null
            ? "คีย์นี้ไม่จำกัดโควต้า"
            : tokens <= remaining
              ? `พอสำหรับโควต้าวันนี้ (เหลือ ${remaining.toLocaleString()} tokens)`
              : `โควต้าวันนี้ไม่พอ — ต้องใช้ประมาณ ${Math.ceil(tokens / remaining)} รอบรีเซ็ต`,
      };
    }
  } catch {
    /* ไม่มี pool ก็ยังประเมินราคาได้ */
  }

  return {
    ok: true,
    model,
    provider: input.provider,
    complexity,
    tasks: rows.length,
    projectId: input.projectId ?? null,
    projectName,
    tokensIn,
    tokensOut,
    tokens,
    costUsd: Number(costUsd.toFixed(6)),
    costThb,
    costPerTaskThb: rows.length ? Number((costThb / rows.length).toFixed(2)) : 0,
    rows,
    quota,
    usdRate: usdToThb(),
    message: `${rows.length} งาน · ${tokens.toLocaleString()} tokens · ประมาณ ฿${costThb.toLocaleString()} (${model.label})`,
  };
}

/** ประเมินราคางานเดียวแบบเร็ว (ใช้ในหน้าแชท/มอบงาน) */
export async function estimateTask(provider: AiProvider, model: string, complexity: Complexity = "med") {
  const res = await estimate({ provider, model, tasks: 1, complexity });
  return { tokens: res.tokens, costThb: res.costThb, model: res.model };
}
