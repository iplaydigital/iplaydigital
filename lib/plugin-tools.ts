// ─────────────────────────────────────────────────────────────
//  Plugin Tools — เครื่องมือที่ใช้คู่กับงาน
//   • เก็บ “ข้อมูลเชื่อมต่อ” ปลายทาง: URL เว็บ, user login, token key, skill
//   • มี “ลิ้งสั่งงาน” (command link) ที่ AI / Python / cron เรียกเพื่อให้ทำงาน
//   • ตั้งวันที่ + เวลาที่จะให้งานออนไลน์ได้ แล้วรันอัตโนมัติเมื่อถึงกำหนด
//   • เมื่อทำงานสำเร็จ → อัปเดตสถานะงาน + แคปหน้าเว็บ + สร้างรายงานให้อัตโนมัติ
//  เก็บใน MariaDB (ws_plugin_tools) หรือ .data/plugin-tools.json
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { applyAction } from "./store";
import { createReport } from "./reports";
import { tzDate as bkkDate, tzToday as bkkToday } from "./tz";

// ── ชนิดข้อมูล ───────────────────────────────────────────────
export type ToolKind = "web-publish" | "python" | "ai" | "http" | "custom";
export type ToolSchedule = "manual" | "once" | "daily" | "weekly";
export type ToolStatus = "draft" | "ready" | "scheduled" | "running" | "done" | "failed";
export type RunTrigger = "manual" | "schedule" | "webhook";

export interface ToolStepResult {
  label: string;
  ok: boolean;
  detail: string;
  ms?: number;
}

export interface ToolCapture {
  id: string;
  at: string;
  url: string;
  statusCode: number | null;
  ok: boolean;
  title: string;
  description: string;
  /** รูปจาก og:image หรือภาพตัวอย่างที่สร้างให้ */
  imageUrl: string | null;
  /** ข้อความที่ดึงได้จากหน้าเว็บ (ตัดให้สั้น) */
  excerpt: string;
  bytes: number;
  mode: "og" | "html" | "none";
  message: string;
  reportId: string | null;
}

export interface ToolRun {
  id: string;
  at: string;
  trigger: RunTrigger;
  ok: boolean;
  message: string;
  durationMs: number;
  steps: ToolStepResult[];
  captureId: string | null;
  reportId: string | null;
  taskId: string | null;
  actorName: string | null;
}

export interface PluginTool {
  id: string;
  name: string;
  kind: ToolKind;
  description: string;
  /** เว็บปลายทาง เช่น https://www.afterklass.com/ */
  targetUrl: string;
  /** endpoint ที่ใช้ส่งงาน (ถ้าไม่ระบุ ใช้ targetUrl) */
  publishUrl: string;
  method: "POST" | "PUT" | "GET";
  contentType: string;
  headers: string;
  payload: string;
  /** หน้าล็อกอิน + บัญชีที่ใช้โพสต์ */
  loginUrl: string;
  loginUser: string;
  loginPassword: string;
  loginNote: string;
  /** token สำหรับ “ลิ้งสั่งงาน” */
  tokenKey: string;
  /** skill / AI ที่ใช้ทำงาน */
  skillId: string | null;
  agentId: string | null;
  /** งานที่จะอัปเดตสถานะเมื่อสำเร็จ */
  taskId: string | null;
  projectId: string | null;
  schedule: ToolSchedule;
  /** เวลาที่จะให้งานออนไลน์ (ISO) */
  runAt: string | null;
  nextRunAt: string | null;
  status: ToolStatus;
  enabled: boolean;
  captureEnabled: boolean;
  createReport: boolean;
  lastRunAt: string | null;
  lastMessage: string | null;
  runs: ToolRun[];
  captures: ToolCapture[];
  createdAt: string;
  updatedAt: string | null;
}

export type PluginToolPublic = Omit<PluginTool, "loginPassword"> & {
  loginPasswordMasked: string;
  loginPasswordSet: boolean;
  commandUrl: string;
  commandLink: string;
};

const FILE = path.join(process.cwd(), ".data", "plugin-tools.json");
const g = globalThis as unknown as {
  __ipwTools?: PluginTool[];
  __ipwToolsMaria?: { ok: boolean; at: number };
};

export const TOOL_KIND_META: Record<ToolKind, { label: string; color: string; hint: string; icon: string }> = {
  "web-publish": { label: "ลงเว็บ / บทความ", color: "#2F7BF0", hint: "ล็อกอินเว็บปลายทางแล้วโพสต์เนื้อหา", icon: "🌐" },
  python: { label: "Python", color: "#B4761A", hint: "รันสคริปต์ Python ตามตาราง", icon: "🐍" },
  ai: { label: "AI / Skill", color: "#7100DD", hint: "ให้ AI + skill สร้างเนื้อหาให้ก่อนส่งงาน", icon: "🤖" },
  http: { label: "HTTP API", color: "#149C74", hint: "ยิง API ปลายทางด้วย token", icon: "🔗" },
  custom: { label: "กำหนดเอง", color: "#8A8FB1", hint: "รวมหลายขั้นตอนเอง", icon: "🧩" },
};

