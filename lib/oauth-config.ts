// ─────────────────────────────────────────────────────────────
//  ตั้งค่า OAuth (Google Workspace / Gmail + LINE) จากหน้า Super Admin
//  เก็บใน MariaDB (ws_oauth) หรือไฟล์ .data/oauth.json
//  ค่าที่ตั้งในหน้าเว็บจะชนะ env — ถ้าเว้นว่างจะใช้ env เป็น fallback
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import type { SessionUser } from "./types";

export interface OAuthConfig {
  googleId: string;
  googleSecret: string;
  lineId: string;
  lineSecret: string;
  /** LINE Official Account (Messaging API) — ใช้รับ/ส่งข้อความในแชท */
  lineOaToken: string;
  lineOaSecret: string;
  lineBotId: string;
  /** URL สาธารณะของเว็บ ใช้สร้าง redirect_uri (เช่น https://workspace.playdigital.co.th) */
  publicUrl: string;
}

const EMPTY: OAuthConfig = {
  googleId: "",
  googleSecret: "",
  lineId: "",
  lineSecret: "",
  lineOaToken: "",
  lineOaSecret: "",
  lineBotId: "",
  publicUrl: "",
};
const FILE = path.join(process.cwd(), ".data", "oauth.json");

const g = globalThis as unknown as {
  __ipwOAuth?: OAuthConfig;
  __ipwOAuthMaria?: { ok: boolean; at: number };
};

function envValue(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

/** ค่าจาก env (fallback) */
function fromEnv(): OAuthConfig {
  return {
    googleId: envValue("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID"),
    googleSecret: envValue("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET"),
    lineId: envValue("AUTH_LINE_ID", "LINE_CHANNEL_ID"),
    lineSecret: envValue("AUTH_LINE_SECRET", "LINE_CHANNEL_SECRET"),
    lineOaToken: envValue("LINE_OA_ACCESS_TOKEN", "LINE_CHANNEL_ACCESS_TOKEN"),
    lineOaSecret: envValue("LINE_OA_CHANNEL_SECRET", "LINE_MESSAGING_CHANNEL_SECRET"),
    lineBotId: envValue("LINE_OA_BOT_ID"),
    publicUrl: envValue("AUTH_URL", "NEXTAUTH_URL"),
  };
}

function readFile(): OAuthConfig {
  if (g.__ipwOAuth) return g.__ipwOAuth;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<OAuthConfig>;
      const merged = { ...EMPTY, ...raw };
      g.__ipwOAuth = merged;
      return merged;
    }
  } catch {
    /* ignore */
  }
  g.__ipwOAuth = { ...EMPTY };
  return g.__ipwOAuth;
}

function writeFile(cfg: OAuthConfig) {
  g.__ipwOAuth = cfg;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  } catch {
    /* read-only */
  }
}

async function maria() {
  if (!process.env.DB_HOST) return null;
  const st = g.__ipwOAuthMaria;
  if (st && !st.ok && Date.now() - st.at < 60_000) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_oauth (
      id VARCHAR(32) PRIMARY KEY,
      data JSON NULL,
      updated_at VARCHAR(32) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    g.__ipwOAuthMaria = { ok: true, at: Date.now() };
    return p;
  } catch {
    g.__ipwOAuthMaria = { ok: false, at: Date.now() };
    return null;
  }
}

/** ค่าที่บันทึกไว้ (ไม่รวม env) */
async function readStored(): Promise<OAuthConfig> {
  const p = await maria();
  if (p) {
    try {
      const [rows] = (await p.query("SELECT data FROM ws_oauth WHERE id='main'")) as unknown as [Record<string, unknown>[]];
      const raw = rows[0]?.data;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as Partial<OAuthConfig> | undefined);
      return { ...EMPTY, ...(parsed ?? {}) };
    } catch {
      /* fall through */
    }
  }
  return readFile();
}

