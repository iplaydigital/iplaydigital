/**
 * npm run super:setup            → สร้าง/ปรับ Super Admin ตาม SUPER_ADMIN_EMAILS
 * npm run super:setup -- --force → ตั้งรหัสผ่านใหม่ให้ทุกคนในรายการ (ค่าเริ่มต้น admin123)
 *
 * ค่าเริ่มต้น: it@playdigital.co.th, jimm@playdigital.co.th · รหัส admin123
 */
import fs from "fs";

try {
  process.loadEnvFile(".env");
} catch {
  /* ใช้ค่าจาก environment */
}

async function main() {
  const force = process.argv.includes("--force");
  const { superAdminEmails, isSuperAdmin } = await import("../lib/oauth-config");
  const { ensureSeedUsers, ensureSuperAdmins, getUserByEmail, updateUser, hashPassword, superAdminPassword, toClient } = await import("../lib/users");

  console.log("Super Admin ที่กำหนด:", superAdminEmails().join(", "));
  await ensureSeedUsers();

  if (force) {
    const pw = superAdminPassword();
    for (const email of superAdminEmails()) {
      const u = await getUserByEmail(email);
      if (!u) {
        console.log(`! ไม่พบบัญชี ${email} (ข้าม)`);
        continue;
      }
      await updateUser(u.id, { passwordHash: hashPassword(pw), role: "admin", active: true }, { silent: true });
      console.log(`✓ ตั้งรหัสผ่านใหม่ให้ ${email}`);
    }
  } else {
    await ensureSuperAdmins();
  }

  for (const email of superAdminEmails()) {
    const u = await getUserByEmail(email);
    if (!u) {
      console.log(`✗ ${email} — ไม่พบบัญชี`);
      continue;
    }
    const client = toClient(u);
    console.log(`${isSuperAdmin(client) ? "✓" : "✗"} ${u.email} · role=${u.role} · super=${isSuperAdmin(client) ? "yes" : "no"} · active=${u.active ? "yes" : "no"}`);
  }

  // ตรวจไฟล์ .data (โหมด demo) ให้ผู้ใช้รู้ว่าเก็บที่ไหน
  if (!process.env.DB_HOST) {
    console.log("\nℹ ยังไม่ได้ตั้ง DB_HOST — บัญชีถูกเก็บใน .data/users.json (โหมด demo)");
    if (fs.existsSync(".data/users.json")) console.log("  ไฟล์:", fs.realpathSync(".data/users.json"));
  }
  console.log(`\nรหัสผ่าน Super Admin: ${process.env.SUPER_ADMIN_PASSWORD ? "จาก SUPER_ADMIN_PASSWORD" : "admin123 (ค่าเริ่มต้น)"}`);
}

main().catch((err) => {
  console.error("❌ ไม่สำเร็จ:", (err as Error).message);
  process.exit(1);
});
