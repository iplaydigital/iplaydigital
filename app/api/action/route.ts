import { NextResponse } from "next/server";
import { applyAction, getBootstrap } from "@/lib/store";
import { requireUser } from "@/lib/auth";
import type { Action } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  try {
    const action = (await req.json()) as Action;
    if (!action?.type) return NextResponse.json({ error: "missing action type" }, { status: 400 });
    // บังคับให้ action ที่ระบุผู้ทำ ใช้ตัวตนจาก session (กันปลอม authorId)
    if (user?.memberId) {
      if ("authorId" in action) action.authorId = user.memberId;
      if ("actorId" in action) action.actorId = user.memberId;
      if (action.type === "hr.leave.decide") action.approverId = user.memberId;
      if (action.type === "hr.checkin") action.checkin = { ...action.checkin, userId: user.memberId };
      if (action.type === "hr.leave") action.leave = { ...action.leave, userId: user.memberId };
      if (action.type === "hr.booking") action.booking = { ...action.booking, ownerId: user.memberId };
    }
    await applyAction(action);
    const data = await getBootstrap();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const dbError = (err as { dbError?: unknown }).dbError ?? null;
    console.error("[action]", err);
    return NextResponse.json(
      { error: (err as Error).message, dbError },
      { status: dbError ? 503 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
