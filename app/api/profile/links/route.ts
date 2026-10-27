import { requireUser, requestMeta } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";
import { updateUser, getUserById } from "../../../../lib/users";
import { domainLabel, isAllowedEmail } from "../../../../lib/identity";
import { getOAuthConfig } from "../../../../lib/oauth-config";

export const dynamic = "force-dynamic";

/** GET /api/profile/links — สถานะช่องทางที่ผูกไว้ + สถานะผู้ให้บริการ */
export async function GET() {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const full = await getUserById(user.id);
  if (!full) return Response.json({ ok: false, error: "ไม่พบบัญชี" }, { status: 404 });
  const cfg = await getOAuthConfig();
  const emailDomain = full.email.split("@")[1] ?? "";

  return Response.json({
    ok: true,
    email: full.email,
    emailDomain,
    emailDomainLabel: domainLabel(),
    emailAllowed: isAllowedEmail(full.email),
    passwordLogin: Boolean(full.passwordHash),
    provider: full.provider,
    google: {
      available: Boolean(cfg.googleId && cfg.googleSecret),
      linked: Boolean(full.googleSub),
      email: full.googleEmail,
      at: full.googleConnectedAt,
    },
    line: {
      available: Boolean(cfg.lineId && cfg.lineSecret),
      linked: Boolean(full.lineUserId),
      name: full.lineDisplay,
      picture: full.linePicture,
      at: full.lineLinkedAt,
    },
    drive: {
      available: Boolean(cfg.googleId && cfg.googleSecret),
      linked: Boolean(full.driveRefreshToken),
      email: full.driveEmail,
      at: full.driveConnectedAt,
    },
    urls: {
      google: "/api/auth/google?mode=link-google",
      line: "/api/auth/line?mode=link-line",
      drive: "/api/auth/google?mode=drive",
    },
  });
}

/** DELETE /api/profile/links?channel=google|line|drive — ยกเลิกการเชื่อมต่อ */
export async function DELETE(req: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const channel = new URL(req.url).searchParams.get("channel");
  const patch =
    channel === "google"
      ? { googleSub: null, googleEmail: null, googleConnectedAt: null }
      : channel === "line"
        ? { lineUserId: null, lineDisplay: null, linePicture: null, lineLinkedAt: null }
        : channel === "drive"
          ? { driveRefreshToken: null, driveEmail: null, driveConnectedAt: null }
          : null;

  if (!patch) return Response.json({ ok: false, error: "ต้องระบุ channel" }, { status: 400 });

  const label = channel === "google" ? "Google" : channel === "line" ? "LINE" : "Google Drive";
  await updateUser(user.id, patch, { silent: true });
  await writeAudit({
    actorId: user.id,
    actorName: user.name,
    targetType: "user",
    targetId: user.id,
    targetName: `${user.name} (${user.email})`,
    action: "update",
    note: `ยกเลิกการเชื่อมต่อ ${label}`,
    ip: requestMeta(req).ip,
  });
  return Response.json({ ok: true });
}
