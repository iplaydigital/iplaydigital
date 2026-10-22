import type { Pool } from "mysql2/promise";

export interface DbErrorInfo {
  code: string;
  message: string;
  hint: string;
  /** คำสั่งที่ใช้แก้ได้ทันที (ไม่มีรหัสผ่าน) */
  fix?: string;
  at: string;
}

export interface DbHealth {
  configured: boolean;
  ok: boolean;
  host: string;
  port: number;
  user: string;
  database: string;
  latencyMs: number | null;
  server: string | null;
  currentUser: string | null;
  charset: string | null;
  tables: number | null;
  schemaReady: boolean;
  error: DbErrorInfo | null;
  checkedAt: string;
}

/** แปลง error ของ MySQL/MariaDB เป็นคำอธิบาย + วิธีแก้ภาษาไทย */
export function describeDbError(err: unknown): DbErrorInfo {
  const e = err as { code?: string; errno?: number; message?: string; sqlMessage?: string };
  const code = String(e?.code ?? e?.errno ?? "UNKNOWN");
  const message = e?.sqlMessage ?? e?.message ?? String(err);
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "3306";
  const user = process.env.DB_USER || "—";
  const db = process.env.DB_NAME || "—";
  const at = new Date().toISOString();

  const mk = (hint: string, fix?: string): DbErrorInfo => ({ code, message, hint, fix, at });

  switch (code) {
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_ACCESS_DENIED_NO_PASSWORD_ERROR":
      return mk(
        `เข้าใช้งานไม่ได้: user '${user}' หรือรหัสผ่านใน .env ไม่ตรงกับที่สร้างไว้ใน MariaDB (หรือ user ถูกสร้างแบบ unix_socket ซึ่งล็อกอินด้วยรหัสผ่านไม่ได้)`,
        [
          "-- รันบนเซิร์ฟเวอร์ในฐานะ root",
          "SELECT user, host, plugin FROM mysql.user WHERE user = '" + user + "';",
          "CREATE DATABASE IF NOT EXISTS `" + db + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
          "ALTER USER '" + user + "'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('รหัสใหม่');",
          "GRANT ALL PRIVILEGES ON `" + db + "`.* TO '" + user + "'@'localhost';",
          "FLUSH PRIVILEGES;",
          "-- จากนั้นอัปเดต .env (ใช้ heredoc เพื่อไม่ให้ ! $ # ถูกตีความ) แล้ว restart แอป",
        ].join("\n"),
      );
    case "ER_BAD_DB_ERROR":
      return mk(
        `ไม่พบฐานข้อมูล '${db}' บนเซิร์ฟเวอร์ — สร้างก่อนแล้ว restart แอป`,
        `CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      );
    case "ER_DBACCESS_DENIED_ERROR":
      return mk(
        `user '${user}' ไม่มีสิทธิ์เข้าถึงฐานข้อมูล '${db}'`,
        `GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${user}'@'localhost';\nFLUSH PRIVILEGES;`,
      );
    case "ER_TABLEACCESS_DENIED_ERROR":
      return mk(
        `ไม่มีสิทธิ์สร้าง/แก้ตาราง — ต้องรัน schema (ws_*) ในฐานข้อมูลนี้`,
        `GRANT CREATE, ALTER, INDEX, SELECT, INSERT, UPDATE, DELETE, REFERENCES ON \`${db}\`.* TO '${user}'@'localhost';\nFLUSH PRIVILEGES;`,
      );
    case "ECONNREFUSED":
      return mk(
        `ต่อ ${host}:${port} ไม่ได้ — MariaDB ไม่ได้รัน หรือพอร์ตผิด`,
        "sudo systemctl status mariadb    # หรือ: docker compose ps\nss -ltnp | grep 3306",
      );
    case "ETIMEDOUT":
    case "EHOSTUNREACH":
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return mk(
        `เครือข่ายไป ${host}:${port} ไม่ได้ — ตรวจ IP/ไฟร์วอลเลย์ หรือใช้ 127.0.0.1 ถ้าเว็บอยู่เครื่องเดียวกับ DB`,
        "nc -vz " + host + " " + port,
      );
    case "PROTOCOL_CONNECTION_LOST":
    case "ECONNRESET":
      return mk(
        "เซิร์ฟเวอร์ตัดการเชื่อมต่อทันที (มักเกิดจากไฟร์วอลล์/ไม่ได้เปิด MySQL จาก IP นี้) — ถ้าแอปอยู่เครื่องเดียวกับ DB ให้ตั้ง DB_HOST=127.0.0.1",
        "DB_HOST=127.0.0.1    # ใน .env",
      );
    case "ER_NOT_SUPPORTED_AUTH_MODE":
      return mk(
        "รูปการยืนยันตัวตนไม่รองรับ — สลับ user เป็น mysql_native_password",
        `ALTER USER '${user}'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('รหัสใหม่');\nFLUSH PRIVILEGES;`,
      );
    case "HANDSHAKE_NO_SSL_SUPPORT":
      return mk("เซิร์ฟเวอร์ต้องใช้ SSL — ตรวจการตั้งค่า TLS ของ MariaDB", undefined);
    default:
      return mk(
        "เชื่อมต่อฐานข้อมูลไม่สำเร็จ — ตรวจค่า DB_* ใน .env (host/port/user/password/database) และสิทธิ์ของ user",
        `mysql -h ${host} -P ${port} -u ${user} -p ${db} -e "SELECT VERSION(), CURRENT_USER();"`,
      );
  }
}

/** ping จริง + เก็บข้อมูลประกอบสำหรับหน้า “วินิจฉัยฐานข้อมูล” */
export async function pingDb(pool: Pool): Promise<DbHealth> {
  const configured = Boolean(process.env.DB_HOST);
  const base: DbHealth = {
    configured,
    ok: false,
    host: process.env.DB_HOST || "—",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "—",
    database: process.env.DB_NAME || "—",
    latencyMs: null,
    server: null,
    currentUser: null,
    charset: null,
    tables: null,
    schemaReady: false,
    error: null,
    checkedAt: new Date().toISOString(),
  };
  if (!configured) {
    return { ...base, error: { code: "NOT_CONFIGURED", message: "ยังไม่ได้ตั้งค่า DB_HOST", hint: "ระบบกำลังใช้ demo store (ไฟล์ .data/store.json) — ตั้งค่า DB_* ใน .env เพื่อใช้ MariaDB", at: base.checkedAt } };
  }
  const started = Date.now();
  try {
    const [rows] = await pool.query(
      `SELECT VERSION() AS server, DATABASE() AS db, CURRENT_USER() AS usr,
              @@character_set_database AS cs,
              (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) AS tables`,
    );
    const row = (rows as Record<string, unknown>[])[0] ?? {};
    const tables = Number(row.tables ?? 0);
    const [ws] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'ws\\_%'",
    );
    const wsCount = Number((ws as Record<string, unknown>[])[0]?.n ?? 0);
    return {
      ...base,
      ok: true,
      latencyMs: Date.now() - started,
      server: String(row.server ?? ""),
      currentUser: String(row.usr ?? ""),
      charset: String(row.cs ?? ""),
      tables,
      schemaReady: wsCount >= 16 || wsCount > 0,
      error: tables === 0 ? null : null,
    };
  } catch (err) {
    return { ...base, latencyMs: Date.now() - started, error: describeDbError(err) };
  }
}
