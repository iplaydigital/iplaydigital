// ─────────────────────────────────────────────────────────────
//  LINE Official Account (Messaging API)
//   • รับข้อความเข้า (webhook) พร้อมตรวจ signature
//   • ส่งข้อความออก (push) ไปหาผู้ใช้ หรือกลุ่ม LINE
//   • ผูกช่องแชทใน Workspace เข้ากับ LINE group/user เพื่อรับ–ส่งต่อ
//   • เก็บ access token ในหน้า Super Admin (ตาราง ws_oauth)
// ─────────────────────────────────────────────────────────────
import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface LineSettings {
  channelSecret: string;
  accessToken: string;
  /** LINE Login Channel ID (ใช้ login) */
  loginChannelId: string;
  botBasicId: string;
}

export interface LineBinding {
  id: string;
  channelId: string;
  targetId: string;
  targetType: "group" | "room" | "user";
  label?: string;
  createdAt: string;
  createdBy?: string;
}

export interface LineInboxMessage {
  id: string;
  at: string;
  type: "text" | "image" | "sticker" | "file" | "other" | "follow" | "unfollow" | "join" | "leave";
  text?: string;
  userId?: string;
  groupId?: string;
  roomId?: string;
  replyToken?: string;
  channelId?: string | null;
  profileName?: string;
}

const BIND_FILE = path.join(process.cwd(), ".data", "line-bindings.json");
const INBOX_FILE = path.join(process.cwd(), ".data", "line-inbox.json");

const g = globalThis as unknown as {
  __ipwLineBindings?: LineBinding[];
  __ipwLineInbox?: LineInboxMessage[];
};

function readJson<T>(file: string, key: "__ipwLineBindings" | "__ipwLineInbox", fallback: T[]): T[] {
  const cached = g[key] as T[] | undefined;
  if (cached) return cached;
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as T[];
      if (Array.isArray(raw)) {
        (g[key] as T[]) = raw;
        return raw;
      }
    }
  } catch {
    /* ignore */
  }
  (g[key] as T[]) = fallback;
  return fallback;
}

function writeJson<T>(file: string, key: "__ipwLineBindings" | "__ipwLineInbox", rows: T[]) {
  (g[key] as T[]) = rows;
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(rows.slice(0, 500), null, 2));
  } catch {
    /* read-only */
  }
}

// ── settings (อ่านจาก oauth-config) ──────────────────────────
export async function lineSettings(): Promise<LineSettings> {
  const { getOAuthConfig } = await import("./oauth-config");
  const cfg = await getOAuthConfig();
  return {
    channelSecret: cfg.lineOaSecret || cfg.lineSecret || "",
    accessToken: cfg.lineOaToken || "",
    loginChannelId: cfg.lineId || "",
    botBasicId: cfg.lineBotId || "",
  };
}

export function lineConfigured(s: LineSettings) {
  return Boolean(s.accessToken);
}

// ── signature ───────────────────────────────────────────────
export function verifyLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false;
  const expected = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── push / reply ────────────────────────────────────────────
export interface LinePushResult {
  ok: boolean;
  error?: string;
  hint?: string;
  status?: number;
}

