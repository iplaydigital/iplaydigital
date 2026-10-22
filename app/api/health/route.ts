import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check — ping MariaDB จริง (ไม่ใช่แค่ดูว่ามี DB_HOST หรือไม่)
 *   curl -s https://your.domain/api/health | jq
 */
export async function GET() {
  const configured = Boolean(process.env.DB_HOST);
  const started = Date.now();

  if (!configured) {
    return NextResponse.json({
      ok: true,
      storage: "demo",
      mode: "demo",
      note: "ยังไม่ได้ตั้งค่า DB_HOST — ใช้ demo store (.data/store.json)",
      db: { configured: false, ok: false, error: null },
      time: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
  }

  try {
    const [{ pool }, { pingDb }] = await Promise.all([import("@/lib/db-maria"), import("@/lib/db-diag")]);
    const db = await pingDb(pool());
    return NextResponse.json(
      {
        ok: db.ok,
        storage: db.ok ? "mariadb" : process.env.DB_REQUIRED === "1" ? "down" : "fallback",
        mode: db.ok ? "mariadb" : "fallback",
        db,
        time: new Date().toISOString(),
        latencyMs: Date.now() - started,
      },
      { status: db.ok || process.env.DB_REQUIRED !== "1" ? 200 : 503 },
    );
  } catch (err) {
    const { describeDbError } = await import("@/lib/db-diag");
    return NextResponse.json(
      { ok: false, storage: "fallback", mode: "fallback", db: { configured: true, ok: false, error: describeDbError(err) }, time: new Date().toISOString() },
      { status: process.env.DB_REQUIRED === "1" ? 503 : 200 },
    );
  }
}
