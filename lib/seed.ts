import type { Bootstrap, Member, Task, CalendarEvent, Message, Project, AiRun, ActivityItem, Booking, LeaveRequest, CheckIn, Room, Channel, DriveFile } from "./types";
import { addDays, d2s, pad, uid } from "./utils";

const TODAY = d2s(new Date());
const D = (n: number) => d2s(addDays(TODAY, n));
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();
const at = (day: string, hh: number, mm = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
};

export const TEAM: Member[] = [
  { id: "u_me", name: "วรพล ศรีสุวรรณ", nickname: "โอ๊ค", role: "Founder / Product Lead", kind: "human", initials: "OP", color: "#6C5CE7", email: "oak@iplaydigital.co", state: "online", skills: ["Product", "Strategy", "AI Ops"], load: 72, capacity: 40, phone: "081-234-5678" },
  { id: "u_ploy", name: "ณัฐริกา ใจดี", nickname: "พลอย", role: "Project Manager", kind: "human", initials: "PL", color: "#3BA7FF", email: "ploy@iplaydigital.co", state: "focus", skills: ["Agile", "Client Care"], load: 88, capacity: 40, phone: "082-345-6789" },
  { id: "u_kan", name: "ธนกฤต วัฒนชัย", nickname: "กัน", role: "Senior Developer", kind: "human", initials: "KN", color: "#22C793", email: "kan@iplaydigital.co", state: "working", skills: ["Next.js", "MariaDB", "DevOps"], load: 95, capacity: 40, phone: "083-456-7890" },
  { id: "u_nan", name: "ปวีณา อินทร์ทอง", nickname: "แนน", role: "UI/UX Designer", kind: "human", initials: "NN", color: "#FF6B9D", email: "nan@iplaydigital.co", state: "focus", skills: ["Figma", "Motion", "Design System"], load: 64, capacity: 40, phone: "084-567-8901" },
  { id: "u_beer", name: "ศุภชัย บุญมาก", nickname: "เบียร์", role: "Full-stack Developer", kind: "human", initials: "BR", color: "#D98A00", email: "beer@iplaydigital.co", state: "online", skills: ["React", "API", "Realtime"], load: 78, capacity: 40, phone: "085-678-9012" },
  { id: "u_mint", name: "อารยา พงษ์ไพร", nickname: "มิ้นท์", role: "Marketing Lead", kind: "human", initials: "MT", color: "#FF9A5A", email: "mint@iplaydigital.co", state: "working", skills: ["Content", "Ads", "CRM"], load: 58, capacity: 40, phone: "086-789-0123" },
  { id: "u_joe", name: "กิตติศักดิ์ ทองแท้", nickname: "โจ", role: "Video / Motion Editor", kind: "human", initials: "JO", color: "#8E7CF3", email: "joe@iplaydigital.co", state: "away", skills: ["Premiere", "After Effects"], load: 46, capacity: 40, phone: "087-890-1234" },
  { id: "u_june", name: "สิริพร แก้วมณี", nickname: "จูน", role: "Finance & Admin", kind: "human", initials: "JN", color: "#3BA7FF", email: "june@iplaydigital.co", state: "online", skills: ["AR/AP", "Payroll"], load: 40, capacity: 40, phone: "088-901-2345" },
  // ── AI workforce ────────────────────────────────────────────
  { id: "ai_nova", name: "NOVA", nickname: "Nova", role: "AI Project Coordinator", kind: "ai", initials: "NV", color: "#6C5CE7", email: "nova@ai.iplaydigital.co", state: "working", skills: ["Planning", "Follow-up", "Summarize"], model: "Claude Sonnet 4.5", paused: false, autonomy: 82, runs: 148, successRate: 96, tokensToday: 184320, currentTaskId: "t_02" },
  { id: "ai_pixel", name: "PIXEL", nickname: "Pixel", role: "AI Creative Designer", kind: "ai", initials: "PX", color: "#FF6B9D", email: "pixel@ai.iplaydigital.co", state: "working", skills: ["Key visual", "Social", "Resize"], model: "Flux 1.1 Pro", paused: false, autonomy: 74, runs: 96, successRate: 91, tokensToday: 96240, currentTaskId: "t_09" },
  { id: "ai_byte", name: "BYTE", nickname: "Byte", role: "AI Full-stack Engineer", kind: "ai", initials: "BY", color: "#22C793", email: "byte@ai.iplaydigital.co", state: "working", skills: ["Next.js", "SQL", "Refactor"], model: "Claude Code", paused: false, autonomy: 68, runs: 212, successRate: 93, tokensToday: 421180, currentTaskId: "t_05" },
  { id: "ai_echo", name: "ECHO", nickname: "Echo", role: "AI Comms & QA", kind: "ai", initials: "EC", color: "#3BA7FF", email: "echo@ai.iplaydigital.co", state: "online", skills: ["QA", "Reply", "Translate"], model: "Gemini 2.5 Pro", paused: false, autonomy: 61, runs: 74, successRate: 88, tokensToday: 58120, currentTaskId: "t_17" },
  { id: "ai_orbit", name: "ORBIT", nickname: "Orbit", role: "AI Data Analyst", kind: "ai", initials: "OR", color: "#D98A00", email: "orbit@ai.iplaydigital.co", state: "away", skills: ["Dashboard", "Forecast"], model: "Grok 4 Fast", paused: true, autonomy: 55, runs: 38, successRate: 84, tokensToday: 12400, currentTaskId: null },
];

