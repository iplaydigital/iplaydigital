/**
 * db:migrate — สร้าง/อัปเกรดตารางทั้งหมด (idempotent)
 *   npm run db:migrate
 * ตรวจโครงสร้าง: แผนก/ทีม, ผู้ใช้ระบบ, audit log, login log, รายงาน
 */
import fs from "fs";
import path from "path";

try {
  process.loadEnvFile(".env");
} catch {
  /* ใช้ค่าจาก environment */
}

async function main() {
  const required = ["DB_HOST", "DB_USER", "DB_NAME"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`❌ ยังไม่ได้ตั้งค่า ${missing.join(", ")} ใน .env`);
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
  });
  console.log(`✅ เชื่อมต่อ ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`);

  const sqlFile = path.join(process.cwd(), "db", "schema.sql");
  const sql = fs.readFileSync(sqlFile, "utf8");
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  let ok = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      ok++;
    } catch (err) {
      const msg = (err as Error).message;
      if (/already exists|Duplicate/i.test(msg)) skipped++;
      else console.warn("⚠️ ", msg.slice(0, 120));
    }
  }
  console.log(`✅ ตารางพร้อมใช้งาน · สั่งสำเร็จ ${ok} · ข้าม ${skipped}`);

  const [rows] = await conn.query("SHOW TABLES LIKE 'ws_%'");
  const tables = (rows as Record<string, string>[]).map((r) => Object.values(r)[0]);
  console.log(`📋 ตาราง ws_* (${tables.length}): ${tables.join(", ")}`);
  for (const want of ["ws_users", "ws_audit_logs", "ws_login_logs", "ws_departments", "ws_teams"]) {
    console.log(`   ${tables.includes(want) ? "✅" : "❌"} ${want}`);
  }
  await conn.end();
}

main().catch((err) => {
  console.error("❌ migrate ไม่สำเร็จ:", (err as Error).message);
  process.exit(1);
});
