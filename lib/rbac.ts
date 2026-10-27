// ─────────────────────────────────────────────────────────────
//  RBAC — บทบาท / โมดูล / ขอบเขตข้อมูล (department & team)
//  4 บทบาทหลักตามที่บริษัทกำหนด
//    admin    ทีมบริหาร      → เห็นทั้งหมด รวมการเงิน
//    ai       ทีม AI          → ปฏิทินรวมทุกแผนก + ลงเวลา/ลา/แชท (ไม่เห็นการเงิน)
//    manager  หัวหน้า/manager → เกือบทุกอย่าง แต่ลบพนักงานไม่ได้ และเห็นเฉพาะแผนกตน
//    member   user            → เห็นเฉพาะแผนกตน ไม่เห็นเรื่องเงิน
//    support  IT/Support      → ดูแลบัญชีและครุภัณฑ์ทุกแผนก (ยกเว้นตั้ง Admin)
// ─────────────────────────────────────────────────────────────
import type { UserRole } from "./types";

export type ModuleKey =
  | "dashboard"
  | "calendar"
  | "tasks"
  | "ai"
  | "chat"
  | "reports"
  | "hr"
  | "staff"
  | "led"
  | "settings"
  | "finance";

export const ROLE_META: Record<
  UserRole,
  { label: string; short: string; color: string; soft: string; desc: string }
> = {
  admin: {
    label: "ทีมบริหาร (Admin)",
    short: "Admin",
    color: "#7100DD",
    soft: "rgba(113,0,221,.10)",
    desc: "เห็นและจัดการได้ทั้งหมด ทุกแผนก ทุกทีม รวมข้อมูลการเงิน",
  },
  support: {
    label: "IT / Support",
    short: "Support",
    color: "#2F7BF0",
    soft: "rgba(59,167,255,.14)",
    desc: "ดูแลบัญชีพนักงาน ครุภัณฑ์ และตั้งค่าทั่วไป (ตั้งสิทธิ์ Admin ไม่ได้)",
  },
  manager: {
    label: "หัวหน้าแผนก (Manager)",
    short: "Manager",
    color: "#149C74",
    soft: "rgba(34,199,147,.14)",
    desc: "เห็นเกือบทุกอย่างในแผนกของตน — ลบพนักงานหรือดูพนักงานแผนกอื่นไม่ได้",
  },
  ai: {
    label: "ทีม AI",
    short: "AI",
    color: "#FF6B9D",
    soft: "rgba(255,107,157,.14)",
    desc: "เห็นปฏิทินรวมทุกแผนก ลงเวลา/ลา/แชท และเทียบกับงานของทีม — ไม่เห็นการเงิน",
  },
  member: {
    label: "พนักงาน (User)",
    short: "User",
    color: "#8A8FB1",
    soft: "rgba(138,143,177,.16)",
    desc: "ใช้งานเฉพาะแผนกของตน ไม่เห็นข้อมูลการเงินหรือพนักงานแผนกอื่น",
  },
};

export const MODULE_META: Record<ModuleKey, { label: string; group: string; desc: string }> = {
  dashboard: { label: "แดชบอร์ด", group: "Workspace", desc: "ภาพรวมตามสิทธิ์ของบทบาท" },
  calendar: { label: "ปฏิทิน", group: "Workspace", desc: "ปฏิทินทีม/แผนก · เดดไลน์งาน" },
  tasks: { label: "งาน & Kanban", group: "Workspace", desc: "งานของแผนก · สถานะ 4 ขั้น" },
  ai: { label: "AI Workforce", group: "Workspace", desc: "เอเจนต์ AI และ run log" },
  chat: { label: "แชท & Drive", group: "Workspace", desc: "ห้องแชททีมและไฟล์ Drive" },
  reports: { label: "รายงาน & Drive", group: "Workspace", desc: "รายงาน + ไฟล์แนบ Drive" },
  hr: { label: "HR & ลงเวลา", group: "Workspace", desc: "ลงเวลา · ลา · จองห้อง" },
  staff: { label: "พนักงาน & สิทธิ์", group: "บริหาร", desc: "ทะเบียนพนักงาน · ประวัติแก้ไข · การเข้าใช้" },
  finance: { label: "การเงิน", group: "บริหาร", desc: "งบประมาณ/ต้นทุน (เฉพาะ Admin และ Manager)" },
  led: { label: "จอ LED", group: "จอแสดงผล", desc: "Playwall Park Silom" },
  settings: { label: "ตั้งค่า", group: "ระบบ", desc: "องค์กร · การเชื่อมต่อ · ฐานข้อมูล" },
};

