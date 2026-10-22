import type { EventCat, Priority, TaskStatus } from "./types";

export const pad = (n: number) => String(n).padStart(2, "0");
export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const d2s = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const s2d = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
};
export const addDays = (d: Date | string, n: number) => {
  const x = typeof d === "string" ? s2d(d) : new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  return x;
};
export const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7; // Monday-first
  x.setDate(x.getDate() - diff);
  return x;
};
export const daysBetween = (a: string, b: string) =>
  Math.round((s2d(b).getTime() - s2d(a).getTime()) / 86400000);
export const daysLeft = (due: string) => daysBetween(d2s(new Date()), due);
export const sameDay = (a: string, b: string) => a === b;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
export const TH_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export const TH_DOW_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const BE = (y: number) => y + 543;

export function thaiDate(input: string | Date, opts: { short?: boolean; withDay?: boolean; weekday?: boolean } = {}) {
  const d = typeof input === "string" ? s2d(input) : input;
  const m = opts.short ? TH_MONTHS_SHORT[d.getMonth()] : TH_MONTHS[d.getMonth()];
  const day = opts.weekday ? `${TH_DOW_FULL[d.getDay()]}ที่ ` : "";
  return `${day}${d.getDate()} ${m} ${BE(d.getFullYear())}`;
}
export function thaiShort(input: string | Date) {
  const d = typeof input === "string" ? s2d(input) : input;
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`;
}
export function thaiFull(input: string | Date) {
  const d = typeof input === "string" ? s2d(input) : input;
  return `${TH_DOW_FULL[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${BE(d.getFullYear())}`;
}
export function thaiTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function relDay(date: string) {
  const n = daysLeft(date);
  if (n === 0) return "วันนี้";
  if (n === 1) return "พรุ่งนี้";
  if (n === 2) return "มะรืนนี้";
  if (n < 0) return `เลย ${Math.abs(n)} วัน`;
  return `อีก ${n} วัน`;
}
export function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "เมื่อสักครู่";
  if (diff < 60) return `${Math.floor(diff)} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  const d = Math.floor(diff / 1440);
  if (d === 1) return "เมื่อวาน";
  if (d < 7) return `${d} วันที่แล้ว`;
  return thaiShort(new Date(iso));
}

export const STATUS_META: Record<TaskStatus, { label: string; color: string; soft: string }> = {
  todo: { label: "รอดำเนินการ", color: "#8A8FB1", soft: "rgba(138,143,177,.14)" },
  doing: { label: "กำลังทำ", color: "#2F7BF0", soft: "rgba(59,167,255,.14)" },
  review: { label: "ตรวจแก้", color: "#C77E00", soft: "rgba(255,176,32,.16)" },
  done: { label: "เสร็จแล้ว", color: "#0F9D6F", soft: "rgba(34,199,147,.14)" },
};
export const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];

export const PRIORITY_META: Record<Priority, { label: string; color: string; soft: string }> = {
  urgent: { label: "ด่วนมาก", color: "#E23E5C", soft: "rgba(255,92,122,.14)" },
  high: { label: "สูง", color: "#D9740E", soft: "rgba(255,154,90,.18)" },
  med: { label: "ปานกลาง", color: "#2F6FE0", soft: "rgba(91,141,239,.14)" },
  low: { label: "ต่ำ", color: "#8A8FB1", soft: "rgba(138,143,177,.14)" },
};

export const CAT_META: Record<EventCat, { label: string; color: string; soft: string; icon: string }> = {
  work: { label: "งาน / เดดไลน์", color: "#5B4BD6", soft: "#efedfd", icon: "flame" },
  meeting: { label: "ประชุม", color: "#2C6FD8", soft: "#e9f3ff", icon: "users" },
  delivery: { label: "ส่งมอบ", color: "#0F9D6F", soft: "#e5f9f2", icon: "package" },
  finance: { label: "การเงิน", color: "#B8790A", soft: "#fff6e4", icon: "wallet" },
  holiday: { label: "วันหยุด", color: "#D6457A", soft: "#ffeef4", icon: "palm" },
  personal: { label: "ส่วนตัว", color: "#6B7196", soft: "#f1f2fa", icon: "user" },
};
export const CAT_ORDER: EventCat[] = ["work", "meeting", "delivery", "finance", "holiday", "personal"];

export const LEAVE_META: Record<string, { label: string; color: string }> = {
  annual: { label: "ลาพักร้อน", color: "#6C5CE7" },
  sick: { label: "ลาป่วย", color: "#E23E5C" },
  personal: { label: "ลากิจ", color: "#C77E00" },
  wfh: { label: "Work from home", color: "#2F7BF0" },
  business: { label: "ไปพบลูกค้า / Site visit", color: "#0F9D6F" },
};

export const money = (n: number) =>
  "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
export const moneyK = (n: number) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `฿${Math.round(n / 1000)}k` : `฿${n}`;
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const initials = (s: string) => s.trim().slice(0, 3);

/** เลือกสีตัวอักษร (ขาว/เข้ม) ให้อ่านง่ายบนพื้นสีที่กำหนด */
/** แปลงสีชุดเก่า (ธีม dark) → พาเลตต์ MNG light โดยไม่ต้อง reseed ข้อมูลเดิม */
const COLOR_REMAP: Record<string, string> = {
  "#8b7cff": "#6C5CE7",
  "#4cc3ff": "#3BA7FF",
  "#35e0a1": "#22C793",
  "#ffc24d": "#D98A00",
  "#ff7ba9": "#FF6B9D",
  "#9aa7c7": "#8A8FB1",
  "#a78bfa": "#8E7CF3",
  "#ff8a5c": "#FF9A5A",
  "#ff6b8a": "#E23E5C",
  "#ffa15c": "#D9740E",
};
export const remapColor = (c?: string) => (c ? COLOR_REMAP[c.toLowerCase()] ?? c : c);

export const textOn = (hex: string) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.66 ? "#23264D" : "#ffffff";
};
export const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const isDriveUrl = (u: string) => /drive\.google\.com|docs\.google\.com/.test(u);
export const driveKind = (u: string): "doc" | "sheet" | "slide" | "pdf" | "image" | "folder" | "other" => {
  if (/\/folders\//.test(u)) return "folder";
  if (/document\/d/.test(u)) return "doc";
  if (/spreadsheets\/d/.test(u)) return "sheet";
  if (/presentation\/d/.test(u)) return "slide";
  if (/\.pdf($|\?)/.test(u)) return "pdf";
  if (/\.(png|jpe?g|webp|gif)($|\?)/.test(u)) return "image";
  return "other";
};
