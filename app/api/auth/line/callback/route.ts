import { setSessionCookie } from "../../../../../lib/auth";
import { clearStateCookie, loginError, readState, requestOrigin } from "../../../../../lib/oauth";
import { ensureSeedUsers, isAllowedEmail, upsertOAuthUser } from "../../../../../lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = requestOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state || state !== readState(req)) return loginError(origin, "line_state");
  if (url.searchParams.get("error")) return loginError(origin, "line_cancelled");

  const clientId = process.env.AUTH_LINE_ID || process.env.LINE_CHANNEL_ID;
  const clientSecret = process.env.AUTH_LINE_SECRET || process.env.LINE_CHANNEL_SECRET;
  if (!clientId || !clientSecret) return loginError(origin, "line_not_configured");

  try {
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/auth/line/callback`,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const token = (await tokenRes.json()) as { id_token?: string; error_description?: string };
    if (!tokenRes.ok || !token.id_token) return loginError(origin, "line_token");

    // ตรวจ id_token + ดึงโปรไฟล์ (LINE Verify API)
    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: token.id_token, client_id: clientId }),
      signal: AbortSignal.timeout(15000),
    });
    const profile = (await verifyRes.json()) as { sub?: string; name?: string; email?: string };
    if (!verifyRes.ok || !profile.sub) return loginError(origin, "line_verify");
    if (!profile.email) return loginError(origin, "line_no_email");
    if (!isAllowedEmail(profile.email)) return loginError(origin, "domain");

    await ensureSeedUsers();
    const user = await upsertOAuthUser({
      email: profile.email,
      name: profile.name || profile.email.split("@")[0],
      provider: "line",
      lineId: profile.sub,
    });
    await setSessionCookie(user.id);

    const res = new Response(null, { status: 302, headers: { location: `${origin}/` } });
    res.headers.append("set-cookie", clearStateCookie());
    return res;
  } catch (err) {
    console.error("[auth/line]", err);
    return loginError(origin, "line_failed");
  }
}
