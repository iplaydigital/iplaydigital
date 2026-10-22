import { newState, requestOrigin, stateCookie } from "../../../../lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const clientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response(null, { status: 302, headers: { location: `${origin}/login?error=google_not_configured` } });
  }
  const state = newState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  const hd = process.env.ALLOWED_EMAIL_DOMAIN?.split(",")[0]?.trim().replace(/^@/, "");
  if (hd) params.set("hd", hd);

  return new Response(null, {
    status: 302,
    headers: { location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, "set-cookie": stateCookie(state) },
  });
}
