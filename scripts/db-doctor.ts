/**
 * npm run db:doctor  [--init]
 * ตรวจการเชื่อมต่อ MariaDB ทีละขั้น พร้อมบอกวิธีแก้เป็นภาษาไทย
 *   --init  = สร้าง schema (ws_*) + seed ถ้าฐานข้อมูลว่าง
 */
import net from "node:net";

try {
  process.loadEnvFile(".env");
} catch {
  /* ใช้ค่าจาก environment */
}

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const okMark = `${c.green}✓${c.reset}`;
const badMark = `${c.red}✗${c.reset}`;
const warnMark = `${c.yellow}!${c.reset}`;
const line = (s = "") => console.log(s);
const item = (ok: boolean | null, label: string, detail = "") =>
  line(`  ${ok === true ? okMark : ok === false ? badMark : warnMark} ${label}${detail ? ` ${c.dim}${detail}${c.reset}` : ""}`);

const HOST = process.env.DB_HOST || "";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "";
const DB = process.env.DB_NAME || "";
const PASS = process.env.DB_PASSWORD || "";
const INIT = process.argv.includes("--init");

function tcpCheck(host: string, port: number, timeout = 5000) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = net.connect({ host, port, timeout });
    const done = (r: { ok: boolean; error?: string }) => { socket.destroy(); resolve(r); };
    socket.once("connect", () => done({ ok: true }));
    socket.once("timeout", () => done({ ok: false, error: "timeout — ไฟร์วอลล์ปิดพอร์ต หรือ DB ไม่ได้รัน" }));
    socket.once("error", (e: NodeJS.ErrnoException) => done({ ok: false, error: `${e.code ?? ""} ${e.message}` }));
  });
}

async function main() {
  line();
  line(`${c.bold}${c.cyan}iPlay Workspace — ตรวจฐานข้อมูล (db:doctor)${c.reset}`);
  line(`${c.dim}${new Date().toLocaleString("th-TH")}${c.reset}`);
  line();

  line(`${c.bold}1) ค่าที่อ่านได้จาก .env / environment${c.reset}`);
  item(!!HOST, "DB_HOST", HOST || "(ว่าง) → ระบบจะรันโหมด demo");
  item(!!PORT, "DB_PORT", String(PORT));
  item(!!USER, "DB_USER", USER || "(ว่าง)");
  item(PASS.length > 0, "DB_PASSWORD", PASS ? `ตั้งไว้ (${PASS.length} ตัวอักษร)` : "(ว่าง)");
  item(!!DB, "DB_NAME", DB || "(ว่าง)");
  if (PASS !== PASS.trim()) line(`     ${warnMark} รหัสผ่านมีช่องว่างหัว/ท้าย — ควรใส่ quote ใน .env`);
  if (/#/.test(process.env.DB_PASSWORD_RAW ?? "")) line(`     ${warnMark} พบ # ในรหัส — ต้องใส่ quote เพื่อไม่ให้ถูกตัดเป็นคอมเมนต์`);

  if (!HOST) {
    line(`\n${warnMark} ไม่ได้ตั้งค่า DB_HOST — ข้ามการตรวจที่เหลือ (โหมด demo ใช้งานได้ปกติ)\n`);
    return 0;
  }

  line(`\n${c.bold}2) เครือข่ายไป ${HOST}:${PORT}${c.reset}`);
  const tcp = await tcpCheck(HOST, PORT);
  item(tcp.ok, `TCP ${HOST}:${PORT}`, tcp.ok ? "" : tcp.error);
  if (!tcp.ok) {
    line(`     ${c.dim}ถ้าเว็บกับ DB อยู่เครื่องเดียวกัน ให้ตั้ง DB_HOST=127.0.0.1${c.reset}`);
    return 1;
  }

  line(`\n${c.bold}3) ล็อกอิน + สิทธิ์${c.reset}`);
  let pool;
  let pingDb: (p: any) => Promise<any>;
  let describeDbError: (e: unknown) => any;
  try {
    const maria = await import("../lib/db-maria");
    const diag = await import("../lib/db-diag");
    pool = maria.pool();
    pingDb = diag.pingDb;
    describeDbError = diag.describeDbError;
  } catch (err) {
    item(false, "โหลด adapter", (err as Error).message);
    return 1;
  }

  const health = await pingDb(pool);
  item(health.ok, "เชื่อมต่อฐานข้อมูล", health.ok ? `${health.latencyMs}ms · ${health.server}` : health.error?.code);
  if (!health.ok) {
    const e = health.error ?? describeDbError("unknown");
    line(`\n  ${c.red}${c.bold}สาเหตุ:${c.reset} ${e.message}`);
    line(`  ${c.dim}${e.hint}${c.reset}`);
    if (e.fix) {
      line(`\n  ${c.bold}คำสั่งที่ใช้แก้:${c.reset}`);
      e.fix.split("\n").forEach((l: string) => line(`    ${c.cyan}${l}${c.reset}`));
    }
    line(`\n  ${c.dim}แก้ .env แล้วต้อง restart แอป (pm2 restart <name> / systemctl restart) — ค่า env ถูกอ่านตอนบูต${c.reset}\n`);
    await pool.end();
    return 1;
  }

  item(true, "ฐานข้อมูล", `${health.database} (${health.charset})`);
  item(true, "ผู้ใช้ที่ใช้จริง", health.currentUser ?? "—");

  line(`\n${c.bold}4) schema (ws_*)${c.reset}`);
  item((health.tables ?? 0) > 0, "จำนวนตารางในฐานข้อมูล", `${health.tables} ตาราง`);
  if (INIT) {
    line(`\n${c.bold}5) สร้าง/อัปเดต schema + seed${c.reset}`);
    try {
      const { ensureSchema, fetchAll } = await import("../lib/db-maria");
      await ensureSchema();
      const d = await fetchAll();
      item(true, "schema พร้อมใช้งาน", `tasks ${d.tasks.length} · events ${d.events.length} · messages ${d.messages.length}`);
    } catch (err) {
      item(false, "สร้าง schema", (err as Error).message);
      await pool.end();
      return 1;
    }
  } else if ((health.tables ?? 0) === 0) {
    line(`     ${warnMark} ยังไม่มีตาราง — รัน ${c.cyan}npm run db:doctor -- --init${c.reset} หรือ ${c.cyan}npm run db:init${c.reset}`);
    line(`     ${c.dim}(แอปจะสร้างให้อัตโนมัติเมื่อมี request แรก แต่สั่งล่วงหน้าจะเห็น error ชัดกว่า)${c.reset}`);
  }

  line(`\n${c.green}${c.bold}สรุป: การเชื่อมต่อฐานข้อมูลพร้อมใช้งาน${c.reset}`);
  line(`${c.dim}  ทดสอบจริง: curl -s http://127.0.0.1:3000/api/health${c.reset}\n`);
  await pool.end();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${badMark} db:doctor ล้มเหลว:`, err?.message ?? err);
    process.exit(1);
  });
