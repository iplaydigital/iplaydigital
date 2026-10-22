import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import type {
  Action, AiRun, ActivityItem, Booking, CalendarEvent, Channel, CheckIn,
  DriveFile, LeaveRequest, Member, Message, Project, Room, Settings, Subtask, Task,
} from "./types";
import type { StoreData } from "./store";
import { seedData } from "./seed";
import { uid, pad } from "./utils";

export const dbEnabled = () => Boolean(process.env.DB_HOST);

/** ข้อมูลประกอบการวินิจฉัย (ไม่รวมรหัสผ่าน) */
export function dbTarget() {
  return {
    host: process.env.DB_HOST || "—",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "—",
    database: process.env.DB_NAME || "—",
  };
}

interface Row extends mysql.RowDataPacket {
  [key: string]: any;
}
const g = globalThis as unknown as { __iplayPool?: mysql.Pool; __iplaySchemaReady?: Promise<void> };

export function pool() {
  if (!g.__iplayPool) {
    g.__iplayPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 8000,
      dateStrings: true,
      charset: "utf8mb4",
      timezone: "+07:00",
    });
  }
  return g.__iplayPool;
}

const j = <T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
};
const iso = (v: string | null | undefined) => (v ? new Date(v.replace(" ", "T")).toISOString() : new Date().toISOString());
const hm = (v: string | null | undefined) => (v ? v.slice(0, 5) : undefined);
const dt = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const todayStr = () => new Date().toISOString().slice(0, 10);

export async function ensureSchema() {
  if (!dbEnabled()) return;
  if (!g.__iplaySchemaReady) {
    g.__iplaySchemaReady = (async () => {
      const sql = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
      const statements = sql
        .split(/;\s*\n/)
        .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
        .filter(Boolean);
      const conn = await pool().getConnection();
      try {
        for (const stmt of statements) await conn.query(stmt);
        const [rows] = await conn.query<Row[]>("SELECT COUNT(*) AS n FROM ws_members");
        if (!rows[0]?.n) await seedDb(conn);
      } finally {
        conn.release();
      }
    })().catch((e) => {
      g.__iplaySchemaReady = undefined;
      throw e;
    });
  }
  return g.__iplaySchemaReady;
}

