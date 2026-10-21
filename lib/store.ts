import fs from "fs";
import path from "path";
import type { Action, Bootstrap, Message, ActivityItem, CalendarEvent, Task } from "./types";
import { seedData, trendData } from "./seed";
import { uid, STATUS_ORDER, CAT_META, pad } from "./utils";

export type StoreData = Omit<Bootstrap, "trend" | "storage" | "today">;

const FILE = path.join(process.cwd(), ".data", "store.json");
const g = globalThis as unknown as { __iplayStore?: StoreData };

function ensureDirs() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadStore(): StoreData {
  if (g.__iplayStore) return g.__iplayStore;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as StoreData;
      if (raw?.tasks?.length && raw?.members?.length) {
        g.__iplayStore = raw;
        return raw;
      }
    }
  } catch {
    /* fall through to seed */
  }
  const data = seedData();
  g.__iplayStore = data;
  persist(data);
  return data;
}

function persist(data: StoreData) {
  try {
    ensureDirs();
    fs.writeFileSync(FILE, JSON.stringify(data));
  } catch {
    /* read-only fs — keep in memory */
  }
}

function log(data: StoreData, actorId: string, text: string, kind: ActivityItem["kind"]) {
  data.activity.unshift({ id: uid("a"), at: new Date().toISOString(), actorId, text, kind });
  data.activity = data.activity.slice(0, 120);
}

function nextCode(data: StoreData, projectId: string) {
  const project = data.projects.find((p) => p.id === projectId);
  const prefix = project?.code ?? "IPL";
  const nums = data.tasks
    .filter((t) => t.code.startsWith(prefix + "-"))
    .map((t) => Number(t.code.split("-")[1]) || 0);
  const base = { ERP: 1000, PLW: 2000, CRM: 3000, WEB: 4000, MV: 5000 }[prefix] ?? 1000;
  return `${prefix}-${Math.max(base, ...nums) + 1}`;
}

