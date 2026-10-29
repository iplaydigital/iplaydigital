"use client";

// ─────────────────────────────────────────────────────────────
//  โปรไฟล์ของฉัน — ช่องทางเข้าใช้ (อีเมล / Google / LINE) + Google Drive
//   • อีเมลหลัก: @playdigital.co.th หรือ @gmail.com
//   • Google และ LINE เป็นช่องทาง "เชื่อมเพิ่ม" จากหน้านี้
//   • Google Drive ทำงานภายใต้บัญชี Google (Gmail) ของผู้ใช้เอง
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck, Check, ExternalLink, HardDrive, KeyRound, Link2, Loader2, Mail, MessageCircle, RefreshCw,
  ShieldCheck, Smartphone, Unlink, UserCircle2,
} from "lucide-react";
import { useApp } from "./providers";
import { cls, thaiDate } from "../lib/utils";
import { domainLabel } from "../lib/identity";

type ChannelKey = "google" | "line" | "drive";

interface LinksInfo {
  ok: boolean;
  email: string;
  emailDomain: string;
  emailDomainLabel: string;
  emailAllowed: boolean;
  passwordLogin: boolean;
  provider: string;
  google: { available: boolean; linked: boolean; email: string | null; at: string | null };
  line: { available: boolean; linked: boolean; name: string | null; picture: string | null; at: string | null };
  drive: { available: boolean; linked: boolean; email: string | null; at: string | null };
  urls: Record<ChannelKey, string>;
}

const RESULT_TEXT: Record<string, string> = {
  google: "เชื่อมบัญชี Google แล้ว — ใช้เข้าสู่ระบบแทนกันได้",
  line: "เชื่อมบัญชี LINE แล้ว — เข้าสู่ระบบด้วย LINE ได้ทันที",
  drive: "เชื่อม Google Drive แล้ว — ไฟล์รายงานจะถูกเก็บในไดรฟ์ของคุณเอง",
};

const ERROR_TEXT: Record<string, string> = {
  google_cancelled: "ยกเลิกการเชื่อม Google",
  google_state: "เซสชันการเชื่อมหมดอายุ — ลองใหม่",
  google_token: "ขอ token จาก Google ไม่สำเร็จ",
  google_email: "Google ไม่ได้ส่งอีเมลกลับมา กรุณาอนุญาตสิทธิ์อีเมล",
  google_unverified: "อีเมล Google ยังไม่ยืนยันตัวตน",
  google_not_configured: "ยังไม่ได้ตั้งค่า Google Client ID/Secret (ติดต่อ Super Admin)",
  google_failed: "เชื่อม Google ไม่สำเร็จ",
  line_cancelled: "ยกเลิกการเชื่อม LINE",
  line_state: "เซสชันการเชื่อม LINE หมดอายุ — ลองใหม่",
  line_token: "ขอ token จาก LINE ไม่สำเร็จ",
  line_verify: "ตรวจสอบโปรไฟล์ LINE ไม่สำเร็จ",
  line_already_linked: "LINE นี้ถูกผูกกับบัญชีอื่นแล้ว",
  line_not_configured: "ยังไม่ได้ตั้งค่า LINE Channel (ติดต่อ Super Admin)",
  line_failed: "เชื่อม LINE ไม่สำเร็จ",
  domain: "อีเมลนี้ไม่อยู่ในโดเมนที่อนุญาต",
  session: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
};

