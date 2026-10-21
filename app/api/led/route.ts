import { NextResponse } from "next/server";
import { getBootstrap } from "../../../lib/store";

export const dynamic = "force-dynamic";

/**
 * LED Wall (Playwall Park Silom) — payload สำหรับจอ LED 1920×1080
 * เรียกได้จาก playwall-parksilom.pages.dev ด้วย fetch + CORS
 */
export async function GET() {
  const data = await getBootstrap();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  return NextResponse.json({
    screen: "iPlay Digital · Park Silom LED",
    ledUrl: data.settings.ledUrl,
    updatedAt: now.toISOString(),
    announce: data.settings.announce,
    todayEvents: data.events
      .filter((e) => e.date === today)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
      .map((e) => ({ title: e.title, time: e.time, cat: e.cat })),
    urgentTasks: data.tasks
      .filter((t) => t.status !== "done" && t.priority === "urgent")
      .map((t) => ({ code: t.code, title: t.title, due: t.due })),
    aiAgents: data.members
      .filter((m) => m.kind === "ai")
      .map((m) => ({ name: m.name, state: m.state, paused: !!m.paused, task: m.currentTaskId })),
    stats: {
      open: data.tasks.filter((t) => t.status !== "done").length,
      done: data.tasks.filter((t) => t.status === "done").length,
      todayDone: data.tasks.filter((t) => t.status === "done").length,
    },
  }, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  });
}
