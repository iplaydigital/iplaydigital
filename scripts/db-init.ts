/**
 * npm run db:init
 * สร้าง schema (db/schema.sql) บน MariaDB + seed ข้อมูลตัวอย่างถ้าฐานข้อมูลว่าง
 */
try {
  process.loadEnvFile(".env");
} catch {
  /* ใช้ค่าจาก environment โดยตรง */
}

async function main() {
  if (!process.env.DB_HOST) {
    console.error("✗ ไม่พบ DB_HOST — คัดลอก .env.example เป็น .env แล้วตั้งค่าการเชื่อมต่อก่อน");
    process.exit(1);
  }
  const { pool, ensureSchema, fetchAll } = await import("../lib/db-maria");
  console.log(`→ เชื่อมต่อ ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME} …`);
  await ensureSchema();
  const d = await fetchAll();
  console.log("✓ schema พร้อมใช้งาน (ตาราง ws_*)");
  console.log(`  members ${d.members.length} · projects ${d.projects.length} · tasks ${d.tasks.length} · events ${d.events.length}`);
  console.log(`  channels ${d.channels.length} · messages ${d.messages.length} · AI runs ${d.aiRuns.length}`);
  await pool().end();
}

main().catch((err) => {
  console.error("✗ db:init ล้มเหลว:", err.message);
  process.exit(1);
});

export {};