export function ProfileView() {
  const { me, toast } = useApp();
  const [info, setInfo] = useState<LinksInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ChannelKey | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/links", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as LinksInfo & { error?: string };
      if (!res.ok) throw new Error(body.error || "โหลดข้อมูลโปรไฟล์ไม่สำเร็จ");
      setInfo(body);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // แสดงผลลัพธ์ที่ส่งกลับมาจาก OAuth (?linked=google|line|drive · ?linkError=…)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const linkError = params.get("linkError");
    if (linked) setBanner({ kind: "ok", text: RESULT_TEXT[linked] ?? "เชื่อมต่อสำเร็จ" });
    else if (linkError) setBanner({ kind: "err", text: ERROR_TEXT[linkError] ?? `เชื่อมต่อไม่สำเร็จ (${linkError})` });
    if (linked || linkError) {
      const url = new URL(window.location.href);
      url.searchParams.delete("linked");
      url.searchParams.delete("linkError");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const connect = (channel: ChannelKey) => {
    if (!info) return;
    window.location.href = info.urls[channel];
  };

  const disconnect = async (channel: ChannelKey) => {
    const name = channel === "google" ? "Google" : channel === "line" ? "LINE" : "Google Drive";
    if (!window.confirm(`ยกเลิกการเชื่อม ${name}?\nคุณยังเข้าสู่ระบบด้วยอีเมล/รหัสผ่านได้ตามปกติ`)) return;
    setBusy(channel);
    try {
      const res = await fetch(`/api/profile/links?channel=${channel}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "ยกเลิกการเชื่อมไม่สำเร็จ");
      toast(`ยกเลิกการเชื่อม ${name} แล้ว`, "info");
      await load();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (!me) return null;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {banner && (
        <div
          className="card"
          style={{
            padding: "12px 16px",
            borderColor: banner.kind === "ok" ? "rgba(34,199,147,.45)" : "rgba(255,92,122,.45)",
            background: banner.kind === "ok" ? "rgba(34,199,147,.10)" : "rgba(255,92,122,.10)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
          }}
        >
          {banner.kind === "ok" ? <Check size={15} /> : <ShieldCheck size={15} />}
          <span style={{ flex: 1 }}>{banner.text}</span>
          <button className="btn btn-sm" onClick={() => setBanner(null)}>ปิด</button>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title"><UserCircle2 size={14} /> บัญชีของฉัน</div>
          <button className="btn btn-sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} รีเฟรช
          </button>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="row" style={{ gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {me.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar" src={me.avatar} alt={me.name} style={{ width: 52, height: 52, objectFit: "cover" }} />
            ) : (
              <span className="avatar" style={{ background: me.color, color: "#fff", width: 52, height: 52, fontSize: 18 }}>
                {me.initials}
              </span>
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <b style={{ fontSize: 15 }}>{me.name}</b>
              <div className="tiny muted">{me.position || me.jobTitle || "—"}</div>
              <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span className="tiny muted"><Mail size={10} /> {me.email}</span>
                {me.isSuper && <span className="role-pill super"><ShieldCheck size={10} /> SUPER ADMIN</span>}
                <span className={cls("pill", info?.emailAllowed ? "ok" : "warn")}>
                  {info?.emailAllowed ? <><BadgeCheck size={9} /> โดเมนที่อนุญาต</> : "โดเมนนอกระบบ"}
                </span>
              </div>
            </div>
          </div>

          <div className="side-card" style={{ fontSize: 11.5 }}>
            <b><KeyRound size={12} /> ช่องทางเข้าสู่ระบบ</b>
            <div>อีเมลที่ใช้ได้: <b>{info?.emailDomainLabel ?? domainLabel()}</b> — ช่องทางใดก็ได้ที่ผูกไว้ ใช้เข้าสู่ระบบได้ทั้งหมด</div>
            <div>รหัสผ่าน: {info?.passwordLogin ? "ตั้งค่าแล้ว" : "ใช้เฉพาะ Google/LINE"} · บัญชีที่ใช้ล่าสุด: <b>{info?.provider ?? me.provider}</b></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><Link2 size={14} /> เชื่อมต่อช่องทางเพิ่มเติม</div>
          <span className="tiny muted">ผูกครั้งเดียว ใช้ได้ตลอด</span>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          <ChannelCard
            title="Google / Gmail"
            icon={<Mail size={15} />}
            tone="#EA4335"
            available={info?.google.available ?? false}
            linked={info?.google.linked ?? false}
            detail={info?.google.linked ? (info.google.email ?? "เชื่อมแล้ว") : "เข้าสู่ระบบด้วยอีเมล Google ของคุณ"}
            at={info?.google.at}
            busy={busy === "google"}
            onConnect={() => connect("google")}
            onDisconnect={() => void disconnect("google")}
            note="ใช้ได้ทั้ง @gmail.com และ Google Workspace ของบริษัท"
          />
          <ChannelCard
            title="LINE"
            icon={<MessageCircle size={15} />}
            tone="#06C755"
            available={info?.line.available ?? false}
            linked={info?.line.linked ?? false}
            detail={info?.line.linked ? (info.line.name ?? "เชื่อมแล้ว") : "เชื่อม LINE เพื่อรับ–ส่งข้อความในแชท"}
            at={info?.line.at}
            busy={busy === "line"}
            onConnect={() => connect("line")}
            onDisconnect={() => void disconnect("line")}
            note="หลังผูกแล้ว เข้าสู่ระบบด้วย LINE ได้ + รับแจ้งเตือนจาก OA"
          />
          <ChannelCard
            title="Google Drive"
            icon={<HardDrive size={15} />}
            tone="#7100DD"
            available={info?.drive.available ?? false}
            linked={info?.drive.linked ?? false}
            detail={info?.drive.linked ? (info.drive.email ?? "เชื่อมแล้ว") : "อัปโหลดรายงานเข้าไดรฟ์ของคุณเอง"}
            at={info?.drive.at}
            busy={busy === "drive"}
            onConnect={() => connect("drive")}
            onDisconnect={() => void disconnect("drive")}
            note="ไฟล์ทั้งหมดอยู่ภายใต้บัญชี Gmail ของคุณ (ไม่ใช้บัญชีกลาง)"
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><Smartphone size={14} /> LINE Official Account</div>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
          <div className="tiny muted" style={{ lineHeight: 1.8 }}>
            • เพิ่มเพื่อน OA ของบริษัท แล้วพิมพ์ข้อความ — ระบบจะเก็บเข้ากล่อง LINE ในหน้าแชท<br />
            • ข้อความจาก OA ส่งกลับหาคุณได้ทันที และส่งเข้ากลุ่ม LINE ที่ผูกไว้ได้<br />
            • เปิดกล่องข้อความ LINE ในหน้า <b>แชท & Drive</b> (ปุ่ม LINE ในช่องพิมพ์)
          </div>
          <div className="row" style={{ gap: 8 }}>
            <a className="btn btn-sm" href="/api/line/status" target="_blank" rel="noreferrer">
              <ExternalLink size={11} /> ดูสถานะการเชื่อมต่อ LINE
            </a>
            <span className={cls("pill", info?.line.linked ? "ok" : "warn")}>
              {info?.line.linked ? "ผูก LINE แล้ว" : "ยังไม่ได้ผูก LINE"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelCard({
  title,
  icon,
  tone,
  available,
  linked,
  detail,
  at,
  busy,
  note,
  onConnect,
  onDisconnect,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  available: boolean;
  linked: boolean;
  detail: string;
  at?: string | null;
  busy: boolean;
  note: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className={cls("login-state", linked && "on")} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ls-head">
        <b style={{ display: "flex", alignItems: "center", gap: 6, color: tone }}>
          {icon} {title}
        </b>
        <span className={cls("pill", linked ? "ok" : available ? "warn" : "")}>
          {linked ? <><Check size={9} /> เชื่อมแล้ว</> : available ? "ยังไม่เชื่อม" : "ยังไม่เปิดใช้"}
        </span>
      </div>
      <div style={{ fontSize: 12 }}>{detail}</div>
      {at && <div className="tiny muted">เชื่อมเมื่อ {thaiDate(at)}</div>}
      <div className="tiny muted" style={{ lineHeight: 1.6 }}>{note}</div>
      <div className="row" style={{ gap: 6, marginTop: "auto" }}>
        {linked ? (
          <>
            <button className="btn btn-sm" onClick={onConnect} disabled={!available || busy}>
              <RefreshCw size={11} /> เชื่อมใหม่
            </button>
            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={onDisconnect} disabled={busy}>
              {busy ? <Loader2 size={11} className="spin" /> : <Unlink size={11} />} ยกเลิก
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onConnect} disabled={!available || busy}>
            {busy ? <Loader2 size={11} className="spin" /> : <Link2 size={11} />} เชื่อมต่อ
          </button>
        )}
      </div>
      {!available && <div className="tiny" style={{ color: "var(--amber)" }}>ยังไม่ได้ตั้งค่าในระบบ — ติดต่อ Super Admin</div>}
    </div>
  );
}
