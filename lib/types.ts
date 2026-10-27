// ─────────────────────────────────────────────────────────────
// iPlay Workspace — shared domain types
// ─────────────────────────────────────────────────────────────

export type ID = string;
export type TaskStatus = "todo" | "doing" | "review" | "done";
export type Priority = "urgent" | "high" | "med" | "low";
export type EventCat = "work" | "meeting" | "delivery" | "finance" | "holiday" | "personal";
export type AgentKind = "human" | "ai";
export type AgentState = "online" | "focus" | "working" | "away" | "off";

export interface Department {
  id: ID;
  name: string;
  short: string;
  color: string;
  /** ลำดับการแสดง */
  order: number;
  headId?: ID | null;
  desc?: string;
}

export interface Team {
  id: ID;
  name: string;
  departmentId: ID;
  color?: string;
  leadId?: ID | null;
}

export interface Member {
  id: ID;
  name: string;
  nickname: string;
  role: string;
  kind: AgentKind;
  departmentId?: ID;
  teamId?: ID | null;
  level?: string;
  initials: string;
  color: string;
  email: string;
  state: AgentState;
  skills: string[];
  /** AI only */
  model?: string;
  paused?: boolean;
  autonomy?: number; // 0-100
  runs?: number;
  successRate?: number;
  tokensToday?: number;
  currentTaskId?: ID | null;
  /** human only */
  load?: number;
  capacity?: number;
  phone?: string;
}

export interface Project {
  id: ID;
  code: string;
  name: string;
  client: string;
  color: string;
  grad: string;
  progress: number;
  start: string;
  due: string;
  budget: number;
  spent: number;
  status: "planning" | "doing" | "review" | "done";
  members: ID[];
}

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
  by?: ID;
}

export interface Comment {
  id: ID;
  authorId: ID;
  text: string;
  at: string;
}

export interface ActivityItem {
  id: ID;
  at: string;
  actorId: ID;
  text: string;
  kind: "task" | "event" | "chat" | "ai" | "hr" | "system" | "drive";
}

export interface Task {
  id: ID;
  code: string;
  title: string;
  desc: string;
  projectId: ID;
  assigneeId: ID;
  status: TaskStatus;
  priority: Priority;
  due: string; // YYYY-MM-DD
  start?: string;
  estimate: number;
  spent: number;
  progress: number;
  tags: string[];
  subtasks: Subtask[];
  comments: Comment[];
  createdAt: string;
  createdBy: ID;
  aiGenerated?: boolean;
  blocked?: boolean;
}

export interface CalendarEvent {
  id: ID;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  time?: string; // HH:mm
  endTime?: string;
  cat: EventCat;
  desc?: string;
  projectId?: ID;
  taskId?: ID;
  location?: string;
  ownerId?: ID;
  allDay?: boolean;
  important?: boolean;
}

export interface DriveFile {
  id: ID;
  name: string;
  type: "doc" | "sheet" | "slide" | "pdf" | "image" | "folder" | "zip" | "other";
  url: string;
  size: string;
  ownerId: ID;
  sharedAt: string;
}

export interface Channel {
  id: ID;
  name: string;
  emoji: string;
  type: "group" | "dm" | "ai";
  topic?: string;
  members: ID[];
  pinned?: boolean;
  unread?: number;
  driveFolder?: string;
}

export interface Message {
  id: ID;
  channelId: ID;
  authorId: ID;
  text: string;
  at: string;
  kind: "text" | "file" | "ai" | "system";
  file?: DriveFile;
  pinned?: boolean;
  reactions?: { emoji: string; users: ID[] }[];
  replyTo?: ID;
}

export interface Room {
  id: ID;
  name: string;
  floor: string;
  capacity: number;
  color: string;
  amenities: string[];
  screen?: boolean;
}

export interface Booking {
  id: ID;
  roomId: ID;
  title: string;
  date: string;
  start: string;
  end: string;
  ownerId: ID;
  attendees: number;
  status: "confirmed" | "pending";
}

export type LeaveType = "annual" | "sick" | "personal" | "wfh" | "business";
export interface LeaveRequest {
  id: ID;
  userId: ID;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  approverId?: ID;
}

export interface CheckIn {
  id: ID;
  userId: ID;
  at: string;
  place: string;
  lat: number;
  lng: number;
  distance: number;
  mode: "office" | "remote" | "onsite";
  note?: string;
  mapUrl: string;
  photo?: boolean;
}

export interface AiRun {
  id: ID;
  agentId: ID;
  taskId?: ID;
  action: string;
  detail: string;
  at: string;
  durationSec: number;
  tokens: number;
  status: "running" | "success" | "queued" | "failed";
}

// ── ผู้ใช้ระบบ & สิทธิ์ ─────────────────────────────────────
export type UserRole = "admin" | "support" | "manager" | "ai" | "member";
export type AuthProvider = "password" | "google" | "line";

