import { NextResponse } from "next/server";
import { requireModule } from "../../../../lib/auth";
import { driveStatus } from "../../../../lib/drive";
import { getUserById } from "../../../../lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireModule("reports");
  if (error || !user) return error;
  // Drive ทำงานภายใต้บัญชี Google (Gmail) ของผู้ใช้เอง
  const full = await getUserById(user.id);
  return NextResponse.json(
    {
      drive: driveStatus({
        driveConnected: Boolean(full?.driveRefreshToken),
        driveEmail: full?.driveEmail ?? full?.googleEmail ?? null,
      }),
      connectUrl: "/api/auth/google?mode=drive",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