export const PROJECTS: Project[] = [
  { id: "p_erp", code: "ERP", name: "iPlay Workspace ERP", client: "iPlay Digital", color: "#6C5CE7", grad: "linear-gradient(135deg,#8E7CF3,#4C2FD6)", progress: 62, start: D(-45), due: D(18), budget: 780000, spent: 402000, status: "doing", members: ["u_me", "u_ploy", "u_kan", "u_beer", "ai_nova", "ai_byte"] },
  { id: "p_playwall", code: "PLW", name: "Playwall Park Silom LED", client: "Park Silom", color: "#3BA7FF", grad: "linear-gradient(135deg,#3BA7FF,#1D5BD6)", progress: 78, start: D(-70), due: D(6), budget: 1250000, spent: 910000, status: "review", members: ["u_me", "u_nan", "u_joe", "u_beer", "ai_pixel"] },
  { id: "p_crm", code: "CRM", name: "PlayCRM Loyalty Platform", client: "Siam Retail Group", color: "#22C793", grad: "linear-gradient(135deg,#22C793,#0E8A63)", progress: 44, start: D(-28), due: D(32), budget: 2400000, spent: 980000, status: "doing", members: ["u_ploy", "u_kan", "u_beer", "ai_byte", "ai_orbit"] },
  { id: "p_web", code: "WEB", name: "iPlay Digital Website 2026", client: "iPlay Digital", color: "#FF6B9D", grad: "linear-gradient(135deg,#FF6B9D,#B950F0)", progress: 88, start: D(-60), due: D(3), budget: 380000, spent: 301000, status: "review", members: ["u_nan", "u_mint", "ai_pixel", "ai_echo"] },
  { id: "p_film", code: "MV", name: "Brand Film — Mekong Coffee", client: "Mekong Coffee", color: "#D98A00", grad: "linear-gradient(135deg,#FFB020,#E07A1F)", progress: 30, start: D(-12), due: D(26), budget: 640000, spent: 180000, status: "planning", members: ["u_joe", "u_mint", "u_nan"] },
];

const T = (
  id: string, code: string, title: string, projectId: string, assigneeId: string,
  status: Task["status"], priority: Task["priority"], due: string, estimate: number,
  extra: Partial<Task> = {},
): Task => ({
  id, code, title, desc: "", projectId, assigneeId, status, priority, due,
  estimate, spent: Math.round(estimate * 0.4), progress: status === "done" ? 100 : status === "review" ? 85 : status === "doing" ? 45 : 0,
  tags: [], subtasks: [], comments: [], createdAt: at(D(-14), 9).toString(), createdBy: "u_me",
  ...extra,
});