export const TOOL_STATUS_META: Record<ToolStatus, { label: string; color: string; soft: string }> = {
  draft: { label: "ต้องกรอกข้อมูลต่อ", color: "#8A8FB1", soft: "rgba(138,143,177,.16)" },
  ready: { label: "พร้อมใช้", color: "#149C74", soft: "rgba(34,199,147,.14)" },
  scheduled: { label: "ตั้งเวลาไว้", color: "#B4761A", soft: "rgba(255,176,32,.18)" },
  running: { label: "กำลังทำงาน", color: "#2F7BF0", soft: "rgba(59,167,255,.14)" },
  done: { label: "สำเร็จ", color: "#149C74", soft: "rgba(34,199,147,.16)" },
  failed: { label: "ล้มเหลว", color: "#E23E5C", soft: "rgba(255,92,122,.16)" },
};

export const SCHEDULE_META: Record<ToolSchedule, { label: string; hint: string }> = {
  manual: { label: "สั่งเอง / ผ่านลิ้ง", hint: "ทำงานเมื่อกดรัน หรือเมื่อมีคนเรียก command link" },
  once: { label: "ครั้งเดียวตามเวลา", hint: "ทำงานครั้งเดียวเมื่อถึงวันที่ + เวลาที่ตั้ง" },
  daily: { label: "ทุกวัน", hint: "ทำงานซ้ำทุกวันในเวลาเดียวกัน" },
  weekly: { label: "ทุกสัปดาห์", hint: "ทำงานซ้ำทุกสัปดาห์ในวันและเวลาเดียวกัน" },
};

const TZ = process.env.AI_POOL_TZ || "Asia/Bangkok";

export function bkkNow() {
  return new Date();
}

/** เวลาที่ควรทำงานครั้งถัดไป (ISO) */
export function computeNextRun(
  schedule: ToolSchedule,
  runAt: string | null,
  from = new Date(),
): string | null {
  if (schedule === "manual" || !runAt) return null;
  const base = new Date(runAt);
  if (Number.isNaN(base.getTime())) return null;
  // ครั้งเดียว: ถ้าเลยเวลาไปแล้วให้ถือว่า “ถึงกำหนดทันที” (กันงานค้างเมื่อเซิร์ฟเวอร์ปิดตอนถึงเวลา)
  if (schedule === "once") return base.toISOString();
  if (base.getTime() > from.getTime()) return base.toISOString();
  const step = schedule === "weekly" ? 7 * 86400_000 : 86400_000;
  let next = base.getTime() + step;
  // ข้ามไปข้างหน้าจนเลยเวลาปัจจุบัน (กันตารางค้างนาน)
  let guard = 0;
  while (next <= from.getTime() && guard < 400) {
    next += step;
    guard += 1;
  }
  return new Date(next).toISOString();
}

function mask(secret: string) {
  if (!secret) return "";
  if (secret.length <= 6) return "••••";
  return `${secret.slice(0, 2)}••••${secret.slice(-2)}`;
}

function token() {
  return `pt_${crypto.randomBytes(12).toString("hex")}`;
}

function cmdUrl(t: PluginTool) {
  return `/api/plugin-tools/hook/${t.tokenKey}`;
}

export function toPublicTool(t: PluginTool): PluginToolPublic {
  const { loginPassword, ...rest } = t;
  return {
    ...rest,
    loginPasswordMasked: mask(loginPassword),
    loginPasswordSet: Boolean(loginPassword),
    commandUrl: cmdUrl(t),
    commandLink: `POST ${cmdUrl(t)}?key=${t.tokenKey}`,
  };
}

// ── ที่เก็บข้อมูล ────────────────────────────────────────────
function readFile(): PluginTool[] {
  if (g.__ipwTools) return g.__ipwTools;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as { tools?: PluginTool[] } | PluginTool[];
      const list = Array.isArray(raw) ? raw : raw.tools ?? [];
      if (Array.isArray(list)) {
        g.__ipwTools = list;
        return list;
      }
    }
  } catch {
    /* ignore */
  }
  const seeded = seedTools();
  writeFile(seeded);
  return seeded;
}

function writeFile(rows: PluginTool[]) {
  g.__ipwTools = rows;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ tools: rows }, null, 2));
  } catch {
    /* read-only */
  }
}

