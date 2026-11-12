// ─────────────────────────────────────────────────────────────
//  เวลากลางของระบบ — ยึด “เวลาไทย (Asia/Bangkok)” เสมอ
//   • ใช้ได้ทั้งฝั่ง server และ client (ไม่มี dependency)
//   • กันปัญหาเซิร์ฟเวอร์เป็น UTC แล้ววันที่/เวลาลงเวลาเพี้ยนไป 7 ชั่วโมง
//   • กันปัญหาผู้ใช้เปิดจากต่างประเทศแล้วเห็นเวลาผิด
// ─────────────────────────────────────────────────────────────

export const APP_TZ = "Asia/Bangkok";
export const APP_TZ_LABEL = "เวลาไทย (GMT+7)";

type Parts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  /** 0 = อาทิตย์ … 6 = เสาร์ (ตามเวลาไทย) */
  weekday: number;
};

const partsCache = new Map<string, Parts>();

/** แยกชิ้นส่วนวัน/เวลาของ timestamp ตามเวลาไทย */
export function tzParts(input: string | number | Date = new Date()): Parts {
  const d = input instanceof Date ? input : new Date(input);
  const valid = !Number.isNaN(d.getTime());
  const src = valid ? d : new Date();
  const key = String(src.getTime());
  const hit = partsCache.get(key);
  if (hit) return hit;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const list = Object.fromEntries(fmt.formatToParts(src).map((p) => [p.type, p.value]));
  const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = list.hour === "24" ? "00" : list.hour;
  const parts: Parts = {
    year: list.year,
    month: list.month,
    day: list.day,
    hour,
    minute: list.minute,
    second: list.second,
    weekday: WD[list.weekday as string] ?? 0,
  };
  if (partsCache.size > 4000) partsCache.clear();
  partsCache.set(key, parts);
  return parts;
}

/** วันที่ตามเวลาไทย (YYYY-MM-DD) */
export function tzDate(input: string | number | Date = new Date()): string {
  const p = tzParts(input);
  return `${p.year}-${p.month}-${p.day}`;
}

/** เวลาตามเวลาไทย (HH:mm) */
export function tzTime(input: string | number | Date = new Date()): string {
  const p = tzParts(input);
  return `${p.hour}:${p.minute}`;
}

/** เวลาตามเวลาไทยแบบมีวินาที (HH:mm:ss) */
export function tzTimeSec(input: string | number | Date = new Date()): string {
  const p = tzParts(input);
  return `${p.hour}:${p.minute}:${p.second}`;
}

/** วันที่ของวันนี้ตามเวลาไทย */
export const tzToday = () => tzDate(new Date());

