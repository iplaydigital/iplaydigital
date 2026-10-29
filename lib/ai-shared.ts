// ─────────────────────────────────────────────────────────────
//  ค่าคงที่ที่ใช้ร่วมกันทั้ง server และ client (ไม่ import อะไรเลย)
// ─────────────────────────────────────────────────────────────

export type AiProvider = "local" | "openai" | "anthropic" | "google" | "custom" | "gateway";

export const PROVIDERS: { key: AiProvider; label: string; baseUrl: string; model: string; hint: string }[] = [
  { key: "local", label: "ในระบบ (rule engine)", baseUrl: "", model: "", hint: "ใช้ข้อมูล Workspace ตอบเอง ไม่มีค่าใช้จ่าย" },
  { key: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", hint: "คีย์ขึ้นต้น sk-…" },
  { key: "anthropic", label: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5", hint: "คีย์ขึ้นต้น sk-ant-…" },
  { key: "google", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", hint: "API key จาก Google AI Studio" },
  { key: "custom", label: "OpenAI-compatible (อื่น ๆ)", baseUrl: "", model: "", hint: "OpenRouter / Typhoon / Ollama / vLLM" },
  { key: "gateway", label: "AI Gateway ของบริษัท", baseUrl: "", model: "", hint: "ใช้ AI_GATEWAY_URL + AI_GATEWAY_KEY" },
];

export type Capability = "text" | "vision" | "tools" | "json" | "reasoning" | "code" | "audio" | "image" | "long-context";

export const CAPABILITY_META: Record<Capability, { label: string; icon: string }> = {
  text: { label: "ข้อความ", icon: "💬" },
  vision: { label: "ดูภาพ", icon: "👁" },
  tools: { label: "เรียกเครื่องมือ", icon: "🛠" },
  json: { label: "JSON mode", icon: "🧩" },
  reasoning: { label: "คิดวิเคราะห์", icon: "🧠" },
  code: { label: "เขียนโค้ด", icon: "⌨️" },
  audio: { label: "เสียง", icon: "🔊" },
  image: { label: "สร้างภาพ", icon: "🎨" },
  "long-context": { label: "บริบทใหญ่", icon: "📚" },
};

export type SkillRuntime = "prompt" | "python" | "node" | "http" | "mcp";
export type SkillKind = "skill" | "plugin";

export const RUNTIME_META: Record<SkillRuntime, { label: string; color: string; hint: string }> = {
  prompt: { label: "Prompt", color: "#7100DD", hint: "ใช้คำสั่ง/เทมเพลตกับโมเดลโดยตรง" },
  python: { label: "Python", color: "#2F7BF0", hint: "รันสคริปต์ผ่าน worker (ต้องมี Python runtime)" },
  node: { label: "Node.js", color: "#149C74", hint: "รันสคริปต์ JS/TS ผ่าน worker (Node runtime)" },
  http: { label: "HTTP API", color: "#B4761A", hint: "เรียก endpoint ภายนอก" },
  mcp: { label: "MCP", color: "#D6337A", hint: "เรียกเครื่องมือผ่าน MCP server" },
};

export type KeyStatus = "active" | "exhausted" | "waiting" | "disabled" | "error";

export const KEY_STATUS_META: Record<KeyStatus, { label: string; color: string; soft: string }> = {
  active: { label: "พร้อมใช้", color: "#149C74", soft: "rgba(34,199,147,.14)" },
  exhausted: { label: "โควต้าหมด", color: "#D6337A", soft: "rgba(255,107,157,.16)" },
  waiting: { label: "รอรีเซ็ต", color: "#B4761A", soft: "rgba(255,176,32,.18)" },
  disabled: { label: "ปิดใช้งาน", color: "#8A8FB1", soft: "rgba(138,143,177,.16)" },
  error: { label: "เชื่อมต่อผิดพลาด", color: "#E23E5C", soft: "rgba(255,92,122,.16)" },
};

/** ย่อตัวเลข token ให้อ่านง่าย */
export function shortTokens(n: number) {
  if (!Number.isFinite(n)) return "ไม่จำกัด";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function thb(n: number, digits = 2) {
  return `฿${Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