export const TASKS: Task[] = [
  T("t_01", "IPL-1041", "ออกแบบหน้า Calendar โหมดเต็มจอ + ลากย้ายอีเวนต์", "p_erp", "u_nan", "review", "urgent", D(1), 12, {
    desc: "ต้องรองรับ 4 มุมมอง (เดือน/สัปดาห์/วัน/Agenda), drag & drop ข้ามวัน, ปุ่ม Fullscreen API และวันที่แบบ พ.ศ.",
    tags: ["UI/UX", "Calendar"], progress: 80,
    subtasks: [
      { id: "s1", title: "โครง month / week grid", done: true, by: "u_nan" },
      { id: "s2", title: "Drag & drop ข้ามวัน", done: true, by: "u_beer" },
      { id: "s3", title: "Fullscreen API + responsive", done: true },
      { id: "s4", title: "Agenda view + ตัวกรองหมวด", done: false },
      { id: "s5", title: "รีวิวกับพี่โอ๊ค", done: false },
    ],
    comments: [
      { id: "c1", authorId: "u_ploy", text: "เดดไลน์งานทุกชิ้นต้องขึ้นปฏิทินอัตโนมัติด้วยนะคะ", at: iso(300) },
      { id: "c2", authorId: "ai_nova", text: "รับทราบค่ะ — ผมซิงก์เดดไลน์ 24 งานเข้า calendar แล้ว และตั้งเตือนล่วงหน้า 1 วันให้ทุกงานด่วน", at: iso(180) },
    ],
  }),
  T("t_02", "IPL-1042", "วางแผน Sprint 22 + แจกงานให้ AI agents", "p_erp", "ai_nova", "doing", "high", D(2), 6, {
    desc: "AI coordinator สรุป backlog, ประเมินชั่วโมง, เสนอผู้รับผิดชอบทั้ง human และ AI",
    tags: ["Planning", "AI"], progress: 55, aiGenerated: true,
    subtasks: [
      { id: "s1", title: "สรุป backlog ค้างจาก Sprint 21", done: true },
      { id: "s2", title: "จัดลำดับตามความสำคัญลูกค้า", done: true },
      { id: "s3", title: "ร่างแผนงาน + owner", done: false },
    ],
    comments: [{ id: "c3", authorId: "u_ploy", text: "NOVA ช่วยแนบ capacity ของทีมในแผนด้วย", at: iso(95) }],
  }),
  T("t_03", "IPL-1043", "ตั้งค่า MariaDB schema + migration", "p_erp", "u_kan", "doing", "urgent", D(0), 8, {
    tags: ["Backend", "MariaDB"], progress: 60,
    subtasks: [
      { id: "s1", title: "erp_tasks / erp_events", done: true },
      { id: "s2", title: "index สำหรับ query ปฏิทิน", done: true },
      { id: "s3", title: "seed + rollback script", done: false },
    ],
  }),
  T("t_04", "IPL-1044", "API กลาง /api/action สำหรับทุก mutation", "p_erp", "u_beer", "done", "high", D(-1), 10, {
    tags: ["API"], progress: 100,
    subtasks: [{ id: "s1", title: "task.move / event.move", done: true }, { id: "s2", title: "activity log", done: true }],
  }),
  T("t_05", "IPL-1045", "ปรับ performance Kanban 1,000 งาน", "p_erp", "ai_byte", "doing", "med", D(4), 6, {
    tags: ["AI", "Performance"], progress: 35, aiGenerated: true,
    comments: [{ id: "c4", authorId: "ai_byte", text: "Profiling เสร็จแล้ว — re-render จากการคำนวณ daysLeft ทุกวินาที ลดเหลือ memo ต่อ task", at: iso(48) }],
  }),
  T("t_06", "IPL-1046", "แชทบอร์ด + ปักหมุด + แชร์ Drive", "p_erp", "u_beer", "doing", "high", D(5), 14, {
    tags: ["Chat", "Drive"], progress: 40,
    subtasks: [
      { id: "s1", title: "เลื่อนグループ / DM", done: true },
      { id: "s2", title: "pin message", done: true },
      { id: "s3", title: "Google Drive picker card", done: false },
    ],
  }),
  T("t_07", "IPL-1047", "ออกแบบหน้าจอ LED Wall 1920×1080", "p_erp", "u_nan", "todo", "high", D(7), 8, { tags: ["UI/UX", "LED"] }),
  T("t_08", "IPL-1048", "รวม AI run log เข้า dashboard", "p_erp", "ai_orbit", "todo", "med", D(9), 4, { tags: ["AI", "Data"], aiGenerated: true }),
  T("t_09", "PLW-2101", "Key visual รอบสุดท้ายสำหรับจอ LED", "p_playwall", "ai_pixel", "review", "urgent", D(1), 6, {
    tags: ["Design", "AI"], progress: 90,
    comments: [{ id: "c5", authorId: "u_nan", text: "ขอเพิ่ม safe area 60px รอบจอด้วยจ้า", at: iso(240) }],
  }),
  T("t_10", "PLW-2102", "ทดสอบการเล่นวิดีโอบนจอ 4K ต่อเนื่อง 72 ชม.", "p_playwall", "u_joe", "doing", "high", D(2), 12, { tags: ["QC", "Playwall"], progress: 70 }),
  T("t_11", "PLW-2103", "ตั้งค่า playlist rotation + fallback offline", "p_playwall", "u_kan", "todo", "high", D(3), 10, { tags: ["Backend"] }),
  T("t_12", "PLW-2104", "ส่งมอบคอนเทนต์รอบที่ 2 ให้ Park Silom", "p_playwall", "u_ploy", "doing", "urgent", D(0), 4, { tags: ["Delivery"], progress: 65 }),
  T("t_13", "PLW-2105", "ใบแจ้งหนี้รอบ 2 (30%) — Park Silom", "p_playwall", "u_june", "todo", "med", D(4), 2, { tags: ["Finance"] }),
  T("t_14", "CRM-3101", "ออกแบบ flow สมัครสมาชิก + OTP", "p_crm", "u_nan", "done", "high", D(-3), 8, { tags: ["UX"], progress: 100 }),
  T("t_15", "CRM-3102", "API สะสมแต้ม + แลกรางวัล", "p_crm", "u_kan", "doing", "urgent", D(6), 20, { tags: ["API", "Backend"], progress: 35 }),
  T("t_16", "CRM-3103", "รายงานยอดใช้งานรายสาขา (BI)", "p_crm", "ai_orbit", "review", "med", D(2), 8, { tags: ["Data", "AI"], aiGenerated: true, progress: 88 }),
  T("t_17", "CRM-3104", "ตรวจข้อความแจ้งเตือนภาษาไทยทั้งระบบ", "p_crm", "ai_echo", "doing", "low", D(8), 3, { tags: ["QA", "AI"], progress: 50 }),
  T("t_18", "WEB-4001", "ขึ้น production เว็บไซต์ใหม่", "p_web", "u_kan", "todo", "urgent", D(3), 6, { tags: ["Deploy"], blocked: true, desc: "รอ DNS จากผู้ให้บริการโดเมน" }),
  T("t_19", "WEB-4002", "เขียนเคสลูกค้า 3 เรื่อง + ภาพประกอบ", "p_web", "u_mint", "review", "med", D(2), 5, { tags: ["Content"], progress: 80 }),
  T("t_20", "WEB-4003", "SEO audit + แก้ meta ทุกหน้า", "p_web", "ai_echo", "done", "low", D(-2), 3, { tags: ["SEO", "AI"], progress: 100, aiGenerated: true }),
  T("t_21", "WEB-4004", "เตรียมภาพ hero ชุดใหม่ 8 ใบ", "p_web", "ai_pixel", "doing", "med", D(5), 6, { tags: ["Design", "AI"], progress: 60, aiGenerated: true }),
  T("t_22", "MV-5001", "Storyboard + shot list", "p_film", "u_joe", "done", "med", D(-1), 10, { tags: ["Video"], progress: 100 }),
  T("t_23", "MV-5002", "คัดโลเคชัน + ขอใบอนุญาตถ่ายทำ", "p_film", "u_ploy", "todo", "high", D(10), 6, { tags: ["Production"] }),
  T("t_24", "MV-5003", "จองสตูดิโอและทีมแสง", "p_film", "u_mint", "todo", "med", D(8), 3, { tags: ["Production"] }),
  T("t_25", "IPL-1049", "Onboarding ลูกค้าใหม่ PlayCRM", "p_erp", "u_ploy", "done", "med", D(-4), 4, { tags: ["Client"], progress: 100 }),
  T("t_26", "IPL-1050", "สรุป OKR Q4 2569", "p_erp", "u_me", "review", "high", D(2), 5, { tags: ["Strategy"], progress: 75 }),
  T("t_27", "PLW-2106", "อัปเดตตารางรอบฉาย LED ประจำสัปดาห์", "p_playwall", "ai_nova", "todo", "med", D(3), 2, { tags: ["Ops", "AI"], aiGenerated: true }),
  T("t_28", "CRM-3105", "เก็บ requirement เฟส 2 กับลูกค้า", "p_crm", "u_ploy", "doing", "high", D(1), 4, { tags: ["Client"], progress: 45 }),
];