/** ข้อมูลผู้ใช้ที่ส่งไปฝั่ง client (ไม่มีรหัสผ่าน) */
export interface SessionUser {
  id: ID;
  email: string;
  name: string;
  nickname: string;
  role: UserRole;
  provider: AuthProvider;
  color: string;
  initials: string;
  position?: string;
  jobTitle?: string;
  level?: string;
  departmentId?: ID | null;
  teamId?: ID | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  memberId?: ID | null;
  /** โมดูลที่เพิ่มให้เป็นพิเศษ (นอกเหนือจากสิทธิ์ตามบทบาท) */
  extraModules?: string[];
  /** Super Admin — สิทธิ์สูงสุด จัดการได้ทุกอย่างรวมถึงการตั้งค่า Login/OAuth */
  isSuper?: boolean;
}

// ── ประวัติการแก้ไข & การเข้าใช้ ────────────────────────────
export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "password" | "role" | "status" | "department" | "approve" | "reject";

export interface AuditEntry {
  id: ID;
  at: string;
  actorId: ID;
  actorName: string;
  targetType: "user" | "member" | "report" | "department" | "team" | "settings" | "asset";
  targetId: ID;
  targetName: string;
  action: AuditAction;
  field?: string;
  from?: string;
  to?: string;
  note?: string;
  ip?: string;
}

export interface LoginLog {
  id: ID;
  at: string;
  userId: ID;
  email: string;
  provider: AuthProvider | "session";
  ok: boolean;
  ip?: string;
  agent?: string;
  reason?: string;
}

// ── รายงาน (เชื่อม Google Drive) ────────────────────────────
export type ReportStatus = "draft" | "submitted" | "approved";

export interface ReportAttachment {
  id: ID;
  name: string;
  url: string;
  /** ชื่อไฟล์บน Google Drive ถ้าอัปโหลดผ่านระบบ */
  driveId?: string;
  size?: string;
  mime?: string;
}

export interface Report {
  id: ID;
  code: string;
  title: string;
  period: string; // YYYY-MM
  projectId?: ID | null;
  authorId: ID;
  status: ReportStatus;
  summary: string;
  driveUrl?: string;
  attachments: ReportAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  brand: string;
  branch: string;
  ledUrl: string;
  driveFolder: string;
  office: { name: string; lat: number; lng: number; radius: number };
  aiEnabled: boolean;
  workStart: string;
  workEnd: string;
  announce: string;
}

export interface Bootstrap {
  members: Member[];
  departments: Department[];
  teams: Team[];
  projects: Project[];
  tasks: Task[];
  events: CalendarEvent[];
  channels: Channel[];
  messages: Message[];
  files: DriveFile[];
  rooms: Room[];
  bookings: Booking[];
  leaves: LeaveRequest[];
  checkins: CheckIn[];
  aiRuns: AiRun[];
  reports: Report[];
  activity: ActivityItem[];
  settings: Settings;
  meId: ID;
  today: string;
  /** mariadb = ต่อฐานข้อมูลได้ · demo = ยังไม่ตั้งค่า DB · fallback = ตั้งค่าแล้วแต่ต่อไม่ได้ (ใช้ข้อมูลสำรอง) */
  storage: "mariadb" | "demo" | "fallback";
  dbError?: { code: string; message: string; hint: string; fix?: string; at: string } | null;
  trend: { labels: string[]; created: number[]; done: number[]; revenue: number[] };
}

export type Action =
  | { type: "task.move"; id: ID; status: TaskStatus; date?: string }
  | { type: "task.update"; id: ID; patch: Partial<Task> }
  | { type: "task.create"; task: Partial<Task> }
  | { type: "task.delete"; id: ID }
  | { type: "task.comment"; id: ID; text: string; authorId: ID }
  | { type: "task.subtask"; id: ID; subId: ID; done: boolean }
  | { type: "event.move"; id: ID; date: string; time?: string }
  | { type: "event.create"; event: Partial<CalendarEvent> }
  | { type: "event.update"; id: ID; patch: Partial<CalendarEvent> }
  | { type: "event.delete"; id: ID }
  | { type: "chat.send"; channelId: ID; text: string; authorId: ID; file?: DriveFile | null }
  | { type: "chat.pin"; id: ID; pinned: boolean }
  | { type: "chat.react"; id: ID; emoji: string; userId: ID }
  | { type: "chat.channel"; name: string; members: ID[]; emoji?: string }
  | { type: "chat.read"; channelId: ID }
  | { type: "agent.toggle"; id: ID; paused: boolean }
  | { type: "agent.run"; id: ID; taskId: ID }
  | { type: "hr.checkin"; checkin: Partial<CheckIn> & { userId: ID } }
  | { type: "hr.leave"; leave: Partial<LeaveRequest> & { userId: ID } }
  | { type: "hr.leave.decide"; id: ID; status: "approved" | "rejected"; approverId: ID }
  | { type: "hr.booking"; booking: Partial<Booking> & { roomId: ID; ownerId: ID } }
  | { type: "hr.booking.cancel"; id: ID }
  | { type: "settings.update"; patch: Partial<Settings> }
  | { type: "activity.add"; actorId: ID; text: string; kind: ActivityItem["kind"] }
  | { type: "reset" };
