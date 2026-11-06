"use client";

// ─────────────────────────────────────────────────────────────
//  ป้ายบอกขอบเขตการมองเห็นข้อมูลตามบทบาท
//   "เห็นทั้งหมด" / "ทั้งแผนก" / "เฉพาะงานที่เกี่ยวข้อง"
// ─────────────────────────────────────────────────────────────
import React from "react";
import { Eye, Info } from "lucide-react";
import { useApp } from "./providers";
import { SCOPE_META, scopeLevel, viewerOf } from "../lib/visibility";

export function ScopeBadge({ counts, hint }: { counts?: string; hint?: string }) {
  const { me } = useApp();
  const level = scopeLevel(viewerOf(me));
  const meta = SCOPE_META[level];
  if (!me) return null;

  return (
    <span
      className="scope-badge"
      style={{ background: `${meta.color}14`, color: meta.color, borderColor: `${meta.color}33` }}
      title={hint ?? `${meta.hint}${counts ? ` · ${counts}` : ""}`}
    >
      <Eye size={10} /> {meta.label}
      {counts ? <b>· {counts}</b> : null}
      <Info size={9} style={{ opacity: 0.6 }} />
    </span>
  );
}
