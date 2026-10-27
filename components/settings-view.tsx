"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, Bot, Building2, Check, Cloud, CloudUpload, Copy, Database, Download, ExternalLink,
  HardDrive, KeyRound, Loader2, Lock, MapPin, Pencil, Plus, RefreshCw, Save, ShieldCheck, Trash2,
  UserCog, UserPlus, Users, Zap,
} from "lucide-react";
import { useApp } from "./providers";
import { Modal } from "./ui";
import { DbDiagnostics } from "./db-status";
import { cls, textOn, thaiDate } from "../lib/utils";
import { canAccess } from "../lib/rbac";
import type { SessionUser, UserRole } from "../lib/types";

type Tab = "org" | "reports" | "login" | "connect" | "data";

const TABS: { key: Tab; label: string; icon: React.ReactNode; superOnly?: boolean }[] = [
  { key: "org", label: "องค์กร", icon: <Building2 size={13} /> },
  { key: "reports", label: "รายงาน & Drive", icon: <CloudUpload size={13} /> },
  { key: "login", label: "Login & เชื่อมต่อ", icon: <KeyRound size={13} />, superOnly: true },
  { key: "connect", label: "การเชื่อมต่อ & AI", icon: <Cloud size={13} /> },
  { key: "data", label: "ข้อมูล & ความปลอดภัย", icon: <Database size={13} /> },
];

const ROLE_LABEL: Record<UserRole, string> = { admin: "Admin", support: "Support", manager: "Manager", ai: "AI", member: "User" };
const ROLE_TONE: Record<UserRole, { color: string; bg: string }> = {
  admin: { color: "#7100DD", bg: "rgba(113,0,221,.10)" },
  support: { color: "#2F7BF0", bg: "rgba(59,167,255,.14)" },
  manager: { color: "#149C74", bg: "rgba(34,199,147,.14)" },
  ai: { color: "#D6337A", bg: "rgba(255,107,157,.16)" },
  member: { color: "#8A8FB1", bg: "rgba(138,143,177,.16)" },
};