export async function seedDb(conn: mysql.PoolConnection) {
  const d = seedData();
  const q = (sql: string, params: unknown[]) => conn.query(sql, params);
  for (const m of d.members) {
    await q(
      `INSERT INTO ws_members (id,name,nickname,role,kind,initials,color,email,state,skills,model,paused,autonomy,runs,success_rate,tokens_today,current_task_id,workload,capacity,phone)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [m.id, m.name, m.nickname, m.role, m.kind, m.initials, m.color, m.email, m.state, JSON.stringify(m.skills || []),
       m.model ?? null, m.paused ? 1 : 0, m.autonomy ?? 60, m.runs ?? 0, m.successRate ?? 90, m.tokensToday ?? 0,
       m.currentTaskId ?? null, m.load ?? 0, m.capacity ?? 40, m.phone ?? null],
    );
  }
  for (const p of d.projects) {
    await q(
      `INSERT INTO ws_projects (id,code,name,client,color,grad,progress,start,due,budget,spent,status,members) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id, p.code, p.name, p.client, p.color, p.grad, p.progress, p.start, p.due, p.budget, p.spent, p.status, JSON.stringify(p.members)],
    );
  }
  for (const t of d.tasks) {
    await q(
      `INSERT INTO ws_tasks (id,code,title,description,project_id,assignee_id,status,priority,due_date,estimate_hrs,spent_hrs,progress,tags,ai_generated,blocked,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [t.id, t.code, t.title, t.desc, t.projectId, t.assigneeId, t.status, t.priority, t.due, t.estimate, t.spent,
       t.progress, JSON.stringify(t.tags), t.aiGenerated ? 1 : 0, t.blocked ? 1 : 0, t.createdBy],
    );
    let i = 0;
    for (const s of t.subtasks) {
      await q(`INSERT INTO ws_task_subtasks (id,task_id,title,done,by_id,pos) VALUES (?,?,?,?,?,?)`,
        [s.id, t.id, s.title, s.done ? 1 : 0, s.by ?? null, i++]);
    }
    for (const c of t.comments) {
      await q(`INSERT INTO ws_task_comments (id,task_id,author_id,body,at) VALUES (?,?,?,?,?)`,
        [c.id, t.id, c.authorId, c.text, c.at.slice(0, 19).replace("T", " ")]);
    }
  }
  for (const e of d.events) {
    await q(
      `INSERT INTO ws_events (id,title,event_date,start_time,end_time,category,description,project_id,task_id,location,owner_id,important)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [e.id, e.title, e.date, e.time ?? null, e.endTime ?? null, e.cat, e.desc ?? null, e.projectId ?? null,
       e.taskId ?? null, e.location ?? null, e.ownerId ?? null, e.important ? 1 : 0],
    );
  }
  for (const c of d.channels) {
    await q(`INSERT INTO ws_channels (id,name,emoji,type,topic,members,pinned,unread,drive_folder) VALUES (?,?,?,?,?,?,?,?,?)`,
      [c.id, c.name, c.emoji, c.type, c.topic ?? null, JSON.stringify(c.members), c.pinned ? 1 : 0, c.unread ?? 0, c.driveFolder ?? null]);
  }
  for (const f of d.files) {
    await q(`INSERT INTO ws_files (id,name,type,url,size,owner_id,shared_at) VALUES (?,?,?,?,?,?,?)`,
      [f.id, f.name, f.type, f.url, f.size, f.ownerId, f.sharedAt.slice(0, 19).replace("T", " ")]);
  }
  for (const m of d.messages) {
    await q(`INSERT INTO ws_messages (id,channel_id,author_id,body,kind,file_json,pinned,reactions,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [m.id, m.channelId, m.authorId, m.text, m.kind, m.file ? JSON.stringify(m.file) : null,
       m.pinned ? 1 : 0, JSON.stringify(m.reactions ?? []), m.at.slice(0, 19).replace("T", " ")]);
  }
  for (const r of d.rooms) {
    await q(`INSERT INTO ws_rooms (id,name,floor,capacity,color,amenities,screen) VALUES (?,?,?,?,?,?,?)`,
      [r.id, r.name, r.floor, r.capacity, r.color, JSON.stringify(r.amenities), r.screen ? 1 : 0]);
  }
  for (const b of d.bookings) {
    await q(`INSERT INTO ws_bookings (id,room_id,title,book_date,start_time,end_time,owner_id,attendees,status) VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.id, b.roomId, b.title, b.date, b.start, b.end, b.ownerId, b.attendees, b.status]);
  }
  for (const l of d.leaves) {
    await q(`INSERT INTO ws_leaves (id,user_id,type,date_from,date_to,days,reason,status,approver_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [l.id, l.userId, l.type, l.from, l.to, l.days, l.reason, l.status, l.approverId ?? null, l.createdAt.slice(0, 19).replace("T", " ")]);
  }
  for (const c of d.checkins) {
    await q(`INSERT INTO ws_checkins (id,user_id,at_time,place,lat,lng,distance_m,mode,note,map_url) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [c.id, c.userId, c.at.slice(0, 19).replace("T", " "), c.place, c.lat, c.lng, c.distance, c.mode, c.note ?? null, c.mapUrl]);
  }
  for (const r of d.aiRuns) {
    await q(`INSERT INTO ws_ai_runs (id,agent_id,task_id,action,detail,duration_sec,tokens,status,at_time) VALUES (?,?,?,?,?,?,?,?,?)`,
      [r.id, r.agentId, r.taskId ?? null, r.action, r.detail, r.durationSec, r.tokens, r.status, r.at.slice(0, 19).replace("T", " ")]);
  }
  for (const a of d.activity) {
    await q(`INSERT INTO ws_activity (id,actor_id,body,kind,at_time) VALUES (?,?,?,?,?)`,
      [a.id, a.actorId, a.text, a.kind, a.at.slice(0, 19).replace("T", " ")]);
  }
  await q(`INSERT INTO ws_settings (id,data) VALUES ('main', ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`, [JSON.stringify(d.settings)]);
  console.log("[db] seeded demo workspace into MariaDB");
}

