// ─────────────────────────────────────────────────────────────
//  รายงาน (Reports) — เพิ่ม/แก้ไข/ลบ + แนบไฟล์ Google Drive
//  เก็บใน MariaDB (ws_reports) หรือไฟล์ .data/reports.json เมื่อ DB ไม่พร้อม
// ─────────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Report, ReportStatus } from "./types";

const FILE = path.join(process.cwd(), ".data", "reports.json");
const g = globalThis as unknown as { __ipwReports?: Report[] };

function readFile(): Report[] {
  if (g.__ipwReports) return g.__ipwReports;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Report[];
      if (Array.isArray(raw)) {
        g.__ipwReports = raw;
        return raw;
      }
    }
  } catch {
    /* ignore */
  }
  const seeded = seedReports();
  writeFile(seeded);
  return seeded;
}

function writeFile(list: Report[]) {
  g.__ipwReports = list;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
  } catch {
    /* read-only */
  }
}

function month(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function seedReports(): Report[] {
  const now = new Date().toISOString();
  return [
    {
      id: "rp_seed_1", code: "RPT-2601", title: "สรุปงานรายเดือน · Playwall Park Silom",
      period: month(-1), projectId: "p_playwall", authorId: "u_ploy", status: "approved",
      summary: "ส่งมอบคอนเทนต์ LED ครบ 4 รอบ เดดไลน์ตรงทุกครั้ง ยอดผู้ชมเฉลี่ย 12,400 คน/วัน — ไฟล์วิดีโอและรายงาน Q/A แนบใน Drive",
      driveUrl: "https://drive.google.com/drive/folders/1iPlayDigitalWorkspace",
      attachments: [{ id: "at_1", name: "playwall-summary.pdf", url: "https://drive.google.com/file/d/playwall-summary", size: "2.4 MB", mime: "application/pdf" }],
      createdAt: now, updatedAt: now,
    },
    {
      id: "rp_seed_2", code: "RPT-2602", title: "รายงานต้นทุน & การเงินไตรมาส",
      period: month(0), projectId: "p_crm", authorId: "u_me", status: "submitted",
      summary: "ต้นทุน CRM อยู่ที่ 41% ของงบ กำไรขั้นต้น 59% — รออนุมัติปิดงวด พร้อมเอกสารใน Drive",
      driveUrl: "https://drive.google.com/drive/folders/1iPlayDigitalWorkspace",
      attachments: [{ id: "at_2", name: "crm-cost-q3.xlsx", url: "https://drive.google.com/file/d/crm-cost-q3", size: "860 KB", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
      createdAt: now, updatedAt: now,
    },
    {
      id: "rp_seed_3", code: "RPT-2603", title: "สรุปผล AI Workforce ประจำสัปดาห์",
      period: month(0), projectId: "p_erp", authorId: "u_kan", status: "draft",
      summary: "AI รับงาน 38 งาน สำเร็จ 35 งาน (92%) ประหยัดเวลาทีมประมาณ 26 ชั่วโมง — ต้องปรับ prompt ของ ORBIT",
      attachments: [],
      createdAt: now, updatedAt: now,
    },
  ];
}

// ── MariaDB ─────────────────────────────────────────────────
async function mariaReady(): Promise<boolean> {
  if (!process.env.DB_HOST) return false;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_reports (
      id         VARCHAR(32) PRIMARY KEY,
      code       VARCHAR(24) NOT NULL,
      title      VARCHAR(300) NOT NULL,
      period     VARCHAR(7) NOT NULL,
      project_id VARCHAR(32) NULL,
      author_id  VARCHAR(32) NOT NULL,
      status     ENUM('draft','submitted','approved') NOT NULL DEFAULT 'draft',
      summary    TEXT NULL,
      drive_url  TEXT NULL,
      attachments JSON NULL,
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    return true;
  } catch {
    return false;
  }
}

function rowToReport(r: Record<string, unknown>): Report {
  let att: Report["attachments"] = [];
  try {
    att = typeof r.attachments === "string" ? JSON.parse(r.attachments) : ((r.attachments as Report["attachments"]) ?? []);
  } catch {
    att = [];
  }
  return {
    id: String(r.id), code: String(r.code), title: String(r.title), period: String(r.period),
    projectId: (r.project_id as string | null) ?? null, authorId: String(r.author_id),
    status: r.status as ReportStatus, summary: String(r.summary ?? ""),
    driveUrl: (r.drive_url as string | null) ?? undefined, attachments: Array.isArray(att) ? att : [],
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

export async function listReports(): Promise<Report[]> {
  if (await mariaReady()) {
    try {
      const { pool } = await import("./db-maria");
      const [rows] = await pool().query<import("mysql2").RowDataPacket[]>(
        "SELECT * FROM ws_reports ORDER BY updated_at DESC",
      );
      if (rows.length) return rows.map(rowToReport);
    } catch {
      /* fall through */
    }
  }
  return readFile();
}

export async function getReport(id: string): Promise<Report | null> {
  const all = await listReports();
  return all.find((r) => r.id === id) ?? null;
}

export async function createReport(input: Partial<Report> & { title: string; authorId: string }): Promise<Report> {
  const all = await listReports();
  const now = new Date().toISOString();
  const seq = 2600 + all.length + 1;
  const report: Report = {
    id: `rp_${crypto.randomBytes(4).toString("hex")}`,
    code: input.code || `RPT-${seq}`,
    title: input.title,
    period: input.period || month(0),
    projectId: input.projectId ?? null,
    authorId: input.authorId,
    status: input.status || "draft",
    summary: input.summary || "",
    driveUrl: input.driveUrl || "",
    attachments: input.attachments || [],
    createdAt: now,
    updatedAt: now,
  };
  await persist(report, true);
  return report;
}

export async function updateReport(id: string, patch: Partial<Report>): Promise<Report | null> {
  const current = await getReport(id);
  if (!current) return null;
  const next: Report = {
    ...current, ...patch, id: current.id,
    code: patch.code || current.code,
    updatedAt: new Date().toISOString(),
  };
  await persist(next, false);
  return next;
}

export async function deleteReport(id: string): Promise<boolean> {
  if (await mariaReady()) {
    try {
      const { pool } = await import("./db-maria");
      await pool().query("DELETE FROM ws_reports WHERE id=?", [id]);
      return true;
    } catch {
      /* fall through */
    }
  }
  const all = readFile();
  writeFile(all.filter((r) => r.id !== id));
  return true;
}

async function persist(report: Report, insert: boolean) {
  if (await mariaReady()) {
    try {
      const { pool } = await import("./db-maria");
      const p = pool();
      if (insert) {
        await p.query(
          `INSERT INTO ws_reports (id,code,title,period,project_id,author_id,status,summary,drive_url,attachments,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [report.id, report.code, report.title, report.period, report.projectId ?? null, report.authorId,
            report.status, report.summary, report.driveUrl || null, JSON.stringify(report.attachments),
            report.createdAt, report.updatedAt],
        );
      } else {
        await p.query(
          `UPDATE ws_reports SET title=?, period=?, project_id=?, status=?, summary=?, drive_url=?, attachments=?, updated_at=? WHERE id=?`,
          [report.title, report.period, report.projectId ?? null, report.status, report.summary,
            report.driveUrl || null, JSON.stringify(report.attachments), report.updatedAt, report.id],
        );
      }
      return;
    } catch {
      /* fall through */
    }
  }
  const all = readFile().filter((r) => r.id !== report.id);
  writeFile([report, ...all]);
}