/** นาทีจากเที่ยงคืนตามเวลาไทย (ใช้เทียบเวลาเข้างาน) */
export function tzMinutes(input: string | number | Date = new Date()): number {
  const p = tzParts(input);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** "HH:mm" → นาที */
export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** เดือนตามเวลาไทย (YYYY-MM) */
export function tzMonth(input: string | number | Date = new Date()): string {
  const p = tzParts(input);
  return `${p.year}-${p.month}`;
}

/** วันในสัปดาห์ตามเวลาไทย (0 = อาทิตย์) */
export const tzWeekday = (input: string | number | Date = new Date()) => tzParts(input).weekday;

/**
 * แปลงค่าวันที่+เวลาที่ผู้ใช้กรอก (ตีความเป็นเวลาไทย) → ISO (UTC)
 * รองรับ "2026-11-04T10:00", "2026-11-04 10:00", "2026-11-04"
 */
export function bkkInputToIso(value: string): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  const normalized = v.replace(" ", "T");
  const withSeconds = /T\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
  const d = new Date(`${withSeconds}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → ค่าในช่อง datetime-local (ตามเวลาไทย) */
export function isoToBkkInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = tzParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** ข้อความวันที่+เวลาไทยแบบอ่านง่าย */
export function tzDateTimeText(input: string | number | Date = new Date(), opts: { seconds?: boolean } = {}) {
  const p = tzParts(input);
  return `${Number(p.day)}/${Number(p.month)}/${Number(p.year) + 543} ${p.hour}:${p.minute}${opts.seconds ? `:${p.second}` : ""}`;
}

/** วันที่แบบไทยย่อ (เช่น 4 พ.ย. 69) */
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function tzDateTextShort(input: string | number | Date = new Date()) {
  const p = tzParts(input);
  return `${Number(p.day)} ${TH_SHORT[Number(p.month) - 1]} ${String(Number(p.year) + 543).slice(-2)}`;
}

const TH_DOW_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_MONTH_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** วันที่เต็มแบบไทยตามเวลาไทย เช่น “วันพฤหัสบดี 6 พฤศจิกายน 2569” */
export function tzThaiDateFull(input: string | number | Date = new Date()): string {
  const p = tzParts(input);
  return `วัน${TH_DOW_FULL[p.weekday]} ${Number(p.day)} ${TH_MONTH_FULL[Number(p.month) - 1]} ${Number(p.year) + 543}`;
}

// ─────────────────────────────────────────────────────────────
//  เวลาสำหรับเก็บในฐานข้อมูล (คอลัมน์ DATETIME)
//  ข้อตกลงกลาง: “เก็บเป็น UTC เสมอ” แล้วค่อยแปลงเป็นเวลาไทยตอนแสดงผล
//   • ฝั่งเขียน: sqlUtc() → "YYYY-MM-DD HH:mm:ss" (UTC)
//   • ฝั่งอ่าน : sqlToIso() → ISO ที่มี Z (ตีความว่าเป็น UTC)
//  ทำแบบนี้ทำให้ไม่ว่าเซิร์ฟเวอร์จะตั้ง timezone ไว้เป็นอะไร เวลาที่แสดงจะตรง
//  กับเวลาไทย (Asia/Bangkok) เสมอ
// ─────────────────────────────────────────────────────────────

/** เขียนลง DATETIME แบบ UTC */
export function sqlUtc(input: string | number | Date = new Date()): string {
  const d = input instanceof Date ? input : new Date(input);
  const src = Number.isNaN(d.getTime()) ? new Date() : d;
  return src.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * อ่านค่าจาก DATETIME → ISO (UTC)
 * - "2026-11-06 07:46:14"       → "2026-11-06T07:46:14.000Z" (ตีความเป็น UTC)
 * - "2026-11-06T07:46:14.871Z"  → คงค่าเดิม
 * - "2026-11-05 20:00:00+07:00" → แปลงเป็น UTC
 * - ค่าที่อ่านไม่ได้ → null (ไม่เดาเป็น epoch)
 */
export function sqlToIso(value: string | number | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const raw = String(value).trim();
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (!m) return null;

  const [, y, mo, d, h = "00", mi = "00", sec = "00", frac = "0", tz] = m;
  const ms = Math.floor(Number(`0.${frac}`) * 1000);
  let time = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec), ms);
  if (Number.isNaN(time)) return null;
  if (tz && tz !== "Z") {
    const sign = tz.startsWith("-") ? -1 : 1;
    const [oh, om] = tz.slice(1).replace(":", "").match(/\d{2}/g) ?? ["0", "0"];
    time -= sign * (Number(oh) * 60 + Number(om)) * 60000;
  }
  const out = new Date(time);
  if (Number.isNaN(out.getTime())) return null;
  // กันค่าเพี้ยน เช่นเดือน 13 ที่ Date.UTC จะปัดไปปีถัดไป
  const iso = out.toISOString();
  if (iso.slice(0, 4) !== y) return null;
  return iso;
}

/** แสดงค่าดิบจาก DB พร้อมการตีความ (ใช้ในหน้า health/diagnose) */
export function describeSqlTime(value: string | null | undefined) {
  const iso = sqlToIso(value);
  return {
    raw: value ?? null,
    iso,
    utc: iso ? `${iso.slice(11, 19)} UTC` : null,
    bangkok: iso ? `${tzTime(iso)} น. (${tzDate(iso)})` : null,
  };
}
