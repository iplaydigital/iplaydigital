import { NextResponse } from "next/server";
import { APP_TZ, describeSqlTime, sqlToIso, sqlUtc, tzDate, tzDateTimeText, tzTimeSec } from "../../../../lib/tz";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/time — ตรวจว่า “เวลาของระบบ” ตรงกับเวลาไทยหรือไม่
 * ใช้ไล่ปัญหากรณีลงเวลา/เข้างานแล้วเวลาขึ้นไม่ตรง Bangkok
 */
export async function GET() {
  const now = new Date();
  const configuredTz = process.env.TZ ?? null;
  const resolvedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const payload: Record<string, unknown> = {
    ok: true,
    policy: {
      display: APP_TZ,
      storage: "UTC (DATETIME/TIMESTAMP) → แปลงเป็นเวลาไทยตอนแสดงผล",
      sessionTimezone: "+00:00 (ตั้งให้ทุก connection)",
      note: "ถ้า latestCheckin ขึ้น “ล้ำหน้า” เวลาจริง แปลว่ามีข้อมูลเก่าที่เก็บเป็นเวลาไทย — ซ่อมด้วย `npm run db:time` แล้วระบุ --table ตามที่สคริปต์แนะนำ",
    },
    server: {
      utc: now.toISOString(),
      bangkok: `${tzDate(now)} ${tzTimeSec(now)}`,
      bangkokText: tzDateTimeText(now, { seconds: true }),
      envTZ: configuredTz,
      resolvedTz,
      node: process.version,
      platform: process.platform,
      // ค่าที่ TZ ของเครื่องเป็นเวลาไทยหรือไม่ (ใช้เป็นข้อมูลประกอบเท่านั้น — โค้ดไม่พึ่งค่านี้แล้ว)
      looksLikeBangkok: resolvedTz === APP_TZ || configuredTz === APP_TZ,
    },
    roundTrip: {
      description: "เขียนลง DB → อ่านกลับ → แสดงผล (ต้องได้เวลาไทยเท่ากับ server.bangkok)",
      written: sqlUtc(now),
      readBackIso: sqlToIso(sqlUtc(now)),
      displayed: tzDateTimeText(sqlToIso(sqlUtc(now)) ?? now, { seconds: true }),
      matches: tzTimeSec(sqlToIso(sqlUtc(now)) ?? now) === tzTimeSec(now),
    },
  };

  // ตรวจเวลาของ MariaDB + ตัวอย่างรายการเช็คอินล่าสุด
  if (process.env.DB_HOST) {
    try {
      const { pool } = await import("../../../../lib/db-maria");
      const p = pool();
      const [tzRows] = (await p.query(
        "SELECT @@session.time_zone AS session_tz, @@global.time_zone AS global_tz, @@system_time_zone AS system_tz, NOW() AS db_now, UTC_TIMESTAMP() AS db_utc",
      )) as unknown as [Record<string, string>[]];
      const r = tzRows[0] ?? {};
      const [lastCheckin] = (await p.query(
        "SELECT at_time FROM ws_checkins ORDER BY at_time DESC LIMIT 1",
      )) as unknown as [Record<string, string>[]];
      const latest = describeSqlTime(lastCheckin?.[0]?.at_time);
      const latestIso = latest.iso ? String(latest.iso) : null;
      // ถ้าเวลาล่าสุดล้ำหน้าเวลาจริงมาก แปลว่าข้อมูลเก่าถูกเก็บเป็นเวลาไทย (+7)
      const aheadMinutes = latestIso ? Math.round((Date.parse(latestIso) - now.getTime()) / 60000) : null;
      payload.database = {
        sessionTimeZone: r.session_tz ?? null,
        globalTimeZone: r.global_tz ?? null,
        systemTimeZone: r.system_tz ?? null,
        now: r.db_now ?? null,
        utcTimestamp: r.db_utc ?? null,
        dbNowLooksUtc: r.db_now && r.db_utc ? String(r.db_now).slice(0, 16) === String(r.db_utc).slice(0, 16) : null,
        latestCheckin: latest,
        latestCheckinAheadMinutes: aheadMinutes,
        latestCheckinLooksStoredAsBangkok: aheadMinutes != null && aheadMinutes > 5,
      };
    } catch (err) {
      payload.database = { error: (err as Error).message };
    }
  } else {
    payload.database = { mode: "demo", note: "ยังไม่ได้ตั้ง DB_HOST — เก็บใน .data/store.json (ISO/UTC)" };
  }

  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
