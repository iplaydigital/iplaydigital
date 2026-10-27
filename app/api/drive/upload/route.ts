import { NextResponse } from "next/server";
import { requireModule } from "../../../../lib/auth";
import { uploadToDrive } from "../../../../lib/drive";
import { getUserById } from "../../../../lib/users";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** อัปโหลดไฟล์เข้า Google Drive (multipart: field "file") */
export async function POST(req: Request) {
  const { user, error } = await requireModule("reports");
  if (error || !user) return error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ต้องแนบไฟล์" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 20 MB" }, { status: 413 });

  const full = await getUserById(user.id);
  const result = await uploadToDrive(
    { name: file.name, type: file.type, bytes: await file.arrayBuffer() },
    {
      driveRefreshToken: full?.driveRefreshToken ?? null,
      driveConnected: Boolean(full?.driveRefreshToken),
      driveEmail: full?.driveEmail ?? full?.googleEmail ?? null,
    },
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 200 });
}
