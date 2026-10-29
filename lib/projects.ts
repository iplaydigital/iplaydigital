// ─────────────────────────────────────────────────────────────
//  บริหารจัดการโปรเจกต์ (Projects CRM/PM)
//   • อ่าน/เขียนตาราง ws_projects (MariaDB) หรือ store.json (โหมดสำรอง)
//   • เพิ่ม / แก้ไข / ลบ / เก็บเข้าคลัง พร้อมตรวจสิทธิ์ที่ชั้น API
// ─────────────────────────────────────────────────────────────
import crypto from "crypto";
import type { Project } from "./types";

export const PROJECT_STATUS: { key: Project["status"]; label: string; color: string }[] = [
  { key: "planning", label: "วางแผน", color: "#8A8FB1" },
  { key: "doing", label: "กำลังทำ", color: "#2F7BF0" },
  { key: "review", label: "ตรวจสอบ", color: "#D98A00" },
  { key: "done", label: "เสร็จสิ้น", color: "#149C74" },
];

export const PROJECT_GRADS = [
  "linear-gradient(135deg,#7100DD,#B37CFF)",
  "linear-gradient(135deg,#2F7BF0,#6FD3FF)",
  "linear-gradient(135deg,#149C74,#5BE3B4)",
  "linear-gradient(135deg,#D6337A,#FFA1C4)",
  "linear-gradient(135deg,#B4761A,#FFD37A)",
];

export interface ProjectInput {
  code?: string;
  name?: string;
  client?: string;
  color?: string;
  grad?: string;
  progress?: number;
  start?: string;
  due?: string;
  budget?: number;
  spent?: number;
  status?: Project["status"];
  members?: string[];
  description?: string;
}

export class ProjectError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalize(input: ProjectInput, base?: Project): Project {
  const now = new Date().toISOString();
  const status = (input.status ?? base?.status ?? "planning") as Project["status"];
  const progress = Math.max(0, Math.min(100, Number(input.progress ?? base?.progress ?? 0) || 0));
  return {
    id: base?.id ?? `p_${crypto.randomBytes(4).toString("hex")}`,
    code: (input.code ?? base?.code ?? "").trim().toUpperCase() || "NEW",
    name: (input.name ?? base?.name ?? "").trim(),
    client: (input.client ?? base?.client ?? "").trim(),
    color: input.color ?? base?.color ?? "#7100DD",
    grad: input.grad ?? base?.grad ?? PROJECT_GRADS[0],
    progress: status === "done" ? 100 : progress,
    start: input.start ?? base?.start ?? now.slice(0, 10),
    due: input.due ?? base?.due ?? now.slice(0, 10),
    budget: Number(input.budget ?? base?.budget ?? 0) || 0,
    spent: Number(input.spent ?? base?.spent ?? 0) || 0,
    status,
    members: input.members ?? base?.members ?? [],
  };
}

async function maria() {
  if (!process.env.DB_HOST) return null;
  try {
    const { pool } = await import("./db-maria");
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS ws_projects (
      id VARCHAR(32) PRIMARY KEY,
      code VARCHAR(12) NOT NULL,
      name VARCHAR(200) NOT NULL,
      client VARCHAR(160) NOT NULL DEFAULT '',
      color VARCHAR(16) NOT NULL DEFAULT '#7100DD',
      grad VARCHAR(200) NOT NULL DEFAULT '',
      progress INT NOT NULL DEFAULT 0,
      start DATE NULL,
      due DATE NULL,
      budget DECIMAL(14,2) NOT NULL DEFAULT 0,
      spent DECIMAL(14,2) NOT NULL DEFAULT 0,
      status ENUM('planning','doing','review','done') NOT NULL DEFAULT 'planning',
      members JSON NULL,
      KEY idx_ws_projects_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    return p;
  } catch {
    return null;
  }
}

function parseMembers(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  try {
    const out = typeof v === "string" ? (JSON.parse(v) as unknown) : [];
    return Array.isArray(out) ? out.map(String) : [];
  } catch {
    return [];
  }
}

function rowToProject(r: Record<string, unknown>): Project {
  const d = (v: unknown) => (v ? String(v).slice(0, 10) : "");
  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    client: String(r.client ?? ""),
    color: String(r.color ?? "#7100DD"),
    grad: String(r.grad ?? ""),
    progress: Number(r.progress ?? 0),
    start: d(r.start),
    due: d(r.due),
    budget: Number(r.budget ?? 0),
    spent: Number(r.spent ?? 0),
    status: r.status as Project["status"],
    members: parseMembers(r.members),
  };
}

