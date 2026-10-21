import type { Bootstrap, Member } from "./types";
import { thaiShort, thaiTime, relDay, LEAVE_META } from "./utils";

const who = (b: Bootstrap, id: string) => b.members.find((m) => m.id === id);

const roomFreeNow = (b: Bootstrap) => {
  const today = b.today;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return b.rooms.filter((r) => {
    const busy = b.bookings.filter((x) => x.roomId === r.id && x.date === today);
    return !busy.some((x) => nowMin >= toMin(x.start) - 0 && nowMin < toMin(x.end));
  });
};

export function aiReply(b: Bootstrap, agentId: string, userText: string): { reply: string; suggestions: string[] } {
  const agent = who(b, agentId);
  const me = who(b, b.meId);
  const t = userText.toLowerCase();
  const todayEvents = b.events.filter((e) => e.date === b.today);
  const open = b.tasks.filter((x) => x.status !== "done");
  const urgent = open.filter((x) => x.priority === "urgent");
  const overdue = open.filter((x) => new Date(x.due + "T23:59:59").getTime() < Date.now());
  const pendingLeaves = b.leaves.filter((l) => l.status === "pending");
  const freeRooms = roomFreeNow(b);
  const aiOn = b.members.filter((m) => m.kind === "ai" && !m.paused);

  const line = (s: string) => s;

  if (/จอง|ห้องประชุม|meeting room|room/i.test(userText)) {
    const room = freeRooms[0] ?? b.rooms[0];
    const free = b.rooms
      .map((r) => `${r.name} (${r.capacity} ที่นั่ง)`)
      .slice(0, 3)
      .join(", ");
    return {
      reply: line(
        `จองให้เรียบร้อยครับ — **${room.name}** ${b.today === b.today ? "วันนี้" : ""} 14:00–15:00 (${room.floor})\n` +
          `• ห้องว่างตอนนี้: ${free}\n` +
          `• ผมสร้างอีเวนต์ลงปฏิทินหมวด "ประชุม" พร้อมแนบผู้เข้าร่วมแล้ว\n` +
          `• ต้องการให้แชร์ลิงก์ Google Maps ของ Park Silom ให้ทีมด้วยไหมครับ?`,
      ),
      suggestions: ["เปลี่ยนเป็น 16:00", "จอง Play Room 2 ชั่วโมง", "แนบ Google Maps"],
    };
  }

  if (/สรุป|summary|รายงาน|standup|สแตนด์/i.test(userText)) {
    return {
      reply: line(
        `สรุปสถานะทีมตอนนี้ครับ (${thaiShort(b.today)})\n` +
          `• งานเปิดอยู่ ${open.length} งาน · ด่วนมาก ${urgent.length} · เลยกำหนด ${overdue.length}\n` +
          `• วันนี้มี ${todayEvents.length} รายการ: ${todayEvents.slice(0, 3).map((e) => `${e.time ?? "ทั้งวัน"} ${e.title}`).join(" · ")}\n` +
          `• AI ที่ทำงานอยู่: ${aiOn.map((a) => a.name).join(", ") || "ยังไม่มี"}\n` +
          `• ใบลารออนุมัติ ${pendingLeaves.length} ใบ\n` +
          `เดดไลน์ใกล้วันสุด: ${urgent[0] ? `${urgent[0].code} "${urgent[0].title}" (${relDay(urgent[0].due)})` : "ไม่มี"}`,
      ),
      suggestions: ["แจกงานให้ BYTE", "สร้าง Sprint ใหม่", "ดู workload ทีม"],
    };
  }

  if (/เดดไลน์|deadline|ด่วน|งานค้าง/i.test(userText)) {
    return {
      reply: line(
        `งานที่ต้องจับตาครับ\n` +
          urgent
            .slice(0, 4)
            .map((x) => `• ${x.code} ${x.title} — ${relDay(x.due)} (${who(b, x.assigneeId)?.name ?? "ไม่ระบุ"})`)
            .join("\n") +
          `\n\nผมแนะนำให้มอบงานที่ยังไม่เริ่มให้ AI agent ช่วยทำคู่ขนาน — พิมพ์ "มอบงานให้ BYTE" ได้เลยครับ`,
      ),
      suggestions: ["มอบงานให้ BYTE", "เลื่อนเดดไลน์เป็นสัปดาห์หน้า", "แจ้งเตือนทีม"],
    };
  }

  if (/ลา|leave|ลาป่วย|พักร้อน/i.test(userText)) {
    return {
      reply: line(
        `เรื่องการลา — มีคำขอรออนุมัติ ${pendingLeaves.length} ใบ\n` +
          pendingLeaves
            .slice(0, 4)
            .map((l) => `• ${who(b, l.userId)?.name} · ${LEAVE_META[l.type]?.label} ${l.days} วัน (${thaiShort(l.from)}–${thaiShort(l.to)})`)
            .join("\n") +
          `\n\nถ้าอนุมัติแล้ว ผมจะอัปเดตปฏิทินทีมและแจ้งใน #all-hands ให้อัตโนมัติครับ`,
      ),
      suggestions: ["อนุมัติทั้งหมด", "ดูยอดวันลาคงเหลือ", "แจ้งทีมใน all-hands"],
    };
  }

  if (/เช็คอิน|check.?in|พิกัด|map|แผนที่/i.test(userText)) {
    const todayIn = b.checkins.filter((c) => c.at.slice(0, 10) === b.today);
    return {
      reply: line(
        `สรุปการเช็คอินวันนี้ครับ — ${todayIn.length} คน\n` +
          todayIn
            .slice(0, 5)
            .map((c) => `• ${who(b, c.userId)?.name} · ${c.mode === "office" ? "ที่ออฟฟิศ" : c.mode === "remote" ? "WFH" : "หน้างาน"} — ${c.place}`)
            .join("\n") +
          `\n\nเช็คอินนอกสถานที่ต้องแนบพิกัด Google Maps ระบบคำนวณระยะห่างจาก Park Silom (รัศมี ${b.settings.office.radius} ม.) ให้แล้ว`,
      ),
      suggestions: ["ขอพิกัดล่าสุดของทีม", "เปิด Google Maps ออฟฟิศ", "สรุปการเข้าออฟฟิศสัปดาห์นี้"],
    };
  }

  if (/drive|เอกสาร|ไฟล์|file/i.test(userText)) {
    return {
      reply: line(
        `ไฟล์ล่าสุดใน Workspace Drive\n` +
          b.files
            .slice(0, 4)
            .map((f) => `• ${f.name} (${f.size}) — แชร์โดย ${who(b, f.ownerId)?.name ?? "-"}`)
            .join("\n") +
          `\n\nโฟลเดอร์กลาง: ${b.settings.driveFolder}\nผมเชื่อมผ่าน MCP อยู่ คุณสั่ง "หาไฟล์ PRD" หรือ "แชร์ไฟล์ล่าสุดเข้า #erp-build" ได้เลย`,
      ),
      suggestions: ["หาไฟล์ PRD", "แชร์ไฟล์ล่าสุดเข้า erp-build", "เปิดโฟลเดอร์กลาง"],
    };
  }

  if (/มอบงาน|assign|ให้.*(nova|byte|pixel|echo|orbit)/i.test(userText)) {
    return {
      reply: line(
        `มอบหมายงานให้ AI แล้วครับ\n` +
          `• NOVA — จัดลำดับงานและติดตามเดดไลน์ (${open.length} งานเปิด)\n` +
          `• BYTE — เริ่ม refactor โมดูลที่ช้าที่สุด (กำลังทำ IPL-1045)\n` +
          `• PIXEL — สร้างภาพประกอบ 8 ใบ ส่งเข้า Drive 📁\n\n` +
          `ทุก run บันทึกใน AI Console พร้อม token ที่ใช้ — ตรวจย้อนหลังได้ครับ`,
      ),
      suggestions: ["ดู AI run log", "หยุด PIXEL ชั่วคราว", "ตั้งงบ token รายวัน"],
    };
  }

  if (/led|playwall|จอ/i.test(userText)) {
    return {
      reply: line(
        `จอ LED Park Silom เชื่อมอยู่ครับ (${b.settings.ledUrl})\n` +
          `• วันนี้มี ${todayEvents.length} คิวฉาย และ ${urgent.length} งานด่วนที่ต้องขึ้นจอ\n` +
          `• ตารางฉายสัปดาห์นี้ดึงจาก Playwall แล้ว — เปิดหน้า "LED Wall" ในเมนูเพื่อพรีวิว 1920×1080\n` +
          `• ต้องการให้ผมส่งคอนเทนต์รอบใหม่ขึ้นจอทันทีไหมครับ?`,
      ),
      suggestions: ["พรีวิวจอ LED", "อัปเดตตารางฉาย", "แจ้งลูกค้า Park Silom"],
    };
  }

  if (/ขอบคุณ|thank|เก่ง/i.test(userText)) {
    return {
      reply: line(`ยินดีครับ 🙌 ผมทำงานคู่กับทีมตลอด — ถ้ามีงานไหนอยากให้ช่วย พิมพ์บอกได้เลย`),
      suggestions: ["สรุปงานวันนี้", "จองห้องประชุมพรุ่งนี้", "หาไฟล์ PRD"],
    };
  }

  return {
    reply: line(
      `รับทราบครับ ${me?.nickname ? `พี่${me.nickname}` : ""} 👋\n` +
        `ผม ${agent?.name ?? "NOVA"} — ผู้ช่วย AI ของทีม iPlay\n` +
        `ตอนนี้มี ${open.length} งานเปิด, ${todayEvents.length} นัดหมายวันนี้ และ AI ที่ทำงานอยู่ ${aiOn.length} ตัว\n` +
        `บอกผมได้เลยว่าจะให้: สรุปงาน / จองห้องประชุม / มอบงานให้ AI / อนุมัติใบลา / แชร์ไฟล์จาก Drive`,
    ),
    suggestions: ["สรุปงานวันนี้", "จองห้องประชุม 14:00", "งานด่วนมีอะไรบ้าง"],
  };
}

export function agentGreeting(b: Bootstrap, agent: Member) {
  return `${agent.name} พร้อมช่วยงาน — ${agent.skills.slice(0, 2).join(" · ")}`;
}

export function agentStatusText(b: Bootstrap, m: Member) {
  if (m.kind !== "ai") return m.state === "online" ? "ออนไลน์" : m.state === "focus" ? "โฟกัสงาน" : m.state === "away" ? "ไม่อยู่" : "พร้อมทำงาน";
  if (m.paused) return "พักการทำงาน";
  if (m.state === "working") {
    const t = b.tasks.find((x) => x.id === m.currentTaskId);
    return t ? `กำลังทำงาน ${t.code}` : "กำลังทำงาน";
  }
  return "พร้อมรับงาน";
}

export function nextRunTime(b: Bootstrap) {
  const d = new Date(Date.now() + 1000 * 60 * 7);
  return thaiTime(d.toISOString());
}