export function applyDemoAction(action: Action): StoreData {
  const data = loadStore();
  const me = data.meId;
  const now = new Date().toISOString();

  switch (action.type) {
    case "task.move": {
      const t = data.tasks.find((x) => x.id === action.id);
      if (t) {
        t.status = action.status;
        if (action.status === "done") {
          t.progress = 100;
          t.subtasks.forEach((s) => (s.done = true));
        } else if (t.progress === 100) t.progress = 80;
        else if (t.progress === 0) t.progress = action.status === "doing" ? 20 : 10;
        const member = data.members.find((m) => m.id === t.assigneeId);
        if (t.assigneeId.startsWith("ai_")) {
          data.aiRuns.unshift({
            id: uid("ar"), agentId: t.assigneeId, taskId: t.id,
            action: action.status === "done" ? "ปิดงานอัตโนมัติ" : "อัปเดตสถานะงาน",
            detail: `${t.code} → ${action.status}`, at: now,
            durationSec: 12, tokens: 1240, status: "success",
          });
        }
        if (member && member.kind === "ai") member.currentTaskId = action.status === "done" ? null : t.id;
        log(data, t.assigneeId, `ย้าย ${t.code} → ${action.status}`, "task");
      }
      break;
    }
    case "task.update": {
      const t = data.tasks.find((x) => x.id === action.id);
      if (t) {
        Object.assign(t, action.patch);
        if (action.patch.status === "done") t.progress = 100;
      }
      break;
    }
    case "task.create": {
      const draft = action.task;
      const id = uid("t");
      const task: Task = {
        id, code: nextCode(data, draft.projectId || "p_erp"),
        title: draft.title || "งานใหม่",
        desc: draft.desc || "",
        projectId: draft.projectId || "p_erp",
        assigneeId: draft.assigneeId || me,
        status: draft.status || "todo",
        priority: draft.priority || "med",
        due: draft.due || new Date().toISOString().slice(0, 10),
        estimate: draft.estimate ?? 4,
        spent: 0, progress: 0,
        tags: draft.tags || [],
        subtasks: draft.subtasks || [],
        comments: [],
        createdAt: now, createdBy: draft.createdBy || me,
        aiGenerated: draft.assigneeId?.startsWith("ai_") || false,
      };
      data.tasks.unshift(task);
      if (task.due) {
        data.events.push({
          id: uid("e"), title: `เดดไลน์: ${task.title}`, date: task.due, cat: "work",
          projectId: task.projectId, taskId: task.id, important: task.priority === "urgent",
        });
      }
      log(data, task.createdBy, `สร้างงาน ${task.code} — ${task.title}`, "task");
      break;
    }
    case "task.delete": {
      const t = data.tasks.find((x) => x.id === action.id);
      data.tasks = data.tasks.filter((x) => x.id !== action.id);
      data.events = data.events.filter((e) => e.taskId !== action.id);
      if (t) log(data, me, `ลบงาน ${t.code}`, "task");
      break;
    }
    case "task.comment": {
      const t = data.tasks.find((x) => x.id === action.id);
      if (t) {
        t.comments.push({ id: uid("c"), authorId: action.authorId, text: action.text, at: now });
        log(data, action.authorId, `คอมเมนต์ใน ${t.code}`, "task");
      }
      break;
    }
    case "task.subtask": {
      const t = data.tasks.find((x) => x.id === action.id);
      const s = t?.subtasks.find((x) => x.id === action.subId);
      if (s && t) {
        s.done = action.done;
        const doneCount = t.subtasks.filter((x) => x.done).length;
        t.progress = Math.round((doneCount / t.subtasks.length) * 100);
        if (doneCount === t.subtasks.length && t.status !== "done") t.status = "review";
      }
      break;
    }
    case "event.move": {
      const e = data.events.find((x) => x.id === action.id);
      if (e) {
        e.date = action.date;
        if (action.time) e.time = action.time;
        if (e.taskId) {
          const t = data.tasks.find((x) => x.id === e.taskId);
          if (t) t.due = action.date;
        }
        log(data, me, `เลื่อน "${e.title}" → ${action.date}`, "event");
      }
      break;
    }
    case "event.create": {
      const draft = action.event;
      const ev: CalendarEvent = {
        id: uid("e"), title: draft.title || "อีเวนต์ใหม่",
        date: draft.date || new Date().toISOString().slice(0, 10),
        cat: draft.cat || "work", time: draft.time, endTime: draft.endTime,
        desc: draft.desc, projectId: draft.projectId, location: draft.location,
        ownerId: draft.ownerId || me, important: draft.important,
      };
      data.events.push(ev);
      log(data, me, `เพิ่มอีเวนต์ "${ev.title}"`, "event");
      break;
    }
    case "event.update": {
      const e = data.events.find((x) => x.id === action.id);
      if (e) Object.assign(e, action.patch);
      break;
    }
    case "event.delete":
      data.events = data.events.filter((x) => x.id !== action.id);
      break;
    case "chat.send": {
      const msg: Message = {
        id: uid("m"), channelId: action.channelId, authorId: action.authorId,
        text: action.text, at: now, kind: action.file ? "file" : "text",
        file: action.file || undefined,
      };
      data.messages.push(msg);
      if (action.file) data.files.unshift(action.file);
      log(data, action.authorId, action.file ? `แชร์ไฟล์ ${action.file.name}` : `ส่งข้อความในแชท`, action.file ? "drive" : "chat");
      break;
    }
    case "chat.pin": {
      const m = data.messages.find((x) => x.id === action.id);
      if (m) m.pinned = action.pinned;
      break;
    }
    case "chat.react": {
      const m = data.messages.find((x) => x.id === action.id);
      if (m) {
        m.reactions = m.reactions || [];
        const r = m.reactions.find((x) => x.emoji === action.emoji);
        if (r) {
          r.users.includes(action.userId)
            ? (r.users = r.users.filter((u) => u !== action.userId))
            : r.users.push(action.userId);
          if (!r.users.length) m.reactions = m.reactions.filter((x) => x !== r);
        } else m.reactions.push({ emoji: action.emoji, users: [action.userId] });
      }
      break;
    }
    case "chat.channel": {
      const ch = {
        id: uid("ch"), name: action.name.replace(/^#/, ""), emoji: action.emoji || "💬",
        type: "group" as const, members: action.members, unread: 0,
      };
      data.channels.push(ch);
      data.messages.push({
        id: uid("m"), channelId: ch.id, authorId: me, at: now,
        text: `สร้างกลุ่ม #${ch.name} แล้ว — เชิญทุกคนแชร์งานและไฟล์ผ่าน Google Drive ที่นี่`,
        kind: "system",
      });
      break;
    }
    case "chat.read": {
      const ch = data.channels.find((c) => c.id === action.channelId);
      if (ch) ch.unread = 0;
      break;
    }
    case "agent.toggle": {
      const a = data.members.find((m) => m.id === action.id);
      if (a) {
        a.paused = action.paused;
        a.state = action.paused ? "away" : "online";
        log(data, action.id, action.paused ? "พักการทำงานของ AI" : "ปลุก AI ให้กลับมาทำงาน", "ai");
      }
      break;
    }
    case "agent.run": {
      const agent = data.members.find((m) => m.id === action.id);
      const task = data.tasks.find((t) => t.id === action.taskId);
      if (agent && task) {
        agent.currentTaskId = task.id;
        agent.paused = false;
        agent.state = "working";
        task.status = task.status === "todo" ? "doing" : task.status;
        data.aiRuns.unshift({
          id: uid("ar"), agentId: agent.id, taskId: task.id,
          action: "เริ่มทำงานที่ได้รับมอบหมาย",
          detail: `${task.code} — ${task.title}`, at: now,
          durationSec: 0, tokens: Math.round(800 + Math.random() * 2000), status: "running",
        });
        log(data, agent.id, `เริ่มทำงาน ${task.code}`, "ai");
      }
      break;
    }
    case "hr.checkin": {
      const c = action.checkin;
      data.checkins.unshift({
        id: uid("ck"), userId: c.userId, at: now,
        place: c.place || "ไม่ระบุ", lat: c.lat || 0, lng: c.lng || 0,
        distance: c.distance || 0, mode: c.mode || "office",
        note: c.note, mapUrl: c.mapUrl || `https://maps.google.com/?q=${c.lat},${c.lng}`,
      });
      log(data, c.userId, `เช็คอิน ${c.mode === "office" ? "ที่ออฟฟิศ" : c.mode === "remote" ? "นอกสถานที่ (WFH)" : "หน้างาน"}`, "hr");
      break;
    }
    case "hr.leave": {
      const l = action.leave;
      data.leaves.unshift({
        id: uid("l"), userId: l.userId, type: l.type || "annual",
        from: l.from || new Date().toISOString().slice(0, 10),
        to: l.to || l.from || new Date().toISOString().slice(0, 10),
        days: l.days || 1, reason: l.reason || "", status: "pending", createdAt: now,
      });
      log(data, l.userId, "ยื่นใบลาใหม่", "hr");
      break;
    }
    case "hr.leave.decide": {
      const l = data.leaves.find((x) => x.id === action.id);
      if (l) {
        l.status = action.status;
        l.approverId = action.approverId;
        log(data, action.approverId, `${action.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}ใบลาของทีม`, "hr");
        if (action.status === "approved") {
          const member = data.members.find((m) => m.id === l.userId);
          const start = new Date().toISOString().slice(0, 10);
          const from = l.from > start ? l.from : start;
          for (let i = 0; i < Math.max(1, l.days); i++) {
            const day = new Date(from + "T12:00:00");
            day.setDate(day.getDate() + i);
            data.events.push({
              id: uid("e"),
              title: `${l.type === "sick" ? "ลาป่วย" : l.type === "annual" ? "ลาพักร้อน" : l.type === "wfh" ? "WFH" : "ลา"}: ${member?.nickname ?? ""}`,
              date: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
              cat: "holiday",
              desc: l.reason,
              ownerId: l.userId,
            });
          }
        }
      }
      break;
    }
    case "hr.booking": {
      const b = action.booking;
      const room = data.rooms.find((r) => r.id === b.roomId);
      const id = uid("b");
      data.bookings.push({
        id, roomId: b.roomId, title: b.title || "จองห้องประชุม",
        date: b.date || new Date().toISOString().slice(0, 10),
        start: b.start || "10:00", end: b.end || "11:00",
        ownerId: b.ownerId, attendees: b.attendees || 1, status: "confirmed",
      });
      const owner = data.members.find((m) => m.id === b.ownerId)?.name || "ทีม";
      log(data, b.ownerId, `จอง ${room?.name || "ห้องประชุม"} ${b.start}-${b.end}`, "hr");
      data.events.push({
        id: uid("e"), title: `${b.title || "ประชุม"} (${room?.name || "ห้องประชุม"})`,
        date: b.date || new Date().toISOString().slice(0, 10),
        time: b.start, endTime: b.end, cat: "meeting", location: room?.name,
        ownerId: b.ownerId, desc: `จองโดย ${owner}`,
      });
      break;
    }
    case "hr.booking.cancel":
      data.bookings = data.bookings.filter((b) => b.id !== action.id);
      break;
    case "settings.update":
      Object.assign(data.settings, action.patch);
      break;
    case "activity.add":
      log(data, action.actorId, action.text, action.kind);
      break;
    case "reset": {
      const fresh = seedData();
      Object.assign(data, fresh);
      break;
    }
    default:
      break;
  }

  g.__iplayStore = data;
  persist(data);
  return data;
}

export function getDemoBootstrap(): Bootstrap {
  const data = loadStore();
  return {
    ...data,
    today: new Date().toISOString().slice(0, 10),
    storage: "demo",
    trend: trendData(),
  };
}

export async function getBootstrap(): Promise<Bootstrap> {
  if (process.env.DB_HOST) {
    const { fetchAll } = await import("./db-maria");
    const data = await fetchAll();
    return { ...data, today: new Date().toISOString().slice(0, 10), storage: "mariadb", trend: trendData() };
  }
  return getDemoBootstrap();
}

export async function applyAction(action: Action): Promise<void> {
  if (process.env.DB_HOST) {
    const { applyMaria } = await import("./db-maria");
    await applyMaria(action);
    return;
  }
  applyDemoAction(action);
}

export function nextTaskCode(projectId: string) {
  const data = loadStore();
  return nextCode(data, projectId);
}

export function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function statusIndex(s: string) {
  return STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]);
}

export function categoryColor(cat: string) {
  return CAT_META[cat as keyof typeof CAT_META]?.color ?? "#9AA7C7";
}
