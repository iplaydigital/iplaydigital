import { requestMeta, setSessionCookie } from "../../../../../lib/auth";
import { writeAudit, writeLogin } from "../../../../../lib/audit";
import { clearStateCookie, loginError, readState, requestOrigin } from "../../../../../lib/oauth";
import { ensureSeedUsers, isAllowedEmail, upsertOAuthUser } from "../../../../../lib/users";
import { getOAuthConfig } from "../../../../../lib/oauth-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = await getOAuthConfig();
  const origin = cfg.publicUrl || requestOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state || state !== readState(req)) return loginError(origin, "google_state");
  if (url.searchParams.get("error")) return loginError(origin, "google_cancelled");

  const clientId = cfg.googleId;
  const clientSecret = cfg.googleSecret;
  if (!clientId || !clientSecret) return loginError(origin, "google_not_configured");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const token = (await tokenRes.json()) as { access_token?: string; error_description?: string };
    if (!tokenRes.ok || !token.access_token) return loginError(origin, "google_token");

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    const info = (await infoRes.json()) as { email?: string; name?: string; email_verified?: boolean };
    if (!infoRes.ok || !info.email) return loginError(origin, "google_email");
    if (info.email_verified === false) return loginError(origin, "google_unverified");
    if (!isAllowedEmail(info.email)) return loginError(origin, "domain");

    await ensureSeedUsers();
    const user = await upsertOAuthUser({
      email: info.email,
      name: info.name || info.email.split("@")[0],
      provider: "google",
    });
    await setSessionCookie(user.id);
    const { ip, agent } = requestMeta(req);
    await writeLogin({ userId: user.id, email: user.email, provider: "google", ok: true, ip, agent });
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "user", targetId: user.id,
      targetName: `${user.name} (${user.email})`, action: "login", note: `เข้าสู่ระบบด้วย Google · ${ip}`, ip,
    });

    const res = new Response(null, { status: 302, headers: { location: `${origin}/` } });
    res.headers.append("set-cookie", clearStateCookie());
    return res;
  } catch (err) {
    console.error("[auth/google]", err);
    return loginError(origin, "google_failed");
  }
}
