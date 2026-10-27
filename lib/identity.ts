// ─────────────────────────────────────────────────────────────
//  กติกาการเข้าใช้ (identity)
//   • อีเมลที่ใช้ login ได้: @playdigital.co.th (บริษัท) และ @gmail.com
//   • Google Drive ใช้ได้เฉพาะบัญชี Google (Gmail) ของผู้ใช้เอง
//   • LINE เป็นอีกช่องทาง: ผูกจากหน้าโปรไฟล์ หรือ login ด้วย LINE ที่ผูกไว้แล้ว
// ─────────────────────────────────────────────────────────────
export const DEFAULT_DOMAINS = "playdigital.co.th,gmail.com";

export function allowedDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAIN || DEFAULT_DOMAINS;
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function emailDomain(email: string): string {
  const e = (email || "").trim().toLowerCase();
  return e.includes("@") ? e.split("@")[1] : "";
}

export function isAllowedEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  const list = allowedDomains();
  // gmail.com ต้องตรงเป๊ะ · โดเมนบริษัทอนุญาต subdomain (เช่น ai.playdigital.co.th)
  return list.some((d) => (d === "gmail.com" ? domain === "gmail.com" : domain === d || domain.endsWith("." + d)));
}

export function isGmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain === "gmail.com" || domain === "googlemail.com";
}

export function isWorkspace(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain || isGmail(email)) return false;
  return allowedDomains().some((d) => d !== "gmail.com" && (domain === d || domain.endsWith("." + d)));
}

/** ช่องทางที่บัญชีนี้ใช้ได้ */
export function loginChannels(email: string): { password: boolean; google: boolean; line: boolean } {
  const gmail = isGmail(email);
  const workspace = isWorkspace(email);
  return {
    password: isAllowedEmail(email),
    // Google ใช้ได้ทั้ง Gmail และ Workspace (Workspace = Google Workspace ของบริษัท)
    google: gmail || workspace,
    line: true,
  };
}

/**
 * Google Drive: ต้องเป็นบัญชี Google ของผู้ใช้เอง
 * - @gmail.com ใช้ Drive ส่วนตัวได้ทันทีเมื่อเชื่อมต่อ
 * - @playdigital.co.th ใช้ได้เมื่อบริษัทเปิด Google Workspace และผู้ใช้เชื่อมต่อบัญชี Google ของตน
 */
export function driveScopeFor(email: string): { allowed: boolean; reason: string } {
  if (!isAllowedEmail(email)) {
    return { allowed: false, reason: "อีเมลนี้ไม่ได้รับอนุญาตให้ใช้ Drive" };
  }
  if (isGmail(email)) return { allowed: true, reason: "ใช้ Google Drive ส่วนตัวของ Gmail" };
  return { allowed: true, reason: "ใช้ Google Drive ของบัญชี Google Workspace บริษัท" };
}

/** โดเมนสำหรับพารามิเตอร์ hd ของ Google — ใส่เฉพาะเมื่อไม่รองรับ gmail.com */
export function googleHostedDomain(): string | null {
  // ถ้าอนุญาต @gmail.com ต้องไม่ส่ง hd (hd จะบล็อกบัญชี Gmail ทั้งหมด)
  const all = allowedDomains();
  if (all.includes("gmail.com")) return null;
  const list = all.filter((d) => d !== "gmail.com" && !d.endsWith(".gmail.com"));
  return list.length === 1 ? list[0] : null;
}

export function domainLabel(): string {
  return allowedDomains().map((d) => "@" + d).join(" หรือ ");
}