/** โมดูลที่แต่ละบทบาทเข้าถึงได้ */
const ACCESS: Record<UserRole, ModuleKey[]> = {
  admin: ["dashboard", "calendar", "tasks", "ai", "chat", "reports", "hr", "staff", "finance", "led", "settings"],
  support: ["dashboard", "calendar", "tasks", "chat", "reports", "hr", "staff", "led", "settings"],
  manager: ["dashboard", "calendar", "tasks", "chat", "reports", "hr", "staff", "finance", "led"],
  ai: ["dashboard", "calendar", "hr", "chat"],
  member: ["dashboard", "calendar", "tasks", "chat", "reports", "hr"],
};

/** ขอบเขตข้อมูลของแต่ละบทบาท */
export interface RoleScope {
  /** เห็นพนักงาน/งานข้ามแผนกหรือไม่ */
  allDepartments: boolean;
  /** เห็นปฏิทินรวมทุกแผนก */
  allCalendar: boolean;
  /** จัดการทะเบียนพนักงานได้ (ในขอบเขตที่อนุญาต) */
  manageStaff: boolean;
  /** ลบพนักงานได้ */
  deleteStaff: boolean;
  /** ตั้ง/ถอดสิทธิ์ Admin ได้ */
  grantAdmin: boolean;
  /** เห็นข้อมูลการเงิน (งบ/ต้นทุน) */
  money: boolean;
  /** แก้ไขตั้งค่าระบบ */
  editSettings: boolean;
  /** อนุมัติใบลา/คำขอเบิกของ */
  approve: boolean;
}

const SCOPE: Record<UserRole, RoleScope> = {
  admin: { allDepartments: true, allCalendar: true, manageStaff: true, deleteStaff: true, grantAdmin: true, money: true, editSettings: true, approve: true },
  support: { allDepartments: true, allCalendar: true, manageStaff: true, deleteStaff: true, grantAdmin: false, money: false, editSettings: true, approve: true },
  manager: { allDepartments: false, allCalendar: true, manageStaff: true, deleteStaff: false, grantAdmin: false, money: true, editSettings: false, approve: true },
  ai: { allDepartments: true, allCalendar: true, manageStaff: false, deleteStaff: false, grantAdmin: false, money: false, editSettings: false, approve: false },
  member: { allDepartments: false, allCalendar: false, manageStaff: false, deleteStaff: false, grantAdmin: false, money: false, editSettings: false, approve: false },
};

export function roleScope(role: UserRole | null | undefined): RoleScope {
  return SCOPE[(role ?? "member") as UserRole] ?? SCOPE.member;
}

export function canAccess(role: UserRole | null | undefined, mod: ModuleKey): boolean {
  if (!role) return false;
  return (ACCESS[role] ?? []).includes(mod);
}

export function visibleModules(role: UserRole | null | undefined): ModuleKey[] {
  return role ? (ACCESS[role] ?? []) : [];
}

/** ตรวจว่าบทบาทนี้ “เห็นข้อมูลของแผนกนี้” ได้หรือไม่ */
export function canSeeDepartment(
  role: UserRole | null | undefined,
  myDept: string | null | undefined,
  targetDept: string | null | undefined,
): boolean {
  const s = roleScope(role);
  if (s.allDepartments) return true;
  if (!targetDept) return false;
  return targetDept === myDept;
}

export function roleLabel(role: UserRole | null | undefined) {
  return role ? ROLE_META[role]?.label ?? role : "—";
}
