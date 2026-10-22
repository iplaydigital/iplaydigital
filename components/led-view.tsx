"use client";

import React, { useEffect, useState } from "react";
import {
  ExternalLink, MonitorPlay, RefreshCw, Radio, Signal, Sparkles, Wifi, WifiOff, Copy, Check,
} from "lucide-react";
import { useApp } from "./providers";
import { Avatar } from "./ui";
import { CAT_META, thaiFull, thaiTime, thaiShort, cls } from "../lib/utils";

export function LedView() {
  const { data, toast } = useApp();
  const [payload, setPayload] = useState<string>("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/led", { cache: "no-store" });
      const json = await res.json();
      setPayload(JSON.stringify(json, null, 2));
      setOk(true);
    } catch {
      setOk(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  if (!data) return null;

  const today = data.events.filter((e) => e.date === data.today).sort((a, b) => (a.time || "00").localeCompare(b.time || "00"));
  const urgent = data.tasks.filter((t) => t.status !== "done" && t.priority === "urgent");
  const ai = data.members.filter((m) => m.kind === "ai");

  return (
    <div className="page">
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="card-title" style={{ fontSize: 14 }}><MonitorPlay size={15} /> LED Wall — Playwall Park Silom</div>
          <p className="tiny muted" style={{ marginTop: 3 }}>เชื่อมจอ LED ผ่าน URL ภายนอก · ข้อมูล Workspace ถูกแปลงเป็น payload พร้อมฉาย</p>
        </div>
        <div className="row">
          <span className={cls("pill", ok ? "" : "")} style={{ background: ok ? "rgba(34,199,147,.14)" : "rgba(255,92,122,.14)", color: ok ? "var(--mint)" : "var(--red)" }}>
            {ok ? <Wifi size={10} /> : <WifiOff size={10} />} {ok ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
          </span>
          <button className="btn btn-sm" onClick={() => void load()} disabled={loading}><RefreshCw size={12} /> รีเฟรช</button>
          <button className="btn btn-sm btn-primary" onClick={() => window.open("/led", "_blank")}><ExternalLink size={12} /> เปิดโหมดจอเต็ม</button>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "1.4fr .6fr" }}>
        <div className="led-frame">
          <span className="led-badge"><Radio size={10} style={{ color: "var(--mint)" }} /> LIVE PREVIEW · 16:9</span>
          <iframe src={data.settings.ledUrl} title="Playwall LED" allow="autoplay; fullscreen" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="side-h"><Signal size={11} /> สถานะการเชื่อมต่อ</div>
            <Row label="จอปลายทาง" value={data.settings.ledUrl.replace(/^https?:\/\//, "").slice(0, 28)} />
            <Row label="โหมดพรีวิว" value="iframe embed" />
            <Row label="API payload" value="/api/led · CORS *" />
            <Row label="อัปเดตล่าสุด" value={thaiTime(new Date().toISOString())} />
            <div className="divider" style={{ margin: "8px 0" }} />
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/api/led`); setCopied(true); toast("คัดลอก API LED แล้ว", "ok"); }}>
                {copied ? <Check size={12} /> : <Copy size={12} />} คัดลอก API
              </button>
              <a className="btn btn-sm" style={{ flex: 1, justifyContent: "center" }} href={data.settings.ledUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> เปิดจอจริง
              </a>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="side-h"><Sparkles size={11} /> คิวฉายวันนี้</div>
            {today.slice(0, 5).map((e) => (
              <div key={e.id} className="row" style={{ gap: 7, padding: "4px 0", fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9, background: CAT_META[e.cat].color }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                <span className="tiny muted">{e.time ?? "ทั้งวัน"}</span>
              </div>
            ))}
            {!today.length && <p className="tiny muted">ไม่มีคิววันนี้</p>}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="side-h">AI บนจอ</div>
            <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
              {ai.map((a) => (
                <span key={a.id} className="chip" style={{ padding: "3px 8px" }}>
                  <Avatar member={a} size="sm" /> {a.name}
                  <span style={{ width: 5, height: 5, borderRadius: 9, background: a.paused ? "var(--amber)" : "var(--mint)" }} />
                </span>
              ))}
            </div>
            <div className="tiny muted" style={{ marginTop: 8 }}>งานด่วนที่ขึ้นจอ: {urgent.length} รายการ</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title"><Radio size={14} /> LED payload (API response)</div><div className="right tiny muted">/api/led</div></div>
          <div className="card-body">
            <pre className="led-payload">{payload || "กำลังโหลด…"}</pre>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title"><Signal size={14} /> วิธีเชื่อมกับ Playwall</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 11.5, color: "var(--text-2)" }}>
            <p>1. ตั้งค่า <code>NEXT_PUBLIC_LED_URL</code> ให้ชี้ไปที่จอ LED (ปัจจุบัน {data.settings.ledUrl})</p>
            <p>2. ให้ฝั่ง Playwall เรียก <code>GET /api/led</code> ทุก 30 วินาที — endpoint เปิด CORS <code>*</code> และไม่ cache</p>
            <p>3. payload มี 4 ก้อน: <b>announce</b> (ข้อความวิ่ง), <b>todayEvents</b> (คิวฉาย), <b>urgentTasks</b>, <b>aiAgents</b></p>
            <p>4. ใช้หน้า <b>/led</b> เป็นจอสำรอง 1920×1080 ที่ดึงข้อมูลสดจาก Workspace</p>
            <div className="side-card" style={{ marginTop: 4 }}>
              <b><MonitorPlay size={12} /> จอแสดงผลในออฟฟิศ</b>
              เปิด /led บนทีวีผ่าน Chromium kiosk: <code>chromium --kiosk {typeof window !== "undefined" ? window.location.origin : ""}/led</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="spread" style={{ padding: "3px 0", fontSize: 11 }}>
      <span className="muted">{label}</span>
      <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

export function LedScreen() {
  const { data } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => void fetch("/api/led"), 30000);
    return () => clearInterval(t);
  }, []);
  if (!data) return null;

  const today = data.events.filter((e) => e.date === data.today).sort((a, b) => (a.time || "00").localeCompare(b.time || "00"));
  const urgent = data.tasks.filter((t) => t.status !== "done" && t.priority === "urgent").slice(0, 4);
  const ai = data.members.filter((m) => m.kind === "ai");
  const stats = [
    { label: "งานเปิดอยู่", value: data.tasks.filter((t) => t.status !== "done").length },
    { label: "ด่วนมาก", value: urgent.length },
    { label: "ปิดแล้ว", value: data.tasks.filter((t) => t.status === "done").length },
    { label: "AI ออนไลน์", value: ai.filter((a) => !a.paused).length },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "32px 44px", display: "flex", flexDirection: "column", gap: 24, background: "radial-gradient(1200px 600px at 70% -10%, rgba(108,92,231,.16), transparent 60%), #f6f7fc" }}>
      <header className="spread">
        <div className="row" style={{ gap: 14 }}>
          <div className="brand-mark" style={{ width: 52, height: 52, fontSize: 18 }}>iP</div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>iPlay Digital · Workspace Live</h1>
            <p className="muted" style={{ fontSize: 13 }}>{thaiFull(now)} · {data.settings.branch}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>
            {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
            <span style={{ fontSize: 22, color: "var(--muted)" }}>:{String(now.getSeconds()).padStart(2, "0")}</span>
          </div>
          <div className="row" style={{ gap: 6, justifyContent: "flex-end", color: "var(--mint)", fontSize: 12 }}>
            <span className="pulse" /> LIVE · {data.storage === "mariadb" ? "MariaDB" : "Demo store"}
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>{s.value}</div>
            <div className="muted" style={{ fontSize: 13 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", gap: 16, flex: 1 }}>
        <div className="card" style={{ padding: 22 }}>
          <div className="card-title" style={{ fontSize: 15, marginBottom: 12 }}>🗓 คิววันนี้</div>
          {today.map((e) => (
            <div key={e.id} className="row" style={{ gap: 12, padding: "9px 0", borderBottom: "1px solid var(--tint-2)", fontSize: 15 }}>
              <span style={{ width: 8, height: 8, borderRadius: 9, background: CAT_META[e.cat].color }} />
              <span style={{ width: 66, fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{e.time ?? "ทั้งวัน"}</span>
              <span style={{ flex: 1 }}>{e.title}</span>
              {e.important && <span className="pill" style={{ background: "rgba(255,92,122,.16)", color: "var(--red)" }}>สำคัญ</span>}
            </div>
          ))}
          {!today.length && <p className="muted">ไม่มีรายการวันนี้</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 22, flex: 1 }}>
            <div className="card-title" style={{ fontSize: 15, marginBottom: 10 }}>🔥 งานด่วน</div>
            {urgent.map((t) => (
              <div key={t.id} style={{ padding: "7px 0", fontSize: 14 }}>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div className="tiny muted">{t.code} · {thaiShort(t.due)}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 22 }}>
            <div className="card-title" style={{ fontSize: 15, marginBottom: 10 }}>🤖 AI กำลังทำงาน</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ai.map((a) => (
                <span key={a.id} className="chip" style={{ padding: "5px 10px", fontSize: 12 }}>
                  <Avatar member={a} size="sm" /> {a.name}
                  <span style={{ width: 6, height: 6, borderRadius: 9, background: a.paused ? "var(--amber)" : "var(--mint)" }} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 18 }}>📣</span>
        <div style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 16 }}>{data.settings.announce}</span>
        </div>
        <span className="pill" style={{ background: "rgba(108,92,231,.14)", color: "var(--violet)" }}>iPlay Workspace</span>
      </div>
    </div>
  );
}
