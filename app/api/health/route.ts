import { NextResponse } from "next/server";
import { APP_TZ, tzDateTimeText } from "@/lib/tz";
import { BUILD } from "@/lib/version";
import { canSeeHealthDetails } from "@/lib/health-access";

export const dynamic = "force-dynamic";

/**
 * Health check — ping MariaDB จริง (ไม่ใช่แค่ดูว่ามี DB_HOST หรือไม่)
 *   curl -s https://your.domain/api/health | jq
 *
 * ข้อมูลพื้นฐาน (ok/mode/build/เวลา) เปิดให้ทุกคน — ใช้ monitoring ได้
 * รายละเอียด DB (host/user/เวอร์ชัน/ตาราง) ต้องเป็น admin/support หรือส่ง header x-health-token
 *   curl -s -H "x-health-token: $HEALTH_TOKEN" https://your.domain/api/health | jq
 */
export async function GET(req: Request) {
  const configured = Boolean(process.env.DB_HOST);
  const started = Date.now();
  const access = await canSeeHealthDetails(req);
  const now = new Date();
  const common = {
    time: now.toISOString(),
    timeBangkok: tzDateTimeText(now, { seconds: true }),
    timeZone: APP_TZ,
    serverTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    build: { ...BUILD, builtAt: BUILD.builtAt || null, commit: BUILD.commit || null },
  };

  if (!configured) {
    return NextResponse.json({
      ok: true,
      storage: "demo",
      mode: "demo",
      ...common,
      // ยังไม่ได้ตั้ง DB — ไม่มีอะไรให้ปิด
      note: "ยังไม่ได้ตั้งค่า DB_HOST — ใช้ demo store (.data/store.json)",
      db: { configured: false, ok: false, error: null },
      latencyMs: Date.now() - started,
    });
  }

  try {
    const [{ pool }, { pingDb }] = await Promise.all([import("@/lib/db-maria"), import("@/lib/db-diag")]);
    const db = await pingDb(pool());
    if (!access.ok) {
      // ผู้ไม่ล็อกอิน/บทบาททั่วไป: บอกแค่ว่าฐานข้อมูลใช้งานได้หรือไม่
      return NextResponse.json(
        {
          ok: db.ok,
          storage: db.ok ? "mariadb" : process.env.DB_REQUIRED === "1" ? "down" : "fallback",
          mode: db.ok ? "mariadb" : "fallback",
          ...common,
          db: { configured: true, ok: db.ok },
          latencyMs: Date.now() - started,
        },
        { status: db.ok || process.env.DB_REQUIRED !== "1" ? 200 : 503 },
      );
    }
    return NextResponse.json(
      {
        ok: db.ok,
        storage: db.ok ? "mariadb" : process.env.DB_REQUIRED === "1" ? "down" : "fallback",
        mode: db.ok ? "mariadb" : "fallback",
        ...common,
        db,
        access: access.via,
        latencyMs: Date.now() - started,
      },
      { status: db.ok || process.env.DB_REQUIRED !== "1" ? 200 : 503 },
    );
  } catch (err) {
    const { describeDbError } = await import("@/lib/db-diag");
    const error = describeDbError(err);
    return NextResponse.json(
      {
        ok: false,
        storage: "fallback",
        mode: "fallback",
        ...common,
        db: access.ok ? { configured: true, ok: false, error } : { configured: true, ok: false },
        latencyMs: Date.now() - started,
      },
      { status: process.env.DB_REQUIRED === "1" ? 503 : 200 },
    );
  }
}
