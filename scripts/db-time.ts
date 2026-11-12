/**
 * db:time — ตรวจ/ซ่อมเวลาที่บันทึกในฐานข้อมูล
 *
 *   npm run db:time                                    # ตรวจสถานะเวลา (อ่านอย่างเดียว)
 *   npm run db:time -- --shift-hours=-7 --table=ws_messages            # ทดลอง (dry-run)
 *   npm run db:time -- --shift-hours=-7 --table=ws_messages --apply    # เขียนจริง
 *   npm run db:time -- --shift-hours=-7 --table=ws_messages,ws_checkins --apply
 *
 * หลักการของระบบ: “เก็บ UTC, แสดงผลเป็นเวลาไทย (Asia/Bangkok)”
 *   • ฝั่งเขียนใช้ lib/tz.ts → sqlUtc()  (DATETIME = UTC)
 *   • ฝั่งอ่านใช้ sqlToIso() แล้วแสดงผลด้วย tzTime()/tzDate()
 *
 * ข้อมูลเก่าที่อาจเพี้ยนมี 2 กรณี
 *   1) แถวที่ใช้ DEFAULT CURRENT_TIMESTAMP / NOW() ตอนที่ DB ยังตั้ง timezone เป็นเวลาไทย
 *      → ค่าที่เก็บเป็นเวลาไทย ต้องเลื่อน -7 ชม. (ครั้งเดียว)
 *   2) ข้อมูลที่ระบบใหม่เขียนแล้ว → เป็น UTC อยู่แล้ว ห้ามเลื่อน
 *
 * ดังนั้นสคริปต์นี้ “ไม่ยอมเขียนจริง” ถ้าไม่ระบุ --table  เพื่อกันการเลื่อนทั้งฐานซ้ำซ้อน
 */
import { sqlToIso, tzDateTimeText } from "../lib/tz";

try {
  process.loadEnvFile(".env");
} catch {
  /* ใช้ค่าจาก environment */
}

const TABLES: { table: string; column: string; label: string }[] = [
  { table: "ws_checkins", column: "at_time", label: "ลงเวลา / เช็คอิน" },
  { table: "ws_task_comments", column: "at", label: "คอมเมนต์งาน" },
  { table: "ws_messages", column: "created_at", label: "แชท" },
  { table: "ws_files", column: "shared_at", label: "ไฟล์ Drive" },
  { table: "ws_leaves", column: "created_at", label: "ใบลา" },
  { table: "ws_ai_runs", column: "at_time", label: "AI runs" },
  { table: "ws_activity", column: "at_time", label: "Activity log" },
];

const args = process.argv.slice(2);
const shiftArg = args.find((a) => a.startsWith("--shift-hours="));
const shiftHours = shiftArg ? Number(shiftArg.split("=")[1]) : 0;
const tableArg = args.find((a) => a.startsWith("--table="));
const onlyTables = tableArg
  ? tableArg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const apply = args.includes("--apply");

const bkk = (iso: string | null) => (iso ? tzDateTimeText(iso, { seconds: true }) : "—");

