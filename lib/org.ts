// ─────────────────────────────────────────────────────────────
//  โครงสร้างองค์กร — แผนก (Department) + ทีม (Team)
//  seed ไว้ในโค้ด และบันทึกลง MariaDB (ws_departments / ws_teams)
//  เพื่อให้แก้ไขได้ภายหลังโดยไม่ต้อง deploy
// ─────────────────────────────────────────────────────────────
import type { Department, Team } from "./types";

export const DEPARTMENTS: Department[] = [
  { id: "dep_exec", name: "ทีมบริหาร", short: "EXEC", color: "#7100DD", order: 1, headId: "u_me", desc: "ผู้บริหาร · การเงิน · ทรัพยากรบุคคล" },
  { id: "dep_strategy", name: "Strategy & Planning", short: "STR", color: "#5B8DEF", order: 2, headId: null, desc: "วางกลยุทธ์ แบรนด์ และ research" },
  { id: "dep_creative", name: "Creative & Design", short: "CRT", color: "#FF6B9D", order: 3, headId: "u_nan", desc: "Art direction, graphic, UI/UX" },
  { id: "dep_production", name: "Production & Motion", short: "PRD", color: "#FF9A5A", order: 4, headId: "u_joe", desc: "ถ่ายทำ ตัดต่อ โมชันกราฟิก" },
  { id: "dep_dev", name: "Development", short: "DEV", color: "#22C793", order: 5, headId: "u_kan", desc: "เว็บ แอป และระบบภายใน" },
  { id: "dep_media", name: "Media & Marketing", short: "MKT", color: "#3BA7FF", order: 6, headId: "u_mint", desc: "Media buying, SEO, CRM, content" },
  { id: "dep_account", name: "Account & Project", short: "ACC", color: "#8E7CF3", order: 7, headId: "u_ploy", desc: "ดูแลลูกค้า บรีฟ และส่งมอบงาน" },
  { id: "dep_ai", name: "AI Workforce", short: "AI", color: "#14C4B2", order: 8, headId: "ai_nova", desc: "เอเจนต์ AI ที่ทำงานร่วมกับทีม" },
];

export const TEAMS: Team[] = [
  { id: "team_brand", name: "Brand & Graphic", departmentId: "dep_creative", color: "#FF6B9D", leadId: "u_nan" },
  { id: "team_motion", name: "Motion & Video", departmentId: "dep_production", color: "#FF9A5A", leadId: "u_joe" },
  { id: "team_web", name: "Web & Platform", departmentId: "dep_dev", color: "#22C793", leadId: "u_kan" },
  { id: "team_media", name: "Media Buying", departmentId: "dep_media", color: "#3BA7FF", leadId: "u_mint" },
  { id: "team_pm", name: "Project Management", departmentId: "dep_account", color: "#8E7CF3", leadId: "u_ploy" },
  { id: "team_agents", name: "AI Agents", departmentId: "dep_ai", color: "#14C4B2", leadId: "ai_nova" },
];

/** แผนกของสมาชิกแต่ละคน (ใช้กับข้อมูล demo/seed) */
export const MEMBER_DEPT: Record<string, { departmentId: string; teamId?: string }> = {
  u_me: { departmentId: "dep_exec" },
  u_ploy: { departmentId: "dep_account", teamId: "team_pm" },
  u_kan: { departmentId: "dep_dev", teamId: "team_web" },
  u_nan: { departmentId: "dep_creative", teamId: "team_brand" },
  u_beer: { departmentId: "dep_dev", teamId: "team_web" },
  u_mint: { departmentId: "dep_media", teamId: "team_media" },
  u_joe: { departmentId: "dep_production", teamId: "team_motion" },
  u_june: { departmentId: "dep_exec" },
  ai_nova: { departmentId: "dep_ai", teamId: "team_agents" },
  ai_pixel: { departmentId: "dep_ai", teamId: "team_agents" },
  ai_byte: { departmentId: "dep_ai", teamId: "team_agents" },
  ai_echo: { departmentId: "dep_ai", teamId: "team_agents" },
  ai_orbit: { departmentId: "dep_ai", teamId: "team_agents" },
};

/** ชื่อย่อแผนก เช่น EXEC / CRT */
export function deptShort(id?: string | null): string {
  return DEPARTMENTS.find((d) => d.id === id)?.short ?? "—";
}

export function deptName(id?: string | null): string {
  return DEPARTMENTS.find((d) => d.id === id)?.name ?? "ไม่ระบุแผนก";
}

export function deptColor(id?: string | null): string {
  return DEPARTMENTS.find((d) => d.id === id)?.color ?? "#8A8FB1";
}

export function teamName(id?: string | null): string {
  return TEAMS.find((t) => t.id === id)?.name ?? "";
}

export function teamsOf(departmentId?: string | null): Team[] {
  return TEAMS.filter((t) => t.departmentId === departmentId);
}

// ── ตำแหน่งใน Digital Agency (ใช้ใน dropdown ของหน้าพนักงาน) ──
export const POSITION_LEVELS = ["Intern", "Junior", "Mid", "Senior", "Lead", "Head", "Director", "C-level"] as const;
export type PositionLevel = (typeof POSITION_LEVELS)[number];

export const JOB_TITLES: { title: string; departmentId: string }[] = [
  { title: "Managing Director", departmentId: "dep_exec" },
  { title: "CTO", departmentId: "dep_exec" },
  { title: "COO", departmentId: "dep_exec" },
  { title: "Finance & Admin", departmentId: "dep_exec" },
  { title: "HR Manager", departmentId: "dep_exec" },
  { title: "IT Support", departmentId: "dep_dev" },
  { title: "Strategy Director", departmentId: "dep_strategy" },
  { title: "Brand Strategist", departmentId: "dep_strategy" },
  { title: "Creative Director", departmentId: "dep_creative" },
  { title: "Art Director", departmentId: "dep_creative" },
  { title: "Copywriter", departmentId: "dep_creative" },
  { title: "Graphic Designer", departmentId: "dep_creative" },
  { title: "UI/UX Designer", departmentId: "dep_creative" },
  { title: "Producer", departmentId: "dep_production" },
  { title: "Video Editor", departmentId: "dep_production" },
  { title: "Motion Designer", departmentId: "dep_production" },
  { title: "Photographer", departmentId: "dep_production" },
  { title: "Tech Lead", departmentId: "dep_dev" },
  { title: "Full-stack Developer", departmentId: "dep_dev" },
  { title: "Frontend Developer", departmentId: "dep_dev" },
  { title: "Media Buyer", departmentId: "dep_media" },
  { title: "Performance Marketing", departmentId: "dep_media" },
  { title: "Content Strategist", departmentId: "dep_media" },
  { title: "Account Manager", departmentId: "dep_account" },
  { title: "Project Manager", departmentId: "dep_account" },
  { title: "Account Executive", departmentId: "dep_account" },
  { title: "AI Project Coordinator", departmentId: "dep_ai" },
  { title: "AI Creative Designer", departmentId: "dep_ai" },
  { title: "AI Full-stack Engineer", departmentId: "dep_ai" },
  { title: "AI Comms & QA", departmentId: "dep_ai" },
  { title: "AI Data Analyst", departmentId: "dep_ai" },
];
