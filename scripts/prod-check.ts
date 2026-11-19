/**
 * prod:check — ตรวจว่า “โค้ดล่าสุดขึ้น production แล้วหรือยัง” + ระบบยังทำงานครบ
 *
 *   npm run prod:check                                   # ตรวจ https://i.playdigital.co.th (หรือ PROD_URL)
 *   npm run prod:check -- --url https://... --user it@playdigital.co.th --password ***
 *   HEALTH_TOKEN=xxx npm run prod:check                  # ดูรายละเอียด DB โดยไม่ต้องล็อกอิน
 *
 * ค่าเริ่มต้นอ่านจาก .env: PROD_URL, PROD_USER, PROD_PASSWORD, HEALTH_TOKEN
 * ทุกครั้งที่ deploy production ให้รันซ้ำเพื่อ recheck รอบสุดท้าย (final)
 */
import { execSync } from "node:child_process";
import { Http, arg, hasFlag, summary, table, type Result } from "./lib/http";

try {
  process.loadEnvFile(".env");
} catch {
  /* ใช้ค่าจาก environment */
}

const local = (cmd: string) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

const baseUrl = arg("url") || process.env.PROD_URL || "https://i.playdigital.co.th";
const email = arg("user") || process.env.PROD_USER || "";
const password = arg("password") || process.env.PROD_PASSWORD || "";
const healthToken = arg("health-token") || process.env.HEALTH_TOKEN || "";
const rows: Result[] = [];
const add = (r: Result) => rows.push(r);

interface HealthBody {
  ok?: boolean;
  mode?: string;
  storage?: string;
  time?: string;
  timeBangkok?: string;
  timeZone?: string;
  serverTimeZone?: string;
  build?: { commit?: string | null; branch?: string | null; builtAt?: string | null; env?: string };
  db?: {
    ok?: boolean;
    host?: string;
    user?: string;
    database?: string;
    server?: string;
    tables?: number | null;
    schemaReady?: boolean;
    latencyMs?: number | null;
    error?: { code?: string; message?: string; hint?: string } | null;
  };
  access?: string;
}

interface TimeBody {
  roundTrip?: { matches?: boolean; written?: string; displayed?: string };
  server?: { utc?: string; bangkok?: string };
  database?: {
    restricted?: boolean;
    latestCheckinLooksStoredAsBangkok?: boolean;
    sessionTimeZone?: string;
    dbNowLooksUtc?: boolean;
    error?: string;
  };
  build?: { commit?: string | null; builtAt?: string | null };
}