async function readStore(): Promise<Project[]> {
  const { loadStore } = await import("./store");
  return loadStore().projects ?? [];
}

export async function listProjects(): Promise<Project[]> {
  const p = await maria();
  if (p) {
    try {
      const [rows] = (await p.query("SELECT * FROM ws_projects ORDER BY status, due")) as unknown as [Record<string, unknown>[]];
      return rows.map(rowToProject);
    } catch {
      /* fall through */
    }
  }
  return readStore();
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const project = normalize(input);
  if (!project.name) throw new ProjectError("ต้องตั้งชื่อโปรเจกต์");
  const all = await listProjects();
  if (all.some((p) => p.code === project.code)) throw new ProjectError(`รหัสโปรเจกต์ ${project.code} ถูกใช้แล้ว`);

  const p = await maria();
  if (p) {
    await p.query(
      `INSERT INTO ws_projects (id,code,name,client,color,grad,progress,start,due,budget,spent,status,members)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [project.id, project.code, project.name, project.client, project.color, project.grad, project.progress,
        project.start || null, project.due || null, project.budget, project.spent, project.status, JSON.stringify(project.members)],
    );
    return project;
  }

  const { loadStore, saveStore } = await import("./store");
  const data = loadStore();
  data.projects = [...(data.projects ?? []), project];
  saveStore(data);
  return project;
}

export async function updateProject(id: string, input: ProjectInput): Promise<Project> {
  const all = await listProjects();
  const current = all.find((p) => p.id === id);
  if (!current) throw new ProjectError("ไม่พบโปรเจกต์", 404);
  const next = normalize(input, current);
  if (!next.name) throw new ProjectError("ต้องตั้งชื่อโปรเจกต์");
  if (all.some((p) => p.code === next.code && p.id !== id)) throw new ProjectError(`รหัสโปรเจกต์ ${next.code} ถูกใช้แล้ว`);

  const p = await maria();
  if (p) {
    await p.query(
      `UPDATE ws_projects SET code=?, name=?, client=?, color=?, grad=?, progress=?, start=?, due=?, budget=?, spent=?, status=?, members=? WHERE id=?`,
      [next.code, next.name, next.client, next.color, next.grad, next.progress, next.start || null, next.due || null,
        next.budget, next.spent, next.status, JSON.stringify(next.members), id],
    );
    return next;
  }

  const { loadStore, saveStore } = await import("./store");
  const data = loadStore();
  data.projects = (data.projects ?? []).map((x) => (x.id === id ? next : x));
  saveStore(data);
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  const all = await listProjects();
  const current = all.find((p) => p.id === id);
  if (!current) throw new ProjectError("ไม่พบโปรเจกต์", 404);

  const p = await maria();
  if (p) {
    await p.query("DELETE FROM ws_projects WHERE id=?", [id]);
    await p.query("UPDATE ws_tasks SET project_id=NULL WHERE project_id=?", [id]).catch(() => undefined);
    return;
  }

  const { loadStore, saveStore } = await import("./store");
  const data = loadStore();
  data.projects = (data.projects ?? []).filter((x) => x.id !== id);
  data.tasks = (data.tasks ?? []).map((t) => {
    if (t.projectId !== id) return t;
    const next = { ...t };
    delete (next as { projectId?: string }).projectId;
    return next;
  });
  saveStore(data);
}

/** สรุปยอดต่อโปรเจกต์ (งาน/คืบหน้า/งบ) สำหรับหน้าบริหารจัดการ */
export function projectStats(projectId: string, tasks: { projectId?: string | null; status: string }[]) {
  const list = tasks.filter((t) => t.projectId === projectId);
  return {
    tasks: list.length,
    open: list.filter((t) => t.status !== "done").length,
    done: list.filter((t) => t.status === "done").length,
  };
}