export async function fetchAll(): Promise<StoreData> {
  await ensureSchema();
  const p = pool();
  const [members] = await p.query<Row[]>("SELECT * FROM ws_members ORDER BY kind DESC, name");
  const [projects] = await p.query<Row[]>("SELECT * FROM ws_projects");
  const [tasks] = await p.query<Row[]>("SELECT * FROM ws_tasks ORDER BY due_date ASC");
  const [subs] = await p.query<Row[]>("SELECT * FROM ws_task_subtasks ORDER BY task_id, pos");
  const [comments] = await p.query<Row[]>("SELECT * FROM ws_task_comments ORDER BY at ASC");
  const [events] = await p.query<Row[]>("SELECT * FROM ws_events ORDER BY event_date ASC, start_time ASC");
  const [channels] = await p.query<Row[]>("SELECT * FROM ws_channels ORDER BY created_at ASC");
  const [messages] = await p.query<Row[]>("SELECT * FROM ws_messages ORDER BY created_at ASC");
  const [files] = await p.query<Row[]>("SELECT * FROM ws_files ORDER BY shared_at DESC");
  const [rooms] = await p.query<Row[]>("SELECT * FROM ws_rooms");
  const [bookings] = await p.query<Row[]>("SELECT * FROM ws_bookings WHERE status <> 'cancelled' ORDER BY book_date, start_time");
  const [leaves] = await p.query<Row[]>("SELECT * FROM ws_leaves ORDER BY created_at DESC");
  const [checkins] = await p.query<Row[]>("SELECT * FROM ws_checkins ORDER BY at_time DESC LIMIT 100");
  const [runs] = await p.query<Row[]>("SELECT * FROM ws_ai_runs ORDER BY at_time DESC LIMIT 60");
  const [activity] = await p.query<Row[]>("SELECT * FROM ws_activity ORDER BY at_time DESC LIMIT 120");
  const [settingsRows] = await p.query<Row[]>("SELECT data FROM ws_settings WHERE id='main'");

  const seeded = seedData();

  return {
    members: members.map<Member>((m) => ({
      id: m.id, name: m.name, nickname: m.nickname, role: m.role, kind: m.kind,
      initials: m.initials, color: m.color, email: m.email, state: m.state,
      skills: j<string[]>(m.skills, []), model: m.model ?? undefined,
      paused: !!m.paused, autonomy: m.autonomy, runs: m.runs, successRate: m.success_rate,
      tokensToday: m.tokens_today, currentTaskId: m.current_task_id ?? null,
      load: m.workload, capacity: m.capacity, phone: m.phone ?? undefined,
    })),
    projects: projects.map<Project>((r) => ({
      id: r.id, code: r.code, name: r.name, client: r.client, color: r.color, grad: r.grad,
      progress: r.progress, start: r.start, due: r.due, budget: Number(r.budget), spent: Number(r.spent),
      status: r.status, members: j<string[]>(r.members, []),
    })),
    tasks: tasks.map<Task>((t) => ({
      id: t.id, code: t.code, title: t.title, desc: t.description ?? "",
      projectId: t.project_id ?? "", assigneeId: t.assignee_id ?? "",
      status: t.status, priority: t.priority, due: t.due_date,
      estimate: Number(t.estimate_hrs), spent: Number(t.spent_hrs), progress: t.progress,
      tags: j<string[]>(t.tags, []),
      subtasks: subs.filter((s) => s.task_id === t.id).map<Subtask>((s) => ({
        id: s.id, title: s.title, done: !!s.done, by: s.by_id ?? undefined,
      })),
      comments: comments.filter((c) => c.task_id === t.id).map((c) => ({
        id: c.id, authorId: c.author_id, text: c.body, at: iso(c.at),
      })),
      createdAt: iso(t.created_at), createdBy: t.created_by ?? "",
      aiGenerated: !!t.ai_generated, blocked: !!t.blocked,
    })),
    events: events.map<CalendarEvent>((e) => ({
      id: e.id, title: e.title, date: e.event_date, time: hm(e.start_time), endTime: hm(e.end_time),
      cat: e.category, desc: e.description ?? undefined, projectId: e.project_id ?? undefined,
      taskId: e.task_id ?? undefined, location: e.location ?? undefined,
      ownerId: e.owner_id ?? undefined, important: !!e.important,
    })),
    channels: channels.map<Channel>((c) => ({
      id: c.id, name: c.name, emoji: c.emoji, type: c.type, topic: c.topic ?? undefined,
      members: j<string[]>(c.members, []), pinned: !!c.pinned, unread: c.unread,
      driveFolder: c.drive_folder ?? undefined,
    })),
    messages: messages.map<Message>((m) => ({
      id: m.id, channelId: m.channel_id, authorId: m.author_id, text: m.body ?? "",
      at: iso(m.created_at), kind: m.kind, file: (j<DriveFile | null>(m.file_json, null)) ?? undefined,
      pinned: !!m.pinned, reactions: j<Message["reactions"]>(m.reactions, []),
    })),
    files: files.map<DriveFile>((f) => ({
      id: f.id, name: f.name, type: f.type, url: f.url, size: f.size,
      ownerId: f.owner_id, sharedAt: iso(f.shared_at),
    })),
    rooms: rooms.map<Room>((r) => ({
      id: r.id, name: r.name, floor: r.floor, capacity: r.capacity, color: r.color,
      amenities: j<string[]>(r.amenities, []), screen: !!r.screen,
    })),
    bookings: bookings.map<Booking>((b) => ({
      id: b.id, roomId: b.room_id, title: b.title, date: b.book_date,
      start: hm(b.start_time)!, end: hm(b.end_time)!, ownerId: b.owner_id,
      attendees: b.attendees, status: b.status,
    })),
    leaves: leaves.map<LeaveRequest>((l) => ({
      id: l.id, userId: l.user_id, type: l.type, from: l.date_from, to: l.date_to,
      days: l.days, reason: l.reason, status: l.status, approverId: l.approver_id ?? undefined,
      createdAt: iso(l.created_at),
    })),
    checkins: checkins.map<CheckIn>((c) => ({
      id: c.id, userId: c.user_id, at: iso(c.at_time), place: c.place,
      lat: Number(c.lat), lng: Number(c.lng), distance: c.distance_m, mode: c.mode,
      note: c.note ?? undefined, mapUrl: c.map_url,
    })),
    aiRuns: runs.map<AiRun>((r) => ({
      id: r.id, agentId: r.agent_id, taskId: r.task_id ?? undefined, action: r.action,
      detail: r.detail, at: iso(r.at_time), durationSec: r.duration_sec, tokens: r.tokens, status: r.status,
    })),
    activity: activity.map<ActivityItem>((a) => ({
      id: a.id, at: iso(a.at_time), actorId: a.actor_id, text: a.body, kind: a.kind,
    })),
    settings: (settingsRows[0] ? j<Settings>(settingsRows[0].data, seeded.settings) : seeded.settings),
    meId: "u_me",
  };
}

