"use client";

import React, { useState } from "react";
import {
  Building2, Cloud, Database, Download, HardDrive, MonitorPlay, RefreshCw,
  Save, ShieldCheck, Sparkles, Trash2, Bot, MapPin,
} from "lucide-react";
import { useApp } from "./providers";
import { Modal } from "./ui";
import { DbDiagnostics } from "./db-status";
import { thaiDate } from "../lib/utils";

export function SettingsView() {
  const { data, act, toast, refresh } = useApp();
  const [form, setForm] = useState(() => ({
    brand: data?.settings.brand ?? "",
    branch: data?.settings.branch ?? "",
    ledUrl: data?.settings.ledUrl ?? "",
    driveFolder: data?.settings.driveFolder ?? "",
    announce: data?.settings.announce ?? "",
    workStart: data?.settings.workStart ?? "09:30",
    workEnd: data?.settings.workEnd ?? "18:30",
    officeName: data?.settings.office.name ?? "",
    lat: data?.settings.office.lat ?? 0,
    lng: data?.settings.office.lng ?? 0,
    radius: data?.settings.office.radius ?? 150,
    aiEnabled: data?.settings.aiEnabled ?? true,
  }));
  const [confirmReset, setConfirmReset] = useState(false);

  if (!data) return null;

  const save = async () => {
    await act({
      type: "settings.update",
      patch: {
        brand: form.brand, branch: form.branch, ledUrl: form.ledUrl, driveFolder: form.driveFolder,
        announce: form.announce, workStart: form.workStart, workEnd: form.workEnd, aiEnabled: form.aiEnabled,
        office: { name: form.officeName, lat: Number(form.lat), lng: Number(form.lng), radius: Number(form.radius) },
      },
    });
    toast("บันทึกการตั้งค่าแล้ว", "ok");
  };

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
    <div className="page">
      <DbDiagnostics />

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

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><Cloud size={14} /> การเชื่อมต่อภายนอก</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field"><span className="label">จอ LED (Playwall Park Silom)</span><input className="input" value={form.ledUrl} onChange={(e) => setForm({ ...form, ledUrl: e.target.value })} /></label>
            <label className="field"><span className="label">Google Drive โฟลเดอร์กลาง</span><input className="input" value={form.driveFolder} onChange={(e) => setForm({ ...form, driveFolder: e.target.value })} /></label>
            <div className="setting-row">
              <div className="s-txt"><b>เปิดใช้งาน AI Workforce</b><small>อนุญาตให้ AI agent รับงานและรันอัตโนมัติ</small></div>
              <button className={`switch ${form.aiEnabled ? "on" : ""}`} onClick={() => setForm({ ...form, aiEnabled: !form.aiEnabled })} />
            </div>
            <div className="side-card" style={{ fontSize: 11 }}>
              <b><Sparkles size={12} /> MCP / AI Gateway</b>
              ตั้งค่า <code>GOOGLE_MCP_URL</code> เพื่อเชื่อม Google Drive ผ่าน MCP server และ <code>AI_GATEWAY_URL</code> + <code>AI_GATEWAY_KEY</code> เพื่อใช้ LLM จริง — ถ้าไม่ตั้ง ระบบใช้ context engine ในตัว
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title"><Database size={14} /> ข้อมูล & ความปลอดภัย</div></div>
          <div className="card-body">
            <div className="setting-row">
              <div className="s-txt"><b>ฐานข้อมูล</b><small>{data.storage === "mariadb" ? "MariaDB — บันทึกทุก mutation ลงตาราง ws_*" : "Demo store (ไฟล์ .data/store.json) — ตั้ง DB_* เพื่อใช้ MariaDB"}</small></div>
              <span className="pill" style={{ background: data.storage === "mariadb" ? "rgba(53,224,161,.14)" : "rgba(255,194,77,.14)", color: data.storage === "mariadb" ? "var(--mint)" : "var(--amber)" }}>
                <HardDrive size={9} /> {data.storage}
              </span>
            </div>
            <div className="setting-row">
              <div className="s-txt"><b>จำนวนข้อมูล</b><small>{data.tasks.length} งาน · {data.events.length} อีเวนต์ · {data.messages.length} ข้อความ · {data.aiRuns.length} AI runs</small></div>
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
            <div className="setting-row">
              <div className="s-txt"><b>รีเซ็ตข้อมูลตัวอย่าง</b><small>ล้างงาน/แชท/AI run กลับเป็นชุดเริ่มต้น</small></div>
              <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => setConfirmReset(true)}><Trash2 size={12} /> รีเซ็ต</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title"><Bot size={14} /> AI agents ในระบบ</div><div className="right tiny muted">{data.members.filter((m) => m.kind === "ai").length} เอเจนต์</div></div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {data.members.filter((m) => m.kind === "ai").map((a) => (
            <div key={a.id} className="room-card">
              <div className="row" style={{ gap: 8 }}>
                <span className="avatar ai" style={{ background: a.color, color: "#04121b", borderRadius: 10 }}>{a.initials}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 12 }}>{a.name}</b>
                  <div className="tiny muted">{a.role}</div>
                </div>
                <button className={`switch ${a.paused ? "" : "on"}`} onClick={() => void act({ type: "agent.toggle", id: a.id, paused: !a.paused })} title={a.paused ? "ปลุก" : "พัก"} />
              </div>
              <div className="tiny muted">{a.model} · autonomy {a.autonomy}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="spread card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <ShieldCheck size={16} style={{ color: "var(--mint)" }} />
          <div>
            <b style={{ fontSize: 12 }}>Next.js 15 · MariaDB · MCP-ready</b>
            <div className="tiny muted">ข้อมูลบันทึกผ่าน API กลาง /api/action ทุกครั้ง — พร้อมต่อยอด SSO และ audit log</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => void save()}><Save size={14} /> บันทึกการตั้งค่า</button>
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
    </div>
  );
}
