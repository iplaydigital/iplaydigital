"use client";

// ─────────────────────────────────────────────────────────────
//  ผังองค์กร (Org chart) — บริหารจัดการพนักงานทั้งหมดเป็นแผนภาพ
//   • คอลัมน์ตามแผนก + หัวหน้า (ดาว) + ลูกทีม พร้อมรูปจริง
//   • รูปพนักงาน: ดึงจาก LINE ที่ผูกไว้ หรืออัปโหลดเอง (ย่อรูปฝั่ง client)
//   • กำหนดหัวหน้าโดยตรง (managerId) เพื่อวาดสายบังคับบัญชา
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Camera, ChevronDown, ChevronRight, Loader2, Mail, RefreshCw, Search, Star,
  Trash2, Upload, UserCog, Users, Wand2,
} from "lucide-react";
import { useApp } from "./providers";
import { Modal } from "./ui";
import { cls } from "../lib/utils";

interface OrgPerson {
  id: string;
  name: string;
  nickname: string;
  email: string;
  position: string;
  jobTitle: string;
  level: string;
  role: string;
  avatar: string | null;
  avatarSource: string | null;
  hasLine: boolean;
  linePicture: string | null;
  departmentId: string | null;
  teamId: string | null;
  managerId: string | null;
  active: boolean;
  color: string;
  initials: string;
  children: OrgPerson[];
}

interface OrgColumn {
  id: string;
  name: string;
  short: string;
  color: string;
  lead: OrgPerson | null;
  /** โครงสร้างสายบังคับบัญชา: root แต่ละคนมี children ซ้อนลงไป */
  nodes: OrgPerson[];
  total: number;
  teams: { id: string; name: string; total: number }[];
}

interface ChartPayload {
  ok: boolean;
  columns: OrgColumn[];
  unassigned: OrgPerson[];
  total: number;
  withPhoto: number;
  fromLine: number;
  canEdit: boolean;
  error?: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "ผู้บริหาร / Admin",
  support: "IT / Support",
  manager: "หัวหน้าแผนก",
  ai: "ทีม AI",
  member: "พนักงาน",
};

