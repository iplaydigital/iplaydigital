// shared helpers สำหรับ OAuth (Google / LINE)
// state = "<nonce>:<mode>" โดย mode = login | link-line | link-google | drive
import crypto from "crypto";

export const STATE_COOKIE = "ipw_oauth_state";
export type OAuthMode = "login" | "link-line" | "link-google" | "drive";

export function requestOrigin(req: Request): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function newState(mode: OAuthMode = "login") {
  return `${crypto.randomBytes(16).toString("hex")}:${mode}`;
}

export function stateMode(state: string | null | undefined): OAuthMode {
  const m = (state || "").split(":")[1];
  return m === "link-line" || m === "link-google" || m === "drive" ? m : "login";
}

export function stateCookie(state: string) {
  return `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearStateCookie() {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readState(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`${STATE_COOKIE}=([^;]+)`));
  return m?.[1] ?? null;
}

export function loginError(origin: string, code: string) {
  return new Response(null, { status: 302, headers: { location: `${origin}/login?error=${encodeURIComponent(code)}` } });
}

/** กลับไปหน้าเดิมพร้อมผลลัพธ์ (ใช้กับการเชื่อมต่อบัญชีจากหน้าโปรไฟล์) */
export function backToProfile(origin: string, code: string, ok: boolean) {
  const q = new URLSearchParams({ [ok ? "linked" : "linkError"]: code });
  return new Response(null, {
    status: 302,
    headers: { location: `${origin}/?${q.toString()}#profile` },
  });
}
