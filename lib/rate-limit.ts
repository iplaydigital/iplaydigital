/**
 * rate limit แบบ in-memory (ต่อ process) — พอสำหรับกัน brute force ระดับเว็บ
 * ถ้า pm2 รันหลาย instance ให้ใช้ nginx limit_req เสริม (ระบุใน docs/PENTEST.md)
 */
type Bucket = number[];

const store = new Map<string, Bucket>();
let lastPrune = Date.now();

function prune(now: number, windowMs: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [k, hits] of store) {
    const alive = hits.filter((t) => now - t < windowMs);
    if (alive.length) store.set(k, alive);
    else store.delete(k);
  }
  if (store.size > 20_000) store.clear();
}

export type RateResult =
  | { ok: true; remaining: number }
  | { ok: false; remaining: 0; retryAfter: number; hits: number };

/** นับความพยายามในช่วงเวลาที่กำหนด */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  prune(now, windowMs);
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    store.set(key, hits);
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    return { ok: false, remaining: 0, retryAfter, hits: hits.length };
  }
  hits.push(now);
  store.set(key, hits);
  return { ok: true, remaining: limit - hits.length };
}

/** ล้าง bucket (เช่น login สำเร็จ) */
export function resetRateLimit(key: string) {
  store.delete(key);
}

/** จำนวนครั้งที่บันทึกไว้ (ใช้ในเทสต์) */
export function rateLimitCount(key: string) {
  return store.get(key)?.length ?? 0;
}

export const LOGIN_LIMIT = {
  /** ต่อ IP */
  ip: { limit: Number(process.env.LOGIN_LIMIT_IP || 20), windowMs: 5 * 60_000 },
  /** ต่อบัญชี (นับเฉพาะที่ผิด) */
  account: { limit: Number(process.env.LOGIN_LIMIT_ACCOUNT || 8), windowMs: 15 * 60_000 },
};
