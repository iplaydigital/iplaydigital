import { NextResponse } from "next/server";
import { requireModule, requireUser } from "../../../lib/auth";
import { createReport, listReports } from "../../../lib/reports";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireModule("reports");
  if (error) return error;
  return NextResponse.json({ reports: await listReports() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const { user, error } = await requireModule("reports");
  if (error || !user) return error;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string; period?: string; projectId?: string | null; summary?: string;
    status?: "draft" | "submitted" | "approved"; driveUrl?: string;
    attachments?: { id?: string; name: string; url: string; size?: string; mime?: string; driveId?: string }[];
  };
  if (!body.title?.trim()) return NextResponse.json({ error: "ต้องตั้งชื่อรายงาน" }, { status: 400 });

  const report = await createReport({
    title: body.title.trim(),
    period: body.period,
    projectId: body.projectId ?? null,
    authorId: user.memberId || user.id,
    summary: body.summary,
    status: body.status || "draft",
    driveUrl: body.driveUrl,
    attachments: (body.attachments || []).map((a, i) => ({
      id: a.id || `at_${Date.now()}_${i}`,
      name: a.name, url: a.url, size: a.size, mime: a.mime, driveId: a.driveId,
    })),
  });
  return NextResponse.json({ ok: true, report });
}
