// ─────────────────────────────────────────────────────────────
//  Model Catalog — ความสามารถ + ราคาต่อ context ของแต่ละโมเดล
//   • ดึงรายการโมเดลจริงจากผู้ให้บริการ (เมื่อมี API key ใน pool)
//   • ถ้าดึงไม่ได้/ไม่มีคีย์ → ใช้แคตตาล็อกภายใน
//   • ราคาอ้างอิง USD ต่อ 1M tokens → แปลงเป็นบาท (AI_USD_THB, ค่าเริ่มต้น 36)
// ─────────────────────────────────────────────────────────────
import type { AiProvider } from "./ai-agents";
import { CAPABILITY_META, type Capability } from "./ai-shared";

export type { Capability };
export { CAPABILITY_META };

export interface ModelInfo {
  id: string;
  provider: AiProvider;
  label: string;
  /** ขนาด context (tokens) */
  contextWindow: number;
  maxOutput: number;
  /** USD ต่อ 1M tokens */
  priceIn: number;
  priceOut: number;
  capabilities: Capability[];
  /** ที่มาของข้อมูล */
  source: "catalog" | "live";
  /** ราคาโดยประมาณหรือไม่ */
  approx?: boolean;
  note?: string;
}

export function usdToThb(): number {
  const n = Number(process.env.AI_USD_THB);
  return Number.isFinite(n) && n > 0 ? n : 36;
}

/** ราคา (บาท) ต่อ 1M tokens */
export function thbPerMillion(usdPerMillion: number) {
  return Number((usdPerMillion * usdToThb()).toFixed(2));
}