export const EVENTS: CalendarEvent[] = [
  { id: "e_01", title: "Daily Stand-up", date: D(0), time: "09:30", endTime: "09:50", cat: "meeting", desc: "ซิงก์งานทีม + AI agents", location: "Silom Studio", ownerId: "u_ploy" },
  { id: "e_02", title: "เดดไลน์: ส่งคอนเทนต์รอบ 2 Park Silom", date: D(0), cat: "delivery", desc: "ส่งมอบผ่าน Drive + แจ้งลูกค้า", projectId: "p_playwall", taskId: "t_12", important: true },
  { id: "e_03", title: "รีวิว Key visual จอ LED", date: D(0), time: "14:00", endTime: "15:00", cat: "meeting", projectId: "p_playwall", location: "Play Room (LED)", ownerId: "u_nan" },
  { id: "e_04", title: "เดดไลน์: MariaDB schema + migration", date: D(0), cat: "work", projectId: "p_erp", taskId: "t_03", important: true },
  { id: "e_05", title: "Sprint 22 Planning", date: D(1), time: "10:00", endTime: "11:30", cat: "meeting", projectId: "p_erp", location: "Silom Studio", ownerId: "u_ploy" },
  { id: "e_06", title: "เดดไลน์: Calendar full screen", date: D(1), cat: "work", projectId: "p_erp", taskId: "t_01", important: true },
  { id: "e_07", title: "โอนเงินเดือนทีม", date: D(1), time: "11:00", cat: "finance", ownerId: "u_june" },
  { id: "e_08", title: "Site visit Park Silom", date: D(2), time: "13:00", endTime: "15:30", cat: "meeting", location: "Park Silom ชั้น 12", projectId: "p_playwall", ownerId: "u_me" },
  { id: "e_09", title: "เดดไลน์: สรุป OKR Q4", date: D(2), cat: "work", projectId: "p_erp", taskId: "t_26" },
  { id: "e_10", title: "ส่งมอบเว็บไซต์ iPlay 2026", date: D(3), cat: "delivery", projectId: "p_web", taskId: "t_18", important: true },
  { id: "e_11", title: "จ่ายค่าเช่าสตูดิโอ", date: D(3), cat: "finance" },
  { id: "e_12", title: "เวิร์กชอป Brand Film", date: D(4), time: "09:00", endTime: "12:00", cat: "meeting", projectId: "p_film", location: "Ploenchit", ownerId: "u_joe" },
  { id: "e_13", title: "เดดไลน์: ใบแจ้งหนี้ Park Silom รอบ 2", date: D(4), cat: "finance", projectId: "p_playwall", taskId: "t_13" },
  { id: "e_14", title: "ส่งมอบ Key visual รอบสุดท้าย", date: D(1), cat: "delivery", projectId: "p_playwall", taskId: "t_09" },
  { id: "e_15", title: "ประชุมลูกค้า PlayCRM", date: D(5), time: "15:00", endTime: "16:00", cat: "meeting", projectId: "p_crm", location: "Google Meet", ownerId: "u_ploy" },
  { id: "e_16", title: "วันหยุด: วันปิยมหาราช", date: D(3), cat: "holiday", desc: "วันหยุดนักขัตฤกษ์" },
  { id: "e_17", title: "ทีมมีตติ้งประจำเดือน", date: D(7), time: "16:00", endTime: "17:30", cat: "meeting", location: "Play Room (LED)" },
  { id: "e_18", title: "เดดไลน์: UI ปรับปรุง Kanban", date: D(6), cat: "work", projectId: "p_erp", taskId: "t_05" },
  { id: "e_19", title: "ถ่ายทำ Brand Film Day 1", date: D(9), cat: "delivery", projectId: "p_film", location: "Mekong Coffee HQ" },
  { id: "e_20", title: "ประชุมบอร์ด Q4", date: D(10), time: "10:00", endTime: "12:00", cat: "meeting", ownerId: "u_me" },
  { id: "e_21", title: "สัมภาษณ์ Junior Dev", date: D(-1), time: "14:00", endTime: "15:00", cat: "meeting", location: "Silom Studio" },
  { id: "e_22", title: "เดดไลน์: Deploy เว็บไซต์", date: D(3), cat: "work", projectId: "p_web", taskId: "t_18" },
  { id: "e_23", title: "ทำฟัน (ส่วนตัว)", date: D(2), time: "18:00", cat: "personal", ownerId: "u_beer" },
  { id: "e_24", title: "ปิดรอบบัญชีกันยายน", date: D(-2), cat: "finance" },
  { id: "e_25", title: "AI Ops review — NOVA & BYTE", date: D(0), time: "17:00", endTime: "17:30", cat: "work", ownerId: "ai_nova" },
  { id: "e_26", title: "อบรม MCP + Google Drive", date: D(8), time: "13:30", endTime: "15:00", cat: "meeting", location: "Silom Studio" },
  { id: "e_27", title: "ครบรอบ 6 ปี iPlay Digital", date: D(12), cat: "holiday" },
  { id: "e_28", title: "ตรวจสุขภาพประจำปี", date: D(6), time: "08:30", endTime: "10:00", cat: "personal" },
];