function seedTools(): PluginTool[] {
  const now = new Date().toISOString();
  const at = (daysFromNow: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  return [
    {
      id: "tl_afterklass",
      name: "ลงบทความ Afterklass",
      kind: "web-publish",
      description: "เขียนบทความด้วย skill คอนเทนต์ → ล็อกอิน Afterklass → เผยแพร่ → แคปหน้าเว็บเก็บเป็นรายงาน",
      targetUrl: "https://www.afterklass.com/",
      publishUrl: "",
      method: "POST",
      contentType: "application/json",
      headers: '{\n  "authorization": "Bearer {{token}}"\n}',
      payload: '{\n  "title": "{{title}}",\n  "body": "{{summary}}",\n  "publishAt": "{{runAt}}"\n}',
      loginUrl: "https://www.afterklass.com/login",
      loginUser: "editor@playdigital.co.th",
      loginPassword: "",
      loginNote: "บัญชีผู้เขียนของทีม — ใส่รหัสผ่านจริงก่อนใช้งานครั้งแรก",
      tokenKey: "pt_afterklass_demo",
      skillId: "sk_content",
      agentId: "ai_pixel",
      taskId: null,
      projectId: "p_playwall",
      schedule: "once",
      runAt: at(1, 10),
      nextRunAt: at(1, 10),
      status: "draft",
      enabled: true,
      captureEnabled: true,
      createReport: true,
      lastRunAt: null,
      lastMessage: null,
      runs: [],
      captures: [],
      createdAt: now,
      updatedAt: null,
    },
    {
      id: "tl_python_report",
      name: "Python สรุปรายงานรายวัน",
      kind: "python",
      description: "รันสคริปต์สรุปยอดงาน/คอนเทนต์ทุกเช้า แล้วแคปแดชบอร์ดเก็บเป็นรายงาน",
      targetUrl: "",
      publishUrl: "",
      method: "POST",
      contentType: "application/json",
      headers: "{}",
      payload: '{ "script": "scripts/daily_report.py", "date": "{{date}}" }',
      loginUrl: "",
      loginUser: "",
      loginPassword: "",
      loginNote: "",
      tokenKey: "pt_python_demo",
      skillId: "sk_python_report",
      agentId: "ai_orbit",
      taskId: null,
      projectId: "p_erp",
      schedule: "daily",
      runAt: at(0, 9),
      nextRunAt: computeNextRun("daily", at(0, 9)),
      status: "ready",
      enabled: true,
      captureEnabled: false,
      createReport: true,
      lastRunAt: null,
      lastMessage: null,
      runs: [],
      captures: [],
      createdAt: now,
      updatedAt: null,
    },
  ];
}

// ── MariaDB ─────────────────────────────────────────────────
async function maria() {
  if (!process.env.DB_HOST) return null;
  const st = g.__ipwToolsMaria;
  if (st && !st.ok && Date.now() - st.at < 60_000) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_plugin_tools (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      kind VARCHAR(24) NOT NULL,
      description TEXT NULL,
      target_url TEXT NULL,
      publish_url TEXT NULL,
      method VARCHAR(8) NOT NULL DEFAULT 'POST',
      content_type VARCHAR(120) NULL,
      headers TEXT NULL,
      payload MEDIUMTEXT NULL,
      login_url TEXT NULL,
      login_user VARCHAR(200) NULL,
      login_password TEXT NULL,
      login_note TEXT NULL,
      token_key VARCHAR(80) NOT NULL,
      skill_id VARCHAR(40) NULL,
      agent_id VARCHAR(40) NULL,
      task_id VARCHAR(40) NULL,
      project_id VARCHAR(40) NULL,
      schedule VARCHAR(16) NOT NULL DEFAULT 'manual',
      run_at VARCHAR(40) NULL,
      next_run_at VARCHAR(40) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      enabled TINYINT NOT NULL DEFAULT 1,
      capture_enabled TINYINT NOT NULL DEFAULT 1,
      create_report TINYINT NOT NULL DEFAULT 1,
      last_run_at VARCHAR(40) NULL,
      last_message TEXT NULL,
      runs JSON NULL,
      captures JSON NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NULL,
      UNIQUE KEY uk_token (token_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    g.__ipwToolsMaria = { ok: true, at: Date.now() };
    return p;
  } catch {
    g.__ipwToolsMaria = { ok: false, at: Date.now() };
    return null;
  }
}

function jsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToTool(r: Record<string, unknown>): PluginTool {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    kind: (String(r.kind ?? "custom") as ToolKind),
    description: String(r.description ?? ""),
    targetUrl: String(r.target_url ?? ""),
    publishUrl: String(r.publish_url ?? ""),
    method: (String(r.method ?? "POST") as PluginTool["method"]),
    contentType: String(r.content_type ?? "application/json"),
    headers: String(r.headers ?? "{}"),
    payload: String(r.payload ?? ""),
    loginUrl: String(r.login_url ?? ""),
    loginUser: String(r.login_user ?? ""),
    loginPassword: String(r.login_password ?? ""),
    loginNote: String(r.login_note ?? ""),
    tokenKey: String(r.token_key ?? ""),
    skillId: (r.skill_id as string | null) ?? null,
    agentId: (r.agent_id as string | null) ?? null,
    taskId: (r.task_id as string | null) ?? null,
    projectId: (r.project_id as string | null) ?? null,
    schedule: (String(r.schedule ?? "manual") as ToolSchedule),
    runAt: (r.run_at as string | null) ?? null,
    nextRunAt: (r.next_run_at as string | null) ?? null,
    status: (String(r.status ?? "draft") as ToolStatus),
    enabled: Boolean(Number(r.enabled ?? 1)),
    captureEnabled: Boolean(Number(r.capture_enabled ?? 1)),
    createReport: Boolean(Number(r.create_report ?? 1)),
    lastRunAt: (r.last_run_at as string | null) ?? null,
    lastMessage: (r.last_message as string | null) ?? null,
    runs: jsonArray<ToolRun>(r.runs),
    captures: jsonArray<ToolCapture>(r.captures),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

async function persist(t: PluginTool) {
  const p = await maria();
  if (p) {
    try {
      await p.query(
        `INSERT INTO ws_plugin_tools
         (id,name,kind,description,target_url,publish_url,method,content_type,headers,payload,
          login_url,login_user,login_password,login_note,token_key,skill_id,agent_id,task_id,project_id,
          schedule,run_at,next_run_at,status,enabled,capture_enabled,create_report,last_run_at,last_message,
          runs,captures,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
          name=VALUES(name), kind=VALUES(kind), description=VALUES(description), target_url=VALUES(target_url),
          publish_url=VALUES(publish_url), method=VALUES(method), content_type=VALUES(content_type), headers=VALUES(headers),
          payload=VALUES(payload), login_url=VALUES(login_url), login_user=VALUES(login_user), login_password=VALUES(login_password),
          login_note=VALUES(login_note), token_key=VALUES(token_key), skill_id=VALUES(skill_id), agent_id=VALUES(agent_id),
          task_id=VALUES(task_id), project_id=VALUES(project_id), schedule=VALUES(schedule), run_at=VALUES(run_at),
          next_run_at=VALUES(next_run_at), status=VALUES(status), enabled=VALUES(enabled), capture_enabled=VALUES(capture_enabled),
          create_report=VALUES(create_report), last_run_at=VALUES(last_run_at), last_message=VALUES(last_message),
          runs=VALUES(runs), captures=VALUES(captures), updated_at=VALUES(updated_at)`,
        [
          t.id, t.name, t.kind, t.description, t.targetUrl, t.publishUrl, t.method, t.contentType, t.headers, t.payload,
          t.loginUrl, t.loginUser, t.loginPassword, t.loginNote, t.tokenKey, t.skillId, t.agentId, t.taskId, t.projectId,
          t.schedule, t.runAt, t.nextRunAt, t.status, t.enabled ? 1 : 0, t.captureEnabled ? 1 : 0, t.createReport ? 1 : 0,
          t.lastRunAt, t.lastMessage, JSON.stringify(t.runs.slice(0, 40)), JSON.stringify(t.captures.slice(0, 12)),
          t.createdAt, t.updatedAt,
        ],
      );
      return;
    } catch {
      /* fall through to file */
    }
  }
  const rows = readFile().filter((x) => x.id !== t.id);
  writeFile([t, ...rows]);
}

export async function listTools(): Promise<PluginTool[]> {
  const p = await maria();
  if (p) {
    try {
      const [rows] = (await p.query("SELECT * FROM ws_plugin_tools ORDER BY created_at DESC")) as unknown as [
        Record<string, unknown>[],
      ];
      if (rows.length) return rows.map(rowToTool);
    } catch {
      /* fall through */
    }
  }
  return readFile();
}

export async function getTool(id: string): Promise<PluginTool | null> {
  return (await listTools()).find((t) => t.id === id) ?? null;
}

export async function findByToken(tokenKey: string): Promise<PluginTool | null> {
  if (!tokenKey) return null;
  return (await listTools()).find((t) => t.tokenKey === tokenKey) ?? null;
}

export interface ToolInput {
  id?: string;
  name?: string;
  kind?: ToolKind;
  description?: string;
  targetUrl?: string;
  publishUrl?: string;
  method?: PluginTool["method"];
  contentType?: string;
  headers?: string;
  payload?: string;
  loginUrl?: string;
  loginUser?: string;
  loginPassword?: string;
  loginNote?: string;
  skillId?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  schedule?: ToolSchedule;
  runAt?: string | null;
  enabled?: boolean;
  captureEnabled?: boolean;
  createReport?: boolean;
  rotateToken?: boolean;
}

function cleanUrl(url: string) {
  const v = (url || "").trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) return `https://${v}`;
  return v;
}

function statusFor(t: PluginTool): ToolStatus {
  if (!t.enabled) return "draft";
  if (t.kind === "web-publish" && (!t.targetUrl || !t.loginUser)) return "draft";
  if (t.nextRunAt) return "scheduled";
  return "ready";
}

export async function saveTool(input: ToolInput): Promise<PluginTool> {
  const all = await listTools();
  const now = new Date().toISOString();
  const existing = input.id ? all.find((t) => t.id === input.id) ?? null : null;

  const base: PluginTool = existing ?? {
    id: `tl_${crypto.randomBytes(4).toString("hex")}`,
    name: "",
    kind: "web-publish",
    description: "",
    targetUrl: "",
    publishUrl: "",
    method: "POST",
    contentType: "application/json",
    headers: "{}",
    payload: "",
    loginUrl: "",
    loginUser: "",
    loginPassword: "",
    loginNote: "",
    tokenKey: token(),
    skillId: null,
    agentId: null,
    taskId: null,
    projectId: null,
    schedule: "manual",
    runAt: null,
    nextRunAt: null,
    status: "draft",
    enabled: true,
    captureEnabled: true,
    createReport: true,
    lastRunAt: null,
    lastMessage: null,
    runs: [],
    captures: [],
    createdAt: now,
    updatedAt: null,
  };

  const next: PluginTool = {
    ...base,
    name: (input.name ?? base.name).trim() || "เครื่องมือใหม่",
    kind: input.kind ?? base.kind,
    description: input.description ?? base.description,
    targetUrl: cleanUrl(input.targetUrl ?? base.targetUrl),
    publishUrl: cleanUrl(input.publishUrl ?? base.publishUrl),
    method: input.method ?? base.method,
    contentType: input.contentType ?? base.contentType,
    headers: input.headers ?? base.headers,
    payload: input.payload ?? base.payload,
    loginUrl: cleanUrl(input.loginUrl ?? base.loginUrl),
    loginUser: (input.loginUser ?? base.loginUser).trim(),
    loginPassword: input.loginPassword ? input.loginPassword : base.loginPassword,
    loginNote: input.loginNote ?? base.loginNote,
    tokenKey: input.rotateToken ? token() : base.tokenKey || token(),
    skillId: input.skillId !== undefined ? input.skillId : base.skillId,
    agentId: input.agentId !== undefined ? input.agentId : base.agentId,
    taskId: input.taskId !== undefined ? input.taskId : base.taskId,
    projectId: input.projectId !== undefined ? input.projectId : base.projectId,
    schedule: input.schedule ?? base.schedule,
    runAt: input.runAt !== undefined ? input.runAt : base.runAt,
    enabled: input.enabled ?? base.enabled,
    captureEnabled: input.captureEnabled ?? base.captureEnabled,
    createReport: input.createReport ?? base.createReport,
    updatedAt: now,
  };

  next.nextRunAt = computeNextRun(next.schedule, next.runAt);
  next.status = statusFor(next);
  await persist(next);
  return next;
}

export async function deleteTool(id: string): Promise<boolean> {
  const p = await maria();
  if (p) {
    try {
      await p.query("DELETE FROM ws_plugin_tools WHERE id=?", [id]);
      return true;
    } catch {
      /* fall through */
    }
  }
  writeFile(readFile().filter((t) => t.id !== id));
  return true;
}

export async function setSchedule(
  id: string,
  patch: { schedule?: ToolSchedule; runAt?: string | null; enabled?: boolean },
): Promise<PluginTool | null> {
  const t = await getTool(id);
  if (!t) return null;
  const next: PluginTool = {
    ...t,
    schedule: patch.schedule ?? t.schedule,
    runAt: patch.runAt !== undefined ? patch.runAt : t.runAt,
    enabled: patch.enabled !== undefined ? patch.enabled : t.enabled,
    updatedAt: new Date().toISOString(),
  };
  next.nextRunAt = computeNextRun(next.schedule, next.runAt);
  next.status = statusFor(next);
  await persist(next);
  return next;
}

// ── แคปหน้าเว็บ ─────────────────────────────────────────────
export interface CaptureResult {
  ok: boolean;
  statusCode: number | null;
  title: string;
  description: string;
  imageUrl: string | null;
  excerpt: string;
  bytes: number;
  mode: "og" | "html" | "none";
  message: string;
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function metaContent(html: string, key: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i");
  return (html.match(re)?.[1] ?? html.match(alt)?.[1] ?? "").trim();
}

function textOf(html: string, limit = 600) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = decodeEntities(body.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, limit);
}

/** ภาพตัวอย่างแบบ “หน้าต่างเบราว์เซอร์” สำหรับใช้ในรายงานเมื่อเว็บไม่มี og:image */
export function makeThumbSvg(title: string, host: string, note: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = [esc(title.slice(0, 58)), esc((title.length > 58 ? title.slice(58, 116) : ""))].filter(Boolean);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#7100DD"/><stop offset="1" stop-color="#2F7BF0"/></linearGradient></defs>
<rect width="800" height="450" fill="#F6F4FF"/>
<rect width="800" height="54" fill="#FFFFFF"/>
<circle cx="26" cy="27" r="6" fill="#FF6B6B"/><circle cx="48" cy="27" r="6" fill="#FFB020"/><circle cx="70" cy="27" r="6" fill="#22C793"/>
<rect x="96" y="17" width="420" height="20" rx="10" fill="#F1EEFA"/>
<text x="112" y="32" font-family="Prompt, sans-serif" font-size="12" fill="#8A8FB1">${esc(host)}</text>
<rect x="0" y="54" width="800" height="140" fill="url(#g)"/>
<text x="40" y="112" font-family="Prompt, sans-serif" font-size="26" fill="#FFFFFF" font-weight="600">${lines[0] ?? ""}</text>
<text x="40" y="146" font-family="Prompt, sans-serif" font-size="20" fill="#EDE4FF">${lines[1] ?? ""}</text>
<rect x="40" y="224" width="720" height="12" rx="6" fill="#E7E1F8"/>
<rect x="40" y="250" width="660" height="12" rx="6" fill="#EDE9FA"/>
<rect x="40" y="276" width="700" height="12" rx="6" fill="#EDE9FA"/>
<rect x="40" y="302" width="480" height="12" rx="6" fill="#EDE9FA"/>
<rect x="40" y="346" width="180" height="40" rx="12" fill="#7100DD"/>
<text x="66" y="372" font-family="Prompt, sans-serif" font-size="14" fill="#FFFFFF">capture · ${esc(note.slice(0, 22))}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function capturePage(url: string): Promise<CaptureResult> {
  const target = cleanUrl(url);
  if (!target) {
    return { ok: false, statusCode: null, title: "", description: "", imageUrl: null, excerpt: "", bytes: 0, mode: "none", message: "ยังไม่ได้ใส่ URL ของเว็บที่ต้องการแคป" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; iPlayWorkspace/1.0; +https://playdigital.co.th)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "th,en;q=0.8",
      },
    });
    const html = await res.text();
    const bytes = Buffer.byteLength(html);
    const title =
      metaContent(html, "og:title") ||
      decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() ||
      new URL(target).host;
    const description = metaContent(html, "og:description") || metaContent(html, "description");
    const og = metaContent(html, "og:image");
    let imageUrl: string | null = null;
    if (og) {
      try {
        imageUrl = new URL(og, target).toString();
      } catch {
        imageUrl = null;
      }
    }
    const host = (() => {
      try {
        return new URL(target).host;
      } catch {
        return target;
      }
    })();
    if (!imageUrl) imageUrl = makeThumbSvg(title, host, `${res.status}`);

    return {
      ok: res.ok,
      statusCode: res.status,
      title: title.slice(0, 200),
      description: description.slice(0, 400),
      imageUrl,
      excerpt: textOf(html),
      bytes,
      mode: og ? "og" : "html",
      message: `HTTP ${res.status} · ${(bytes / 1024).toFixed(1)} KB${og ? " · พบ og:image" : ""}`,
    };
  } catch (err) {
    const message = (err as Error).name === "AbortError" ? "หมดเวลารอเว็บปลายทาง (15s)" : (err as Error).message;
    return { ok: false, statusCode: null, title: "", description: "", imageUrl: null, excerpt: "", bytes: 0, mode: "none", message: `แคปไม่สำเร็จ: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── รันงาน ──────────────────────────────────────────────────
export interface RunOptions {
  trigger?: RunTrigger;
  actorName?: string | null;
  note?: string | null;
}

export interface RunOutcome {
  ok: boolean;
  message: string;
  run: ToolRun;
  tool: PluginTool;
}

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

export async function runTool(id: string, opts: RunOptions = {}): Promise<RunOutcome | null> {
  const tool = await getTool(id);
  if (!tool) return null;
  const startedAt = Date.now();
  const trigger: RunTrigger = opts.trigger ?? "manual";
  const steps: ToolStepResult[] = [];
  const nowIso = new Date().toISOString();

  // 1) ตรวจความพร้อมของข้อมูลเชื่อมต่อ
  const missing: string[] = [];
  if (tool.kind === "web-publish") {
    if (!tool.targetUrl) missing.push("URL เว็บปลายทาง");
    if (!tool.loginUser) missing.push("user login");
  }
  steps.push({
    label: "ตรวจข้อมูลเชื่อมต่อ",
    ok: missing.length === 0,
    detail: missing.length ? `ยังขาด: ${missing.join(", ")}` : `${TOOL_KIND_META[tool.kind].label} · พร้อมทำงาน`,
  });

  let capture: ToolCapture | null = null;
  let reportId: string | null = null;
  let published = false;
  let publishMessage = "";

  // 2) ล็อกอิน (ตรวจปลายทางล็อกอินว่าตอบสนอง)
  if (tool.loginUrl) {
    const loginProbe = await fetch(tool.loginUrl, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; iPlayWorkspace/1.0)" },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
    steps.push({
      label: "ล็อกอินเว็บปลายทาง",
      ok: Boolean(loginProbe?.ok),
      detail: loginProbe
        ? `${tool.loginUser || "(ไม่ระบุผู้ใช้)"} · HTTP ${loginProbe.status}`
        : "เชื่อมหน้าล็อกอินไม่ได้ (ตรวจ URL / เครือข่าย)",
    });
  }

  // 3) ส่งงานไปปลายทาง (ถ้ามี URL สำหรับโพสต์)
  if (tool.publishUrl) {
    const vars: Record<string, string> = {
      token: tool.tokenKey,
      date: nowIso.slice(0, 10),
      runAt: tool.runAt ?? nowIso,
      title: tool.name,
      summary: tool.description,
      tool: tool.name,
    };
    let headers: Record<string, string> = { "content-type": tool.contentType || "application/json" };
    try {
      const parsed = JSON.parse(tool.headers || "{}") as Record<string, string>;
      headers = { ...headers, ...parsed };
    } catch {
      steps.push({ label: "อ่าน headers", ok: false, detail: "headers ต้องเป็น JSON" });
    }
    Object.keys(headers).forEach((k) => {
      headers[k] = renderTemplate(String(headers[k]), vars);
    });
    const body = tool.method === "GET" ? undefined : renderTemplate(tool.payload || "{}", vars);
    try {
      const res = await fetch(tool.publishUrl, {
        method: tool.method,
        headers,
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const text = await res.text().catch(() => "");
      published = res.ok;
      publishMessage = `HTTP ${res.status}${text ? ` · ${text.slice(0, 160)}` : ""}`;
      steps.push({ label: "ส่งงานไปปลายทาง", ok: res.ok, detail: publishMessage });
    } catch (err) {
      publishMessage = (err as Error).message;
      steps.push({ label: "ส่งงานไปปลายทาง", ok: false, detail: `ส่งไม่สำเร็จ: ${publishMessage}` });
    }
  } else {
    steps.push({
      label: "ส่งงานไปปลายทาง",
      ok: true,
      detail: "ยังไม่ได้ตั้ง URL สำหรับโพสต์ — โหมดเตรียมเนื้อหา (ส่งผ่านลิ้งสั่งงาน/สคริปต์ปลายทางได้)",
    });
  }

  // 4) แคปหน้าเว็บ
  const captureTarget = tool.targetUrl || tool.publishUrl;
  if (tool.captureEnabled && captureTarget) {
    const result = await capturePage(captureTarget);
    capture = {
      id: `cap_${crypto.randomBytes(4).toString("hex")}`,
      at: new Date().toISOString(),
      url: captureTarget,
      statusCode: result.statusCode,
      ok: result.ok,
      title: result.title,
      description: result.description,
      imageUrl: result.imageUrl,
      excerpt: result.excerpt,
      bytes: result.bytes,
      mode: result.mode,
      message: result.message,
      reportId: null,
    };
    steps.push({ label: "แคปหน้าเว็บ", ok: result.ok, detail: result.message });
  }

  // 5) สร้างรายงานอัตโนมัติ (ต้องมีแคปที่สำเร็จ หรือตั้งใจให้เป็นรายงานแบบข้อความ)
  const reportReady = capture ? capture.ok : !tool.captureEnabled;
  if (tool.createReport && reportReady) {
    try {
      const report = await createReport({
        title: `รายงานอัตโนมัติ · ${tool.name}`,
        period: new Date().toISOString().slice(0, 7),
        projectId: tool.projectId ?? null,
        authorId: tool.agentId || "ai_nova",
        authorName: `${tool.name} (Plugin Tool)`,
        status: "submitted",
        summary: [
          capture?.title ? `หน้าเว็บ: ${capture.title}` : `เครื่องมือ: ${tool.name} (${TOOL_KIND_META[tool.kind].label})`,
          capture?.description ?? "",
          capture?.excerpt ? `เนื้อหาที่พบ: ${capture.excerpt.slice(0, 240)}` : "",
          `ผลการทำงาน: ${capture?.message ?? "ทำงานตามกำหนดเวลา"}`,
          published ? `ส่งงานขึ้นเว็บแล้ว: ${publishMessage}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        driveUrl: capture?.url || tool.targetUrl || tool.publishUrl,
        attachments: capture?.imageUrl
          ? [{ id: `at_${Date.now()}`, name: "หน้าเว็บที่แคป", url: capture.imageUrl, mime: "image/*" }]
          : [],
      });
      reportId = report.id;
      if (capture) capture.reportId = report.id;
      steps.push({ label: "สร้างรายงาน", ok: true, detail: `รายงาน ${report.code} · ${report.title}` });
    } catch (err) {
      steps.push({ label: "สร้างรายงาน", ok: false, detail: `สร้างรายงานไม่สำเร็จ: ${(err as Error).message}` });
    }
  } else if (tool.createReport && capture && !capture.ok) {
    steps.push({
      label: "สร้างรายงาน",
      ok: false,
      detail: "ข้ามการสร้างรายงาน — แคปหน้าเว็บไม่สำเร็จ (ไม่มีหลักฐานหน้าเว็บ)",
    });
  }

  // 6) อัปเดตสถานะงาน
  if (tool.taskId) {
    try {
      await applyAction({ type: "task.update", id: tool.taskId, patch: { status: "done", progress: 100 } });
      await applyAction({
        type: "task.comment",
        id: tool.taskId,
        authorId: tool.agentId || "ai_nova",
        text: `✅ Plugin Tool “${tool.name}” ทำงานสำเร็จ (${trigger === "schedule" ? "ตามกำหนดเวลา" : trigger === "webhook" ? "ผ่านลิ้งสั่งงาน" : "สั่งเอง"})` +
          (reportId ? ` · สร้างรายงานแล้ว (${reportId})` : "") +
          (capture ? ` · ${capture.message}` : ""),
      });
      steps.push({ label: "อัปเดตสถานะงาน", ok: true, detail: "ตั้งงานเป็น “เสร็จสิ้น” + คอมเมนต์หลักฐานในงาน" });
    } catch (err) {
      steps.push({ label: "อัปเดตสถานะงาน", ok: false, detail: `อัปเดตงานไม่สำเร็จ: ${(err as Error).message}` });
    }
  }

  // ขั้นที่ถือว่า “งานไม่สำเร็จ”: ข้อมูลเชื่อมต่อไม่ครบ, เข้าเว็บปลายทางไม่ได้, ส่งงานไม่ผ่าน
  const critical = steps.filter(
    (s) => !s.ok && /ตรวจข้อมูลเชื่อมต่อ|ส่งงานไปปลายทาง|ล็อกอินเว็บปลายทาง/.test(s.label),
  );
  const ok = missing.length === 0 && critical.length === 0;
  const warnings = steps.filter((s) => !s.ok).map((s) => `${s.label}: ${s.detail}`);
  const message = ok
    ? `ทำงานสำเร็จ${published ? " · ส่งงานขึ้นเว็บแล้ว" : ""}${capture?.ok ? ` · ${capture.message}` : ""}${reportId ? " · มีรายงานแล้ว" : ""}${warnings.length ? ` · ข้อสังเกต: ${warnings.join(" · ")}` : ""}`
    : `ยังไม่สำเร็จ: ${critical.map((s) => `${s.label} (${s.detail})`).join(" · ")}`;

  const run: ToolRun = {
    id: `run_${crypto.randomBytes(4).toString("hex")}`,
    at: nowIso,
    trigger,
    ok,
    message,
    durationMs: Date.now() - startedAt,
    steps,
    captureId: capture?.id ?? null,
    reportId,
    taskId: tool.taskId,
    actorName: opts.actorName ?? null,
  };

  const next: PluginTool = {
    ...tool,
    status: ok ? "done" : "failed",
    lastRunAt: run.at,
    lastMessage: message,
    nextRunAt: tool.schedule === "once" ? null : computeNextRun(tool.schedule, tool.runAt),
    updatedAt: new Date().toISOString(),
    runs: [run, ...tool.runs].slice(0, 40),
    captures: capture ? [capture, ...tool.captures].slice(0, 12) : tool.captures,
  };
  if (next.schedule === "manual" || next.schedule === "once") {
    // งานครั้งเดียว/สั่งเอง ไม่ต้องค้างสถานะ scheduled
    next.status = ok ? "done" : "failed";
  } else if (next.nextRunAt) {
    next.status = ok ? "ready" : "failed";
  }
  await persist(next);
  return { ok, message, run, tool: next };
}