export async function linePush(to: string, messages: { type: "text"; text: string }[], token?: string): Promise<LinePushResult> {
  const s = await lineSettings();
  const accessToken = token || s.accessToken;
  if (!accessToken) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า LINE Channel Access Token", hint: "ตั้งค่าได้ที่ ตั้งค่า → Login & เชื่อมต่อ → LINE Official Account" };
  }
  if (!to) return { ok: false, error: "ต้องระบุ LINE target (groupId / userId)" };

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ to, messages }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return { ok: true, status: res.status };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return {
      ok: false,
      status: res.status,
      error: body.message || `LINE ตอบกลับ ${res.status}`,
      hint:
        res.status === 401
          ? "Access Token ไม่ถูกต้องหรือหมดอายุ — ออกใหม่ใน LINE Developers Console"
          : res.status === 403
            ? "OA ยังไม่ได้เปิดสิทธิ์ Messaging API หรือบอทยังไม่ถูกเชิญเข้ากลุ่มนี้"
            : undefined,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function lineProfile(userId: string): Promise<{ displayName?: string; pictureUrl?: string } | null> {
  const s = await lineSettings();
  if (!s.accessToken || !userId) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${s.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as { displayName?: string; pictureUrl?: string };
  } catch {
    return null;
  }
}

// ── bindings ────────────────────────────────────────────────
export async function listBindings(): Promise<LineBinding[]> {
  return readJson<LineBinding>(BIND_FILE, "__ipwLineBindings", []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addBinding(input: Omit<LineBinding, "id" | "createdAt">): Promise<LineBinding> {
  const rows = readJson<LineBinding>(BIND_FILE, "__ipwLineBindings", []);
  const binding: LineBinding = {
    ...input,
    id: `lb_${crypto.randomBytes(4).toString("hex")}`,
    createdAt: new Date().toISOString(),
  };
  writeJson(BIND_FILE, "__ipwLineBindings", [binding, ...rows.filter((b) => !(b.channelId === input.channelId && b.targetId === input.targetId))]);
  return binding;
}

export async function removeBinding(id: string): Promise<boolean> {
  const rows = readJson<LineBinding>(BIND_FILE, "__ipwLineBindings", []);
  const next = rows.filter((b) => b.id !== id);
  writeJson(BIND_FILE, "__ipwLineBindings", next);
  return next.length !== rows.length;
}

export async function bindingForChannel(channelId: string): Promise<LineBinding | null> {
  const rows = await listBindings();
  return rows.find((b) => b.channelId === channelId) ?? null;
}

export async function bindingForTarget(targetId: string): Promise<LineBinding | null> {
  const rows = await listBindings();
  return rows.find((b) => b.targetId === targetId) ?? null;
}

// ── inbox ───────────────────────────────────────────────────
export async function listInbox(limit = 60): Promise<LineInboxMessage[]> {
  return readJson<LineInboxMessage>(INBOX_FILE, "__ipwLineInbox", []).slice(0, limit);
}

export async function pushInbox(msg: LineInboxMessage): Promise<LineInboxMessage> {
  const rows = readJson<LineInboxMessage>(INBOX_FILE, "__ipwLineInbox", []);
  writeJson(INBOX_FILE, "__ipwLineInbox", [msg, ...rows]);
  return msg;
}

/** ดึงรูปโปรไฟล์ (URL ของ LINE CDN) มาเก็บเป็น data URL เพื่อใช้ในระบบ */
export async function imageUrlAsDataUrl(url: string, maxBytes = 2 * 1024 * 1024): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export function newInboxId() {
  return `lm_${crypto.randomBytes(5).toString("hex")}`;
}

/** แปลง webhook event → ข้อความในกล่องรับ */
export async function eventToInbox(event: Record<string, unknown>): Promise<LineInboxMessage> {
  const type = String(event.type ?? "other");
  const source = (event.source ?? {}) as { userId?: string; groupId?: string; roomId?: string; type?: string };
  const message = (event.message ?? {}) as { type?: string; text?: string; id?: string };
  const target = source.groupId || source.roomId || source.userId;
  const binding = target ? await bindingForTarget(target) : null;
  const profile = source.userId ? await lineProfile(source.userId) : null;

  const mapped: LineInboxMessage["type"] =
    type === "follow" || type === "unfollow" || type === "join" || type === "leave"
      ? (type as LineInboxMessage["type"])
      : message.type === "text" || message.type === "image" || message.type === "sticker"
        ? (message.type as LineInboxMessage["type"])
        : "other";

  return {
    id: newInboxId(),
    at: new Date().toISOString(),
    type: mapped,
    text: message.text,
    userId: source.userId,
    groupId: source.groupId,
    roomId: source.roomId,
    replyToken: (event.replyToken as string) ?? undefined,
    channelId: binding?.channelId ?? null,
    profileName: profile?.displayName,
  };
}

export function describeInbox(m: LineInboxMessage): string {
  const where = m.groupId ? "กลุ่ม LINE" : m.roomId ? "ห้อง LINE" : "แชทส่วนตัว LINE";
  switch (m.type) {
    case "follow": return `${m.profileName ?? "ผู้ใช้"} เพิ่ม OA เป็นเพื่อน`;
    case "unfollow": return `${m.profileName ?? "ผู้ใช้"} เลิกติดตาม OA`;
    case "join": return `OA ถูกเชิญเข้ากลุ่ม LINE (${m.groupId ?? "-"})`;
    case "leave": return `OA ออกจากกลุ่ม LINE (${m.groupId ?? "-"})`;
    case "image": return `[รูปภาพ] จาก${where}`;
    case "sticker": return `[สติกเกอร์] จาก${where}`;
    case "text": return m.text ?? "";
    default: return `[${m.type}] จาก${where}`;
  }
}