export const CHANNELS: Channel[] = [
  { id: "ch_all", name: "all-hands", emoji: "📣", type: "group", topic: "ประกาศทีม iPlay Digital ทั้งหมด", members: TEAM.map((m) => m.id), pinned: true, unread: 2, driveFolder: "iPlay Workspace" },
  { id: "ch_erp", name: "erp-build", emoji: "⚙️", type: "group", topic: "งานพัฒนา iPlay Workspace ERP", members: ["u_me", "u_ploy", "u_kan", "u_beer", "u_nan", "ai_nova", "ai_byte"], unread: 4 },
  { id: "ch_playwall", name: "playwall-led", emoji: "🖥️", type: "group", topic: "จอ LED Park Silom + ตารางฉาย", members: ["u_me", "u_nan", "u_joe", "u_kan", "ai_pixel", "ai_echo"], unread: 1 },
  { id: "ch_design", name: "design-squad", emoji: "🎨", type: "group", topic: "Design system, key visual, motion", members: ["u_nan", "u_joe", "u_mint", "ai_pixel"], unread: 0 },
  { id: "dm_nova", name: "NOVA (AI)", emoji: "🤖", type: "ai", topic: "AI Project Coordinator — มอบหมายงานได้ทันที", members: ["u_me", "ai_nova"], unread: 0 },
  { id: "dm_ploy", name: "พลอย", emoji: "💬", type: "dm", members: ["u_me", "u_ploy"], unread: 0 },
];

const FILE = (id: string, name: string, type: DriveFile["type"], path: string, size: string, ownerId: string, sharedAt: string): DriveFile => ({
  id, name, type, url: `https://drive.google.com/${path}`, size, ownerId, sharedAt,
});

export const FILES: DriveFile[] = [
  FILE("f_01", "iPlay Workspace — PRD v3.gdoc", "doc", "document/d/1iPlayPRDv3/edit", "1.2 MB", "u_ploy", iso(220)),
  FILE("f_02", "Park Silom — Content Round 2.gsheet", "sheet", "spreadsheets/d/1PlaywallContent2/edit", "640 KB", "u_ploy", iso(340)),
  FILE("f_03", "LED Wall Key Visual — Final.png", "image", "file/d/1KeyVisualLED/view", "18.4 MB", "ai_pixel", iso(120)),
  FILE("f_04", "Sprint 22 Plan.gsheet", "sheet", "spreadsheets/d/1Sprint22/edit", "310 KB", "ai_nova", iso(60)),
  FILE("f_05", "iPlay Brand Guideline 2026.pdf", "pdf", "file/d/1BrandGuide2026/view", "9.8 MB", "u_nan", iso(1400)),
  FILE("f_06", "โฟลเดอร์กลางทีม iPlay", "folder", "drive/folders/1iPlayDigitalWorkspace", "—", "u_me", iso(3000)),
];

