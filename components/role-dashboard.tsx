"use client";

import React from "react";
import {
  Activity, ArrowRight, Bot, CalendarDays, CheckCircle2, ClipboardList, Clock, Flame,
  FolderKanban, ListTodo, Lock, MessageSquare, ShieldCheck, Users, Wallet,
} from "lucide-react";
import { useApp } from "./providers";
import { Dashboard } from "./dashboard";
import { Avatar, Meter, StatusPill } from "./ui";
import { WorkloadBars } from "./charts";
import { DEPARTMENTS, deptColor, deptName, deptShort, teamName } from "../lib/org";
import { ROLE_META, canAccess, roleScope } from "../lib/rbac";
import { STATUS_META, STATUS_ORDER, cls, money, thaiDate, thaiTime } from "../lib/utils";
import type { Bootstrap, SessionUser } from "../lib/types";

/** แดชบอร์ดที่เปลี่ยนหน้าตาตามสิทธิ์ของบทบาท */
export function RoleDashboard({ me }: { me: SessionUser }) {
  const { data } = useApp();
  if (!data) return null;
  const scope = roleScope(me.role);

  // ทีมบริหาร / Support → แดชบอร์ดเต็ม
  if (me.role === "admin") return <Dashboard />;

  if (me.role === "support") return <OpsDashboard data={data} me={me} />;
  if (me.role === "manager") return <ManagerDashboard data={data} me={me} />;
  if (me.role === "ai") return <AiDashboard data={data} me={me} />;
  return <MemberDashboard data={data} me={me} scope={scope} />;
}

