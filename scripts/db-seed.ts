/**
 * npm run db:seed
 * ล้างข้อมูลในตาราง ws_* และ seed ชุดตัวอย่างใหม่ (ใช้ demo data ชุดเดียวกับโหมด demo)
 */
try {
  process.loadEnvFile(".env");
} catch {
  /* noop */
}

async function main() {
  if (!process.env.DB_HOST) {
    console.error("✗ ไม่พบ DB_HOST — ตั้งค่า .env ก่อน");
    process.exit(1);
  }
  const { applyMaria, fetchAll, pool } = await import("../lib/db-maria");
  console.log("→ กำลังรีเซ็ตข้อมูลและ seed ใหม่…");
  await applyMaria({ type: "reset" });
  const d = await fetchAll();
  console.log(`✓ seed สำเร็จ — tasks ${d.tasks.length} · events ${d.events.length} · messages ${d.messages.length}`);
  await pool().end();
}

main().catch((err) => {
  console.error("✗ db:seed ล้มเหลว:", err.message);
  process.exit(1);
});

export {};