export const MESSAGES: Message[] = [
  { id: "m_01", channelId: "ch_all", authorId: "u_me", text: "อรุณสวัสดิ์ทีม 🌤️ สัปดาห์นี้โฟกัส 3 เรื่อง: ปิดงาน Playwall, deploy เว็บใหม่ และเปิดใช้ Workspace ERP เฟสแรก", at: iso(300), kind: "text", reactions: [{ emoji: "🔥", users: ["u_ploy", "u_kan", "u_mint", "ai_nova"] }] },
  { id: "m_02", channelId: "ch_all", authorId: "ai_nova", text: "สรุปงานค้างวันนี้: 24 งานเปิดอยู่ · 3 งานด่วนมาก · 2 เดดไลน์วันนี้ (Playwall รอบ 2, MariaDB schema)\nผมตั้งเตือนล่วงหน้าให้แล้ว และจอง Play Room ให้ 14:00–15:00 ตามที่ทีมขอครับ", at: iso(280), kind: "ai", pinned: true, reactions: [{ emoji: "👍", users: ["u_me", "u_ploy"] }] },
  { id: "m_03", channelId: "ch_all", authorId: "u_june", text: "รอบบัญชีกันยายนปิดแล้วนะคะ ใบเสร็จทั้งหมดอยู่ใน Drive โฟลเดอร์ Finance", at: iso(240), kind: "text" },
  { id: "m_04", channelId: "ch_all", authorId: "u_mint", text: "แชร์ไอเดียคอนเทนต์เดือน พ.ย. แล้วในดีไซน์บอร์ด ใครว่างช่วยคอมเมนต์ด้วยนะ", at: iso(150), kind: "text" },
  { id: "m_05", channelId: "ch_erp", authorId: "u_kan", text: "schema MariaDB รอบแรกพร้อมแล้ว — ตาราง tasks / events / chat / hr แยก index วันที่มีทั้งหมด", at: iso(190), kind: "text", reactions: [{ emoji: "🎉", users: ["u_beer", "u_ploy", "ai_byte"] }] },
  { id: "m_06", channelId: "ch_erp", authorId: "u_beer", text: "ลากการ์ดข้ามช่องแล้วบันทึกทันที ไม่ต้องรอ refresh ✅", at: iso(170), kind: "text" },
  { id: "m_07", channelId: "ch_erp", authorId: "ai_byte", text: "ผมรีแฟกเตอร์ Calendar ให้ render เฉพาะ cell ที่เปลี่ยน — ลดงาน paint ลง 38% ครับ", at: iso(130), kind: "ai", reactions: [{ emoji: "⚡", users: ["u_kan"] }] },
  { id: "m_08", channelId: "ch_erp", authorId: "u_nan", text: "แนบ PRD ล่าสุดให้แล้วนะ", at: iso(110), kind: "text" },
  { id: "m_09", channelId: "ch_erp", authorId: "u_nan", text: "", at: iso(109), kind: "file", file: FILES[0] },
  { id: "m_10", channelId: "ch_erp", authorId: "u_ploy", text: "ปักหมุด PRD ไว้แล้วทุกคน ใช้เวอร์ชันนี้เท่านั้นน้า", at: iso(100), kind: "text" },
  { id: "m_11", channelId: "ch_playwall", authorId: "u_joe", text: "เทสต์วิดีโอ 4K ต่อเนื่อง 48 ชม. ผ่าน ไม่มีเฟรมหลุด 🎬", at: iso(260), kind: "text", reactions: [{ emoji: "🔥", users: ["u_me", "u_nan", "ai_pixel"] }] },
  { id: "m_12", channelId: "ch_playwall", authorId: "ai_pixel", text: "Key visual รอบสุดท้าย (เพิ่ม safe area 60px) พร้อมส่งแล้วครับ", at: iso(120), kind: "ai" },
  { id: "m_13", channelId: "ch_playwall", authorId: "ai_pixel", text: "", at: iso(119), kind: "file", file: FILES[2] },
  { id: "m_14", channelId: "ch_playwall", authorId: "u_me", text: "เด็ดมาก ส่งลูกค้าพรุ่งนี้เช้าเลย", at: iso(80), kind: "text" },
  { id: "m_15", channelId: "ch_playwall", authorId: "u_kan", text: "ลิงก์จอ LED สำหรับพรีวิว: playwall-parksilom.pages.dev — เปิดบนทีวีในออฟฟิศได้เลย", at: iso(55), kind: "text", pinned: true },
  { id: "m_16", channelId: "ch_design", authorId: "u_nan", text: "อัปเดต Design System: ปุ่ม / การ์ด / ปฏิทิน ใช้ชุดสีเดียวกันทั้งระบบแล้ว", at: iso(400), kind: "text" },
  { id: "m_17", channelId: "ch_design", authorId: "u_joe", text: "Motion ของ Kanban นุ่มขึ้นเยอะ 👍", at: iso(320), kind: "text" },
  { id: "m_18", channelId: "ch_design", authorId: "ai_pixel", text: "เตรียมชุดภาพ hero 8 ใบ สไตล์渐变 noir ไว้ให้แล้ว", at: iso(200), kind: "ai" },
  { id: "m_19", channelId: "dm_nova", authorId: "u_me", text: "NOVA ช่วยสรุปงานด่วนของวันนี้ แล้วจองห้องประชุมให้ทีม 14:00 ด้วย", at: iso(90), kind: "text" },
  { id: "m_20", channelId: "dm_nova", authorId: "ai_nova", text: "เรียบร้อยครับ 👍\n• งานด่วน 3 งาน: Calendar (พรุ่งนี้), Key visual (พรุ่งนี้), Park Silom รอบ 2 (วันนี้)\n• จอง Play Room 14:00–15:00 ให้แล้ว — เชิญทีม Playwall 6 คน\n• แนบ Sprint 22 Plan ไว้ในแชทแล้ว", at: iso(88), kind: "ai", reactions: [{ emoji: "🙌", users: ["u_me"] }] },
  { id: "m_21", channelId: "dm_nova", authorId: "ai_nova", text: "", at: iso(87), kind: "file", file: FILES[3] },
  { id: "m_22", channelId: "dm_ploy", authorId: "u_ploy", text: "พี่โอ๊ค พรุ่งนี้ลูกค้า Park Silom ขอดู timeline บนปฏิทินแบบเต็มจอได้ไหมคะ", at: iso(75), kind: "text" },
  { id: "m_23", channelId: "dm_ploy", authorId: "u_me", text: "ได้เลย เดี๋ยวเปิด fullscreen ให้ดูในที่ประชุม", at: iso(70), kind: "text" },
  { id: "m_24", channelId: "ch_all", authorId: "u_beer", text: "ปล. ใครจะเช็คอินนอกสถานที่ อย่าลืมแนบพิกัด Google Maps ในฟอร์มนะครับ", at: iso(45), kind: "text" },
];

