"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

const ERRORS: Record<string, string> = {
  google_not_configured: "ยังไม่ได้ตั้งค่า Google Login (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET)",
  google_state: "เซสชัน Google หมดอายุ — ลองอีกครั้ง",
  google_cancelled: "ยกเลิกการเข้าสู่ระบบด้วย Google",
  google_token: "แลก token กับ Google ไม่สำเร็จ",
  google_email: "Google ไม่ได้ส่งอีเมลกลับมา — ตรวจสอบสิทธิ์ email scope",
  google_unverified: "อีเมล Google ยังไม่ยืนยัน",
  google_failed: "เชื่อมต่อ Google ไม่สำเร็จ ลองใหม่ภายหลัง",
  line_not_configured: "ยังไม่ได้ตั้งค่า LINE Login (AUTH_LINE_ID / AUTH_LINE_SECRET)",
  line_state: "เซสชัน LINE หมดอายุ — ลองอีกครั้ง",
  line_cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE",
  line_token: "แลก token กับ LINE ไม่สำเร็จ",
  line_verify: "ตรวจสอบ LINE id_token ไม่ผ่าน",
  line_no_email: "LINE ไม่ได้อนุญาตให้เข้าถึงอีเมล — เข้าสู่ระบบด้วยอีเมล/รหัสผ่านแทนได้",
  line_failed: "เชื่อมต่อ LINE ไม่สำเร็จ ลองใหม่ภายหลัง",
  domain: "อนุญาตเฉพาะอีเมลโดเมนบริษัทเท่านั้น",
  session: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
};

export function LoginForm({ googleReady, lineReady }: { googleReady: boolean; lineReady: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const errCode = params.get("error");
  const nextPath = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(errCode ? ERRORS[errCode] || "เข้าสู่ระบบไม่สำเร็จ" : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `เข้าสู่ระบบไม่สำเร็จ (${res.status})`);
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="login-head">
        <div className="login-badge"><ShieldCheck size={14} /> เข้าสู่ระบบ</div>
        <h2>ยินดีต้อนรับกลับ</h2>
        <p className="muted">ใช้อีเมลบริษัทและรหัสผ่าน หรือเลือกเข้าสู่ระบบด้วย Google / LINE</p>
      </div>

      {error && (
        <div className="login-alert">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span className="label">อีเมลบริษัท</span>
          <span className="login-input">
            <Mail size={14} />
            <input
              className="input"
              type="email"
              autoComplete="username"
              required
              placeholder="name@iplaydigital.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </span>
        </label>

        <label className="field">
          <span className="label">รหัสผ่าน</span>
          <span className="login-input">
            <Lock size={14} />
            <input
              className="input"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <button type="button" className="login-eye" onClick={() => setShow(!show)} tabIndex={-1} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </span>
        </label>

        <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
          {busy ? <><Loader2 size={15} className="spin" /> กำลังเข้าสู่ระบบ…</> : <>เข้าสู่ระบบ <ArrowRight size={15} /></>}
        </button>
      </form>

      <div className="login-or"><span>หรือ</span></div>

      <div className="login-oauth">
        <a className="auth-btn google" href={googleReady ? "/api/auth/google" : "/api/auth/google"} aria-disabled={!googleReady}>
          <GoogleIcon />
          <span>Google Workspace / Gmail</span>
          {!googleReady && <small>ยังไม่ตั้งค่า</small>}
        </a>
        <a className="auth-btn line" href="/api/auth/line">
          <LineIcon />
          <span>LINE</span>
          {!lineReady && <small>ยังไม่ตั้งค่า</small>}
        </a>
      </div>

      <div className="login-hint">
        <b>บัญชีเริ่มต้น (เปลี่ยนรหัสผ่านทันทีหลังเข้าใช้)</b>
        <div><code>oak@iplaydigital.co</code> · admin</div>
        <div><code>ploy@iplaydigital.co</code> · support</div>
        <div><code>nan@iplaydigital.co</code> · member</div>
        <div className="tiny muted">รหัสผ่านเริ่มต้น: <code>iplay@2026</code> (หรือค่าจาก <code>ADMIN_INITIAL_PASSWORD</code>)</div>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.7-2.9c-1 .7-2.3 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5l-.1.1-3.6 2.8-.1.1C3.4 21.3 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.4c-.3-.7-.4-1.5-.4-2.4 0-.8.2-1.7.4-2.4l-.1-.1L1.5 6.6l-.1.1C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.3l3.9-2.9z" />
      <path fill="#EA4335" d="M12 4.7c2.2 0 3.7.9 4.5 1.7l3.3-3.2C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l3.9 3c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#06C755" />
      <path fill="#fff" d="M19 10.9c0-3.4-3.1-6.1-7-6.1s-7 2.7-7 6.1c0 3 2.5 5.6 5.9 6 .2 0 .5.1.6.3.1.2.1.4 0 .6-.1.3-.3 1-.3 1.1 0 .2-.1.6.5.4s3.4-2 4.6-3.4c.9-.9 1.7-2.1 1.7-4z" />
      <path fill="#06C755" d="M8.2 8.9h-.7c-.1 0-.2.1-.2.2v3.6c0 .1.1.2.2.2h.7c.1 0 .2-.1.2-.2V9.1c0-.1-.1-.2-.2-.2zm4 0h-.7c-.1 0-.2.1-.2.2v2.2l-1.6-2.3-.1-.1h-.8c-.1 0-.2.1-.2.2v3.6c0 .1.1.2.2.2h.7c.1 0 .2-.1.2-.2v-2.2l1.6 2.3.1.1h.8c.1 0 .2-.1.2-.2V9.1c0-.1-.1-.2-.2-.2zm3.7 2.9h-1.8v-.6h1.8c.1 0 .2-.1.2-.2v-.6c0-.1-.1-.2-.2-.2h-1.8v-.6h1.8c.1 0 .2-.1.2-.2v-.6c0-.1-.1-.2-.2-.2h-2.6c-.1 0-.2.1-.2.2v3.6c0 .1.1.2.2.2h2.6c.1 0 .2-.1.2-.2v-.6c0-.1-.1-.2-.2-.2z" />
    </svg>
  );
}
