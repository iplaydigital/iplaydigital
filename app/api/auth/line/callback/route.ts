import { getSessionUser, requestMeta, requireUser, setSessionCookie } from "../../../../../lib/auth";
import { writeAudit, writeLogin } from "../../../../../lib/audit";
import { backToProfile, clearStateCookie, loginError, readState, requestOrigin, stateMode } from "../../../../../lib/oauth";
import { ensureSeedUsers, getUserByLineId, isAllowedEmail, updateUser, upsertOAuthUser } from "../../../../../lib/users";
import { getOAuthConfig } from "../../../../../lib/oauth-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = await getOAuthConfig();
  const origin = cfg.publicUrl || requestOrigin(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const mode = stateMode(state);

  if (!code || !state || state !== readState(req)) return loginError(origin, "line_state");
  if (url.searchParams.get("error")) {
    return mode === "link-line" ? backToProfile(origin, "line_cancelled", false) : loginError(origin, "line_cancelled");
  }

  const clientId = cfg.lineId;
  const clientSecret = cfg.lineSecret;
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
    if (!tokenRes.ok || !token.id_token) {
      return mode === "link-line" ? backToProfile(origin, "line_token", false) : loginError(origin, "line_token");
    }

    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: token.id_token, client_id: clientId }),
      signal: AbortSignal.timeout(15000),
    });
    const profile = (await verifyRes.json()) as { sub?: string; name?: string; email?: string; picture?: string };
    if (!verifyRes.ok || !profile.sub) {
      return mode === "link-line" ? backToProfile(origin, "line_verify", false) : loginError(origin, "line_verify");
    }

    // ── โหมดผูกบัญชี LINE เข้ากับผู้ใช้ที่ล็อกอินอยู่ ──
    if (mode === "link-line") {
      const { user } = await requireUser();
      if (!user) return loginError(origin, "session");

      // กันการผูก LINE เดียวกับหลายบัญชี
      const owner = await getUserByLineId(profile.sub);
      if (owner && owner.id !== user.id) {
        return backToProfile(origin, "line_already_linked", false);
      }

      await updateUser(
        user.id,
        {
          lineUserId: profile.sub,
          lineDisplay: profile.name ?? null,
          linePicture: profile.picture ?? null,
          lineLinkedAt: new Date().toISOString(),
        },
        { actor: { id: user.id, name: user.name }, ip: requestMeta(req).ip },
      );
      await writeAudit({
        actorId: user.id, actorName: user.name, targetType: "user", targetId: user.id,
        targetName: `${user.name} (${user.email})`, action: "update",
        note: `เชื่อมบัญชี LINE: ${profile.name ?? profile.sub}`, ip: requestMeta(req).ip,
      });

      const res = backToProfile(origin, "line", true);
      res.headers.append("set-cookie", clearStateCookie());
      return res;
    }

    // ── โหมดเข้าสู่ระบบ ──
    const linked = await getUserByLineId(profile.sub);
    if (linked) {
      if (!linked.active) return loginError(origin, "line_suspended");
      await setSessionCookie(linked.id);
      const { ip, agent } = requestMeta(req);
      await writeLogin({ userId: linked.id, email: linked.email, provider: "line", ok: true, ip, agent });
      await writeAudit({
        actorId: linked.id, actorName: linked.name, targetType: "user", targetId: linked.id,
        targetName: `${linked.name} (${linked.email})`, action: "login", note: `เข้าสู่ระบบด้วย LINE (ผูกไว้แล้ว) · ${ip}`, ip,
      });
      const res = new Response(null, { status: 302, headers: { location: `${origin}/` } });
      res.headers.append("set-cookie", clearStateCookie());
      return res;
    }

    if (!profile.email) return loginError(origin, "line_link_required");
    if (!isAllowedEmail(profile.email)) return loginError(origin, "domain");

    await ensureSeedUsers();
    const user = await upsertOAuthUser({
      email: profile.email,
      name: profile.name || profile.email.split("@")[0],
      provider: "line",
      lineId: profile.sub,
      picture: profile.picture,
    });
    await updateUser(
      user.id,
      { lineUserId: profile.sub, lineDisplay: profile.name ?? null, linePicture: profile.picture ?? null, lineLinkedAt: new Date().toISOString() },
      { silent: true },
    );

    await setSessionCookie(user.id);
    const { ip, agent } = requestMeta(req);
    await writeLogin({ userId: user.id, email: user.email, provider: "line", ok: true, ip, agent });
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "user", targetId: user.id,
      targetName: `${user.name} (${user.email})`, action: "login", note: `เข้าสู่ระบบด้วย LINE · ${ip}`, ip,
    });

    const res = new Response(null, { status: 302, headers: { location: `${origin}/` } });
    res.headers.append("set-cookie", clearStateCookie());
    return res;
  } catch (err) {
    console.error("[auth/line]", err);
    const existing = await getSessionUser();
    return existing && mode === "link-line"
      ? backToProfile(origin, "line_failed", false)
      : loginError(origin, "line_failed");
  }
}