export const ROOMS: Room[] = [
  { id: "r_silom", name: "Silom Studio", floor: "ชั้น 12", capacity: 8, color: "#6C5CE7", amenities: ["จอ 65\"", "ไวท์บอร์ด", "Zoom"], screen: true },
  { id: "r_play", name: "Play Room (LED)", floor: "ชั้น 12", capacity: 20, color: "#3BA7FF", amenities: ["LED 4K", "ลำโพง", "กล้อง"], screen: true },
  { id: "r_ploen", name: "Ploenchit", floor: "ชั้น 11", capacity: 4, color: "#22C793", amenities: ["จอ 43\"", "โทรศัพท์"] },
  { id: "r_focus", name: "Focus Pod", floor: "ชั้น 11", capacity: 2, color: "#D98A00", amenities: ["เงียบ", "Standing desk"] },
];

export const BOOKINGS: Booking[] = [
  { id: "b_01", roomId: "r_play", title: "รีวิว Key visual LED", date: D(0), start: "14:00", end: "15:00", ownerId: "u_nan", attendees: 6, status: "confirmed" },
  { id: "b_02", roomId: "r_silom", title: "Daily Stand-up", date: D(0), start: "09:30", end: "09:50", ownerId: "u_ploy", attendees: 7, status: "confirmed" },
  { id: "b_03", roomId: "r_silom", title: "Sprint 22 Planning", date: D(1), start: "10:00", end: "11:30", ownerId: "u_ploy", attendees: 8, status: "confirmed" },
  { id: "b_04", roomId: "r_ploen", title: "ประชุมลูกค้า PlayCRM", date: D(0), start: "15:00", end: "16:00", ownerId: "u_me", attendees: 4, status: "confirmed" },
  { id: "b_05", roomId: "r_play", title: "ทีมมีตติ้งประจำเดือน", date: D(7), start: "16:00", end: "17:30", ownerId: "u_me", attendees: 15, status: "pending" },
  { id: "b_06", roomId: "r_focus", title: "Deep work — BYTE refactor", date: D(0), start: "10:00", end: "12:00", ownerId: "ai_byte", attendees: 1, status: "confirmed" },
];

export const LEAVES: LeaveRequest[] = [
  { id: "l_01", userId: "u_beer", type: "sick", from: D(-1), to: D(0), days: 2, reason: "ไข้หวัดใหญ่ มีใบแพทย์แนบ", status: "approved", createdAt: at(D(-2), 8).toString(), approverId: "u_ploy" },
  { id: "l_02", userId: "u_joe", type: "business", from: D(2), to: D(2), days: 1, reason: "ไปสำรวจโลเคชันถ่าย Brand Film", status: "pending", createdAt: at(D(-1), 17).toString() },
  { id: "l_03", userId: "u_mint", type: "annual", from: D(8), to: D(10), days: 3, reason: "ลาพักร้อนต่างจังหวัด", status: "pending", createdAt: at(D(-1), 11).toString() },
  { id: "l_04", userId: "u_nan", type: "wfh", from: D(1), to: D(1), days: 1, reason: "ทำงานที่บ้าน รอช่างติดตั้งอินเทอร์เน็ต", status: "approved", createdAt: at(D(-2), 15).toString(), approverId: "u_ploy" },
  { id: "l_05", userId: "u_kan", type: "annual", from: D(-12), to: D(-10), days: 3, reason: "ทริปครอบครัว", status: "approved", createdAt: at(D(-16), 9).toString(), approverId: "u_me" },
];

export const CHECKINS: CheckIn[] = [
  { id: "ck_01", userId: "u_me", at: at(D(0), 8, 52).toString(), place: "iPlay Digital — Park Silom", lat: 13.7284, lng: 100.5347, distance: 12, mode: "office", mapUrl: "https://maps.google.com/?q=13.7284,100.5347" },
  { id: "ck_02", userId: "u_ploy", at: at(D(0), 9, 4).toString(), place: "iPlay Digital — Park Silom", lat: 13.7285, lng: 100.5341, distance: 24, mode: "office", mapUrl: "https://maps.google.com/?q=13.7285,100.5341" },
  { id: "ck_03", userId: "u_kan", at: at(D(0), 9, 18).toString(), place: "บ้านพัก — บางนา", lat: 13.6682, lng: 100.6048, distance: 11800, mode: "remote", note: "WFH ตามที่อนุมัติ", mapUrl: "https://maps.google.com/?q=13.6682,100.6048" },
  { id: "ck_04", userId: "u_joe", at: at(D(0), 8, 30).toString(), place: "Mekong Coffee HQ — อโศก", lat: 13.7373, lng: 100.5601, distance: 3400, mode: "onsite", note: "สำรวจโลเคชันถ่ายทำ", mapUrl: "https://maps.google.com/?q=13.7373,100.5601" },
  { id: "ck_05", userId: "u_nan", at: at(D(-1), 9, 10).toString(), place: "iPlay Digital — Park Silom", lat: 13.7284, lng: 100.5347, distance: 15, mode: "office", mapUrl: "https://maps.google.com/?q=13.7284,100.5347" },
];

const RUN = (id: string, agentId: string, taskId: string | undefined, action: string, detail: string, minsAgo: number, durationSec: number, tokens: number, status: AiRun["status"]): AiRun => ({
  id, agentId, taskId, action, detail, at: iso(minsAgo), durationSec, tokens, status,
});