// ── แดชบอร์ดหัวหน้าแผนก ─────────────────────────────────────
function ManagerDashboard({ data, me }: { data: Bootstrap; me: SessionUser }) {
  const { go, openTask, now } = useApp();
  const deptId = me.departmentId ?? "";
  const dept = DEPARTMENTS.find((d) => d.id === deptId);
  const teammates = data.members.filter((m) => m.departmentId === deptId);
  const teamIds = teammates.map((m) => m.id);
  const myTasks = data.tasks.filter((t) => teamIds.includes(t.assigneeId));
  const openTasks = myTasks.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => new Date(t.due + "T23:59:59") < now);
  const deptProjects = data.projects.filter((p) => p.members.some((m) => teamIds.includes(m)));
  const pendingLeaves = data.leaves.filter((l) => l.status === "pending" && teamIds.includes(l.userId));
  const todayEvents = data.events.filter((e) => e.date === data.today && (!e.projectId || deptProjects.some((p) => p.id === e.projectId)));
  const budget = deptProjects.reduce((s, p) => s + p.budget, 0);
  const spent = deptProjects.reduce((s, p) => s + p.spent, 0);

  return (
    <div className="page">
      <div className="role-banner" style={{ background: `linear-gradient(120deg, ${dept?.color ?? "#149C74"}18, #ffffff 65%)`, borderColor: `${dept?.color ?? "#149C74"}33` }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="kpi-ico" style={{ background: `${dept?.color ?? "#149C74"}1f`, color: dept?.color ?? "#149C74" }}>
            <ShieldCheck size={16} />
          </span>
          <div>
            <b style={{ fontSize: 13 }}>แดชบอร์ดหัวหน้าแผนก · {dept?.name ?? "ยังไม่ระบุแผนก"}</b>
            <div className="tiny muted">
              {ROLE_META.manager.desc} · ทีม {teammates.length} คน
            </div>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => go("staff")}><Users size={12} /> จัดการทีม</button>
      </div>

      <div className="kpi-grid">
        <KpiSmall icon={<ListTodo size={16} />} grad="var(--grad-cyan)" value={openTasks.length} label={`งานค้างในแผนก · ${overdue.length} เลยกำหนด`} sub={`${myTasks.filter((t) => t.status === "done").length} ปิดแล้ว`} />
        <KpiSmall icon={<FolderKanban size={16} />} grad="var(--grad-violet)" value={deptProjects.length} label="โปรเจกต์ที่แผนกเกี่ยวข้อง" sub={`งบรวม ${money(budget)}`} />
        <KpiSmall icon={<Users size={16} />} grad="var(--grad-mint)" value={teammates.length} label="สมาชิกในแผนก" sub={`${pendingLeaves.length} ใบลารออนุมัติ`} />
        <KpiSmall icon={<Wallet size={16} />} grad="var(--grad-amber)" value={money(spent)} label="ใช้จ่ายไปแล้ว" sub={`คงเหลือ ${money(Math.max(0, budget - spent))}`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Flame size={14} /> งานด่วนของแผนก</div>
            <button className="link-btn" onClick={() => go("tasks")}>เปิด Kanban <ArrowRight size={11} /></button>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {openTasks.slice(0, 6).map((t) => {
              const u = data.members.find((m) => m.id === t.assigneeId);
              return (
                <button key={t.id} className="list-row" onClick={() => openTask(t.id)}>
                  <span className="lr-ico" style={{ background: `${dept?.color ?? "#149C74"}1a`, color: dept?.color ?? "#149C74" }}>{t.code.split("-")[1]?.slice(-2)}</span>
                  <div className="lr-main">
                    <b>{t.title}</b>
                    <small>{u?.nickname ?? "—"} · กำหนด {thaiDate(t.due, { short: true })}</small>
                  </div>
                  <div className="lr-right"><StatusPill status={t.status} /></div>
                </button>
              );
            })}
            {openTasks.length === 0 && <div className="empty"><CheckCircle2 size={22} /><p>ไม่มีงานค้างในแผนก</p></div>}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><Users size={14} /> ภาระงานในทีม</div>
            <span className="tiny muted">{teammates.filter((m) => m.kind === "human").length} คน</span>
          </div>
          <div className="card-body">
            <WorkloadBars
              rows={teammates.filter((m) => m.kind === "human").map((m) => {
                const load = myTasks.filter((t) => t.assigneeId === m.id && t.status !== "done");
                const hours = load.reduce((sum, t) => sum + t.estimate, 0);
                return {
                  name: `${m.nickname} · ${hours} ชม.`,
                  role: m.role,
                  color: m.color,
                  initials: m.initials,
                  value: Math.min(100, Math.round((hours / Math.max(1, (m.capacity ?? 40))) * 100)),
                };
              })}
            />
            <div className="divider" />
            <div className="tiny muted">สถานะงานในแผนก</div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {STATUS_ORDER.map((s) => (
                <span key={s} className="pill" style={{ background: STATUS_META[s].soft, color: STATUS_META[s].color }}>
                  {STATUS_META[s].label} {myTasks.filter((t) => t.status === s).length}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><CalendarDays size={14} /> ปฏิทินวันนี้</div><button className="link-btn" onClick={() => go("calendar")}>ดูปฏิทิน <ArrowRight size={11} /></button></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayEvents.slice(0, 5).map((e) => (
              <div key={e.id} className="feed-item">
                <span className="feed-dot" style={{ background: "var(--violet)" }} />
                <div>
                  <b style={{ fontSize: 11.5 }}>{e.title}</b>
                  <div className="tiny muted">{e.time ?? "ทั้งวัน"} {e.location ? `· ${e.location}` : ""}</div>
                </div>
              </div>
            ))}
            {todayEvents.length === 0 && <div className="tiny muted">ไม่มีนัดหมายวันนี้</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><ClipboardList size={14} /> รออนุมัติ</div><button className="link-btn" onClick={() => go("hr")}>ไปที่ HR <ArrowRight size={11} /></button></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingLeaves.slice(0, 4).map((l) => {
              const u = data.members.find((m) => m.id === l.userId);
              return (
                <div key={l.id} className="list-row">
                  {u && <Avatar member={u} size="sm" />}
                  <div className="lr-main"><b>{u?.nickname ?? "—"} ขอลา</b><small>{l.from} → {l.to} · {l.days} วัน</small></div>
                  <div className="lr-right"><span className="pill" style={{ background: "var(--yellow-soft)", color: "#B47600" }}>รออนุมัติ</span></div>
                </div>
              );
            })}
            {pendingLeaves.length === 0 && <div className="tiny muted">ไม่มีคำขอรออนุมัติ</div>}
            <div className="side-card" style={{ fontSize: 11, marginTop: 4 }}>
              <b><Lock size={12} /> ขอบเขตของคุณ</b>
              <div>• เห็นงาน/พนักงานเฉพาะแผนก {dept?.name}</div>
              <div>• ลบพนักงานไม่ได้ (ระงับบัญชีได้)</div>
              <div>• เห็นข้อมูลการเงินแบบอ่านเท่านั้น</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── แดชบอร์ดทีม AI (ปฏิทินรวม + ลงเวลา + ลา + แชท) ─────────
function AiDashboard({ data, me }: { data: Bootstrap; me: SessionUser }) {
  const { go } = useApp();
  const crossDept = DEPARTMENTS.map((d) => ({
    dept: d,
    events: data.events.filter((e) => {
      if (e.date !== data.today) return false;
      const owner = data.members.find((m) => m.id === e.ownerId);
      return owner?.departmentId === d.id;
    }).length,
    tasks: data.tasks.filter((t) => {
      const m = data.members.find((x) => x.id === t.assigneeId);
      return m?.departmentId === d.id && t.status !== "done";
    }).length,
    checkins: data.checkins.filter((c) => {
      const m = data.members.find((x) => x.id === c.userId);
      return m?.departmentId === d.id && c.at.slice(0, 10) === data.today;
    }).length,
    leaves: data.leaves.filter((l) => {
      const m = data.members.find((x) => x.id === l.userId);
      return m?.departmentId === d.id && l.status === "pending";
    }).length,
  }));

  const todayCheckins = data.checkins.filter((c) => c.at.slice(0, 10) === data.today);
  const todayEvents = data.events.filter((e) => e.date === data.today).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const pendingLeaves = data.leaves.filter((l) => l.status === "pending");
  const recentMessages = [...data.messages].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  return (
    <div className="page">
      <div className="role-banner" style={{ background: "linear-gradient(120deg, rgba(255,107,157,.12), #fff 65%)", borderColor: "rgba(255,107,157,.28)" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="kpi-ico" style={{ background: "rgba(255,107,157,.16)", color: "#D6337A" }}><Bot size={16} /></span>
          <div>
            <b style={{ fontSize: 13 }}>แดชบอร์ดทีม AI · มุมมองภาพรวมทุกแผนก</b>
            <div className="tiny muted">{ROLE_META.ai.desc}</div>
          </div>
        </div>
        <span className="pill" style={{ background: "rgba(255,107,157,.14)", color: "#D6337A" }}>ไม่แสดงข้อมูลการเงิน</span>
      </div>

      <div className="kpi-grid">
        <KpiSmall icon={<CalendarDays size={16} />} grad="var(--grad-violet)" value={todayEvents.length} label="นัดหมายวันนี้ (ทุกแผนก)" sub={`${data.events.length} ทั้งเดือน`} />
        <KpiSmall icon={<Clock size={16} />} grad="var(--grad-mint)" value={todayCheckins.length} label="ลงเวลาวันนี้" sub={`${data.members.filter((m) => m.kind === "human").length} คนทั้งบริษัท`} />
        <KpiSmall icon={<ListTodo size={16} />} grad="var(--grad-cyan)" value={data.tasks.filter((t) => t.status !== "done").length} label="งานคงค้างทั้งบริษัท" sub={`เสร็จแล้ว ${data.tasks.filter((t) => t.status === "done").length}`} />
        <KpiSmall icon={<Users size={16} />} grad="var(--grad-amber)" value={pendingLeaves.length} label="ใบลารออนุมัติ" sub="ดูรายละเอียดได้ที่ HR" />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><Activity size={14} /> ปฏิทินรวม vs การลงเวลา (วันนี้)</div>
          <span className="tiny muted">เทียบกิจกรรมกับ work track ของแต่ละแผนก</span>
        </div>
        <div className="card-body">
          <table className="kanban-table">
            <thead><tr><th>แผนก</th><th>นัดหมายวันนี้</th><th>งานค้าง</th><th>ลงเวลาแล้ว</th><th>ลารออนุมัติ</th><th>ความคืบหน้า</th></tr></thead>
            <tbody>
              {crossDept.map((row) => {
                const ratio = row.tasks === 0 ? 1 : Math.min(1, row.checkins / Math.max(1, row.tasks));
                return (
                  <tr key={row.dept.id}>
                    <td>
                      <div className="row" style={{ gap: 7 }}>
                        <span className="dot" style={{ width: 8, height: 8, borderRadius: 9, background: row.dept.color }} />
                        <b style={{ fontSize: 11.5 }}>{row.dept.name}</b>
                        <span className="tiny muted">{row.dept.short}</span>
                      </div>
                    </td>
                    <td>{row.events}</td>
                    <td>{row.tasks}</td>
                    <td>{row.checkins}</td>
                    <td>{row.leaves ? <span className="pill" style={{ background: "var(--yellow-soft)", color: "#B47600" }}>{row.leaves}</span> : "—"}</td>
                    <td style={{ width: 160 }}><Meter value={Math.round(ratio * 100)} tone={ratio >= 0.8 ? "mint" : ""} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><CalendarDays size={14} /> กำหนดการวันนี้</div><button className="link-btn" onClick={() => go("calendar")}>เปิดปฏิทิน <ArrowRight size={11} /></button></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayEvents.slice(0, 8).map((e) => {
              const owner = data.members.find((m) => m.id === e.ownerId);
              return (
                <div key={e.id} className="feed-item">
                  <span className="feed-dot" style={{ background: deptColor(owner?.departmentId) }} />
                  <div>
                    <b style={{ fontSize: 11.5 }}>{e.title}</b>
                    <div className="tiny muted">{e.time ?? "ทั้งวัน"} · {deptShort(owner?.departmentId)} · {owner?.nickname ?? "ทีม"}</div>
                  </div>
                </div>
              );
            })}
            {todayEvents.length === 0 && <div className="tiny muted">ยังไม่มีนัดหมายวันนี้</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><MessageSquare size={14} /> ความเคลื่อนไหวแชท</div><button className="link-btn" onClick={() => go("chat")}>เปิดแชท <ArrowRight size={11} /></button></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {recentMessages.map((m) => {
              const author = data.members.find((x) => x.id === m.authorId);
              const ch = data.channels.find((c) => c.id === m.channelId);
              return (
                <div key={m.id} className="list-row">
                  {author && <Avatar member={author} size="sm" />}
                  <div className="lr-main"><b>{author?.nickname ?? "—"} · #{ch?.name ?? "general"}</b><small>{m.text.slice(0, 60)}</small></div>
                  <div className="lr-right tiny muted">{thaiTime(m.at)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── แดชบอร์ด Support / Ops ──────────────────────────────────
function OpsDashboard({ data, me }: { data: Bootstrap; me: SessionUser }) {
  const { go } = useApp();
  const humans = data.members.filter((m) => m.kind === "human");
  const todayCheckins = data.checkins.filter((c) => c.at.slice(0, 10) === data.today);
  const pendingLeaves = data.leaves.filter((l) => l.status === "pending");
  return (
    <div className="page">
      <div className="role-banner" style={{ background: "linear-gradient(120deg, rgba(59,167,255,.12), #fff 65%)", borderColor: "rgba(59,167,255,.26)" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="kpi-ico" style={{ background: "rgba(59,167,255,.16)", color: "#2F7BF0" }}><ShieldCheck size={16} /></span>
          <div>
            <b style={{ fontSize: 13 }}>แดชบอร์ด IT / Support</b>
            <div className="tiny muted">{ROLE_META.support.desc}</div>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => go("staff")}><Users size={12} /> ทะเบียนพนักงาน</button>
      </div>
      <div className="kpi-grid">
        <KpiSmall icon={<Users size={16} />} grad="var(--grad-violet)" value={humans.length} label="พนักงานทั้งหมด" sub="จัดการบัญชีและสิทธิ์ได้" />
        <KpiSmall icon={<Clock size={16} />} grad="var(--grad-mint)" value={todayCheckins.length} label="ลงเวลาวันนี้" sub={`${humans.length - todayCheckins.length} คนยังไม่ลงเวลา`} />
        <KpiSmall icon={<ClipboardList size={16} />} grad="var(--grad-cyan)" value={pendingLeaves.length} label="ใบลารออนุมัติ" sub="อนุมัติได้ที่ HR" />
        <KpiSmall icon={<Activity size={16} />} grad="var(--grad-amber)" value={data.activity.length} label="กิจกรรมในระบบ" sub={`${data.tasks.length} งาน · ${data.reports.length} รายงาน`} />
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><Users size={14} /> ทีมทั้งหมด</div><button className="link-btn" onClick={() => go("staff")}>จัดการ <ArrowRight size={11} /></button></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {humans.slice(0, 8).map((m) => (
              <div key={m.id} className="list-row">
                <Avatar member={m} size="sm" />
                <div className="lr-main"><b>{m.nickname} · {m.name}</b><small>{deptName(m.departmentId)}{m.teamId ? ` · ${teamName(m.teamId)}` : ""}</small></div>
                <div className="lr-right"><span className="pill">{deptShort(m.departmentId)}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title"><Activity size={14} /> กิจกรรมล่าสุด</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.activity.slice(0, 8).map((a) => {
              const actor = data.members.find((m) => m.id === a.actorId);
              return (
                <div key={a.id} className="feed-item">
                  <span className="feed-dot" style={{ background: deptColor(actor?.departmentId) }} />
                  <div><b style={{ fontSize: 11.5 }}>{actor?.nickname ?? "ระบบ"}</b><div className="tiny muted">{a.text}</div></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── แดชบอร์ดพนักงาน (User) ─────────────────────────────────
function MemberDashboard({ data, me, scope }: { data: Bootstrap; me: SessionUser; scope: ReturnType<typeof roleScope> }) {
  const { go, openTask, now } = useApp();
  const myId = data.meId;
  const myTasks = data.tasks.filter((t) => t.assigneeId === myId);
  const openTasks = myTasks.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => new Date(t.due + "T23:59:59") < now);
  const myEvents = data.events.filter((e) => e.date === data.today && (!e.ownerId || e.ownerId === myId));
  const myCheckin = data.checkins.find((c) => c.userId === myId && c.at.slice(0, 10) === data.today);
  const myLeaves = data.leaves.filter((l) => l.userId === myId);
  const teammates = data.members.filter((m) => m.departmentId === me.departmentId && m.kind === "human");
  const dept = DEPARTMENTS.find((d) => d.id === me.departmentId);

  return (
    <div className="page">
      <div className="role-banner" style={{ background: "linear-gradient(120deg, rgba(113,0,221,.10), #fff 65%)", borderColor: "rgba(113,0,221,.22)" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="kpi-ico" style={{ background: "rgba(113,0,221,.10)", color: "var(--violet)" }}><Users size={16} /></span>
          <div>
            <b style={{ fontSize: 13 }}>สวัสดี {me.nickname || me.name} · แผนก {dept?.name ?? "—"}</b>
            <div className="tiny muted">{ROLE_META.member.desc} · ไม่แสดงข้อมูลการเงิน</div>
          </div>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => go("tasks")}><ListTodo size={12} /> งานของฉัน</button>
      </div>

      <div className="kpi-grid">
        <KpiSmall icon={<ListTodo size={16} />} grad="var(--grad-cyan)" value={openTasks.length} label={`งานของฉัน · ${overdue.length} เลยกำหนด`} sub={`เสร็จแล้ว ${myTasks.filter((t) => t.status === "done").length} งาน`} />
        <KpiSmall icon={<CalendarDays size={16} />} grad="var(--grad-violet)" value={myEvents.length} label="นัดหมายวันนี้" sub={myEvents[0]?.title ?? "ไม่มีนัดหมาย"} />
        <KpiSmall icon={<Clock size={16} />} grad="var(--grad-mint)" value={myCheckin ? thaiTime(myCheckin.at) : "ยังไม่ลง"} label="ลงเวลาวันนี้" sub={myCheckin?.place ?? "กดลงเวลาที่เมนู HR"} />
        <KpiSmall icon={<ClipboardList size={16} />} grad="var(--grad-amber)" value={myLeaves.filter((l) => l.status === "pending").length} label="ใบลาของฉัน" sub={`อนุมัติแล้ว ${myLeaves.filter((l) => l.status === "approved").length}`} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><ListTodo size={14} /> งานที่ต้องทำ</div><button className="link-btn" onClick={() => go("tasks")}>ทั้งหมด <ArrowRight size={11} /></button></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {openTasks.slice(0, 6).map((t) => (
              <button key={t.id} className="list-row" onClick={() => openTask(t.id)}>
                <span className="lr-ico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>{t.code.split("-")[1]?.slice(-2)}</span>
                <div className="lr-main"><b>{t.title}</b><small>กำหนด {thaiDate(t.due, { short: true })} · {t.estimate} ชม.</small></div>
                <div className="lr-right"><StatusPill status={t.status} /></div>
              </button>
            ))}
            {openTasks.length === 0 && <div className="empty"><CheckCircle2 size={22} /><p>ไม่มีงานค้าง เยี่ยม!</p></div>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><Users size={14} /> ทีมในแผนกของฉัน</div><span className="tiny muted">{teammates.length} คน</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {teammates.map((m) => (
              <div key={m.id} className="list-row">
                <Avatar member={m} size="sm" />
                <div className="lr-main"><b>{m.nickname}</b><small>{m.role}</small></div>
                <div className="lr-right tiny muted">{m.load ?? 0}%</div>
              </div>
            ))}
            {!scope.money && <div className="tiny muted" style={{ marginTop: 6 }}>ข้อมูลงบประมาณ/ต้นทุนถูกซ่อนตามสิทธิ์ของคุณ</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title"><ClipboardList size={14} /> ทางลัด</div></div>
        <div className="card-body row" style={{ gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "calendar", label: "ปฏิทินทีม", icon: <CalendarDays size={13} /> },
            { key: "hr", label: "ลงเวลา / ลา", icon: <Clock size={13} /> },
            { key: "chat", label: "แชททีม", icon: <MessageSquare size={13} /> },
            { key: "reports", label: "รายงานของฉัน", icon: <ClipboardList size={13} /> },
          ].filter((x) => canAccess(me.role, x.key as "calendar")).map((x) => (
            <button key={x.key} className="btn btn-sm" onClick={() => go(x.key as "calendar")}>{x.icon} {x.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiSmall({ icon, grad, value, label, sub }: { icon: React.ReactNode; grad: string; value: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="k-top">
        <span className="kpi-ico" style={{ background: grad }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div className="kpi-lbl">{label}</div>
          <div className="kpi-val">{value}</div>
        </div>
      </div>
      {sub && <div className="tiny muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
}
