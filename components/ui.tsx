"use client";

import React from "react";
import {
  ArrowRight, Bot, CalendarDays, Check, Clock, Flag, FolderOpen,
  MessageSquare, Paperclip, PaperclipIcon, Pin, Sparkles, Users, X, Zap,
} from "lucide-react";
import type { Member, Priority, TaskStatus } from "../lib/types";
import { PRIORITY_META, STATUS_META, cls } from "../lib/utils";

export function Avatar({
  member, size = "md", title,
}: { member?: Member | null; size?: "sm" | "md" | "lg"; title?: string }) {
  if (!member) return <span className={cls("avatar", size)} style={{ background: "#333a55" }}>?</span>;
  return (
    <span
      className={cls("avatar", size, member.kind === "ai" && "ai")}
      title={title ?? `${member.name} · ${member.role}`}
      style={{ background: member.color, color: member.kind === "ai" ? "#04121b" : "#06101f" }}
    >
      {member.kind === "ai" ? <Bot size={size === "sm" ? 12 : size === "lg" ? 20 : 15} strokeWidth={2.4} /> : member.initials}
    </span>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="pill" style={{ background: m.soft, color: m.color }}>
      <i style={{ width: 5, height: 5, borderRadius: 9, background: m.color }} /> {m.label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span className="pill" style={{ background: m.soft, color: m.color }}>
      <Flag size={9} /> {m.label}
    </span>
  );
}

export function Meter({ value, tone = "" }: { value: number; tone?: string }) {
  return (
    <div className={cls("meter", tone)}>
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Modal({
  title, subtitle, icon, onClose, children, footer, wide,
}: {
  title: string; subtitle?: string; icon?: React.ReactNode; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { width: "min(760px, 94vw)" } : undefined}>
        <div className="modal-head">
          <div style={{ width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(139,124,255,.16)", color: "var(--violet)", flex: "0 0 auto" }}>
            {icon ?? <Sparkles size={16} />}
          </div>
          <div style={{ flex: 1 }}>
            <h3>{title}</h3>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><X size={15} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({
  icon, title, right, hint,
}: { icon?: React.ReactNode; title: string; right?: React.ReactNode; hint?: string }) {
  return (
    <div className="spread" style={{ marginTop: 2 }}>
      <div className="card-title" style={{ fontSize: 13.5 }}>
        {icon} {title} {hint && <span className="tiny muted" style={{ fontWeight: 400 }}>· {hint}</span>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return <div className="empty">{icon ?? <FolderOpen size={26} />}<p>{text}</p></div>;
}

export function FileBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    doc: { label: "DOC", color: "#4C8DFF" },
    sheet: { label: "XLS", color: "#35E0A1" },
    slide: { label: "PPT", color: "#FFC24D" },
    pdf: { label: "PDF", color: "#FF6B8A" },
    image: { label: "IMG", color: "#FF7BA9" },
    folder: { label: "DIR", color: "#8B7CFF" },
    other: { label: "FILE", color: "#9AA7C7" },
  };
  const m = map[type] ?? map.other;
  return (
    <span className="file-ico" style={{ background: `${m.color}22`, color: m.color }}>
      <span style={{ fontSize: 8.5, fontWeight: 800 }}>{m.label}</span>
    </span>
  );
}

export const ICONS = { ArrowRight, Check, Clock, CalendarDays, MessageSquare, Paperclip, PaperclipIcon, Pin, Users, Zap };