export function SettingsView() {
  const { me } = useApp();
  const [tab, setTab] = useState<Tab>("org");
  const allowed = me ? canAccess(me.role, "settings") : false;

  if (!me) return null;

  if (!allowed) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", background: "rgba(113,0,221,.10)", color: "var(--violet)" }}>
              <Lock size={20} />
            </div>
            <b style={{ fontSize: 15 }}>หน้านี้สำหรับทีมบริหาร / IT Support เท่านั้น</b>
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
        {TABS.filter((t) => !t.superOnly || me.isSuper).map((t) => (
          <button key={t.key} className={cls(tab === t.key && "on")} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
            {t.superOnly && <span className="super-tag">SUPER</span>}
          </button>
        ))}
      </div>

      {tab === "org" && <OrgTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "login" && me.isSuper && <LoginTab />}
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

// ── Login & เชื่อมต่อ (Super Admin เท่านั้น) ─────────────────
interface OAuthInfo {
  google: { clientId: string; secretSet: boolean; configured: boolean; source: "ui" | "env" | "none" };
  line: { clientId: string; secretSet: boolean; configured: boolean; source: "ui" | "env" | "none" };
  lineOa: { tokenSet: boolean; secretSet: boolean; configured: boolean; botId: string; webhookUrl: string };
  webhook: string;
  publicUrl: string;
  redirects: { google: string; line: string };
  allowlist: string;
  superAdmins: string[];
}

function LoginTab() {
  const { toast } = useApp();
  const [info, setInfo] = useState<OAuthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    googleId: "",
    googleSecret: "",
    lineId: "",
    lineSecret: "",
    lineOaToken: "",
    lineOaSecret: "",
    lineBotId: "",
    publicUrl: "",
  });
  const [showSecret, setShowSecret] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/oauth", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as OAuthInfo & { error?: string };
      if (!res.ok) throw new Error(body.error || "โหลดการตั้งค่าไม่สำเร็จ");
      setInfo(body);
      setForm({
        googleId: body.google.clientId ?? "",
        googleSecret: "",
        lineId: body.line.clientId ?? "",
        lineSecret: "",
        lineOaToken: "",
        lineOaSecret: "",
        lineBotId: body.lineOa?.botId ?? "",
        publicUrl: body.publicUrl ?? "",
      });
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        googleId: form.googleId,
        lineId: form.lineId,
        lineBotId: form.lineBotId,
        publicUrl: form.publicUrl,
      };
      // ส่ง secret เฉพาะเมื่อพิมพ์ใหม่ (ช่องว่าง = คงค่าเดิม)
      if (form.googleSecret) payload.googleSecret = form.googleSecret;
      if (form.lineSecret) payload.lineSecret = form.lineSecret;
      if (form.lineOaToken) payload.lineOaToken = form.lineOaToken;
      if (form.lineOaSecret) payload.lineOaSecret = form.lineOaSecret;

      const res = await fetch("/api/settings/oauth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as OAuthInfo & { error?: string };
      if (!res.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      setInfo(body);
      setForm((f) => ({ ...f, googleSecret: "", lineSecret: "", lineOaToken: "", lineOaSecret: "" }));
      toast("บันทึกการเชื่อมต่อ Login แล้ว — ใช้งานได้ทันที", "ok");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const clearSecret = async (which: "google" | "line" | "lineOa" | "lineOaSecret") => {
    const name = which === "google" ? "Google Client Secret" : which === "line" ? "LINE Login Secret" : which === "lineOa" ? "LINE OA Access Token" : "LINE OA Channel Secret";
    if (!window.confirm(`ล้าง ${name}?`)) return;
    try {
      const payload =
        which === "google"
          ? { googleSecret: "" }
          : which === "line"
            ? { lineSecret: "" }
            : which === "lineOa"
              ? { lineOaToken: "" }
              : { lineOaSecret: "" };
      const res = await fetch("/api/settings/oauth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as OAuthInfo & { error?: string };
      if (!res.ok) throw new Error(body.error || "ล้างค่าไม่สำเร็จ");
      setInfo(body);
      toast("ล้างค่าแล้ว (ระบบจะใช้ค่าจาก .env ถ้ามี)", "info");
    } catch (err) {
      toast((err as Error).message, "err");
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`คัดลอก ${label} แล้ว`, "ok");
    } catch {
      toast("คัดลอกไม่สำเร็จ — เลือกข้อความแล้วกด Ctrl+C", "err");
    }
  };

  const sourceLabel = (s: "ui" | "env" | "none") => (s === "ui" ? "ตั้งในหน้านี้" : s === "env" ? "จาก .env" : "ยังไม่ตั้งค่า");

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="card-title">
            <KeyRound size={14} /> เชื่อมต่อ Google Workspace / Gmail และ LINE Login
            <span className="super-tag">SUPER ADMIN</span>
          </div>
          <button className="btn btn-sm" onClick={() => void load()}><RefreshCw size={11} /> รีเฟรช</button>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="side-card" style={{ fontSize: 11 }}>
            <b><ShieldCheck size={12} /> ค่าที่บันทึกในหน้านี้จะถูกใช้ทันที</b>
            <div>ไม่ต้องแก้ไฟล์ .env หรือ restart เซิร์ฟเวอร์ · ค่าที่ตั้งในหน้านี้จะชนะค่าใน .env</div>
            <div>Secret ถูกเก็บแบบไม่แสดงผล (แสดงเฉพาะว่าตั้งค่าแล้ว) และทุกการแก้ไขถูกบันทึกในประวัติ</div>
          </div>

          {loading && <div className="row muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> กำลังโหลดการตั้งค่า…</div>}

          {!loading && info && (
            <>
              <div className="login-state-grid">
                <div className={cls("login-state", info.google.configured && "on")}>
                  <div className="ls-head">
                    <b>Google / Gmail</b>
                    <span className={cls("pill", info.google.configured ? "ok" : "warn")}>
                      {info.google.configured ? <><Check size={9} /> พร้อมใช้งาน</> : "ยังไม่พร้อม"}
                    </span>
                  </div>
                  <div className="tiny muted">Client ID: {info.google.clientId || "—"}</div>
                  <div className="tiny muted">Secret: {info.google.secretSet ? "ตั้งค่าแล้ว" : "ยังไม่มี"} · {sourceLabel(info.google.source)}</div>
                </div>
                <div className={cls("login-state", info.line.configured && "on")}>
                  <div className="ls-head">
                    <b>LINE Login</b>
                    <span className={cls("pill", info.line.configured ? "ok" : "warn")}>
                      {info.line.configured ? <><Check size={9} /> พร้อมใช้งาน</> : "ยังไม่พร้อม"}
                    </span>
                  </div>
                  <div className="tiny muted">Channel ID: {info.line.clientId || "—"}</div>
                  <div className="tiny muted">Channel Secret: {info.line.secretSet ? "ตั้งค่าแล้ว" : "ยังไม่มี"} · {sourceLabel(info.line.source)}</div>
                </div>
                <div className={cls("login-state", info.lineOa?.configured && "on")}>
                  <div className="ls-head">
                    <b>LINE OA (Messaging API)</b>
                    <span className={cls("pill", info.lineOa?.configured ? "ok" : "warn")}>
                      {info.lineOa?.configured ? <><Check size={9} /> พร้อมรับ–ส่ง</> : "ยังไม่พร้อม"}
                    </span>
                  </div>
                  <div className="tiny muted">Access Token: {info.lineOa?.tokenSet ? "ตั้งค่าแล้ว" : "ยังไม่มี"}</div>
                  <div className="tiny muted">Channel Secret: {info.lineOa?.secretSet ? "ตั้งค่าแล้ว" : "ยังไม่มี"}</div>
                  <div className="tiny muted">Webhook: <code>{info.lineOa?.webhookUrl || info.webhook}</code></div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 10 }}>
                <label className="field">
                  <span className="label">Google Client ID</span>
                  <input className="input" value={form.googleId} onChange={(e) => setForm({ ...form, googleId: e.target.value })} placeholder="xxxxx.apps.googleusercontent.com" />
                </label>
                <label className="field">
                  <span className="label">Google Client Secret</span>
                  <input className="input" type={showSecret ? "text" : "password"} value={form.googleSecret} onChange={(e) => setForm({ ...form, googleSecret: e.target.value })} placeholder={info.google.secretSet ? "•••••••• (เว้นว่าง = คงค่าเดิม)" : "GOCSPX-…"} />
                </label>
                <label className="field">
                  <span className="label">LINE Channel ID</span>
                  <input className="input" value={form.lineId} onChange={(e) => setForm({ ...form, lineId: e.target.value })} placeholder="2006xxxxxx" />
                </label>
                <label className="field">
                  <span className="label">LINE Channel Secret</span>
                  <input className="input" type={showSecret ? "text" : "password"} value={form.lineSecret} onChange={(e) => setForm({ ...form, lineSecret: e.target.value })} placeholder={info.line.secretSet ? "•••••••• (เว้นว่าง = คงค่าเดิม)" : "channel secret"} />
                </label>
                <label className="field">
                  <span className="label">LINE OA — Channel Access Token</span>
                  <input className="input" type={showSecret ? "text" : "password"} value={form.lineOaToken} onChange={(e) => setForm({ ...form, lineOaToken: e.target.value })} placeholder={info.lineOa.tokenSet ? "•••••••• (เว้นว่าง = คงค่าเดิม)" : "long-lived channel access token"} />
                </label>
                <label className="field">
                  <span className="label">LINE OA — Channel Secret (ตรวจ signature)</span>
                  <input className="input" type={showSecret ? "text" : "password"} value={form.lineOaSecret} onChange={(e) => setForm({ ...form, lineOaSecret: e.target.value })} placeholder={info.lineOa.secretSet ? "•••••••• (เว้นว่าง = คงค่าเดิม)" : "Messaging API channel secret"} />
                </label>
                <label className="field">
                  <span className="label">LINE OA — Basic ID (ถ้ามี)</span>
                  <input className="input" value={form.lineBotId} onChange={(e) => setForm({ ...form, lineBotId: e.target.value })} placeholder="@your-oa" />
                </label>
                <label className="field" style={{ gridColumn: "span 2" }}>
                  <span className="label">URL สาธารณะของระบบ (ใช้สร้าง redirect URI)</span>
                  <input className="input" value={form.publicUrl} onChange={(e) => setForm({ ...form, publicUrl: e.target.value })} placeholder="https://workspace.playdigital.co.th" />
                </label>
              </div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
                  {saving ? <><Loader2 size={12} className="spin" /> กำลังบันทึก…</> : <><Save size={12} /> บันทึกการเชื่อมต่อ</>}
                </button>
                <button className="btn btn-sm" onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? "ซ่อน" : "แสดง"}ช่อง secret
                </button>
                <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => void clearSecret("google")}>ล้าง Google Secret</button>
                <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => void clearSecret("line")}>ล้าง LINE Secret</button>
                <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => void clearSecret("lineOa")}>ล้าง LINE OA Token</button>
                <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => void clearSecret("lineOaSecret")}>ล้าง OA Secret</button>
              </div>

              <div className="divider" />

              <b style={{ fontSize: 12 }}><ExternalLink size={12} /> Redirect URI ที่ต้องนำไปใส่ในผู้ให้บริการ</b>
              <div className="redirect-row">
                <span className="tiny muted" style={{ width: 64 }}>Google</span>
                <code className="code-chip" style={{ flex: 1, overflow: "auto" }}>{info.redirects.google}</code>
                <button className="btn btn-sm" onClick={() => void copy(info.redirects.google, "Google redirect URI")}><Copy size={11} /> คัดลอก</button>
              </div>
              <div className="redirect-row">
                <span className="tiny muted" style={{ width: 64 }}>LINE</span>
                <code className="code-chip" style={{ flex: 1, overflow: "auto" }}>{info.redirects.line}</code>
                <button className="btn btn-sm" onClick={() => void copy(info.redirects.line, "LINE redirect URI")}><Copy size={11} /> คัดลอก</button>
              </div>
              <div className="redirect-row">
                <span className="tiny muted" style={{ width: 64 }}>Webhook</span>
                <code className="code-chip" style={{ flex: 1, overflow: "auto" }}>{info.webhook}</code>
                <button className="btn btn-sm" onClick={() => void copy(info.webhook, "LINE webhook URL")}><Copy size={11} /> คัดลอก</button>
              </div>

              <div className="grid-2" style={{ gap: 10 }}>
                <div className="side-card" style={{ fontSize: 11 }}>
                  <b><Zap size={12} /> ขั้นตอน Google (5 นาที)</b>
                  <div>1. Google Cloud Console → APIs & Services → Credentials</div>
                  <div>2. Create credentials → OAuth client ID → Web application</div>
                  <div>3. ใส่ Authorized redirect URI ตามด้านบน (ทั้ง dev และ production)</div>
                  <div>4. OAuth consent screen → เพิ่ม scope <code>email</code>, <code>profile</code>, <code>openid</code></div>
                  <div>5. คัดลอก Client ID / Secret มาวางในหน้านี้ แล้วกดบันทึก</div>
                  <a className="link-btn" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">เปิด Google Cloud Console</a>
                </div>
                <div className="side-card" style={{ fontSize: 11 }}>
                  <b><Zap size={12} /> ขั้นตอน LINE (5 นาที)</b>
                  <div>1. LINE Developers Console → สร้าง Provider → สร้าง Channel ชนิด <b>LINE Login</b></div>
                  <div>2. เปิด scopes: <code>profile</code>, <code>openid</code>, <code>email</code></div>
                  <div>3. ใส่ Callback URL ตามด้านบน (ต้องตรงทุกตัวอักษร)</div>
                  <div>4. คัดลอก Channel ID / Channel Secret มาวางในหน้านี้</div>
                  <div>5. ยื่นขอสิทธิ์ Email address (ถ้าต้องการอีเมลจริงจาก LINE)</div>
                  <a className="link-btn" href="https://developers.line.biz/console/" target="_blank" rel="noreferrer">เปิด LINE Developers</a>
                </div>
                <div className="side-card" style={{ fontSize: 11 }}>
                  <b><Zap size={12} /> LINE OA (รับ–ส่งข้อความในแชท)</b>
                  <div>1. LINE Developers → สร้าง Channel ชนิด <b>Messaging API</b> (หรือเปิดใช้ใน OA เดิม)</div>
                  <div>2. Channel access token → ออก long-lived token แล้ววางในช่องด้านบน</div>
                  <div>3. Channel secret → ใช้อันเดียวกับที่ใช้ตรวจ signature ของ webhook</div>
                  <div>4. Webhook URL → วาง URL ด้านบน แล้วกด <b>Verify</b></div>
                  <div>5. เปิด <b>Use webhook</b> + ปิด “ตอบกลับอัตโนมัติ” ถ้าต้องการให้ระบบตอบแทน</div>
                  <div>6. เชิญ OA เข้ากลุ่ม LINE แล้วผูกกลุ่มในหน้าแชท (ไอคอน LINE ในช่องพิมพ์)</div>
                  <a className="link-btn" href="https://developers.line.biz/console/" target="_blank" rel="noreferrer">เปิด LINE Developers</a>
                </div>
              </div>

              <div className="side-card" style={{ fontSize: 11 }}>
                <b><Users size={12} /> Super Admin</b>
                <div>{info.superAdmins.join(" · ")}</div>
                <div className="tiny muted">โดเมนที่อนุญาตให้เข้าใช้: <b>{info.allowlist}</b> · ตั้งค่าได้ที่ <code>ALLOWED_EMAIL_DOMAIN</code></div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
