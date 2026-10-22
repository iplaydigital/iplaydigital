"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, Bot, Building2, Cloud, CloudUpload, Database, Download, HardDrive, KeyRound,
  Loader2, Lock, MapPin, Pencil, Plus, RefreshCw, Save, ShieldCheck, Trash2, UserCog, UserPlus, Users,
} from "lucide-react";
import { useApp } from "./providers";
import { Modal } from "./ui";
import { DbDiagnostics } from "./db-status";
import { cls, textOn, thaiDate } from "../lib/utils";
import type { SessionUser, UserRole } from "../lib/types";

type Tab = "org" | "staff" | "reports" | "connect" | "data";

const TABS: { key: Tab; label: string; icon: React.ReactNode; managerOnly?: boolean }[] = [
  { key: "org", label: "องค์กร", icon: <Building2 size={13} /> },
  { key: "staff", label: "พนักงาน & สิทธิ์", icon: <UserCog size={13} /> },
  { key: "reports", label: "รายงาน & Drive", icon: <CloudUpload size={13} /> },
  { key: "connect", label: "การเชื่อมต่อ & AI", icon: <Cloud size={13} /> },
  { key: "data", label: "ข้อมูล & ความปลอดภัย", icon: <Database size={13} /> },
];

const ROLE_LABEL: Record<UserRole, string> = { admin: "Admin", support: "Support", member: "Member" };
const ROLE_TONE: Record<UserRole, { color: string; bg: string }> = {
  admin: { color: "#7100DD", bg: "rgba(113,0,221,.10)" },
  support: { color: "#2F7BF0", bg: "rgba(59,167,255,.14)" },
  member: { color: "#8A8FB1", bg: "rgba(138,143,177,.16)" },
};

export function SettingsView() {
  const { me } = useApp();
  const [tab, setTab] = useState<Tab>("org");
  const manager = me?.role === "admin" || me?.role === "support";

  if (!me) return null;

  if (!manager) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", background: "rgba(113,0,221,.10)", color: "var(--violet)" }}>
              <Lock size={20} />
            </div>
            <b style={{ fontSize: 15 }}>หน้านี้สำหรับ Admin และ Support เท่านั้น</b>
            <p className="tiny muted" style={{ maxWidth: 460, lineHeight: 1.7 }}>
              บัญชีของคุณเป็นสิทธิ์ <b>{ROLE_LABEL[me.role]}</b> — ใช้งานงาน ปฏิทิน แชท และสร้างรายงานของตนเองได้
              หากต้องการสิทธิ์จัดการพนักงานหรือตั้งค่าระบบ กรุณาติดต่อ Admin
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="tabs settings-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={cls(tab === t.key && "on")} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "org" && <OrgTab />}
      {tab === "staff" && <StaffTab me={me} />}
      {tab === "reports" && <ReportsTab />}
      {tab === "connect" && <ConnectTab />}
      {tab === "data" && <DataTab />}
    </div>
  );
}

