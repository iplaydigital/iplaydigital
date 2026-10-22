import { NextResponse } from "next/server";
import { getBootstrap } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getBootstrap();
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
