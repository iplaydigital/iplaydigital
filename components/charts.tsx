"use client";

import React from "react";

export function LineChart({
  series, labels, colors = ["#8B7CFF", "#35E0A1"], height = 170, yFmt,
}: {
  series: number[][]; labels: string[]; colors?: string[]; height?: number; yFmt?: (v: number) => string;
}) {
  const w = 520;
  const h = height;
  const pad = { l: 34, r: 8, t: 12, b: 22 };
  const max = Math.max(1, ...series.flat()) * 1.15;
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (iw / Math.max(1, labels.length - 1)) * i;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = (vals: number[]) =>
    `${path(vals)} L ${x(vals.length - 1)} ${pad.t + ih} L ${x(0)} ${pad.t + ih} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        {series.map((_, i) => (
          <linearGradient key={i} id={`lg${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity="0.32" />
            <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} stroke="rgba(255,255,255,.06)" strokeDasharray="3 5" />
          <text x={pad.l - 6} y={pad.t + ih * f + 3} textAnchor="end" fontSize="8" fill="#626c8a">
            {yFmt ? yFmt(Math.round(max * (1 - f))) : Math.round(max * (1 - f))}
          </text>
        </g>
      ))}
      {series.map((vals, i) => (
        <g key={i}>
          <path d={area(vals)} fill={`url(#lg${i})`} />
          <path d={path(vals)} fill="none" stroke={colors[i % colors.length]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {vals.map((v, j) => (
            <circle key={j} cx={x(j)} cy={y(v)} r="2.6" fill="#0d1120" stroke={colors[i % colors.length]} strokeWidth="1.8" />
          ))}
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={l + i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="8.5" fill="#626c8a">{l}</text>
      ))}
    </svg>
  );
}

export function BarChart({
  values, labels, height = 170, color = "#8B7CFF", yFmt,
}: { values: number[]; labels: string[]; height?: number; color?: string; yFmt?: (v: number) => string }) {
  const w = 520;
  const h = height;
  const pad = { l: 34, r: 8, t: 12, b: 22 };
  const max = Math.max(1, ...values) * 1.18;
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const bw = iw / values.length - 12;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {[0, 0.33, 0.66, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} stroke="rgba(255,255,255,.06)" strokeDasharray="3 5" />
          <text x={pad.l - 6} y={pad.t + ih * f + 3} textAnchor="end" fontSize="8" fill="#626c8a">
            {yFmt ? yFmt(Math.round(max * (1 - f))) : Math.round(max * (1 - f))}
          </text>
        </g>
      ))}
      {values.map((v, i) => {
        const bh = (v / max) * ih;
        const bx = pad.l + (iw / values.length) * i + 6;
        return (
          <g key={i}>
            <rect x={bx} y={pad.t + ih - bh} width={bw} height={bh} rx="4" fill="url(#bg1)" />
            <text x={bx + bw / 2} y={pad.t + ih - bh - 4} textAnchor="middle" fontSize="8" fill="#c3c9de">{v}</text>
            <text x={bx + bw / 2} y={h - 6} textAnchor="middle" fontSize="8.5" fill="#626c8a">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  items, size = 148, centerTop, centerBottom,
}: { items: { label: string; value: number; color: string }[]; size?: number; centerTop: string | number; centerBottom: string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="13" />
        {items.map((it) => {
          const len = (it.value / total) * c;
          const el = (
            <circle
              key={it.label}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={it.color} strokeWidth="13" strokeLinecap="round"
              strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{centerTop}</div>
          <div style={{ fontSize: 9.5, color: "var(--muted)" }}>{centerBottom}</div>
        </div>
      </div>
    </div>
  );
}

export function WorkloadBars({
  rows,
}: { rows: { name: string; role: string; color: string; value: number; initials: string; ai?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((r) => {
        const tone = r.value > 95 ? "var(--red)" : r.value > 80 ? "var(--amber)" : "var(--mint)";
        return (
          <div key={r.name} className="row" style={{ gap: 9 }}>
            <span className="avatar sm" style={{ background: r.color, color: r.ai ? "#04121b" : "#06101f", borderRadius: r.ai ? 8 : 99 }}>
              {r.ai ? "AI" : r.initials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="spread" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{r.name}</span>
                <span className="tiny muted">{r.value}%</span>
              </div>
              <div className="meter">
                <i style={{ width: `${Math.min(100, r.value)}%`, background: tone }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Spark({ values, color = "#8B7CFF" }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="spark">
      {values.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, ${color}33)` }} />
      ))}
    </div>
  );
}