export const AIRUNS: AiRun[] = [
  RUN("ar_01", "ai_byte", "t_05", "รัน benchmark Kanban", "วัด render 1,000 งาน — พบ bottleneck ที่การคำนวณ daysLeft ใน render loop", 3, 0, 8420, "running"),
  RUN("ar_02", "ai_nova", "t_02", "ร่างแผน Sprint 22", "จัดลำดับ 18 งานตาม priority + capacity ทีม และเสนอ owner ครบทุกงาน", 18, 96, 23180, "success"),
  RUN("ar_03", "ai_pixel", "t_09", "สร้าง key visual LED", "เรนเดอร์ 6 variants 16:9 พร้อม safe area 60px ส่งเข้า Drive แล้ว", 42, 184, 41200, "success"),
  RUN("ar_04", "ai_echo", "t_17", "ตรวจข้อความไทย 42 จุด", "แก้คำผิด 5 จุด ปรับโทนการแจ้งเตือนให้สุภาพขึ้น", 66, 38, 7620, "success"),
  RUN("ar_05", "ai_nova", "t_27", "อัปเดตตารางฉาย LED", "ดึงคิวจาก Playwall แล้วซิงก์เป็นอีเวนต์รายสัปดาห์", 95, 24, 5140, "success"),
  RUN("ar_06", "ai_orbit", "t_16", "สร้างรายงานยอดใช้งานรายสาขา", "รอคิว — agent ถูกพักการทำงานชั่วคราว", 130, 0, 0, "queued"),
  RUN("ar_07", "ai_byte", undefined, "สแกน dependency", "อัปเดต next 15.5.4 → ตรวจ CVE 0 รายการ", 190, 71, 15300, "success"),
  RUN("ar_08", "ai_echo", undefined, "สรุปแชทประจำวัน", "สรุป 24 ข้อความใน #erp-build เป็น 5 ประเด็นสำคัญ", 240, 19, 3280, "success"),
];

export const ACTIVITY: ActivityItem[] = [
  { id: "a_01", at: iso(3), actorId: "ai_byte", text: "กำลังรัน benchmark Kanban (task IPL-1045)", kind: "ai" },
  { id: "a_02", at: iso(10), actorId: "u_beer", text: "ย้าย IPL-1046 → กำลังทำ", kind: "task" },
  { id: "a_03", at: iso(18), actorId: "ai_nova", text: "ร่างแผน Sprint 22 สำเร็จ — 18 งาน", kind: "ai" },
  { id: "a_04", at: iso(26), actorId: "u_nan", text: "แชร์ไฟล์ LED Wall Key Visual — Final.png", kind: "drive" },
  { id: "a_05", at: iso(34), actorId: "u_joe", text: "เช็คอินนอกสถานที่ที่ Mekong Coffee HQ", kind: "hr" },
  { id: "a_06", at: iso(47), actorId: "u_ploy", text: "จอง Play Room (LED) 14:00–15:00", kind: "hr" },
  { id: "a_07", at: iso(58), actorId: "ai_pixel", text: "ส่งงาน IPL-2101 → ตรวจแก้", kind: "ai" },
  { id: "a_08", at: iso(75), actorId: "u_kan", text: "อัปเดต MariaDB schema สำเร็จ", kind: "system" },
  { id: "a_09", at: iso(92), actorId: "u_mint", text: "ยื่นขอลาพักร้อน 3 วัน", kind: "hr" },
  { id: "a_10", at: iso(120), actorId: "u_me", text: "เปิด Sprint 22 ใน Workspace", kind: "system" },
  { id: "a_11", at: iso(160), actorId: "ai_echo", text: "ตรวจข้อความภาษาไทย 42 จุด", kind: "ai" },
];

export function seedData(): Omit<Bootstrap, "trend" | "storage" | "today"> {
  return {
    members: TEAM,
    projects: PROJECTS,
    tasks: TASKS,
    events: EVENTS,
    channels: CHANNELS,
    messages: MESSAGES,
    files: FILES,
    rooms: ROOMS,
    bookings: BOOKINGS,
    leaves: LEAVES,
    checkins: CHECKINS,
    aiRuns: AIRUNS,
    activity: ACTIVITY,
    settings: {
      brand: "iPlay Workspace",
      branch: "iPlay Digital · Park Silom",
      ledUrl: process.env.NEXT_PUBLIC_LED_URL || "https://playwall-parksilom.pages.dev/",
      driveFolder: process.env.NEXT_PUBLIC_DRIVE_FOLDER || "https://drive.google.com/drive/folders/1iPlayDigitalWorkspace",
      office: { name: "iPlay Digital — Park Silom", lat: 13.7284, lng: 100.5347, radius: 150 },
      aiEnabled: true,
      workStart: "09:30",
      workEnd: "18:30",
      announce: "โฟกัสสัปดาห์นี้: ปิดงาน Playwall + Deploy เว็บใหม่ 🚀",
    },
    meId: "u_me",
  };
}

export function trendData() {
  const now = new Date();
  const labels: string[] = [];
  const created = [18, 24, 21, 29, 26, 32];
  const done = [14, 19, 20, 23, 27, 29];
  const revenue = [420, 510, 468, 690, 720, 845];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${d.getMonth() + 1}/${String(d.getFullYear() + 543).slice(2)}`);
  }
  return { labels, created, done, revenue };
}

// helpers used by the demo store for freshly created records
export const newComment = (authorId: string, text: string) => ({ id: uid("c"), authorId, text, at: new Date().toISOString() });
export const timeNow = () => `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