export function OrgChartView() {
  const { toast, refresh } = useApp();
  const [chart, setChart] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [photoOf, setPhotoOf] = useState<OrgPerson | null>(null);
  const [expand, setExpand] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const syncLine = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/org/line-photos", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { updated?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(body.error || "ดึงรูปจาก LINE ไม่สำเร็จ");
      toast(`ดึงรูปจาก LINE แล้ว ${body.updated ?? 0} คน${body.skipped ? ` · ข้าม ${body.skipped} คน` : ""}`, "ok");
      await load();
      void refresh();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setSyncing(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/org/chart", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as ChartPayload;
      if (!res.ok) throw new Error(body.error || "โหลดผังองค์กรไม่สำเร็จ");
      setChart(body);
    } catch (err) {
      toast((err as Error).message, "err");
      setChart(null);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const matches = useCallback(
    (p: OrgPerson) => {
      const key = q.trim().toLowerCase();
      if (!key) return true;
      return `${p.name} ${p.nickname} ${p.email} ${p.position} ${p.jobTitle}`.toLowerCase().includes(key);
    },
    [q],
  );

  const flatten = useCallback((nodes: OrgPerson[]): OrgPerson[] =>
    nodes.flatMap((n) => [n, ...flatten(n.children)]), []);

  const filterTree = useCallback(
    (nodes: OrgPerson[]): OrgPerson[] => {
      const out: OrgPerson[] = [];
      for (const n of nodes) {
        const kids = filterTree(n.children);
        if (matches(n) || kids.length) out.push({ ...n, children: kids });
      }
      return out;
    },
    [matches],
  );

  const columns = useMemo(() => {
    if (!chart) return [];
    return chart.columns
      .map((c) => ({ ...c, nodes: q ? filterTree(c.nodes) : c.nodes }))
      .filter((c) => !q || c.nodes.length > 0);
  }, [chart, q, filterTree]);

  const allPeople = useMemo(() => {
    if (!chart) return [];
    const list: OrgPerson[] = [];
    for (const c of chart.columns) list.push(...flatten(c.nodes));
    list.push(...chart.unassigned);
    return list;
  }, [chart, flatten]);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="kpi-grid">
        <Kpi icon={<Users size={16} />} grad="var(--grad-violet)" value={chart?.total ?? 0} label="พนักงานในผัง" />
        <Kpi icon={<Building2 size={16} />} grad="var(--grad-cyan)" value={chart?.columns.length ?? 0} label="แผนก" />
        <Kpi icon={<Camera size={16} />} grad="var(--grad-mint)" value={chart?.withPhoto ?? 0} label="มีรูปโปรไฟล์" />
        <Kpi icon={<Wand2 size={16} />} grad="var(--grad-amber)" value={chart?.fromLine ?? 0} label="รูปดึงจาก LINE" />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><Building2 size={14} /> ผังองค์กร &amp; รูปพนักงาน</div>
          <div className="org-toolbar">
            <div className="searchbox" style={{ height: 32, width: 210 }}>
              <Search size={13} />
              <input placeholder="ค้นหาชื่อ / ตำแหน่ง…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn-sm" onClick={() => setExpand((v) => !v)}>
              {expand ? <ChevronDown size={11} /> : <ChevronRight size={11} />} {expand ? "ย่อรายชื่อ" : "ขยายรายชื่อ"}
            </button>
            {chart?.canEdit && (
              <button className="btn btn-sm" onClick={() => void syncLine()} disabled={syncing}>
                {syncing ? <Loader2 size={11} className="spin" /> : <Wand2 size={11} />} ดึงรูปจาก LINE ทั้งทีม
              </button>
            )}
            <button className="btn btn-sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />} รีเฟรช
            </button>
          </div>
        </div>

        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="side-card" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
            <b><Star size={12} /> ดาว = หัวหน้าแผนก</b> · กดที่รูปเพื่อ “ดึงรูปจาก LINE” หรือ “อัปโหลดรูปเอง”
            {chart?.canEdit ? " · กำหนดหัวหน้าโดยตรงได้จากปุ่มหัวข้อในหน้ารูป" : " · ต้องมีสิทธิ์ Admin/Support/Manager เพื่อแก้ไข"}
          </div>

          {loading && !chart && <div className="row muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> กำลังโหลดผังองค์กร…</div>}

          {chart && (
            <div className="org-canvas">
              {columns.map((col) => (
                <div key={col.id} className="org-col">
                  <div className="org-col-head" style={{ color: col.color, borderBottom: `2px solid ${col.color}22` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9, background: col.color }} />
                    {col.name}
                    <span className="org-count">{col.total} คน</span>
                  </div>

                  {col.nodes.length === 0 && <div className="org-empty">ยังไม่มีพนักงานในแผนกนี้</div>}

                  {expand ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {col.nodes.map((p) => (
                        <TreeBranch
                          key={p.id}
                          person={p}
                          depth={0}
                          lead={col.lead?.id === p.id}
                          count={col.lead?.id === p.id ? Math.max(0, col.total - 1) : undefined}
                          onPick={(x) => setPhotoOf(x)}
                        />
                      ))}
                    </div>
                  ) : (
                    col.nodes.slice(0, 1).map((p) => (
                      <PersonNode
                        key={p.id}
                        person={p}
                        lead={col.lead?.id === p.id}
                        onPhoto={() => setPhotoOf(p)}
                        avatarUrl={p.avatar}
                      />
                    ))
                  )}

                  {col.teams.length > 0 && (
                    <div className="tiny muted" style={{ paddingLeft: 2 }}>
                      ทีม: {col.teams.map((t) => `${t.name} (${t.total})`).join(" · ")}
                    </div>
                  )}
                </div>
              ))}

              {chart.unassigned.length > 0 && (
                <div className="org-col">
                  <div className="org-col-head" style={{ color: "var(--muted)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9, background: "var(--muted)" }} />
                    ยังไม่ระบุแผนก
                    <span className="org-count">{chart.unassigned.length} คน</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {chart.unassigned.map((p) => (
                      <PersonNode key={p.id} person={p} onPhoto={() => setPhotoOf(p)} avatarUrl={p.avatar} compact />
                    ))}
                  </div>
                </div>
              )}

              {columns.length === 0 && <div className="org-empty" style={{ flex: 1 }}>ไม่พบพนักงานที่ตรงกับคำค้น</div>}
            </div>
          )}
        </div>
      </div>

      {photoOf && (
        <PhotoModal
          person={photoOf}
          people={allPeople}
          onClose={() => setPhotoOf(null)}
          onSaved={async () => {
            await load();
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function TreeBranch({
  person,
  depth,
  lead,
  count,
  onPick,
}: {
  person: OrgPerson;
  depth: number;
  lead: boolean;
  count?: number;
  onPick: (p: OrgPerson) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: depth ? 10 : 0 }}>
      {depth > 0 && <div style={{ width: 1, height: 4, marginLeft: 14, background: "var(--line)" }} />}
      <PersonNode person={person} lead={lead} count={count} compact={depth > 0} onPhoto={() => onPick(person)} avatarUrl={person.avatar} />
      {person.children.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderLeft: "1px dashed var(--line)", marginLeft: 12, paddingLeft: 8 }}>
          {person.children.map((c) => (
            <TreeBranch key={c.id} person={c} depth={depth + 1} lead={false} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonNode({
  person,
  lead = false,
  compact = false,
  count,
  avatarUrl,
  onPhoto,
}: {
  person: OrgPerson;
  lead?: boolean;
  compact?: boolean;
  count?: number;
  avatarUrl: string | null;
  onPhoto: () => void;
}) {
  return (
    <div className={cls("org-node", lead && "lead")}>
      {lead && <span className="org-star" title="หัวหน้าแผนก"><Star size={11} /></span>}
      <div className="org-node-top">
        <button onClick={onPhoto} title="จัดการรูปโปรไฟล์" style={{ border: 0, background: "none", padding: 0, cursor: "pointer" }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={cls("org-photo", compact && "sm")} src={avatarUrl} alt={person.name} />
          ) : (
            <span className={cls("org-photo", compact && "sm")} style={{ background: person.color }}>
              {person.initials}
            </span>
          )}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="org-name">{person.name}</div>
          <div className="org-role">{person.jobTitle || person.position || ROLE_LABEL[person.role] || "—"}</div>
          <div className="org-role tiny">{person.email}</div>
        </div>
        {count !== undefined && <span className="org-count" title="จำนวนคนในแผนก">{count}</span>}
        {count === undefined && person.children.length > 0 && <span className="org-count">{person.children.length}</span>}
      </div>
      <div className="row" style={{ gap: 5 }}>
        <span className="pill" style={{ fontSize: 9, background: `${person.color}1a`, color: person.color }}>
          {ROLE_LABEL[person.role] ?? person.role}
        </span>
        {person.level && <span className="pill" style={{ fontSize: 9 }}>{person.level}</span>}
        {person.avatarSource === "line" && <span className="pill" style={{ fontSize: 9, background: "rgba(6,199,85,.14)", color: "#06C755" }}>LINE</span>}
        <button className="btn btn-sm" style={{ marginLeft: "auto", padding: "0 7px", height: 22 }} onClick={onPhoto}>
          <Camera size={10} /> รูป
        </button>
      </div>
    </div>
  );
}

function PhotoModal({
  person,
  people,
  onClose,
  onSaved,
}: {
  person: OrgPerson;
  people: OrgPerson[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useApp();
  const [current, setCurrent] = useState<string | null>(person.avatar);
  const [busy, setBusy] = useState<"line" | "upload" | "clear" | "manager" | null>(null);
  const [managerId, setManagerId] = useState(person.managerId ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const call = async (init: RequestInit, kind: typeof busy) => {
    setBusy(kind);
    try {
      const res = await fetch(`/api/staff/${person.id}/photo`, init);
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; avatar?: string | null; error?: string; hint?: string };
      if (!res.ok || body.ok === false) throw new Error([body.error, body.hint].filter(Boolean).join(" — ") || "ดำเนินการไม่สำเร็จ");
      if (body.avatar !== undefined) setCurrent(body.avatar ?? null);
      toast("บันทึกแล้ว", "ok");
      await onSaved();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const pullLine = () =>
    call(
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "line" }) },
      "line",
    );

  const clear = () =>
    call(
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "clear" }) },
      "clear",
    );

  const upload = async (file: File) => {
    const small = await shrinkImage(file);
    const form = new FormData();
    form.append("file", small);
    await call({ method: "POST", body: form }, "upload");
  };

  const saveManager = () =>
    call(
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ managerId: managerId || null }) },
      "manager",
    );

  return (
    <Modal
      title={`รูปโปรไฟล์ · ${person.name}`}
      subtitle={`${person.jobTitle || person.position || ROLE_LABEL[person.role]} · ${person.email}`}
      icon={<Camera size={16} />}
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>ปิด</button>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="photo-preview">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt={person.name} />
          ) : (
            <span className="org-photo" style={{ width: 88, height: 88, borderRadius: 16, background: person.color, fontSize: 22 }}>
              {person.initials}
            </span>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5 }}>
            <b>ที่มาของรูป: {person.avatarSource === "line" ? "LINE" : person.avatarSource === "upload" ? "อัปโหลดเอง" : "ยังไม่มีรูป"}</b>
            <span className="tiny muted">แนะนำรูปสี่เหลี่ยมจัตุรัส ≥ 200×200px · ระบบย่อให้อัตโนมัติก่อนอัปโหลด</span>
            <span className={cls("pill", person.hasLine ? "ok" : "warn")} style={{ alignSelf: "flex-start" }}>
              {person.hasLine ? "ผูก LINE แล้ว — ดึงรูปได้" : "ยังไม่ผูก LINE"}
            </span>
          </div>
        </div>

        <div className="org-photo-tabs">
          <button className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === "upload" ? <Loader2 size={11} className="spin" /> : <Upload size={11} />} อัปโหลดรูปเอง
          </button>
          <button className="btn btn-sm" onClick={() => void pullLine()} disabled={busy !== null || !person.hasLine}>
            {busy === "line" ? <Loader2 size={11} className="spin" /> : <Wand2 size={11} />} ดึงรูปจาก LINE
          </button>
          <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => void clear()} disabled={busy !== null || !current}>
            {busy === "clear" ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />} ลบรูป
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />

        <div className="divider" />

        <div className="field">
          <span className="label"><UserCog size={11} /> หัวหน้าโดยตรง (วาดเส้นสายบังคับบัญชาในผัง)</span>
          <select className="select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">— ไม่ระบุ (อยู่ใต้หัวหน้าแผนก) —</option>
            {people
              .filter((p) => p.id !== person.id)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.jobTitle || p.position || ROLE_LABEL[p.role]}</option>
              ))}
          </select>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm btn-primary" onClick={() => void saveManager()} disabled={busy !== null}>
            {busy === "manager" ? <Loader2 size={11} className="spin" /> : <UserCog size={11} />} บันทึกหัวหน้า
          </button>
          <span className="tiny muted"><Mail size={10} /> {person.email}</span>
        </div>
      </div>
    </Modal>
  );
}

/** ย่อรูปฝั่ง client ก่อนอัปโหลด (สูงสุด 512px, JPEG 0.86) */
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 512;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function Kpi({ icon, grad, value, label }: { icon: React.ReactNode; grad: string; value: React.ReactNode; label: string }) {
  return (
    <div className="kpi">
      <div className="kpi-ico" style={{ background: grad }}>{icon}</div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  );
}
