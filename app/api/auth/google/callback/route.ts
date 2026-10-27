import { getSessionUser, requestMeta, requireUser, setSessionCookie } from "../../../../../lib/auth";
import { writeAudit, writeLogin } from "../../../../../lib/audit";
import { backToProfile, clearStateCookie, loginError, readState, requestOrigin, stateMode } from "../../../../../lib/oauth";
import { ensureSeedUsers, getUserByEmail, isAllowedEmail, updateUser, upsertOAuthUser } from "../../../../../lib/users";
import { getOAuthConfig } from "../../../../../lib/oauth-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = await getOAuthConfig();
  const origin = cfg.publicUrl || requestOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const mode = stateMode(state);

  if (!code || !state || state !== readState(req)) return loginError(origin, "google_state");
  if (url.searchParams.get("error")) {
    return mode === "login" ? loginError(origin, "google_cancelled") : backToProfile(origin, "google_cancelled", false);
  }

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
    const token = (await tokenRes.json()) as {
      access_token?: string; refresh_token?: string; scope?: string; error_description?: string;
    };
    if (!tokenRes.ok || !token.access_token) {
      return mode === "login" ? loginError(origin, "google_token") : backToProfile(origin, "google_token", false);
    }

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    const info = (await infoRes.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
    if (!infoRes.ok || !info.email) {
      return mode === "login" ? loginError(origin, "google_email") : backToProfile(origin, "google_email", false);
    }
    if (info.email_verified === false) {
      return mode === "login" ? loginError(origin, "google_unverified") : backToProfile(origin, "google_unverified", false);
    }

    // ── โหมดเชื่อมต่อบัญชี (จากหน้าโปรไฟล์) ──
    if (mode !== "login") {
      const { user } = await requireUser();
      if (!user) return loginError(origin, "session");

      const patch: Parameters<typeof updateUser>[1] = {
        googleSub: info.sub ?? null,
        googleEmail: info.email,
        googleConnectedAt: new Date().toISOString(),
      };
      // โหมด drive: เก็บ refresh token ของผู้ใช้เอง (ใช้ Drive ใต้บัญชี Gmail ของเขา)
      if (mode === "drive" && token.refresh_token) {
        patch.driveRefreshToken = token.refresh_token;
        patch.driveEmail = info.email;
        patch.driveConnectedAt = new Date().toISOString();
      }
      await updateUser(user.id, patch, { actor: { id: user.id, name: user.name }, ip: requestMeta(req).ip });

      await writeAudit({
        actorId: user.id, actorName: user.name, targetType: "user", targetId: user.id,
        targetName: `${user.name} (${user.email})`, action: "update",
        note: mode === "drive" ? `เชื่อม Google Drive: ${info.email}` : `เชื่อมบัญชี Google: ${info.email}`,
        ip: requestMeta(req).ip,
      });

      const res = backToProfile(origin, mode === "drive" ? "drive" : "google", true);
      res.headers.append("set-cookie", clearStateCookie());
      return res;
    }

    // ── โหมดเข้าสู่ระบบ ──
    if (!isAllowedEmail(info.email)) return loginError(origin, "domain");

    await ensureSeedUsers();
    const user = await upsertOAuthUser({
      email: info.email,
      name: info.name || info.email.split("@")[0],
      provider: "google",
    });
    // จำข้อมูล Google ไว้ใช้เชื่อม Drive ภายหลัง
    if (!user.googleSub || !user.googleEmail) {
      await updateUser(user.id, { googleSub: info.sub ?? null, googleEmail: info.email, googleConnectedAt: new Date().toISOString() }, { silent: true });
    }

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
    // ถ้าผู้ใช้ล็อกอินอยู่แล้ว (โหมดเชื่อมบัญชี) ให้กลับโปรไฟล์ ไม่ใช่หน้า login
    const existing = await getSessionUser();
    return existing && mode !== "login"
      ? backToProfile(origin, "google_failed", false)
      : loginError(origin, "google_failed");
  }
}