// ── องค์กร ───────────────────────────────────────────────────
function OrgTab() {
  const { data, act, toast } = useApp();
  const [form, setForm] = useState(() => ({
    brand: data?.settings.brand ?? "",
    branch: data?.settings.branch ?? "",
    announce: data?.settings.announce ?? "",
    workStart: data?.settings.workStart ?? "09:30",
    workEnd: data?.settings.workEnd ?? "18:30",
    officeName: data?.settings.office.name ?? "",
    lat: data?.settings.office.lat ?? 0,
    lng: data?.settings.office.lng ?? 0,
    radius: data?.settings.office.radius ?? 150,
  }));

  if (!data) return null;

  const save = async () => {
    await act({
      type: "settings.update",
      patch: {
        brand: form.brand, branch: form.branch, announce: form.announce,
        workStart: form.workStart, workEnd: form.workEnd,
        office: { name: form.officeName, lat: Number(form.lat), lng: Number(form.lng), radius: Number(form.radius) },
      },
    });
    toast("บันทึกข้อมูลองค์กรแล้ว", "ok");
  };

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><Building2 size={14} /> ข้อมูลองค์กร</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field"><span className="label">ชื่อระบบ</span><input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></label>
            <label className="field"><span className="label">สาขา / สำนักงาน</span><input className="input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></label>
            <label className="field"><span className="label">ข้อความประชาสัมพันธ์ (ขึ้นจอ LED)</span><textarea className="textarea" value={form.announce} onChange={(e) => setForm({ ...form, announce: e.target.value })} /></label>
            <div className="grid-2">
              <label className="field"><span className="label">เริ่มงาน</span><input className="input" type="time" value={form.workStart} onChange={(e) => setForm({ ...form, workStart: e.target.value })} /></label>
              <label className="field"><span className="label">เลิกงาน</span><input className="input" type="time" value={form.workEnd} onChange={(e) => setForm({ ...form, workEnd: e.target.value })} /></label>
            </div>
            <button className="btn btn-primary" onClick={() => void save()}><Save size={13} /> บันทึก</button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><MapPin size={14} /> พิกัดออฟฟิศ (สำหรับเช็คอิน)</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field"><span className="label">ชื่อสถานที่</span><input className="input" value={form.officeName} onChange={(e) => setForm({ ...form, officeName: e.target.value })} /></label>
            <div className="grid-2">
              <label className="field"><span className="label">ละติจูด</span><input className="input" type="number" step="0.00001" value={form.lat} onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })} /></label>
              <label className="field"><span className="label">ลองจิจูด</span><input className="input" type="number" step="0.00001" value={form.lng} onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })} /></label>
            </div>
            <label className="field"><span className="label">รัศมีที่อนุญาต (เมตร)</span><input className="input" type="number" value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })} /></label>
            <div className="map-card">
              <iframe title="office" src={`https://maps.google.com/maps?q=${form.lat},${form.lng}&z=16&output=embed`} loading="lazy" />
            </div>
            <a className="link-btn" href={`https://maps.google.com/?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer">เปิดใน Google Maps</a>
          </div>
        </div>
      </div>
    </>
  );
}

// ── พนักงาน & สิทธิ์ ─────────────────────────────────────────
function StaffTab({ me }: { me: SessionUser }) {
  const { data, toast } = useApp();
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [editing, setEditing] = useState<SessionUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", nickname: "", position: "", role: "member" as UserRole, password: "", active: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { users?: SessionUser[]; error?: string };
      if (!res.ok) throw new Error(body.error || "โหลดรายชื่อไม่สำเร็จ");
      setUsers(body.users ?? []);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", nickname: "", position: "", role: "member", password: "", active: true });
    setCreating(true);
  };

  const openEdit = (u: SessionUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, nickname: u.nickname, position: u.position ?? "", role: u.role, password: "", active: u.active });
    setCreating(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name, nickname: form.nickname, position: form.position, role: form.role, active: form.active,
      };
      if (form.password) payload.password = form.password;
      if (!editing) { payload.email = form.email; payload.password = form.password || undefined; }
      const res = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; initialPassword?: string };
      if (!res.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast(editing ? "อัปเดตข้อมูลพนักงานแล้ว" : `เพิ่มพนักงานแล้ว · รหัสผ่านเริ่มต้น ${body.initialPassword ?? "iplay@2026"}`, "ok");
      setCreating(false);
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: SessionUser) => {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast(body.error || "อัปเดตไม่สำเร็จ", "err");
    toast(u.active ? `ระงับการใช้งาน ${u.name} แล้ว` : `เปิดใช้งาน ${u.name} แล้ว`, "info");
    await load();
  };

  const remove = async (u: SessionUser) => {
    if (!window.confirm(`ลบบัญชี ${u.name} (${u.email}) ?`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast(body.error || "ลบไม่สำเร็จ", "err");
    toast("ลบพนักงานแล้ว", "info");
    await load();
  };

  const shown = users.filter((u) => {
    const okRole = roleFilter === "all" || u.role === roleFilter;
    const okQ = !q || `${u.name} ${u.email} ${u.nickname} ${u.position ?? ""}`.toLowerCase().includes(q.toLowerCase());
    return okRole && okQ;
  });

  const stats = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    support: users.filter((u) => u.role === "support").length,
    active: users.filter((u) => u.active).length,
    oauth: users.filter((u) => u.provider !== "password").length,
  };

  const workload = (u: SessionUser) => {
    if (!data) return { tasks: 0, open: 0, leave: 0 };
    const memberId = u.memberId || data.members.find((m) => m.email.toLowerCase() === u.email.toLowerCase())?.id;
    const tasks = data.tasks.filter((t) => t.assigneeId === memberId);
    return {
      tasks: tasks.length,
      open: tasks.filter((t) => t.status !== "done").length,
      leave: data.leaves.filter((l) => l.userId === memberId && l.status === "pending").length,
    };
  };

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 4 }}>
        <MiniKpi icon={<Users size={14} />} label="พนักงานทั้งหมด" value={stats.total} tone="violet" />
        <MiniKpi icon={<ShieldCheck size={14} />} label="Admin / Support" value={`${stats.admin} / ${stats.support}`} tone="blue" />
        <MiniKpi icon={<BadgeCheck size={14} />} label="เปิดใช้งาน" value={stats.active} tone="mint" />
        <MiniKpi icon={<KeyRound size={14} />} label="เข้าสู่ระบบด้วย Google/LINE" value={stats.oauth} tone="amber" />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><UserCog size={14} /> พนักงาน & สิทธิ์การใช้งาน</div>
          <div className="row" style={{ gap: 6 }}>
            <div className="searchbox" style={{ width: 200 }}>
              <Users size={13} />
              <input placeholder="ค้นหาชื่อ / อีเมล…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="seg">
              {(["all", "admin", "support", "member"] as const).map((r) => (
                <button key={r} className={roleFilter === r ? "on" : ""} onClick={() => setRoleFilter(r)}>
                  {r === "all" ? "ทั้งหมด" : ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNew}><UserPlus size={13} /> เพิ่มพนักงาน</button>
          </div>
        </div>
        <div className="card-body">
          {loading && <div className="row muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> กำลังโหลด…</div>}
          <table className="kanban-table">
            <thead>
              <tr>
                <th>พนักงาน</th><th>ตำแหน่ง</th><th>สิทธิ์</th><th>วิธีเข้าใช้</th>
                <th>งาน (ค้าง)</th><th>ล่าสุด</th><th>สถานะ</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const w = workload(u);
                const canTouch = me.role === "admin" || u.role !== "admin";
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="avatar" style={{ background: u.color, color: textOn(u.color), width: 26, height: 26, fontSize: 10 }}>{u.initials}</span>
                        <div>
                          <b style={{ fontSize: 12 }}>{u.name} {u.id === me.id && <span className="tiny muted">(คุณ)</span>}</b>
                          <div className="tiny muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.position || "—"}</td>
                    <td>
                      <span className="pill" style={{ background: ROLE_TONE[u.role].bg, color: ROLE_TONE[u.role].color }}>
                        {u.role === "admin" && <ShieldCheck size={9} />} {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="tiny muted">{u.provider === "password" ? "อีเมล/รหัสผ่าน" : u.provider === "google" ? "Google" : "LINE"}</td>
                    <td>{w.tasks} <span className="tiny muted">({w.open})</span></td>
                    <td className="tiny muted">{u.lastLoginAt ? thaiDate(u.lastLoginAt.slice(0, 10), { short: true }) : "ยังไม่เคยเข้า"}</td>
                    <td>
                      <span className={cls("pill", u.active ? "" : "off")} style={{ background: u.active ? "rgba(34,199,147,.14)" : "rgba(255,92,122,.12)", color: u.active ? "#149C74" : "#C9304F" }}>
                        {u.active ? "ใช้งาน" : "ระงับ"}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(u)} disabled={!canTouch} title="แก้ไข"><Pencil size={12} /></button>
                        <button className="btn btn-sm" onClick={() => void toggleActive(u)} disabled={!canTouch || u.id === me.id} title={u.active ? "ระงับ" : "เปิดใช้"}>
                          {u.active ? <Lock size={12} /> : <BadgeCheck size={12} />}
                        </button>
                        <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => void remove(u)} disabled={!canTouch || u.id === me.id} title="ลบ"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && shown.length === 0 && <div className="empty"><Users size={24} /><p>ไม่พบพนักงานตามเงื่อนไข</p></div>}

          <div className="side-card" style={{ marginTop: 12, fontSize: 11 }}>
            <b><ShieldCheck size={12} /> กติกาสิทธิ์</b>
            <div>Admin — ตั้งค่าได้ทุกส่วน ตั้ง/ถอดสิทธิ์ Admin และลบพนักงานได้</div>
            <div>Support — จัดการพนักงานทั่วไปและแก้รายงานได้ แต่แตะบัญชี Admin ไม่ได้</div>
            <div>Member — ใช้งานงาน/ปฏิทิน/แชท และสร้างรายงานของตนเอง</div>
          </div>
        </div>
      </div>

      {creating && (
        <Modal
          title={editing ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
          subtitle={editing ? editing.email : "ระบบจะสร้างรหัสผ่านเริ่มต้นให้"}
          icon={<UserCog size={16} />}
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                {busy ? <><Loader2 size={13} className="spin" /> กำลังบันทึก…</> : "บันทึก"}
              </button>
            </>
          }
        >
          <div className="grid-2" style={{ gap: 10 }}>
            <label className="field"><span className="label">ชื่อ-นามสกุล</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span className="label">ชื่อเล่น</span><input className="input" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></label>
            <label className="field"><span className="label">อีเมลบริษัท</span><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} /></label>
            <label className="field"><span className="label">ตำแหน่ง</span><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
            <label className="field">
              <span className="label">สิทธิ์</span>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                <option value="member">Member</option>
                <option value="support">Support</option>
                {me.role === "admin" && <option value="admin">Admin</option>}
              </select>
            </label>
            <label className="field">
              <span className="label">{editing ? "ตั้งรหัสผ่านใหม่ (ว่าง = ไม่เปลี่ยน)" : "รหัสผ่านเริ่มต้น"}</span>
              <input className="input" type="text" placeholder="อย่างน้อย 6 ตัวอักษร" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <div className="setting-row" style={{ gridColumn: "span 2" }}>
              <div className="s-txt"><b>เปิดใช้งานบัญชี</b><small>ปิดเพื่อระงับการเข้าสู่ระบบ (ไม่ลบข้อมูล)</small></div>
              <button className={cls("switch", form.active && "on")} onClick={() => setForm({ ...form, active: !form.active })} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── รายงาน & Drive ──────────────────────────────────────────
function ReportsTab() {
  const { data, act, toast } = useApp();
  const [drive, setDrive] = useState<{ mode: string; configured: boolean; hint: string; folderId: string | null; folderUrl: string } | null>(null);
  const [folder, setFolder] = useState(data?.settings.driveFolder ?? "");

  useEffect(() => {
    void fetch("/api/drive/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { drive?: typeof drive }) => setDrive(b.drive ?? null))
      .catch(() => setDrive(null));
  }, []);

  const save = async () => {
    await act({ type: "settings.update", patch: { driveFolder: folder } });
    toast("บันทึกโฟลเดอร์ Drive แล้ว", "ok");
  };

  return (
    <>
      <div className="card">
        <div className="card-head"><div className="card-title"><CloudUpload size={14} /> การเชื่อมต่อ Google Drive</div></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="setting-row">
            <div className="s-txt">
              <b>สถานะการเชื่อมต่อ</b>
              <small>{drive?.hint ?? "กำลังตรวจสอบ…"}</small>
            </div>
            <span className="pill" style={{ background: drive?.configured ? "rgba(34,199,147,.14)" : "rgba(255,176,32,.16)", color: drive?.configured ? "#149C74" : "#B47600" }}>
              {drive?.configured ? "เชื่อมต่อแล้ว" : "โหมดลิงก์"}
            </span>
          </div>
          <label className="field">
            <span className="label">โฟลเดอร์กลางของทีม (แสดงในแชท & รายงาน)</span>
            <input className="input" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => void save()}><Save size={12} /> บันทึก</button>
            {drive?.folderUrl && <a className="btn btn-sm" href={drive.folderUrl} target="_blank" rel="noreferrer">เปิดโฟลเดอร์</a>}
          </div>
          <div className="side-card" style={{ fontSize: 11 }}>
            <b><Cloud size={12} /> วิธีเปิดอัปโหลดจริง (OAuth)</b>
            <div>1. สร้าง OAuth Client (Web) ใน Google Cloud Console แล้วเปิด Drive API</div>
            <div>2. ขอ refresh token ด้วย scope <code>https://www.googleapis.com/auth/drive.file</code></div>
            <div>3. ใส่ <code>GOOGLE_DRIVE_CLIENT_ID</code>, <code>GOOGLE_DRIVE_CLIENT_SECRET</code>, <code>GOOGLE_DRIVE_REFRESH_TOKEN</code>, <code>GOOGLE_DRIVE_FOLDER_ID</code> ใน <code>.env</code> แล้ว restart</div>
            <div className="muted">ถ้าไม่ตั้ง ระบบยังใช้งานได้ — แนบเป็นลิงก์ไฟล์ Drive แทน</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title"><CloudUpload size={14} /> รายงานล่าสุด</div></div>
        <div className="card-body">
          <table className="kanban-table">
            <thead><tr><th>รหัส</th><th>ชื่อรายงาน</th><th>งวด</th><th>สถานะ</th><th>ไฟล์แนบ</th><th>อัปเดต</th></tr></thead>
            <tbody>
              {(data?.reports ?? []).slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td className="mono tiny">{r.code}</td>
                  <td>{r.title}</td>
                  <td className="mono tiny">{r.period}</td>
                  <td className="tiny">{r.status === "approved" ? "อนุมัติแล้ว" : r.status === "submitted" ? "ส่งแล้ว" : "ฉบับร่าง"}</td>
                  <td className="tiny muted">{r.attachments.length} ไฟล์</td>
                  <td className="tiny muted">{thaiDate(r.updatedAt.slice(0, 10), { short: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny muted" style={{ marginTop: 8 }}>จัดการ/อนุมัติรายงานได้ที่เมนู “รายงาน & Drive”</div>
        </div>
      </div>
    </>
  );
}

// ── การเชื่อมต่อ & AI ───────────────────────────────────────
function ConnectTab() {
  const { data, act, toast } = useApp();
  const [form, setForm] = useState({
    ledUrl: data?.settings.ledUrl ?? "",
    aiEnabled: data?.settings.aiEnabled ?? true,
  });

  if (!data) return null;

  const save = async () => {
    await act({ type: "settings.update", patch: { ledUrl: form.ledUrl, aiEnabled: form.aiEnabled } });
    toast("บันทึกการเชื่อมต่อแล้ว", "ok");
  };

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><Cloud size={14} /> จอ LED & ภายนอก</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field"><span className="label">จอ LED (Playwall Park Silom)</span><input className="input" value={form.ledUrl} onChange={(e) => setForm({ ...form, ledUrl: e.target.value })} /></label>
            <div className="setting-row">
              <div className="s-txt"><b>เปิดใช้งาน AI Workforce</b><small>อนุญาตให้ AI agent รับงานและรันอัตโนมัติ</small></div>
              <button className={cls("switch", form.aiEnabled && "on")} onClick={() => setForm({ ...form, aiEnabled: !form.aiEnabled })} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => void save()}><Save size={12} /> บันทึก</button>
            <div className="side-card" style={{ fontSize: 11 }}>
              <b>MCP / AI Gateway</b>
              <div>ตั้ง <code>GOOGLE_MCP_URL</code> เพื่อเชื่อม Google Drive ผ่าน MCP server</div>
              <div>ตั้ง <code>AI_GATEWAY_URL</code> + <code>AI_GATEWAY_KEY</code> เพื่อใช้ LLM จริง (ไม่ตั้ง = ใช้ context engine ในตัว)</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><Bot size={14} /> AI agents</div><div className="right tiny muted">{data.members.filter((m) => m.kind === "ai").length} เอเจนต์</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.members.filter((m) => m.kind === "ai").map((a) => (
              <div key={a.id} className="room-card" style={{ padding: 10 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="avatar ai" style={{ background: a.color, color: textOn(a.color), borderRadius: 10 }}>{a.initials}</span>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 12 }}>{a.name}</b>
                    <div className="tiny muted">{a.role} · {a.model}</div>
                  </div>
                  <button className={cls("switch", !a.paused && "on")} onClick={() => void act({ type: "agent.toggle", id: a.id, paused: !a.paused })} title={a.paused ? "ปลุก" : "พัก"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── ข้อมูล & ความปลอดภัย ────────────────────────────────────
function DataTab() {
  const { me, data, act, toast, refresh } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!data || !me) return null;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iplay-workspace-${data.today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("ดาวน์โหลดข้อมูลทั้งระบบแล้ว", "ok");
  };

  const exportCsv = () => {
    const head = "code,title,project,assignee,status,priority,due,estimate,progress\n";
    const rows = data.tasks.map((t) => {
      const p = data.projects.find((x) => x.id === t.projectId);
      const u = data.members.find((m) => m.id === t.assigneeId);
      return [t.code, `"${t.title.replace(/"/g, "''")}"`, p?.name, u?.name, t.status, t.priority, t.due, t.estimate, t.progress].join(",");
    });
    const blob = new Blob(["\uFEFF" + head + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iplay-tasks-${data.today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("ส่งออกงานเป็น CSV แล้ว", "ok");
  };

  return (
    <>
      <DbDiagnostics />

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><Database size={14} /> ข้อมูล</div></div>
          <div className="card-body">
            <div className="setting-row">
              <div className="s-txt"><b>ฐานข้อมูล</b><small>{data.storage === "mariadb" ? "MariaDB — บันทึกทุก mutation ลงตาราง ws_*" : "Demo store (ไฟล์ .data/store.json) — ตั้ง DB_* เพื่อใช้ MariaDB"}</small></div>
              <span className="pill" style={{ background: data.storage === "mariadb" ? "rgba(34,199,147,.14)" : "rgba(255,176,32,.14)", color: data.storage === "mariadb" ? "#149C74" : "#B47600" }}>
                <HardDrive size={9} /> {data.storage}
              </span>
            </div>
            <div className="setting-row">
              <div className="s-txt"><b>จำนวนข้อมูล</b><small>{data.tasks.length} งาน · {data.events.length} อีเวนต์ · {data.messages.length} ข้อความ · {data.reports.length} รายงาน</small></div>
              <span className="tiny muted">{thaiDate(data.today, { short: true })}</span>
            </div>
            <div className="setting-row">
              <div className="s-txt"><b>ส่งออกข้อมูล</b><small>สำรองงาน + ระบบทั้งหมดเป็น JSON หรือ CSV</small></div>
              <div className="row">
                <button className="btn btn-sm" onClick={exportJson}><Download size={12} /> JSON</button>
                <button className="btn btn-sm" onClick={exportCsv}><Download size={12} /> CSV</button>
              </div>
            </div>
            <div className="setting-row">
              <div className="s-txt"><b>รีเฟรชข้อมูล</b><small>ดึงสถานะล่าสุดจากเซิร์ฟเวอร์</small></div>
              <button className="btn btn-sm" onClick={() => void refresh()}><RefreshCw size={12} /> รีเฟรช</button>
            </div>
            {me.role === "admin" && (
              <div className="setting-row">
                <div className="s-txt"><b>รีเซ็ตข้อมูลตัวอย่าง</b><small>ล้างงาน/แชท/AI run กลับเป็นชุดเริ่มต้น (Admin เท่านั้น)</small></div>
                <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => setConfirmReset(true)}><Trash2 size={12} /> รีเซ็ต</button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><ShieldCheck size={14} /> ความปลอดภัย & การเข้าใช้</div></div>
          <div className="card-body">
            <div className="setting-row">
              <div className="s-txt"><b>เซสชันของคุณ</b><small>ลงชื่อเข้าใช้ด้วย {me.provider === "password" ? "อีเมล/รหัสผ่าน" : me.provider === "google" ? "Google" : "LINE"} · สิทธิ์ {ROLE_LABEL[me.role]}</small></div>
              <span className="pill" style={{ background: "rgba(34,199,147,.14)", color: "#149C74" }}>{me.email}</span>
            </div>
            <div className="setting-row">
              <div className="s-txt"><b>โดเมนที่อนุญาต</b><small>{me.email.split("@")[1]} · ตั้งค่าเพิ่มได้ที่ ALLOWED_EMAIL_DOMAIN</small></div>
              <button className="btn btn-sm" onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/login"))}>ออกจากระบบ</button>
            </div>
            <div className="side-card" style={{ fontSize: 11 }}>
              <b><KeyRound size={12} /> คำแนะนำ</b>
              <div>• ตั้ง <code>AUTH_SECRET</code> เป็นค่าสุ่มยาว ≥ 32 ตัวอักษร</div>
              <div>• เปลี่ยนรหัสผ่านเริ่มต้นของทุกบัญชีทันทีหลังติดตั้ง</div>
              <div>• เปิด <code>Secure</code> cookie อัตโนมัติเมื่อรันบน HTTPS (production)</div>
              <div>• ตรวจ log การเข้าใช้ได้ที่ <code>ws_users.last_login_at</code></div>
            </div>
          </div>
        </div>
      </div>

      {confirmReset && (
        <Modal
          title="รีเซ็ตข้อมูลตัวอย่าง?"
          subtitle="การกระทำนี้ย้อนกลับไม่ได้"
          icon={<Trash2 size={16} />}
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>ยกเลิก</button>
              <button className="btn btn-primary" style={{ background: "var(--red)" }} onClick={async () => { await act({ type: "reset" }); setConfirmReset(false); toast("รีเซ็ตข้อมูลแล้ว", "info"); }}>
                ยืนยันรีเซ็ต
              </button>
            </>
          }
        >
          <p style={{ fontSize: 12.5, lineHeight: 1.6 }}>ระบบจะล้างงาน อีเวนต์ แชท ไฟล์ การลา และ AI run ทั้งหมด แล้วสร้างข้อมูลตัวอย่างชุดใหม่ (seed) ให้อัตโนมัติ</p>
        </Modal>
      )}
    </>
  );
}

function MiniKpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: "violet" | "blue" | "mint" | "amber" }) {
  const map = { violet: "var(--violet)", blue: "#2F7BF0", mint: "#149C74", amber: "#B47600" } as const;
  const soft = { violet: "rgba(113,0,221,.10)", blue: "rgba(59,167,255,.14)", mint: "rgba(34,199,147,.14)", amber: "rgba(255,176,32,.16)" } as const;
  return (
    <div className="kpi" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="kpi-ico" style={{ background: soft[tone], color: map[tone], width: 28, height: 28 }}>{icon}</span>
        <div>
          <div className="kpi-lbl">{label}</div>
          <div className="kpi-val" style={{ fontSize: 16 }}>{value}</div>
        </div>
      </div>
    </div>
  );
}