async function log(actorId: string, body: string, kind: ActivityItem["kind"]) {
  await pool().query("INSERT INTO ws_activity (id,actor_id,body,kind,at_time) VALUES (?,?,?,?,?)",
    [uid("a"), actorId, body.slice(0, 400), kind, dt()]);
}

export async function applyMaria(action: Action): Promise<void> {
  await ensureSchema();
  const p = pool();
  const me = "u_me";
  const now = dt();

  switch (action.type) {
    case "task.move": {
      const [rows] = await p.query<Row[]>("SELECT * FROM ws_tasks WHERE id=?", [action.id]);
      const t = rows[0];
      if (!t) break;
      const progress = action.status === "done" ? 100 : t.progress === 0 ? (action.status === "doing" ? 25 : 10) : t.progress;
      await p.query("UPDATE ws_tasks SET status=?, progress=? WHERE id=?", [action.status, progress, action.id]);
      if (action.status === "done") await p.query("UPDATE ws_task_subtasks SET done=1 WHERE task_id=?", [action.id]);
      await log(t.assignee_id, `ย้าย ${t.code} → ${action.status}`, "task");
      if (String(t.assignee_id).startsWith("ai_")) {
        await p.query("INSERT INTO ws_ai_runs (id,agent_id,task_id,action,detail,duration_sec,tokens,status,at_time) VALUES (?,?,?,?,?,?,?,?,?)",
          [uid("ar"), t.assignee_id, t.id, action.status === "done" ? "ปิดงานอัตโนมัติ" : "อัปเดตสถานะงาน", `${t.code} → ${action.status}`, 12, 1240, "success", now]);
      }
      break;
    }
    case "task.update": {
      const map: Record<string, string> = {
        title: "title", desc: "description", status: "status", priority: "priority",
        due: "due_date", estimate: "estimate_hrs", spent: "spent_hrs", progress: "progress",
        projectId: "project_id", assigneeId: "assignee_id", blocked: "blocked",
      };
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const [k, v] of Object.entries(action.patch)) {
        if (map[k]) { sets.push(`${map[k]}=?`); vals.push(v as unknown); }
        else if (k === "tags") { sets.push("tags=?"); vals.push(JSON.stringify(v)); }
      }
      if (sets.length) await p.query(`UPDATE ws_tasks SET ${sets.join(",")} WHERE id=?`, [...vals, action.id]);
      break;
    }
    case "task.create": {
      const d = action.task;
      const ids = uid("t");
      const prefix = d.projectId
        ? (await p.query<Row[]>("SELECT code FROM ws_projects WHERE id=?", [d.projectId]))[0][0]?.code ?? "IPL"
        : "IPL";
      const [maxRows] = await p.query<Row[]>(
        "SELECT code FROM ws_tasks WHERE code LIKE ? ORDER BY CAST(SUBSTRING_INDEX(code,'-',-1) AS UNSIGNED) DESC LIMIT 1",
        [`${prefix}-%`],
      );
      const code = `${prefix}-${(Number(maxRows[0]?.code?.split("-").pop()) || 999) + 1}`;
      await p.query(
        `INSERT INTO ws_tasks (id,code,title,description,project_id,assignee_id,status,priority,due_date,estimate_hrs,spent_hrs,progress,tags,ai_generated,blocked,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ids, code, d.title ?? "งานใหม่", d.desc ?? "", d.projectId ?? "p_erp", d.assigneeId ?? me,
         d.status ?? "todo", d.priority ?? "med", d.due ?? todayStr(), d.estimate ?? 4, 0, 0,
         JSON.stringify(d.tags ?? []), String(d.assigneeId).startsWith("ai_") ? 1 : 0, 0, me],
      );
      await p.query(
        `INSERT INTO ws_events (id,title,event_date,category,project_id,task_id,important) VALUES (?,?,?,?,?,?,?)`,
        [uid("e"), `เดดไลน์: ${d.title ?? "งานใหม่"}`, d.due ?? todayStr(), "work", d.projectId ?? null, ids, d.priority === "urgent" ? 1 : 0],
      );
      await log(me, `สร้างงาน ${code} — ${d.title ?? ""}`, "task");
      break;
    }
    case "task.delete":
      await p.query("DELETE FROM ws_tasks WHERE id=?", [action.id]);
      await p.query("DELETE FROM ws_events WHERE task_id=?", [action.id]);
      break;
    case "task.comment":
      await p.query("INSERT INTO ws_task_comments (id,task_id,author_id,body,at) VALUES (?,?,?,?,?)",
        [uid("c"), action.id, action.authorId, action.text, now]);
      break;
    case "task.subtask":
      await p.query("UPDATE ws_task_subtasks SET done=? WHERE id=?", [action.done ? 1 : 0, action.subId]);
      break;
    case "event.move": {
      await p.query("UPDATE ws_events SET event_date=?, start_time=COALESCE(?, start_time) WHERE id=?",
        [action.date, action.time ?? null, action.id]);
      const [rows] = await p.query<Row[]>("SELECT * FROM ws_events WHERE id=?", [action.id]);
      if (rows[0]?.task_id) await p.query("UPDATE ws_tasks SET due_date=? WHERE id=?", [action.date, rows[0].task_id]);
      break;
    }
    case "event.create":
      await p.query(
        `INSERT INTO ws_events (id,title,event_date,start_time,end_time,category,description,project_id,location,owner_id,important)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [uid("e"), action.event.title ?? "อีเวนต์ใหม่", action.event.date ?? todayStr(),
         action.event.time ?? null, action.event.endTime ?? null, action.event.cat ?? "work",
         action.event.desc ?? null, action.event.projectId ?? null, action.event.location ?? null,
         action.event.ownerId ?? me, action.event.important ? 1 : 0],
      );
      break;
    case "event.update": {
      const map: Record<string, string> = {
        title: "title", date: "event_date", time: "start_time", endTime: "end_time",
        cat: "category", desc: "description", location: "location", important: "important",
      };
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const [k, v] of Object.entries(action.patch)) {
        if (map[k]) { sets.push(`${map[k]}=?`); vals.push(v as unknown); }
      }
      if (sets.length) await p.query(`UPDATE ws_events SET ${sets.join(",")} WHERE id=?`, [...vals, action.id]);
      break;
    }
    case "event.delete":
      await p.query("DELETE FROM ws_events WHERE id=?", [action.id]);
      break;
    case "chat.send": {
      const id = uid("m");
      await p.query("INSERT INTO ws_messages (id,channel_id,author_id,body,kind,file_json,pinned,reactions,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [id, action.channelId, action.authorId, action.text, action.file ? "file" : "text",
         action.file ? JSON.stringify(action.file) : null, 0, JSON.stringify([]), now]);
      if (action.file) {
        await p.query("INSERT INTO ws_files (id,name,type,url,size,owner_id,shared_at) VALUES (?,?,?,?,?,?,?)",
          [action.file.id, action.file.name, action.file.type, action.file.url, action.file.size, action.file.ownerId, now]);
      }
      break;
    }
    case "chat.pin":
      await p.query("UPDATE ws_messages SET pinned=? WHERE id=?", [action.pinned ? 1 : 0, action.id]);
      break;
    case "chat.react": {
      const [rows] = await p.query<Row[]>("SELECT reactions FROM ws_messages WHERE id=?", [action.id]);
      if (!rows[0]) break;
      const reactions = j<{ emoji: string; users: string[] }[]>(rows[0].reactions, []);
      const r = reactions.find((x) => x.emoji === action.emoji);
      if (r) {
        r.users = r.users.includes(action.userId) ? r.users.filter((u) => u !== action.userId) : [...r.users, action.userId];
      } else reactions.push({ emoji: action.emoji, users: [action.userId] });
      await p.query("UPDATE ws_messages SET reactions=? WHERE id=?", [JSON.stringify(reactions.filter((x) => x.users.length)), action.id]);
      break;
    }
    case "chat.channel": {
      const id = uid("ch");
      const name = action.name.replace(/^#/, "");
      await p.query("INSERT INTO ws_channels (id,name,emoji,type,topic,members,pinned,unread) VALUES (?,?,?,?,?,?,?,?)",
        [id, name, action.emoji ?? "💬", "group", null, JSON.stringify(action.members), 0, 0]);
      await p.query("INSERT INTO ws_messages (id,channel_id,author_id,body,kind,pinned,reactions,created_at) VALUES (?,?,?,?,?,?,?,?)",
        [uid("m"), id, me, `สร้างกลุ่ม #${name} แล้ว — เชิญทุกคนแชร์งานและไฟล์ผ่าน Google Drive ที่นี่`, "system", 0, JSON.stringify([]), now]);
      break;
    }
    case "chat.read":
      await p.query("UPDATE ws_channels SET unread=0 WHERE id=?", [action.channelId]);
      break;
    case "agent.toggle":
      await p.query("UPDATE ws_members SET paused=?, state=? WHERE id=?",
        [action.paused ? 1 : 0, action.paused ? "away" : "online", action.id]);
      break;
    case "agent.run": {
      await p.query("UPDATE ws_members SET paused=0, state='working', current_task_id=?, runs=runs+1 WHERE id=?", [action.taskId, action.id]);
      await p.query("UPDATE ws_tasks SET status=IF(status='todo','doing',status) WHERE id=?", [action.taskId]);
      const [rows] = await p.query<Row[]>("SELECT code,title FROM ws_tasks WHERE id=?", [action.taskId]);
      await p.query("INSERT INTO ws_ai_runs (id,agent_id,task_id,action,detail,duration_sec,tokens,status,at_time) VALUES (?,?,?,?,?,?,?,?,?)",
        [uid("ar"), action.id, action.taskId, "เริ่มทำงานที่ได้รับมอบหมาย",
         `${rows[0]?.code ?? ""} — ${rows[0]?.title ?? ""}`, 0, Math.round(800 + Math.random() * 2000), "running", now]);
      break;
    }
    case "hr.checkin": {
      const c = action.checkin;
      await p.query("INSERT INTO ws_checkins (id,user_id,at_time,place,lat,lng,distance_m,mode,note,map_url) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [uid("ck"), c.userId, now, c.place ?? "", c.lat ?? 0, c.lng ?? 0, c.distance ?? 0,
         c.mode ?? "office", c.note ?? null, c.mapUrl ?? `https://maps.google.com/?q=${c.lat},${c.lng}`]);
      break;
    }
    case "hr.leave": {
      const l = action.leave;
      await p.query("INSERT INTO ws_leaves (id,user_id,type,date_from,date_to,days,reason,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [uid("l"), l.userId, l.type ?? "annual", l.from ?? todayStr(), l.to ?? l.from ?? todayStr(),
         l.days ?? 1, l.reason ?? "", "pending", now]);
      break;
    }
    case "hr.leave.decide": {
      await p.query("UPDATE ws_leaves SET status=?, approver_id=? WHERE id=?", [action.status, action.approverId, action.id]);
      if (action.status === "approved") {
        const [rows] = await p.query<Row[]>("SELECT * FROM ws_leaves WHERE id=?", [action.id]);
        const l = rows[0];
        if (l) {
          const [mrows] = await p.query<Row[]>("SELECT nickname FROM ws_members WHERE id=?", [l.user_id]);
          const member = mrows[0];
          const from = new Date(l.date_from + "T12:00:00");
          const label = l.type === "sick" ? "ลาป่วย" : l.type === "annual" ? "ลาพักร้อน" : l.type === "wfh" ? "WFH" : "ลา";
          for (let i = 0; i < Math.max(1, l.days); i++) {
            const d = new Date(from);
            d.setDate(d.getDate() + i);
            const ds = d.toISOString().slice(0, 10);
            await p.query("INSERT INTO ws_events (id,title,event_date,category,description,owner_id) VALUES (?,?,?,?,?,?)",
              [uid("e"), `${label}: ${member?.nickname ?? ""}`, ds, "holiday", l.reason, l.user_id]);
          }
        }
      }
      break;
    }
    case "hr.booking": {
      const b = action.booking;
      const room = (await p.query<Row[]>("SELECT name FROM ws_rooms WHERE id=?", [b.roomId]))[0][0];
      await p.query("INSERT INTO ws_bookings (id,room_id,title,book_date,start_time,end_time,owner_id,attendees,status) VALUES (?,?,?,?,?,?,?,?,?)",
        [uid("b"), b.roomId, b.title ?? "จองห้องประชุม", b.date ?? todayStr(), b.start ?? "10:00",
         b.end ?? "11:00", b.ownerId, b.attendees ?? 1, "confirmed"]);
      await p.query("INSERT INTO ws_events (id,title,event_date,start_time,end_time,category,location,owner_id) VALUES (?,?,?,?,?,?,?,?)",
        [uid("e"), `${b.title ?? "ประชุม"} (${room?.name ?? "ห้องประชุม"})`, b.date ?? todayStr(),
         b.start ?? "10:00", b.end ?? "11:00", "meeting", room?.name ?? null, b.ownerId]);
      break;
    }
    case "hr.booking.cancel":
      await p.query("UPDATE ws_bookings SET status='cancelled' WHERE id=?", [action.id]);
      break;
    case "settings.update": {
      const [rows] = await p.query<Row[]>("SELECT data FROM ws_settings WHERE id='main'");
      const current = j<Record<string, unknown>>(rows[0]?.data, {});
      await p.query("UPDATE ws_settings SET data=? WHERE id='main'", [JSON.stringify({ ...current, ...action.patch })]);
      break;
    }
    case "activity.add":
      await log(action.actorId, action.text, action.kind);
      break;
    case "reset": {
      const conn = await p.getConnection();
      try {
        await conn.query("SET FOREIGN_KEY_CHECKS=0");
        for (const t of ["ws_messages", "ws_channels", "ws_task_comments", "ws_task_subtasks", "ws_tasks",
          "ws_events", "ws_files", "ws_bookings", "ws_rooms", "ws_leaves", "ws_checkins",
          "ws_ai_runs", "ws_activity", "ws_projects", "ws_members", "ws_settings"]) {
          await conn.query(`TRUNCATE TABLE ${t}`);
        }
        await conn.query("SET FOREIGN_KEY_CHECKS=1");
        await seedDb(conn);
      } finally {
        conn.release();
      }
      break;
    }
    default:
      break;
  }
}

export const clock = () => `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
