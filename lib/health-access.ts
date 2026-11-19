/**
 * ใครดูรายละเอียดสุขภาพระบบได้
 *  - ผู้ใช้ที่ล็อกอินและเป็น admin/support (หรือ super admin)
 *  - ผู้ถือ HEALTH_TOKEN (สำหรับ monitoring / สคริปต์ ops) ผ่าน header `x-health-token`
 * ผู้ใช้อื่น/ผู้ไม่ล็อกอินเห็นแค่สถานะพื้นฐาน (กัน information disclosure)
 */
export async function canSeeHealthDetails(req: Request): Promise<{ ok: boolean; via: "token" | "session" | "none" }> {
  const token = process.env.HEALTH_TOKEN;
  if (token) {
    const given = req.headers.get("x-health-token") ?? "";
    if (given.length === token.length && safeEqual(given, token)) return { ok: true, via: "token" };
  }
  try {
    const { getSessionUser } = await import("./auth");
    const user = await getSessionUser();
    if (user && (user.isSuper || user.role === "admin" || user.role === "support")) {
      return { ok: true, via: "session" };
    }
  } catch {
    /* ไม่มี session ก็แค่เห็นข้อมูลพื้นฐาน */
  }
  return { ok: false, via: "none" };
}

function safeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
