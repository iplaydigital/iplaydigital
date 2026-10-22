"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Check, Copy, Database, ExternalLink, Loader2, RefreshCw,
  Server, ShieldCheck, Terminal, Wifi, WifiOff, X,
} from "lucide-react";
import { useApp } from "./providers";
import { Modal } from "./ui";
import { cls } from "../lib/utils";

interface DbHealthResponse {
  ok: boolean;
  storage: string;
  mode?: string;
  note?: string;
  db?: {
    configured: boolean;
    ok: boolean;
    host?: string;
    port?: number;
    user?: string;
    database?: string;
    latencyMs?: number | null;
    server?: string | null;
    currentUser?: string | null;
    charset?: string | null;
    tables?: number | null;
    schemaReady?: boolean;
    error?: { code: string; message: string; hint: string; fix?: string; at: string } | null;
  };
  time?: string;
}

export function useDbHealth() {
  const [health, setHealth] = useState<DbHealthResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store" });
      setHealth((await res.json()) as DbHealthResponse);
    } catch (e) {
      setHealth({ ok: false, storage: "unknown", note: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { health, busy, check };
}

/** แบนเนอร์เตือนเมื่อตั้งค่า DB แล้วแต่ต่อไม่ได้ (ระบบยังใช้งานได้ด้วยข้อมูลสำรอง) */
export function DbBanner() {
  const { data, refresh, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [checking, setChecking] = useState(false);

  if (!data || data.storage !== "fallback" || hidden) return null;
  const err = data.dbError;

  const recheck = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store" });
      const h = (await res.json()) as DbHealthResponse;
      await refresh();
      if (h.ok) toast("เชื่อมต่อ MariaDB สำเร็จ — กลับมาใช้ฐานข้อมูลจริงแล้ว", "ok");
      else toast(`ยังเชื่อมต่อไม่ได้: ${h.db?.error?.code ?? "unknown"} — ${h.db?.error?.hint ?? ""}`.slice(0, 120), "err");
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div className="db-banner">
        <AlertTriangle size={15} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>เชื่อมต่อ MariaDB ไม่ได้ — ระบบทำงานด้วยข้อมูลสำรอง</b>
          <small>
            {err ? `${err.code}: ${err.message}` : "ตรวจสอบค่า DB_* ใน .env แล้ว restart แอป"}
            {" · "}ข้อมูลที่แก้ไขตอนนี้จะถูกเก็บชั่วคราวในเครื่อง ไม่ได้ลงฐานข้อมูล
          </small>
        </div>
        <button className="btn btn-sm" onClick={() => void recheck()} disabled={checking}>
          {checking ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} ตรวจสอบอีกครั้ง
        </button>
        <button className="btn btn-sm" onClick={() => setOpen(true)}><Terminal size={12} /> วิธีแก้</button>
        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setHidden(true)} title="ซ่อน (แสดงใหม่เมื่อโหลดหน้า)"><X size={13} /></button>
      </div>
      {open && <DbFixModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function DbFixModal({ onClose }: { onClose: () => void }) {
  const { data } = useApp();
  const { health } = useDbHealth();
  const err = health?.db?.error ?? data?.dbError ?? null;
  const [copied, setCopied] = useState(false);
  const db = health?.db;
  const user = db?.user ?? "agency_os";
  const name = db?.database ?? "agency_os";
  const fix = err?.fix;

  const copy = async () => {
    const text = [
      `# iPlay Workspace — แก้การเชื่อมต่อฐานข้อมูล (${err?.code ?? "unknown"})`,
      err ? `# ${err.message}` : "",
      "",
      fix ?? "",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Modal
      title="เชื่อมต่อฐานข้อมูลไม่สำเร็จ"
      subtitle={err ? `${err.code} · ${new Date(err.at).toLocaleString("th-TH")}` : "ตรวจสอบการตั้งค่า DB_*"}
      icon={<Database size={16} />}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />} คัดลอกคำสั่ง</button>
          <button className="btn btn-primary" onClick={onClose}>เข้าใจแล้ว</button>
        </>
      }
    >
      {err ? (
        <>
          <div className="side-card" style={{ borderColor: "rgba(255,92,122,.35)", background: "rgba(255,92,122,.08)" }}>
            <b style={{ color: "var(--red)" }}><AlertTriangle size={12} /> {err.code}</b>
            <div style={{ fontSize: 11.5, lineHeight: 1.6 }}>{err.message}</div>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.65 }}>{err.hint}</p>
          {fix && <pre className="led-payload" style={{ maxHeight: 260 }}>{fix}</pre>}
        </>
      ) : (
        <p style={{ fontSize: 12 }}>ยังไม่มีรายละเอียด error — กด “ตรวจสอบอีกครั้ง” ในแบนเนอร์เพื่อรีเฟรช</p>
      )}
      <div className="grid-2">
        <div className="room-card">
          <div className="row" style={{ gap: 7 }}><Database size={13} style={{ color: "var(--violet)" }} /><b style={{ fontSize: 12 }}>ค่าที่แอปใช้อยู่</b></div>
          <div className="tiny muted" style={{ lineHeight: 1.8 }}>
            host · {db?.host ?? "—"}:{db?.port ?? 3306}<br />
            user · {user}<br />
            database · {name}<br />
            ตาราง ws_* · {db?.tables ?? "—"} ตาราง
          </div>
        </div>
        <div className="room-card">
          <div className="row" style={{ gap: 7 }}><ShieldCheck size={13} style={{ color: "var(--mint)" }} /><b style={{ fontSize: 12 }}>เช็กลิสต์</b></div>
          <ol className="tiny muted" style={{ lineHeight: 1.8, paddingLeft: 14, margin: 0 }}>
            <li>แก้ <code>.env</code> ด้วย heredoc (กัน <code>! $ #</code> ถูกตีความ)</li>
            <li>restart แอป — env ถูกอ่านตอนบูตเท่านั้น</li>
            <li><code>npm run db:doctor</code> เพื่อตรวจซ้ำ</li>
            <li>ถ้า DB อยู่เครื่องเดียวกัน ใช้ <code>DB_HOST=127.0.0.1</code></li>
          </ol>
        </div>
      </div>
      <div className="tiny muted">
        คำแนะนำฉบับเต็มอยู่ใน README หัวข้อ “แก้ปัญหาการเชื่อมต่อฐานข้อมูล”
      </div>
    </Modal>
  );
}

/** การ์ดวินิจฉัยในหน้าตั้งค่า */
export function DbDiagnostics() {
  const { data, refresh, toast } = useApp();
  const { health, busy, check } = useDbHealth();
  const [tab, setTab] = useState<"status" | "fix">("status");
  const err = health?.db?.error ?? data?.dbError ?? null;
  const mode = health?.db?.configured === false ? "demo" : health?.db?.ok ? "mariadb" : "fallback";
  const badge = mode === "mariadb" ? { text: "MariaDB · เชื่อมต่อแล้ว", color: "var(--mint)", bg: "rgba(34,199,147,.14)" }
    : mode === "demo" ? { text: "Demo store (ยังไม่ตั้งค่า DB)", color: "var(--amber)", bg: "rgba(255,176,32,.14)" }
    : { text: "Fallback · ต่อ DB ไม่ได้", color: "var(--red)", bg: "rgba(255,92,122,.14)" };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><Database size={14} /> วินิจฉัยฐานข้อมูล</div>
        <div className="right">
          <span className="pill" style={{ background: badge.bg, color: badge.color }}>
            {mode === "mariadb" ? <Wifi size={10} /> : <WifiOff size={10} />} {badge.text}
          </span>
          <button className="btn btn-sm" onClick={async () => { await check(); await refresh(); toast("ตรวจสอบการเชื่อมต่อใหม่แล้ว", "ok"); }} disabled={busy}>
            {busy ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} ตรวจสอบใหม่
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button className={tab === "status" ? "on" : ""} onClick={() => setTab("status")}>สถานะ</button>
          <button className={tab === "fix" ? "on" : ""} onClick={() => setTab("fix")}>วิธีแก้ / คำสั่ง</button>
        </div>

        {tab === "status" ? (
          <div className="grid-2" style={{ gap: 10 }}>
            <DiagRow icon={<Server size={12} />} label="โฮสต์" value={`${health?.db?.host ?? "—"}:${health?.db?.port ?? 3306}`} />
            <DiagRow icon={<Database size={12} />} label="ฐานข้อมูล" value={health?.db?.database ?? "—"} />
            <DiagRow icon={<ShieldCheck size={12} />} label="ผู้ใช้" value={health?.db?.currentUser ?? health?.db?.user ?? "—"} />
            <DiagRow icon={<Wifi size={12} />} label="เวลาเชื่อมต่อ" value={health?.db?.latencyMs != null ? `${health.db.latencyMs} ms` : "—"} />
            <DiagRow label="เซิร์ฟเวอร์" value={health?.db?.server ?? "—"} />
            <DiagRow label="ตาราง ws_*" value={health?.db?.tables != null ? `${health.db.tables} ตาราง` : "—"} />
            <DiagRow label="charset" value={health?.db?.charset ?? "—"} />
            <DiagRow label="ตรวจล่าสุด" value={health?.time ? new Date(health.time).toLocaleTimeString("th-TH") : "—"} />
          </div>
        ) : (
          <>
            {err ? (
              <>
                <div className="side-card" style={{ borderColor: "rgba(255,92,122,.3)", background: "rgba(255,92,122,.07)", marginBottom: 10 }}>
                  <b style={{ color: "var(--red)" }}>{err.code}</b>
                  <div style={{ fontSize: 11.5, lineHeight: 1.6 }}>{err.message}</div>
                </div>
                <p style={{ fontSize: 11.5, lineHeight: 1.65, marginBottom: 8 }}>{err.hint}</p>
                {err.fix && <pre className="led-payload" style={{ maxHeight: 240 }}>{err.fix}</pre>}
              </>
            ) : mode === "mariadb" ? (
              <div className="empty"><Check size={22} style={{ color: "var(--mint)" }} /><p>ฐานข้อมูลพร้อมใช้งาน ไม่มีอะไรต้องแก้</p></div>
            ) : (
              <div className="empty"><Database size={22} /><p>ยังไม่ได้ตั้งค่า DB_HOST — ระบบใช้ demo store อยู่</p></div>
            )}
          </>
        )}

        <div className="divider" style={{ margin: "12px 0" }} />
        <div className="row" style={{ gap: 8, flexWrap: "wrap", fontSize: 10.5, color: "var(--muted)" }}>
          <span className="row" style={{ gap: 5 }}><Terminal size={11} /> บนเซิร์ฟเวอร์:</span>
          <code className="code-chip">npm run db:doctor</code>
          <code className="code-chip">npm run db:doctor -- --init</code>
          <a className="link-btn" href="/api/health" target="_blank" rel="noreferrer"><ExternalLink size={10} /> เปิด /api/health</a>
        </div>
      </div>
    </div>
  );
}

function DiagRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className={cls("row")} style={{ gap: 8, padding: "6px 8px", background: "var(--tint-1)", borderRadius: 8 }}>
      <span className="muted" style={{ display: "grid", placeItems: "center", width: 16 }}>{icon}</span>
      <span className="tiny muted" style={{ flex: 1 }}>{label}</span>
      <span className="tiny" style={{ fontWeight: 600, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