async function main() {
  console.log(`\n🔎 prod:check → ${baseUrl}\n${"─".repeat(70)}`);
  const http = new Http(baseUrl);
  const localCommit = local("git rev-parse --short HEAD");
  const localSubject = local("git log -1 --format=%s");

  // 1) เข้าถึงเว็บได้ไหม
  let health: { status: number; body: HealthBody } | null = null;
  try {
    const res = await http.fetch("/api/health", { timeoutMs: 20_000 });
    const text = await res.text();
    let body: HealthBody = {};
    try {
      body = JSON.parse(text) as HealthBody;
    } catch {
      body = {};
    }
    health = { status: res.status, body };
    add({
      id: "NET-01",
      name: "เข้าถึงเว็บproductionได้",
      status: res.status < 500 ? "PASS" : "FAIL",
      detail: `HTTP ${res.status} · ${res.headers.get("content-type") ?? "-"}`,
    });
    if (res.status >= 500) throw new Error(`production ตอบ HTTP ${res.status}`);
    if (!body.build) {
      add({
        id: "DEPLOY-00",
        name: "เวอร์ชันที่ deploy",
        status: "WARN",
        detail: "production ยังไม่รู้จัก field build — เป็น build เก่าก่อน PR #16",
      });
    }
  } catch (err) {
    add({
      id: "NET-01",
      name: "เข้าถึงเว็บproductionได้",
      status: "FAIL",
      detail: (err as Error).message,
    });
    finish(rows, health);
    return;
  }

  // 2) เทียบ commit กับ main ในเครื่อง
  const remoteCommit = health.body.build?.commit ?? "";
  if (remoteCommit && localCommit) {
    const same = remoteCommit === localCommit;
    add({
      id: "DEPLOY-01",
      name: "production = commit ล่าสุดหรือยัง",
      status: same ? "PASS" : "WARN",
      detail: same
        ? `${remoteCommit} ตรงกับ HEAD (${localSubject})`
        : `production ${remoteCommit} ≠ local ${localCommit} → ยังต้อง deploy`,
    });
  }
  if (health.body.build?.builtAt) {
    add({
      id: "DEPLOY-02",
      name: "เวลาที่ build ล่าสุด",
      status: "INFO",
      detail: `${health.body.build.builtAt} (branch ${health.body.build.branch ?? "?"})`,
    });
  }

  // 3) เวลาไทย
  const serverUtc = health.body.time ? Date.parse(health.body.time) : NaN;
  const driftSec = Number.isFinite(serverUtc) ? Math.round((Date.now() - serverUtc) / 1000) : null;
  add({
    id: "TIME-01",
    name: "นาฬิกาเซิร์ฟเวอร์",
    status: driftSec != null && Math.abs(driftSec) <= 120 ? "PASS" : "FAIL",
    detail: driftSec != null ? `คลาด ${driftSec} วินาที · ${health.body.timeBangkok ?? ""}` : "อ่านเวลาไม่ได้",
  });
  add({
    id: "TIME-02",
    name: "เขตเวลาที่ใช้แสดงผล",
    status: health.body.timeZone === "Asia/Bangkok" ? "PASS" : "WARN",
    detail: `timeZone=${health.body.timeZone ?? "-"} · serverTZ=${health.body.serverTimeZone ?? "-"}`,
  });

  // 4) ตรวจ endpoint ที่ต้องล็อกอิน (ต้องไม่หลุดให้คนนอก)
  for (const ep of ["/api/bootstrap", "/api/staff", "/api/users", "/api/reports"]) {
    try {
      const res = await http.fetch(ep, { timeoutMs: 15_000 });
      add({
        id: "AUTH-01",
        name: `ไม่ล็อกอินต้องโดนปฏิเสธ ${ep}`,
        status: res.status === 401 || res.status === 403 || res.status === 302 || res.status === 307 ? "PASS" : "FAIL",
        detail: `HTTP ${res.status}`,
      });
    } catch (err) {
      add({ id: "AUTH-01", name: `ตรวจ ${ep}`, status: "FAIL", detail: (err as Error).message });
    }
  }

  // 5) security headers พื้นฐาน
  const home = await http.fetch("/", { timeoutMs: 20_000 }).catch(() => null);
  if (home) {
    const need: [string, string][] = [
      ["strict-transport-security", "HSTS"],
      ["content-security-policy", "CSP"],
      ["x-content-type-options", "nosniff"],
      ["referrer-policy", "Referrer-Policy"],
      ["permissions-policy", "Permissions-Policy"],
    ];
    const missing = need.filter(([h]) => !home.headers.get(h)).map(([, label]) => label);
    add({
      id: "HDR-01",
      name: "security headers",
      status: missing.length === 0 ? "PASS" : "WARN",
      detail: missing.length ? `ขาด: ${missing.join(", ")} (ต้อง deploy build ใหม่)` : "ครบ",
    });
    add({
      id: "HDR-02",
      name: "ไม่เปิดเผย x-powered-by",
      status: home.headers.get("x-powered-by") ? "WARN" : "PASS",
      detail: home.headers.get("x-powered-by") ?? "ไม่พบ header",
    });
  }

  // 6) ล็อกอิน + รายละเอียด DB (ถ้ามีข้อมูลล็อกอิน)
  let authed = false;
  if (email && password) {
    const res = await http.login(email, password);
    authed = res.status === 200 && Boolean(res.body?.ok);
    add({
      id: "AUTH-02",
      name: "ล็อกอินด้วยบัญชี ops",
      status: authed ? "PASS" : "FAIL",
      detail: authed ? `เข้าสู่ระบบในชื่อ ${email}` : `HTTP ${res.status} · ${(res.body as { error?: string })?.error ?? ""}`,
    });
  } else {
    add({
      id: "AUTH-02",
      name: "ล็อกอินด้วยบัญชี ops",
      status: "INFO",
      detail: "ข้าม — ใส่ --user/--password หรือ PROD_USER/PROD_PASSWORD เพื่อตรวจส่วนที่ต้องล็อกอิน",
    });
  }

  const detailHeaders: Record<string, string> = {};
  if (healthToken) detailHeaders["x-health-token"] = healthToken;

  const isDemo = health.body.mode === "demo";
  if ((authed || healthToken) && isDemo) {
    add({ id: "DB-00", name: "โหมดจัดเก็บข้อมูล", status: "INFO", detail: "demo store (.data/store.json) — ไม่ได้ตั้ง DB_HOST บน production" });
  } else if (authed || healthToken) {
    const h = await http.json<HealthBody>("/api/health", { headers: detailHeaders });
    const db = h.body.db;
    add({
      id: "DB-01",
      name: "เชื่อมต่อ MariaDB",
      status: db?.ok ? "PASS" : "FAIL",
      detail: db?.ok
        ? `${db.database} @ ${db.host} · ${db.server ?? "-"} · ${db.tables ?? "?"} ตาราง · ${db.latencyMs ?? "?"} ms`
        : `error ${db?.error?.code ?? "-"}: ${db?.error?.message ?? "ไม่ทราบสาเหตุ"}`,
    });
    add({
      id: "DB-02",
      name: "schema ครบ (ws_*)",
      status: db?.schemaReady ? "PASS" : "FAIL",
      detail: `${db?.tables ?? "?"} ตาราง · schemaReady=${String(db?.schemaReady)}`,
    });

    const t = await http.json<TimeBody>("/api/health/time", { headers: detailHeaders });
    add({
      id: "TIME-03",
      name: "เขียน/อ่าน/แสดงเวลา ตรงกัน",
      status: t.body.roundTrip?.matches ? "PASS" : "FAIL",
      detail: `${t.body.roundTrip?.written ?? "-"} → ${t.body.roundTrip?.displayed ?? "-"}`,
    });
    const d = t.body.database ?? {};
    if (d.restricted) {
      add({ id: "TIME-04", name: "timezone ของ DB", status: "INFO", detail: "ต้องใช้ session admin" });
    } else if (d.error) {
      add({ id: "TIME-04", name: "timezone ของ DB", status: "WARN", detail: d.error });
    } else {
      add({
        id: "TIME-04",
        name: "ข้อมูลลงเวลาเก่าไม่เพี้ยน",
        status: d.latestCheckinLooksStoredAsBangkok ? "WARN" : "PASS",
        detail: d.latestCheckinLooksStoredAsBangkok
          ? "พบข้อมูลเก่าที่เก็บเป็นเวลาไทย → รัน npm run db:time -- --shift-hours=-7 --table=... --apply ครั้งเดียว"
          : `session tz=${d.sessionTimeZone ?? "-"} · DB NOW() เป็น UTC=${String(d.dbNowLooksUtc)}`,
      });
    }
  }

  if (hasFlag("json")) {
    console.log(JSON.stringify({ url: baseUrl, localCommit, remoteCommit, rows }, null, 2));
  }
  finish(rows, health);
}

function finish(rows: Result[], health: { body: HealthBody } | null) {
  console.log("\nผลการตรวจ:");
  table(rows);
  const s = summary(rows);
  const verdict = s.fail === 0 ? "✅ ผ่านทุกข้อ" : "❌ ยังมีข้อที่ไม่ผ่าน — แก้ก่อนถือว่า final";
  console.log(`\n${verdict}`);
  if (health?.body.build?.commit) {
    console.log(`production commit: ${health.body.build.commit}`);
  }
  process.exit(s.fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ prod:check ล้มเหลว:", err);
  process.exit(1);
});
