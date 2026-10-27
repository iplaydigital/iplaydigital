import { newState, requestOrigin, stateCookie } from "../../../../lib/oauth";
import { getOAuthConfig } from "../../../../lib/oauth-config";

export const dynamic = "force-dynamic";

/**
 * เริ่ม LINE Login
 *   ?mode=login      เข้าสู่ระบบ (บัญชีที่ผูก LINE ไว้ หรืออีเมลที่อนุญาต)
 *   ?mode=link-line  ผูก LINE เข้ากับบัญชีที่ล็อกอินอยู่ (จากหน้าโปรไฟล์)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = await getOAuthConfig();
  const origin = cfg.publicUrl || requestOrigin(req);
  const mode = url.searchParams.get("mode") === "link-line" ? "link-line" : "login";

  if (!cfg.lineId) {
    return new Response(null, { status: 302, headers: { location: `${origin}/login?error=line_not_configured` } });
  }

  const state = newState(mode);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.lineId,
    redirect_uri: `${origin}/api/auth/line/callback`,
    state,
    scope: "profile openid email",
  });
  return new Response(null, {
    status: 302,
    headers: { location: `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`, "set-cookie": stateCookie(state) },
  });
}
