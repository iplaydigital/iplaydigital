import { newState, requestOrigin, stateCookie, type OAuthMode } from "../../../../lib/oauth";
import { getOAuthConfig } from "../../../../lib/oauth-config";
import { googleHostedDomain } from "../../../../lib/identity";
import { requireUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

/**
 * เริ่ม Google OAuth
 *   ?mode=login        เข้าสู่ระบบ (Google Workspace / Gmail)
 *   ?mode=link-google  ผูกบัญชี Google เข้ากับผู้ใช้ที่ล็อกอินอยู่
 *   ?mode=drive        เชื่อม Google Drive ของผู้ใช้เอง (ต้องมี scope drive.file)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = await getOAuthConfig();
  const origin = cfg.publicUrl || requestOrigin(req);
  const mode = (url.searchParams.get("mode") || "login") as OAuthMode;

  if (!cfg.googleId) {
    return new Response(null, { status: 302, headers: { location: `${origin}/login?error=google_not_configured` } });
  }
  if (mode !== "login") {
    const { user } = await requireUser();
    if (!user) return new Response(null, { status: 302, headers: { location: `${origin}/login?error=session` } });
  }

  const state = newState(mode);
  const scope = mode === "drive" ? "openid email profile https://www.googleapis.com/auth/drive.file" : "openid email profile";
  const params = new URLSearchParams({
    client_id: cfg.googleId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope,
    state,
    access_type: "offline",
    prompt: mode === "drive" ? "consent" : "select_account",
    include_granted_scopes: "true",
  });
  // จำกัดโดเมนเฉพาะกรณีที่ไม่รองรับ Gmail (ถ้ารองรับ Gmail ให้เลือกบัญชีได้ทุกแบบ)
  const hd = googleHostedDomain();
  if (hd && mode === "login") params.set("hd", hd);

  return new Response(null, {
    status: 302,
    headers: { location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, "set-cookie": stateCookie(state) },
  });
}