/** ค่าที่ใช้งานจริง (stored ก่อน env) */
export async function getOAuthConfig(): Promise<OAuthConfig> {
  const stored = await readStored();
  const env = fromEnv();
  return {
    googleId: stored.googleId || env.googleId,
    googleSecret: stored.googleSecret || env.googleSecret,
    lineId: stored.lineId || env.lineId,
    lineSecret: stored.lineSecret || env.lineSecret,
    lineOaToken: stored.lineOaToken || env.lineOaToken,
    lineOaSecret: stored.lineOaSecret || env.lineOaSecret,
    lineBotId: stored.lineBotId || env.lineBotId,
    publicUrl: stored.publicUrl || env.publicUrl,
  };
}

export async function saveOAuthConfig(patch: Partial<OAuthConfig>): Promise<OAuthConfig> {
  const current = await readStored();
  const next: OAuthConfig = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""])),
  } as OAuthConfig;

  const p = await maria();
  if (p) {
    try {
      await p.query(
        "INSERT INTO ws_oauth (id, data, updated_at) VALUES ('main', ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)",
        [JSON.stringify(next), new Date().toISOString()],
      );
      return next;
    } catch {
      /* fall through */
    }
  }
  writeFile(next);
  return next;
}

export function isSuperAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== "admin") return false;
  return superAdminEmails().includes(user.email.toLowerCase());
}

export function superAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || "it@playdigital.co.th,jimm@playdigital.co.th";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export interface OAuthPublicInfo {
  google: { clientId: string; secretSet: boolean; configured: boolean; source: "ui" | "env" | "none" };
  line: { clientId: string; secretSet: boolean; configured: boolean; source: "ui" | "env" | "none" };
  lineOa: { tokenSet: boolean; secretSet: boolean; configured: boolean; botId: string; webhookUrl: string };
  publicUrl: string;
  redirects: { google: string; line: string };
  webhook: string;
  allowlist: string;
  superAdmins: string[];
}

/** ข้อมูลสำหรับแสดงในหน้าตั้งค่า (ปิดบัง secret) */
export async function oauthPublicInfo(): Promise<OAuthPublicInfo> {
  const [stored, merged] = await Promise.all([readStored(), getOAuthConfig()]);
  const env = fromEnv();
  const origin = merged.publicUrl || "";
  const source = (key: keyof OAuthConfig): "ui" | "env" | "none" => {
    if (stored[key]) return "ui";
    if (env[key]) return "env";
    return "none";
  };
  return {
    google: {
      clientId: merged.googleId,
      secretSet: Boolean(merged.googleSecret),
      configured: Boolean(merged.googleId && merged.googleSecret),
      source: stored.googleId || stored.googleSecret ? "ui" : env.googleId || env.googleSecret ? "env" : "none",
    },
    line: {
      clientId: merged.lineId,
      secretSet: Boolean(merged.lineSecret),
      configured: Boolean(merged.lineId && merged.lineSecret),
      source: stored.lineId || stored.lineSecret ? "ui" : env.lineId || env.lineSecret ? "env" : "none",
    },
    lineOa: {
      tokenSet: Boolean(merged.lineOaToken),
      secretSet: Boolean(merged.lineOaSecret),
      configured: Boolean(merged.lineOaToken && merged.lineOaSecret),
      botId: merged.lineBotId,
      webhookUrl: `${origin || "https://<โดเมนของคุณ>"}/api/line/webhook`,
    },
    publicUrl: origin,
    webhook: `${origin || "https://<โดเมนของคุณ>"}/api/line/webhook`,
    redirects: {
      google: `${origin || "https://<โดเมนของคุณ>"}/api/auth/google/callback`,
      line: `${origin || "https://<โดเมนของคุณ>"}/api/auth/line/callback`,
    },
    allowlist: process.env.ALLOWED_EMAIL_DOMAIN || "playdigital.co.th,gmail.com",
    superAdmins: superAdminEmails(),
  };
}