async function main() {
  const required = ["DB_HOST", "DB_USER", "DB_NAME"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`❌ ยังไม่ได้ตั้งค่า ${missing.join(", ")} ใน .env`);
    process.exit(1);
  }
  if (!Number.isFinite(shiftHours)) {
    console.error("❌ --shift-hours ต้องเป็นตัวเลข เช่น --shift-hours=-7");
    process.exit(1);
  }

  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    connectTimeout: 8000,
    dateStrings: true,
    timezone: "Z",
  });

  // หมายเหตุ: สคริปต์นี้ “ไม่” บังคับ session tz = UTC เพื่อให้เห็น timezone จริงของ DB
  const [tzRows] = (await conn.query(
    "SELECT @@session.time_zone AS session_tz, @@global.time_zone AS global_tz, @@system_time_zone AS system_tz, NOW() AS db_now, UTC_TIMESTAMP() AS db_utc",
  )) as unknown as [Record<string, string>[]];
  const tz = tzRows[0] ?? {};
  const dbNowUtc = String(tz.db_now).slice(0, 16) === String(tz.db_utc).slice(0, 16);
  const nowIso = new Date().toISOString();

  console.log("──────────────────────────────────────────────");
  console.log(`🕒 ตอนนี้ (เวลาไทย) : ${bkk(nowIso)}`);
  console.log(`🌐 ตอนนี้ (UTC)      : ${nowIso}`);
  console.log(`🗄  DB NOW()         : ${tz.db_now}`);
  console.log(`🗄  DB UTC_TIMESTAMP : ${tz.db_utc}`);
  console.log(`🗄  session/global tz: ${tz.session_tz} / ${tz.global_tz}`);
  console.log(`🗄  timezone ของ OS  : ${tz.system_tz}`);
  console.log("🗄  แอปพลิเคชันบังคับ session tz = +00:00 (เก็บ UTC, แสดงผลเป็นเวลาไทย)");
  console.log(
    dbNowUtc
      ? "✅ DB NOW() ตรงกับ UTC — แถวใหม่ที่เขียนด้วย CURRENT_TIMESTAMP จะเป็น UTC"
      : "ℹ️  DB NOW() เป็นเวลาไทย (timezone ของ DB) — แถวเก่าที่เขียนด้วย CURRENT_TIMESTAMP/NOW() อาจเป็นเวลาไทย",
  );
  console.log("──────────────────────────────────────────────");

  const suspects: string[] = [];
  for (const t of TABLES) {
    try {
      const [rows] = (await conn.query(
        `SELECT COUNT(*) AS n, MAX(${t.column}) AS latest FROM ${t.table}`,
      )) as unknown as [Record<string, unknown>[]];
      const n = Number(rows[0]?.n ?? 0);
      const latest = rows[0]?.latest ? String(rows[0].latest) : null;
      const latestIso = sqlToIso(latest);
      const aheadMin = latestIso ? Math.round((Date.parse(latestIso) - Date.parse(nowIso)) / 60000) : 0;
      const suspect = aheadMin > 5;
      if (suspect) suspects.push(`${t.table}.${t.column}`);
      console.log(
        `${t.label.padEnd(18)} ${String(n).padStart(6)} แถว · ล่าสุดใน DB: ${latest ?? "—"}` +
          (latestIso ? ` → เวลาไทย ${bkk(latestIso)}` : "") +
          (suspect ? `  ⚠️ ล้ำหน้าเวลาจริง ${aheadMin} นาที (อาจเก็บเป็นเวลาไทย)` : ""),
      );
    } catch (err) {
      console.log(`${t.label.padEnd(18)} ⚠️ อ่านไม่ได้: ${(err as Error).message}`);
    }
  }

  if (suspects.length) {
    console.log(
      `\n⚠️  พบคอลัมน์ที่น่าสงสัยว่าข้อมูลเก่าเป็นเวลาไทย: ${suspects.join(", ")}\n` +
        "   → ถ้าต้องการเลื่อนครั้งเดียว ระบุตารางให้ชัดเจน เช่น\n" +
        `     npm run db:time -- --shift-hours=-7 --table=${suspects.join(",")} --apply`,
    );
  }

  if (!shiftHours) {
    console.log("\nตรวจสอบเท่านั้น (ไม่ได้แก้อะไร) — ถ้าต้องการเลื่อนเวลาให้ใส่ --shift-hours=-7 --table=<ตาราง> [--apply]");
    await conn.end();
    return;
  }

  const targets = onlyTables.length
    ? TABLES.filter((t) => onlyTables.includes(t.table))
    : TABLES;
  if (!targets.length) {
    console.error(`❌ ไม่พบตารางที่ระบุ: ${onlyTables.join(", ")}\n   ใช้ได้: ${TABLES.map((t) => t.table).join(", ")}`);
    await conn.end();
    process.exit(1);
  }
  if (apply && !onlyTables.length) {
    console.error(
      "❌ ต้องระบุ --table=<ตาราง> ทุกครั้งที่ใช้ --apply\n" +
        "   เพื่อกันการเลื่อนข้อมูลทั้งฐานซ้ำซ้อน (ข้อมูลที่ระบบใหม่เขียนเป็น UTC อยู่แล้ว)\n" +
        `   ตารางที่ใช้ได้: ${TABLES.map((t) => t.table).join(", ")}`,
    );
    await conn.end();
    process.exit(1);
  }

  console.log(
    `\n${apply ? "🚚 กำลังเลื่อนเวลา" : "🧪 ทดลอง (ยังไม่เขียนจริง)"} ${shiftHours > 0 ? "+" : ""}${shiftHours} ชั่วโมง`,
  );
  for (const t of targets) {
    const sql = `UPDATE ${t.table} SET ${t.column} = DATE_ADD(${t.column}, INTERVAL ${Math.trunc(shiftHours)} HOUR)`;
    if (!apply) {
      const [rows] = (await conn.query(`SELECT COUNT(*) AS n FROM ${t.table}`)) as unknown as [Record<string, unknown>[]];
      console.log(`  (dry-run) ${t.table}: ${rows[0]?.n ?? 0} แถว → ${sql}`);
      continue;
    }
    const [res] = (await conn.query(sql)) as unknown as [{ affectedRows: number }];
    console.log(`  ✅ ${t.table}: ${res.affectedRows} แถว`);
  }
  console.log(apply ? "\nเสร็จแล้ว — เปิดหน้า HR เพื่อตรวจเวลาอีกครั้ง" : "\nเพิ่ม --apply เพื่อเขียนจริง");

  await conn.end();
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
