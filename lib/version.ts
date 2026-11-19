/**
 * ข้อมูล build ที่ฝังตอน build — ใช้ตอบคำถาม “production อัปเดตรึยัง”
 *
 * next.config.mjs จะใส่ APP_COMMIT / APP_BRANCH / APP_BUILT_AT ให้ตอน build
 * ถ้าไม่มี (เช่น build จาก tarball ที่ไม่มี .git) จะเป็นค่าว่าง
 */
export const BUILD = {
  commit: process.env.APP_COMMIT || "",
  branch: process.env.APP_BRANCH || "",
  builtAt: process.env.APP_BUILT_AT || "",
  node: process.version,
  env: process.env.NODE_ENV || "development",
};

/** สรุปสั้น ๆ สำหรับ log/health */
export const buildSummary = () =>
  `${BUILD.commit || "unknown"}${BUILD.builtAt ? ` · ${BUILD.builtAt}` : ""}`;
