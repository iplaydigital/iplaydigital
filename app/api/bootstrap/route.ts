import { NextResponse } from "next/server";
import { getBootstrap } from "@/lib/store";
import { requireUser } from "@/lib/auth";
import { filterBootstrapFor, viewerOf } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  try {
    const full = await getBootstrap();
    // เห็นเฉพาะงาน/โปรเจกต์/ปฏิทินที่เกี่ยวข้องกับบทบาทของผู้ใช้คนนี้
    const data = filterBootstrapFor(full, viewerOf(user));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const dbError = (err as { dbError?: unknown }).dbError ?? null;
    console.error("[bootstrap]", err);
    return NextResponse.json(
      {
        error: (err as Error).message,
        dbError,
        hint: "เชื่อมต่อฐานข้อมูลไม่ได้ — เปิด /api/health เพื่อดูสาเหตุ หรือรัน `npm run db:doctor` บนเซิร์ฟเวอร์",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
