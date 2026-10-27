import { newState, requestOrigin, stateCookie } from "../../../../lib/oauth";
import { getOAuthConfig } from "../../../../lib/oauth-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cfg = await getOAuthConfig();
  const origin = cfg.publicUrl || requestOrigin(req);
  const clientId = cfg.lineId;
  if (!clientId) {
    return new Response(null, { status: 302, headers: { location: `${origin}/login?error=line_not_configured` } });
  }
  const state = newState();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/line/callback`,
    state,
    scope: "profile openid email",
  });
  return new Response(null, {
    status: 302,
    headers: { location: `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`, "set-cookie": stateCookie(state) },
  });
}
