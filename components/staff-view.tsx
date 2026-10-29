"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, Building2, CalendarClock, Check, ChevronRight, Clock, History, KeyRound,
  Loader2, Lock, LogIn, Pencil, Plus, Search, ShieldCheck, Trash2, UserCog, UserPlus, Users, X,
} from "lucide-react";
import { useApp } from "./providers";
import { Modal } from "./ui";
import { cls, thaiDate, thaiTime, textOn } from "../lib/utils";
import { MODULE_META, ROLE_META, canAccess, visibleModules, type ModuleKey } from "../lib/rbac";
import type { AuditEntry, Department, LoginLog, SessionUser, Team, UserRole } from "../lib/types";

interface StaffScope {
  role: UserRole;
  allDepartments: boolean;
  manageStaff: boolean;
  deleteStaff: boolean;
  grantAdmin: boolean;
  departmentId: string | null;
}

interface StaffPayload {
  users: SessionUser[];
  departments: Department[];
  teams: Team[];
  scope: StaffScope;
  stats: { total: number; active: number; suspended: number; admins: number; managers: number; oauth: number };
}

const ROLE_OPTIONS: UserRole[] = ["member", "manager", "ai", "support", "admin"];

export function StaffView() {
  const { me, toast } = useApp();
  const [payload, setPayload] = useState<StaffPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState<string>("all");
  const [role, setRole] = useState<"all" | UserRole>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "create" | "edit"; user?: SessionUser } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as StaffPayload & { error?: string };
      if (!res.ok) throw new Error(body.error || "โหลดทะเบียนพนักงานไม่สำเร็จ");
      setPayload(body);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  if (!me) return null;
  if (!canAccess(me.role, "staff")) {
    return (
      <div className="page">
        <NoAccess role={me.role} />
      </div>
    );
  }

  const users = payload?.users ?? [];
  const departments = payload?.departments ?? [];
  const teams = payload?.teams ?? [];
  const scope = payload?.scope;

  const shown = users.filter((u) => {
    const inDept = dept === "all" || u.departmentId === dept;
    const inRole = role === "all" || u.role === role;
    const text = `${u.name} ${u.nickname} ${u.email} ${u.position ?? ""} ${u.jobTitle ?? ""}`.toLowerCase();
    return inDept && inRole && (!q || text.includes(q.toLowerCase()));
  });

  const countByDept = (id: string) => users.filter((u) => u.departmentId === id).length;
  const open = users.find((u) => u.id === openId) ?? null;

  const save = async (data: Record<string, unknown>, mode: "create" | "edit", id?: string) => {
    const res = await fetch(mode === "create" ? "/api/staff" : `/api/staff/${id}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; initialPassword?: string };
    if (!res.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
    toast(
      mode === "create"
        ? `เพิ่มพนักงานแล้ว · รหัสผ่านเริ่มต้น ${body.initialPassword ?? "iplay@2026"}`
        : "อัปเดตข้อมูลพนักงานแล้ว",
      "ok",
    );
    setForm(null);
    await load();
  };

  const patch = async (u: SessionUser, data: Record<string, unknown>, msg: string) => {
    const res = await fetch(`/api/staff/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast(body.error || "อัปเดตไม่สำเร็จ", "err");
    toast(msg, "info");
    await load();
  };

  const remove = async (u: SessionUser) => {
    if (!window.confirm(`ลบบัญชี ${u.name} (${u.email}) ออกจากระบบถาวร?`)) return;
    const res = await fetch(`/api/staff/${u.id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast(body.error || "ลบไม่สำเร็จ", "err");
    toast("ลบพนักงานแล้ว", "info");
    setOpenId(null);
    await load();
  };

  return (
    <div className="page">
      {/* KPI */}
      <div className="kpi-grid">
        <MiniKpi icon={<Users size={15} />} label="พนักงานในขอบเขตของคุณ" value={payload?.stats.total ?? 0} tone="violet" sub={scope?.allDepartments ? "ทุกแผนก" : `เฉพาะ ${deptName(departments, scope?.departmentId)}`} />
        <MiniKpi icon={<BadgeCheck size={15} />} label="เปิดใช้งาน" value={payload?.stats.active ?? 0} tone="mint" sub={`ระงับ ${payload?.stats.suspended ?? 0}`} />
        <MiniKpi icon={<ShieldCheck size={15} />} label="ผู้บริหาร / หัวหน้า" value={`${payload?.stats.admins ?? 0} / ${payload?.stats.managers ?? 0}`} tone="blue" sub={`Google/LINE ${payload?.stats.oauth ?? 0} คน`} />
        <MiniKpi icon={<Building2 size={15} />} label="แผนก" value={scope?.allDepartments ? departments.length : 1} tone="amber" sub={scope?.allDepartments ? "เห็นทุกแผนก" : "เห็นเฉพาะแผนกตน"} />
      </div>

      {/* org overview + department tabs */}
      <div className="card">
        <div className="card-head">
          <div className="card-title"><Building2 size={14} /> ทะเบียนพนักงาน · แยกตามแผนก</div>
          <div className="row" style={{ gap: 6 }}>
            <div className="searchbox" style={{ width: 210 }}>
              <Search size={13} />
              <input placeholder="ค้นหาชื่อ / อีเมล / ตำแหน่ง…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="select" style={{ width: 130 }} value={role} onChange={(e) => setRole(e.target.value as "all" | UserRole)}>
              <option value="all">ทุกสิทธิ์</option>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_META[r].short}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => setForm({ mode: "create" })}>
              <UserPlus size={13} /> เพิ่มพนักงาน
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="dept-tabs">
            <button className={cls("dept-tab", dept === "all" && "on")} onClick={() => setDept("all")}>
              <span className="dot" style={{ background: "var(--violet)" }} />
              ทั้งหมด
              <b>{users.length}</b>
            </button>
            {departments.map((d) => {
              const n = countByDept(d.id);
              const blocked = !scope?.allDepartments && d.id !== scope?.departmentId;
              return (
                <button
                  key={d.id}
                  className={cls("dept-tab", dept === d.id && "on", blocked && "off")}
                  onClick={() => { if (!blocked) setDept(d.id); }}
                  title={blocked ? "ไม่สามารถเข้าถึงพนักงานต่างแผนกได้" : d.desc}
                  disabled={blocked}
                >
                  <span className="dot" style={{ background: d.color }} />
                  {d.name}
                  <b>{blocked ? "—" : n}</b>
                </button>
              );
            })}
          </div>

          {loading && <div className="row muted" style={{ gap: 8, padding: 12 }}><Loader2 size={14} className="spin" /> กำลังโหลดทะเบียน…</div>}

          {!loading && (
            <table className="kanban-table staff-table">
              <thead>
                <tr>
                  <th>พนักงาน</th><th>แผนก / ทีม</th><th>ตำแหน่ง</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => {
                  const deptInfo = departments.find((d) => d.id === u.departmentId);
                  const team = teams.find((t) => t.id === u.teamId);
                  return (
                    <tr key={u.id} onClick={() => setOpenId(u.id)}>
                      <td>
                        <div className="row" style={{ gap: 9 }}>
                          {u.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="avatar" src={u.avatar} alt={u.name} style={{ width: 28, height: 28, objectFit: "cover" }} />
                          ) : (
                            <span className="avatar" style={{ background: u.color, color: textOn(u.color), width: 28, height: 28, fontSize: 10 }}>{u.initials}</span>
                          )}
                          <div>
                            <b style={{ fontSize: 12 }}>{u.name}{u.id === me.id && <span className="tiny muted"> (คุณ)</span>}</b>
                            <div className="tiny muted">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="pill" style={{ background: `${deptInfo?.color ?? "#8A8FB1"}1a`, color: deptInfo?.color ?? "#8A8FB1" }}>
                          {deptInfo?.short ?? "—"}
                        </span>
                        <span className="tiny muted" style={{ marginLeft: 6 }}>{deptInfo?.name ?? "ไม่ระบุ"}{team ? ` · ${team.name}` : ""}</span>
                      </td>
                      <td>
                        <b style={{ fontSize: 11.5 }}>{u.jobTitle || u.position || "—"}</b>
                        {u.level && <div className="tiny muted">{u.level}</div>}
                      </td>
                      <td>
                        <span className="pill" style={{ background: ROLE_META[u.role].soft, color: ROLE_META[u.role].color }}>
                          {ROLE_META[u.role].short}
                        </span>
                        {u.isSuper && <span className="super-badge" style={{ marginLeft: 4 }}><ShieldCheck size={9} /> SUPER</span>}
                      </td>
                      <td>
                        <span className="pill" style={{ background: u.active ? "rgba(34,199,147,.14)" : "var(--red-soft)", color: u.active ? "#149C74" : "#C9304F" }}>
                          {u.active ? "ใช้งาน" : "ระงับ"}
                        </span>
                      </td>
                      <td className="tiny muted">{u.lastLoginAt ? `${thaiDate(u.lastLoginAt.slice(0, 10), { short: true })} ${thaiTime(u.lastLoginAt)}` : "ยังไม่เคยเข้า"}</td>
                      <td>
                        <div className="row" style={{ gap: 3 }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-sm" title="ดูโปรไฟล์ & ประวัติ" onClick={() => setOpenId(u.id)}><ChevronRight size={12} /></button>
                          <button className="btn btn-sm" title="แก้ไข" onClick={() => setForm({ mode: "edit", user: u })}><Pencil size={12} /></button>
                          {scope?.manageStaff && (
                            <button className="btn btn-sm" title={u.active ? "ระงับบัญชี" : "เปิดใช้งาน"} disabled={u.id === me.id} onClick={() => void patch(u, { active: !u.active }, u.active ? "ระงับบัญชีแล้ว" : "เปิดใช้งานแล้ว")}>
                              {u.active ? <Lock size={12} /> : <BadgeCheck size={12} />}
                            </button>
                          )}
                          {scope?.deleteStaff && (
                            <button className="btn btn-sm" style={{ color: "var(--red)" }} title="ลบ" disabled={u.id === me.id} onClick={() => void remove(u)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && shown.length === 0 && <div className="empty"><Users size={24} /><p>ไม่พบพนักงานตามเงื่อนไข</p></div>}

          {scope && !scope.deleteStaff && (
            <div className="side-card" style={{ marginTop: 10, fontSize: 11 }}>
              <b><Lock size={12} /> ขอบเขตสิทธิ์ของคุณ</b>
              <div>{ROLE_META[scope.role].desc}</div>
              {!scope.deleteStaff && <div>• ไม่มีสิทธิ์ลบพนักงาน (ทำได้เฉพาะระงับบัญชี)</div>}
              {!scope.allDepartments && <div>• เห็นและแก้ไขได้เฉพาะพนักงานในแผนกของตนเอง</div>}
            </div>
          )}
        </div>
      </div>

      {open && (
        <StaffDrawer
          user={open}
          departments={departments}
          teams={teams}
          scope={scope}
          me={me}
          onClose={() => setOpenId(null)}
          onEdit={() => setForm({ mode: "edit", user: open })}
          onPatch={patch}
          onPhoto={async (file) => {
            const small = await shrink(file);
            const form = new FormData();
            form.append("file", small);
            const res = await fetch(`/api/staff/${open.id}/photo`, { method: "POST", body: form });
            const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; hint?: string };
            if (!res.ok) return toast([body.error, body.hint].filter(Boolean).join(" — ") || "อัปโหลดรูปไม่สำเร็จ", "err");
            toast("อัปเดตรูปพนักงานแล้ว", "ok");
            await load();
          }}
          onPullLine={async () => {
            const res = await fetch(`/api/staff/${open.id}/photo`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ source: "line" }),
            });
            const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; hint?: string };
            if (!res.ok) return toast([body.error, body.hint].filter(Boolean).join(" — ") || "ดึงรูปจาก LINE ไม่สำเร็จ", "err");
            toast("ดึงรูปจาก LINE แล้ว", "ok");
            await load();
          }}
          onDelete={scope?.deleteStaff ? () => void remove(open) : undefined}
        />
      )}

      {form && (
        <StaffForm
          mode={form.mode}
          user={form.user}
          departments={departments}
          teams={teams}
          scope={scope}
          me={me}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// ── drawer: โปรไฟล์ + ประวัติแก้ไข + การเข้าใช้ ────────────────
function StaffDrawer({
  user, departments, teams, scope, me, onClose, onEdit, onPatch, onPhoto, onPullLine, onDelete,
}: {
  user: SessionUser;
  departments: Department[];
  teams: Team[];
  scope?: StaffScope;
  me: SessionUser;
  onClose: () => void;
  onEdit: () => void;
  onPatch: (u: SessionUser, data: Record<string, unknown>, msg: string) => Promise<void>;
  onPhoto: (file: File) => Promise<void>;
  onPullLine: () => Promise<void>;
  onDelete?: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "audit" | "login">("profile");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [logins, setLogins] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetch(`/api/staff/${user.id}/history`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { audit?: AuditEntry[]; logins?: LoginLog[] }) => {
        if (!alive) return;
        setAudit(b.audit ?? []);
        setLogins(b.logins ?? []);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user.id]);

  const dept = departments.find((d) => d.id === user.departmentId);
  const team = teams.find((t) => t.id === user.teamId);
  const base = visibleModules(user.role);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer staff-drawer">
        <div className="drawer-head">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={user.avatar} alt={user.name} style={{ width: 40, height: 40, objectFit: "cover" }} />
          ) : (
            <span className="avatar" style={{ background: user.color, color: textOn(user.color), width: 40, height: 40, fontSize: 13 }}>{user.initials}</span>
          )}
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 14 }}>{user.name}</b>
            <div className="tiny muted">{user.email}</div>
            {(scope?.manageStaff || user.id === me.id) && (
              <div className="row" style={{ gap: 4, marginTop: 3 }}>
                <label className="link-btn" style={{ fontSize: 10, cursor: "pointer" }}>
                  อัปโหลดรูป
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onPhoto(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button className="link-btn" style={{ fontSize: 10 }} onClick={() => void onPullLine()}>
                  ดึงรูปจาก LINE
                </button>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="tabs" style={{ margin: "0 16px 12px" }}>
          <button className={cls(tab === "profile" && "on")} onClick={() => setTab("profile")}><UserCog size={12} /> ข้อมูล</button>
          <button className={cls(tab === "audit" && "on")} onClick={() => setTab("audit")}><History size={12} /> ประวัติแก้ไข</button>
          <button className={cls(tab === "login" && "on")} onClick={() => setTab("login")}><LogIn size={12} /> การเข้าใช้</button>
        </div>

        <div className="drawer-body">
          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="kv-grid">
                <KV label="แผนก" value={dept ? `${dept.name} (${dept.short})` : "ไม่ระบุ"} />
                <KV label="ทีม" value={team?.name ?? "ไม่มีทีม"} />
                <KV label="ตำแหน่ง" value={user.jobTitle || user.position || "—"} />
                <KV label="ระดับ" value={user.level || "—"} />
                <KV label="สิทธิ์" value={user.isSuper ? "Super Admin (ทุกสิทธิ์)" : ROLE_META[user.role].label} />
                <KV label="วิธีเข้าใช้" value={user.provider === "password" ? "อีเมล/รหัสผ่าน" : user.provider === "google" ? "Google" : "LINE"} />
                <KV label="สถานะ" value={user.active ? "ใช้งาน" : "ระงับ"} />
                <KV label="เข้าใช้ล่าสุด" value={user.lastLoginAt ? `${thaiDate(user.lastLoginAt.slice(0, 10), { short: true })} ${thaiTime(user.lastLoginAt)}` : "ยังไม่เคยเข้า"} />
              </div>

              <div className="divider" />
              <b style={{ fontSize: 12 }}>สิทธิ์เข้าถึงโมดูล</b>
              <div className="module-grid">
                {(Object.keys(MODULE_META) as ModuleKey[]).map((m) => {
                  const allowed = base.includes(m) || (user.extraModules ?? []).includes(m);
                  const isExtra = !base.includes(m) && (user.extraModules ?? []).includes(m);
                  return (
                    <span key={m} className={cls("module-chip", allowed && "on", isExtra && "extra")}>
                      {allowed ? <Check size={10} /> : <X size={10} />} {MODULE_META[m].label}
                      {isExtra && <small>+ เพิ่มเติม</small>}
                    </span>
                  );
                })}
              </div>

              <div className="divider" />
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={onEdit}><Pencil size={12} /> แก้ไขข้อมูล</button>
                {scope?.manageStaff && (
                  <button className="btn btn-sm" disabled={user.id === me.id} onClick={() => void onPatch(user, { active: !user.active }, user.active ? "ระงับบัญชีแล้ว" : "เปิดใช้งานแล้ว")}>
                    {user.active ? <><Lock size={12} /> ระงับบัญชี</> : <><BadgeCheck size={12} /> เปิดใช้งาน</>}
                  </button>
                )}
                {onDelete && user.id !== me.id && (
                  <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={onDelete}><Trash2 size={12} /> ลบ</button>
                )}
              </div>
            </div>
          )}

          {tab === "audit" && (
            <div>
              {loading && <div className="row muted" style={{ gap: 8 }}><Loader2 size={13} className="spin" /> กำลังโหลดประวัติ…</div>}
              {!loading && audit.length === 0 && <div className="empty"><History size={22} /><p>ยังไม่มีประวัติการแก้ไข</p></div>}
              <div className="timeline">
                {audit.map((a) => (
                  <div key={a.id} className="tl-item">
                    <span className={cls("tl-dot", a.action)} />
                    <div className="tl-body">
                      <div className="tl-top">
                        <b>{auditActionLabel(a.action)}{a.field ? ` · ${a.field}` : ""}</b>
                        <span className="tiny muted">{thaiDate(a.at.slice(0, 10), { short: true })} {thaiTime(a.at)}</span>
                      </div>
                      {(a.from || a.to) && (
                        <div className="tiny">
                          <span className="tl-from">{a.from || "—"}</span>
                          <ChevronRight size={10} style={{ verticalAlign: "middle", margin: "0 3px" }} />
                          <span className="tl-to">{a.to || "—"}</span>
                        </div>
                      )}
                      <div className="tiny muted">โดย {a.actorName}{a.ip && ` · ${a.ip}`}</div>
                      {a.note && <div className="tiny muted">{a.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "login" && (
            <div>
              {loading && <div className="row muted" style={{ gap: 8 }}><Loader2 size={13} className="spin" /> กำลังโหลด…</div>}
              {!loading && logins.length === 0 && <div className="empty"><LogIn size={22} /><p>ยังไม่มีประวัติการเข้าใช้</p></div>}
              <table className="kanban-table">
                <thead><tr><th>เวลา</th><th>วิธี</th><th>ผล</th><th>IP</th></tr></thead>
                <tbody>
                  {logins.map((l) => (
                    <tr key={l.id}>
                      <td className="tiny">{thaiDate(l.at.slice(0, 10), { short: true })} {thaiTime(l.at)}</td>
                      <td className="tiny">{l.provider === "password" ? "อีเมล" : l.provider === "google" ? "Google" : l.provider === "line" ? "LINE" : "Session"}</td>
                      <td className="tiny">
                        <span className="pill" style={{ background: l.ok ? "rgba(34,199,147,.14)" : "var(--red-soft)", color: l.ok ? "#149C74" : "#C9304F" }}>
                          {l.ok ? "สำเร็จ" : l.reason || "ไม่สำเร็จ"}
                        </span>
                      </td>
                      <td className="tiny muted">{l.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tiny muted" style={{ marginTop: 8 }}>บันทึกทุกครั้งที่เข้า/ออกระบบ พร้อม IP และอุปกรณ์</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── form: เพิ่ม/แก้ไข + กำหนดสิทธิ์โมดูล ──────────────────────
function StaffForm({
  mode, user, departments, teams, scope, me, onClose, onSave,
}: {
  mode: "create" | "edit";
  user?: SessionUser;
  departments: Department[];
  teams: Team[];
  scope?: StaffScope;
  me: SessionUser;
  onClose: () => void;
  onSave: (data: Record<string, unknown>, mode: "create" | "edit", id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    nickname: user?.nickname ?? "",
    email: user?.email ?? "",
    departmentId: user?.departmentId ?? scope?.departmentId ?? "",
    teamId: user?.teamId ?? "",
    jobTitle: user?.jobTitle ?? user?.position ?? "",
    level: user?.level ?? "",
    role: (user?.role ?? "member") as UserRole,
    password: "",
    active: user?.active ?? true,
    extraModules: user?.extraModules ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptTeams = teams.filter((t) => t.departmentId === form.departmentId);
  const baseModules = visibleModules(form.role);
  const canGrantAdmin = scope?.grantAdmin ?? false;
  const roleChoices = ROLE_OPTIONS.filter((r) => (r === "admin" ? canGrantAdmin : r === "support" ? me.role === "admin" : true));
  const lockedDept = !(scope?.allDepartments ?? true);

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) return setError("ต้องกรอกชื่อ-นามสกุล");
    if (mode === "create" && !form.email.trim()) return setError("ต้องกรอกอีเมลบริษัท");
    setBusy(true);
    try {
      const data: Record<string, unknown> = {
        name: form.name, nickname: form.nickname, departmentId: form.departmentId || null,
        teamId: form.teamId || null, jobTitle: form.jobTitle, level: form.level,
        role: form.role, active: form.active, extraModules: form.extraModules,
      };
      if (mode === "create") data.email = form.email;
      if (form.password) data.password = form.password;
      await onSave(data, mode, user?.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={mode === "create" ? "เพิ่มพนักงาน" : `แก้ไข · ${user?.name ?? ""}`}
      subtitle={mode === "create" ? "สร้างบัญชีใหม่และกำหนดแผนก/สิทธิ์" : user?.email}
      icon={<UserCog size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? <><Loader2 size={13} className="spin" /> กำลังบันทึก…</> : "บันทึก"}
          </button>
        </>
      }
    >
      {error && <div className="login-alert"><Lock size={13} /><span>{error}</span></div>}
      <div className="grid-2" style={{ gap: 10 }}>
        <label className="field"><span className="label">ชื่อ-นามสกุล</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field"><span className="label">ชื่อเล่น</span><input className="input" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></label>
        <label className="field">
          <span className="label">อีเมลบริษัท</span>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={mode === "edit"} placeholder="name@playdigital.co.th" />
        </label>
        <label className="field">
          <span className="label">สิทธิ์การใช้งาน</span>
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {roleChoices.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">แผนก</span>
          <select className="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, teamId: "" })} disabled={mode === "edit" && lockedDept}>
            <option value="">— ไม่ระบุ —</option>
            {departments.filter((d) => !lockedDept || d.id === scope?.departmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">ทีม</span>
          <select className="select" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
            <option value="">— ไม่มีทีม —</option>
            {deptTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">ตำแหน่ง</span>
          <input className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="เช่น Art Director" />
        </label>
        <label className="field">
          <span className="label">ระดับ</span>
          <select className="select" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            <option value="">—</option>
            {["Intern", "Junior", "Mid", "Senior", "Lead", "Head", "Director", "C-level"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">{mode === "edit" ? "ตั้งรหัสผ่านใหม่ (ว่าง = ไม่เปลี่ยน)" : "รหัสผ่านเริ่มต้น"}</span>
          <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="อย่างน้อย 6 ตัวอักษร" />
        </label>
        <div className="setting-row" style={{ gridColumn: "span 2" }}>
          <div className="s-txt"><b>เปิดใช้งานบัญชี</b><small>ปิด = ระงับการเข้าสู่ระบบ (ยังเก็บประวัติไว้)</small></div>
          <button className={cls("switch", form.active && "on")} onClick={() => setForm({ ...form, active: !form.active })} />
        </div>
      </div>

      <div className="divider" />
      <div className="spread" style={{ marginBottom: 6 }}>
        <b style={{ fontSize: 12 }}><KeyRound size={12} /> สิทธิ์เข้าถึงโมดูล</b>
        <span className="tiny muted">สิทธิ์ตามบทบาท + เพิ่มเฉพาะบุคคล</span>
      </div>
      <div className="module-grid">
        {(Object.keys(MODULE_META) as ModuleKey[]).map((m) => {
          const base = baseModules.includes(m);
          const extra = form.extraModules.includes(m);
          return (
            <button
              key={m}
              className={cls("module-chip", (base || extra) && "on", !base && extra && "extra")}
              onClick={() => {
                if (base) return;
                setForm({
                  ...form,
                  extraModules: extra ? form.extraModules.filter((x) => x !== m) : [...form.extraModules, m],
                });
              }}
              title={base ? "ได้ตามบทบาท" : "เพิ่มสิทธิ์เฉพาะบุคคล"}
            >
              {base || extra ? <Check size={10} /> : <X size={10} />} {MODULE_META[m].label}
              {base && <small>ตามบทบาท</small>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// ── helpers ─────────────────────────────────────────────────
function auditActionLabel(a: AuditEntry["action"]): string {
  const map: Record<AuditEntry["action"], string> = {
    create: "สร้างบัญชี", update: "แก้ไขข้อมูล", delete: "ลบข้อมูล", login: "เข้าสู่ระบบ",
    logout: "ออกจากระบบ", password: "เปลี่ยนรหัสผ่าน", role: "เปลี่ยนสิทธิ์", status: "เปลี่ยนสถานะ",
    department: "ย้ายแผนก", approve: "อนุมัติ", reject: "ปฏิเสธ",
  };
  return map[a] ?? a;
}

function deptName(departments: Department[], id?: string | null) {
  return departments.find((d) => d.id === id)?.name ?? "ไม่ระบุ";
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function MiniKpi({ icon, label, value, tone, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: "violet" | "blue" | "mint" | "amber"; sub?: string }) {
  const color = { violet: "var(--violet)", blue: "#2F7BF0", mint: "#149C74", amber: "#B47600" }[tone];
  const soft = { violet: "rgba(113,0,221,.10)", blue: "rgba(59,167,255,.14)", mint: "rgba(34,199,147,.14)", amber: "rgba(255,176,32,.16)" }[tone];
  return (
    <div className="kpi" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 9 }}>
        <span className="kpi-ico" style={{ background: soft, color, width: 30, height: 30 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div className="kpi-lbl">{label}</div>
          <div className="kpi-val" style={{ fontSize: 16 }}>{value}</div>
          {sub && <div className="tiny muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function NoAccess({ role }: { role: UserRole }) {
  return (
    <div className="card" style={{ padding: 30, textAlign: "center" }}>
      <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
        <div style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", background: "rgba(113,0,221,.10)", color: "var(--violet)" }}>
          <Lock size={20} />
        </div>
        <b style={{ fontSize: 15 }}>หน้านี้สำหรับ Admin / Support / Manager เท่านั้น</b>
        <p className="tiny muted" style={{ maxWidth: 460, lineHeight: 1.7 }}>
          บัญชีของคุณเป็นสิทธิ์ <b>{ROLE_META[role].label}</b> — ใช้งานงาน ปฏิทิน แชท และรายงานของตนเองได้
          หากต้องการเข้าถึงทะเบียนพนักงาน กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <span className="pill"><CalendarClock size={10} /> สิทธิ์ของคุณถูกจำกัดตามนโยบายบริษัท</span>
      </div>
    </div>
  );
}

/** ย่อรูปก่อนอัปโหลด (สูงสุด 512px) */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