const CATALOG: Record<string, Omit<ModelInfo, "provider" | "source">> = {
  // ── OpenAI ──
  "gpt-4.1": { id: "gpt-4.1", label: "GPT-4.1", contextWindow: 1_047_576, maxOutput: 32_768, priceIn: 2, priceOut: 8, capabilities: ["text", "vision", "tools", "json", "code", "long-context"] },
  "gpt-4.1-mini": { id: "gpt-4.1-mini", label: "GPT-4.1 mini", contextWindow: 1_047_576, maxOutput: 32_768, priceIn: 0.4, priceOut: 1.6, capabilities: ["text", "vision", "tools", "json", "code", "long-context"] },
  "gpt-4.1-nano": { id: "gpt-4.1-nano", label: "GPT-4.1 nano", contextWindow: 1_047_576, maxOutput: 32_768, priceIn: 0.1, priceOut: 0.4, capabilities: ["text", "vision", "tools", "json", "long-context"] },
  "gpt-4o": { id: "gpt-4o", label: "GPT-4o", contextWindow: 128_000, maxOutput: 16_384, priceIn: 2.5, priceOut: 10, capabilities: ["text", "vision", "tools", "json", "audio"] },
  "gpt-4o-mini": { id: "gpt-4o-mini", label: "GPT-4o mini", contextWindow: 128_000, maxOutput: 16_384, priceIn: 0.15, priceOut: 0.6, capabilities: ["text", "vision", "tools", "json"] },
  o3: { id: "o3", label: "o3 (reasoning)", contextWindow: 200_000, maxOutput: 100_000, priceIn: 2, priceOut: 8, capabilities: ["text", "reasoning", "tools", "code"] },
  "o4-mini": { id: "o4-mini", label: "o4-mini (reasoning)", contextWindow: 200_000, maxOutput: 100_000, priceIn: 1.1, priceOut: 4.4, capabilities: ["text", "reasoning", "tools", "code"] },
  // ── Anthropic ──
  "claude-opus-4-1": { id: "claude-opus-4-1", label: "Claude Opus 4.1", contextWindow: 200_000, maxOutput: 32_000, priceIn: 15, priceOut: 75, capabilities: ["text", "vision", "tools", "reasoning", "code", "long-context"] },
  "claude-sonnet-4-5": { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", contextWindow: 200_000, maxOutput: 64_000, priceIn: 3, priceOut: 15, capabilities: ["text", "vision", "tools", "reasoning", "code", "long-context"] },
  "claude-haiku-4-5": { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", contextWindow: 200_000, maxOutput: 32_000, priceIn: 1, priceOut: 5, capabilities: ["text", "vision", "tools", "code"] },
  "claude-3-7-sonnet": { id: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet", contextWindow: 200_000, maxOutput: 64_000, priceIn: 3, priceOut: 15, capabilities: ["text", "vision", "tools", "reasoning", "code"], approx: true },
  // ── Google ──
  "gemini-2.5-pro": { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextWindow: 1_048_576, maxOutput: 65_536, priceIn: 1.25, priceOut: 10, capabilities: ["text", "vision", "tools", "json", "reasoning", "code", "audio", "long-context"] },
  "gemini-2.5-flash": { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", contextWindow: 1_048_576, maxOutput: 65_536, priceIn: 0.3, priceOut: 2.5, capabilities: ["text", "vision", "tools", "json", "audio", "long-context"] },
  "gemini-2.5-flash-lite": { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", contextWindow: 1_048_576, maxOutput: 65_536, priceIn: 0.1, priceOut: 0.4, capabilities: ["text", "vision", "tools", "json", "long-context"] },
  "gemini-2.0-flash": { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", contextWindow: 1_048_576, maxOutput: 8_192, priceIn: 0.1, priceOut: 0.4, capabilities: ["text", "vision", "tools", "json", "audio"], approx: true },
  // ── Local / rule engine ──
  "rule-engine": { id: "rule-engine", label: "Rule engine (ในระบบ)", contextWindow: 32_000, maxOutput: 4_000, priceIn: 0, priceOut: 0, capabilities: ["text", "json"], note: "ประมวลผลใน Workspace ไม่มีค่าใช้จ่าย" },
};

function guessCapabilities(id: string): Capability[] {
  const caps: Capability[] = ["text"];
  if (/gpt-4|claude|gemini|vision|vl/i.test(id)) caps.push("vision");
  if (/gpt|claude|gemini|mistral|llama|qwen|deepseek/i.test(id)) caps.push("tools", "json");
  if (/o[34]|reason|think|r1/i.test(id)) caps.push("reasoning");
  if (/code|devstral|coder/i.test(id)) caps.push("code");
  if (/1m|long/i.test(id)) caps.push("long-context");
  return caps;
}

function catalogFor(id: string, provider: AiProvider): ModelInfo {
  const key = Object.keys(CATALOG).find((k) => id === k || id.endsWith(`/${k}`) || id.startsWith(`${k}-`));
  if (key) return { ...CATALOG[key], id, provider, source: "catalog" };
  // เดาแบบระมัดระวังสำหรับโมเดลที่ไม่รู้จัก
  const free = provider === "local" || provider === "gateway";
  return {
    id,
    provider,
    label: id,
    contextWindow: 128_000,
    maxOutput: 8_192,
    priceIn: free ? 0 : 1.5,
    priceOut: free ? 0 : 6,
    capabilities: guessCapabilities(id),
    source: "catalog",
    approx: true,
    note: "ไม่พบในแคตตาล็อก — ราคาเป็นการประมาณ ควรตรวจสอบกับผู้ให้บริการ",
  };
}

const liveCache = new Map<string, { at: number; models: ModelInfo[] }>();
const CACHE_MS = 10 * 60 * 1000;

function baseUrlFor(provider: AiProvider, given?: string) {
  if (given) return given.replace(/\/$/, "");
  switch (provider) {
    case "openai": return "https://api.openai.com/v1";
    case "anthropic": return "https://api.anthropic.com/v1";
    case "google": return "https://generativelanguage.googleapis.com/v1beta";
    default: return "";
  }
}

/** ดึงรายการโมเดลจริงจากผู้ให้บริการ */
export async function fetchLiveModels(
  provider: AiProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<{ ok: boolean; models: ModelInfo[]; message: string }> {
  const cacheKey = `${provider}:${baseUrl ?? ""}`;
  const hit = liveCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, models: hit.models, message: "cache" };

  if (provider === "local" || provider === "gateway" || !apiKey) {
    return { ok: false, models: [], message: "ผู้ให้บริการนี้ใช้แคตตาล็อกภายใน" };
  }

  const base = baseUrlFor(provider, baseUrl);
  try {
    let ids: string[] = [];
    if (provider === "google") {
      const res = await fetch(`${base}/models?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return { ok: false, models: [], message: `Google ตอบกลับ ${res.status}` };
      const body = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
      ids = (body.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => (m.name ?? "").replace(/^models\//, ""))
        .filter(Boolean);
    } else if (provider === "anthropic") {
      const res = await fetch(`${base}/models?limit=100`, {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { ok: false, models: [], message: `Anthropic ตอบกลับ ${res.status}` };
      const body = (await res.json()) as { data?: { id?: string }[] };
      ids = (body.data ?? []).map((m) => m.id ?? "").filter(Boolean);
    } else {
      const res = await fetch(`${base}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { ok: false, models: [], message: `ผู้ให้บริการตอบกลับ ${res.status}` };
      const body = (await res.json()) as { data?: { id?: string }[] };
      ids = (body.data ?? []).map((m) => m.id ?? "").filter(Boolean);
    }

    const models = ids
      .filter((id) => !/embedding|moderation|whisper|tts|dall-e|image-1|rerank/i.test(id))
      .map((id) => ({ ...catalogFor(id, provider), source: "live" as const }))
      .sort((a, b) => a.priceIn - b.priceIn || a.id.localeCompare(b.id));

    if (models.length) liveCache.set(cacheKey, { at: Date.now(), models });
    return { ok: true, models, message: `พบ ${models.length} โมเดล` };
  } catch (err) {
    return { ok: false, models: [], message: (err as Error).message };
  }
}

/** รายการโมเดลสำหรับ UI: ลอง live ก่อน แล้ว fallback แคตตาล็อก */
export async function listModels(
  provider: AiProvider,
  apiKey?: string,
  baseUrl?: string,
): Promise<{ models: ModelInfo[]; live: boolean; message: string }> {
  if (provider === "local") {
    return { models: [catalogFor("rule-engine", "local")], live: false, message: "engine ภายในระบบ" };
  }
  if (provider === "gateway") {
    const id = process.env.AI_MODEL || "claude-sonnet-4-5";
    return { models: [catalogFor(id, "gateway")], live: false, message: "ใช้โมเดลจาก AI Gateway" };
  }

  const live = await fetchLiveModels(provider, apiKey ?? "", baseUrl);
  const catalog = Object.values(CATALOG)
    .filter((m) => m.id !== "rule-engine")
    .filter((m) => (provider === "openai" ? /^gpt|^o[34]|^chatgpt/.test(m.id) : provider === "anthropic" ? m.id.startsWith("claude") : provider === "google" ? m.id.startsWith("gemini") : true))
    .map((m) => ({ ...m, provider, source: "catalog" as const }));

  if (live.ok && live.models.length) {
    // รวมแคตตาล็อกที่ยังไม่มีใน live (เผื่อผู้ให้บริการตัดโมเดลเก่าออก)
    const ids = new Set(live.models.map((m) => m.id));
    return { models: [...live.models, ...catalog.filter((m) => !ids.has(m.id))], live: true, message: live.message };
  }
  return { models: catalog, live: false, message: live.message || "ใช้แคตตาล็อกภายใน" };
}

export async function getModelInfo(provider: AiProvider, modelId: string): Promise<ModelInfo> {
  const { models } = await listModels(provider);
  return models.find((m) => m.id === modelId) ?? catalogFor(modelId, provider);
}

/** ทดสอบคีย์ว่าติดต่อผู้ให้บริการได้จริง */
export async function probeProvider(provider: AiProvider, apiKey: string, baseUrl?: string): Promise<{ ok: boolean; message: string }> {
  if (provider === "local") return { ok: true, message: "engine ภายในระบบพร้อมใช้" };
  if (provider === "gateway") {
    const url = process.env.AI_GATEWAY_URL;
    return url ? { ok: true, message: `gateway: ${url}` } : { ok: false, message: "ยังไม่ได้ตั้ง AI_GATEWAY_URL" };
  }
  if (!apiKey) return { ok: false, message: "ยังไม่มี API key" };
  liveCache.delete(`${provider}:${baseUrl ?? ""}`);
  const res = await fetchLiveModels(provider, apiKey, baseUrl);
  return { ok: res.ok, message: res.ok ? `เชื่อมต่อได้ · ${res.models.length} โมเดล` : res.message };
}

/** ราคา (บาท) สำหรับจำนวน token ที่กำหนด */
export function priceFor(model: Pick<ModelInfo, "priceIn" | "priceOut">, tokensIn: number, tokensOut: number) {
  const usd = (tokensIn / 1_000_000) * model.priceIn + (tokensOut / 1_000_000) * model.priceOut;
  return { usd: Number(usd.toFixed(6)), thb: Number((usd * usdToThb()).toFixed(4)) };
}

export function modelCatalogIds() {
  return Object.keys(CATALOG);
}
