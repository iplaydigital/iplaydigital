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
  todo: { label: "รอดำเนินการ", color: "#9AA7C7", soft: "rgba(154,167,199,.14)" },
  doing: { label: "กำลังทำ", color: "#4CC3FF", soft: "rgba(76,195,255,.14)" },
  review: { label: "ตรวจแก้", color: "#FFC24D", soft: "rgba(255,194,77,.14)" },
  done: { label: "เสร็จแล้ว", color: "#35E0A1", soft: "rgba(53,224,161,.14)" },
};
export const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];

export const PRIORITY_META: Record<Priority, { label: string; color: string; soft: string }> = {
  urgent: { label: "ด่วนมาก", color: "#FF6B8A", soft: "rgba(255,107,138,.14)" },
  high: { label: "สูง", color: "#FFA15C", soft: "rgba(255,161,92,.14)" },
  med: { label: "ปานกลาง", color: "#4CC3FF", soft: "rgba(76,195,255,.14)" },
  low: { label: "ต่ำ", color: "#9AA7C7", soft: "rgba(154,167,199,.14)" },
};

export const CAT_META: Record<EventCat, { label: string; color: string; soft: string; icon: string }> = {
  work: { label: "งาน / เดดไลน์", color: "#8B7CFF", soft: "rgba(139,124,255,.16)", icon: "flame" },
  meeting: { label: "ประชุม", color: "#4CC3FF", soft: "rgba(76,195,255,.16)", icon: "users" },
  delivery: { label: "ส่งมอบ", color: "#35E0A1", soft: "rgba(53,224,161,.16)", icon: "package" },
  finance: { label: "การเงิน", color: "#FFC24D", soft: "rgba(255,194,77,.16)", icon: "wallet" },
  holiday: { label: "วันหยุด", color: "#FF7BA9", soft: "rgba(255,123,169,.16)", icon: "palm" },
  personal: { label: "ส่วนตัว", color: "#9AA7C7", soft: "rgba(154,167,199,.16)", icon: "user" },
};
export const CAT_ORDER: EventCat[] = ["work", "meeting", "delivery", "finance", "holiday", "personal"];

export const LEAVE_META: Record<string, { label: string; color: string }> = {
  annual: { label: "ลาพักร้อน", color: "#8B7CFF" },
  sick: { label: "ลาป่วย", color: "#FF6B8A" },
  personal: { label: "ลากิจ", color: "#FFC24D" },
  wfh: { label: "Work from home", color: "#4CC3FF" },
  business: { label: "ไปพบลูกค้า / Site visit", color: "#35E0A1" },
};

export const money = (n: number) =>
  "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
export const moneyK = (n: number) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `฿${Math.round(n / 1000)}k` : `฿${n}`;
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const initials = (s: string) => s.trim().slice(0, 3);
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