/** ประมวลผลงานที่ถึงกำหนดเวลา (เรียกจากหน้าเว็บหรือ cron) */
export async function processDueTools(limit = 3): Promise<{ ran: RunOutcome[]; due: number }> {
  const all = await listTools();
  const now = Date.now();
  const due = all.filter(
    (t) => t.enabled && t.schedule !== "manual" && t.nextRunAt && new Date(t.nextRunAt).getTime() <= now,
  );
  const ran: RunOutcome[] = [];
  for (const t of due.slice(0, limit)) {
    const outcome = await runTool(t.id, { trigger: "schedule", actorName: "ระบบตั้งเวลา" });
    if (outcome) ran.push(outcome);
  }
  return { ran, due: due.length };
}

/** สรุปภาพรวมสำหรับ KPI */
export function toolSummary(tools: PluginTool[]) {
  const runs = tools.flatMap((t) => t.runs);
  const today = bkkDate(new Date());
  const runsToday = runs.filter((r) => bkkDate(r.at) === today);
  const okRuns = runs.filter((r) => r.ok).length;
  const scheduled = tools.filter((t) => t.enabled && t.nextRunAt).length;
  const upcoming = tools
    .filter((t) => t.enabled && t.nextRunAt)
    .map((t) => ({ id: t.id, name: t.name, nextRunAt: t.nextRunAt as string }))
    .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
    .slice(0, 5);
  return {
    tools: tools.length,
    enabled: tools.filter((t) => t.enabled).length,
    scheduled,
    captures: tools.reduce((s, t) => s + t.captures.length, 0),
    runsToday: runsToday.length,
    runsTodayOk: runsToday.filter((r) => r.ok).length,
    totalRuns: runs.length,
    successRate: runs.length ? Math.round((okRuns / runs.length) * 100) : 0,
    nextRunAt: upcoming[0]?.nextRunAt ?? null,
    upcoming,
    timezone: TZ,
  };
}

export function summarizeForPrompt(tool: PluginTool) {
  return `${tool.name} (${TOOL_KIND_META[tool.kind].label}) → ${tool.targetUrl || "internal"}${tool.skillId ? ` · skill ${tool.skillId}` : ""}`;
}
