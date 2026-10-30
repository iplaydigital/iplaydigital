"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, CloudUpload, FileBarChart2, FileText, Link2, Loader2, Paperclip,
  Pencil, Plus, Trash2, X,
} from "lucide-react";
import { useApp } from "./providers";
import { Modal } from "./ui";
import { cls, thaiDate } from "../lib/utils";
import type { Report, ReportStatus } from "../lib/types";

const STATUS_META: Record<ReportStatus, { label: string; color: string; soft: string }> = {
  draft: { label: "ฉบับร่าง", color: "#8A8FB1", soft: "rgba(138,143,177,.16)" },
  submitted: { label: "ส่งแล้ว", color: "#2F7BF0", soft: "rgba(59,167,255,.14)" },
  approved: { label: "อนุมัติแล้ว", color: "#149C74", soft: "rgba(34,199,147,.16)" },
};

const emptyDraft = () => ({
  title: "",
  period: new Date().toISOString().slice(0, 7),
  projectId: "",
  status: "draft" as ReportStatus,
  summary: "",
  driveUrl: "",
  attachments: [] as Report["attachments"],
});

/** URL ของ Google Drive → ตรวจรูปแบบไฟล์ */
function driveKind(url: string) {
  if (/docs\.google\.com\/document/.test(url)) return "doc";
  if (/docs\.google\.com\/spreadsheets/.test(url)) return "sheet";
  if (/docs\.google\.com\/presentation/.test(url)) return "slide";
  if (/\.pdf($|\?)/i.test(url)) return "pdf";
  return "other";
}

export function ReportsView() {
  const { me, data, toast, refresh } = useApp();
  const [list, setList] = useState<Report[]>(data?.reports ?? []);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | ReportStatus>("all");
  const [editing, setEditing] = useState<Report | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [confirmDel, setConfirmDel] = useState<Report | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drive, setDrive] = useState<{
    configured: boolean;
    mode: string;
    hint: string;
    folderUrl: string;
    needsUserConnect?: boolean;
  } | null>(null);

  // Manager ขึ้นไปจัดการรายงานของทีมได้ (เดิมตัด role "manager" ออก ทำให้แก้/ลบไม่ได้)
  const manager = me?.role === "admin" || me?.role === "support" || me?.role === "manager";
  // เจ้าของรายงานอาจถูกเก็บเป็น memberId (u_xxx) หรือ userId (usr_xxx) — ต้องตรงทั้งคู่ (+ อีเมล/ชื่อ สำหรับข้อมูลเก่า)
  const mineOf = (r: Report) => {
    if (!me) return false;
    const author = r.authorId ?? "";
    if (author && (author === me.id || author === me.memberId || author === me.email)) return true;
    if (!author && r.authorName && r.authorName === me.name) return true;
    return false;
  };
  const canEditOf = (r: Report) => manager || mineOf(r);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { reports?: Report[]; error?: string };
      if (!res.ok) throw new Error(body.error || "โหลดรายงานไม่ได้");
      setList(body.reports ?? []);
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void fetch("/api/drive/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { drive?: { configured: boolean; mode: string; hint: string; folderUrl: string; needsUserConnect?: boolean } }) =>
        setDrive(b.drive ?? null),
      )
      .catch(() => setDrive(null));
  }, [load]);

  const shown = useMemo(
    () => list.filter((r) => filter === "all" || r.status === filter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [list, filter],
  );

  const openNew = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setLinkInput("");
    setOpen(true);
  };

  const openEdit = (r: Report) => {
    setEditing(r);
    setDraft({
      title: r.title,
      period: r.period,
      projectId: r.projectId || "",
      status: r.status,
      summary: r.summary,
      driveUrl: r.driveUrl || "",
      attachments: r.attachments ?? [],
    });
    setLinkInput("");
    setOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast("ต้องตั้งชื่อรายงานก่อน", "err");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...draft, projectId: draft.projectId || null };
      const res = await fetch(editing ? `/api/reports/${editing.id}` : "/api/reports", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
      toast(editing ? "อัปเดตรายงานแล้ว" : "สร้างรายงานแล้ว", "ok");
      setOpen(false);
      await load();
      void refresh();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  // ใช้ modal ยืนยันในแอป (window.confirm ถูกบล็อกในเว็บวิวของ LINE/Facebook ทำให้กดลบแล้วเงียบ)
  const remove = async (r: Report) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${r.id}`, { method: "DELETE" });
      const b = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || b.ok === false) throw new Error(b.error || "ลบไม่สำเร็จ");
      toast("ลบรายงานแล้ว", "ok");
      setConfirmDel(null);
      await load();
      void refresh();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (r: Report, status: ReportStatus) => {
    const res = await fetch(`/api/reports/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      toast(b.error || "อัปเดตสถานะไม่สำเร็จ", "err");
      return;
    }
    toast(`เปลี่ยนสถานะเป็น “${STATUS_META[status].label}”`, "ok");
    await load();
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url)) {
      toast("ลิงก์ต้องขึ้นต้นด้วย https://", "err");
      return;
    }
    const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "drive-link");
    setDraft((d) => ({
      ...d,
      attachments: [...d.attachments, { id: `at_${Date.now()}`, name, url, mime: driveKind(url) }],
    }));
    setLinkInput("");
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/drive/upload", { method: "POST", body: form });
      const body = (await res.json()) as {
        ok?: boolean; configured?: boolean; error?: string; hint?: string;
        file?: { id: string; name: string; url: string; size: string; mime: string };
      };
      if (body.ok && body.file) {
        setDraft((d) => ({
          ...d,
          attachments: [
            ...d.attachments,
            { id: `at_${Date.now()}`, name: body.file!.name, url: body.file!.url, size: body.file!.size, mime: body.file!.mime, driveId: body.file!.id },
          ],
        }));
        toast("อัปโหลดเข้า Google Drive แล้ว", "ok");
      } else {
        toast(body.hint || body.error || "อัปโหลดไม่สำเร็จ — แนบลิงก์ Drive แทนได้", "err");
      }
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <div className="card-title"><FileBarChart2 size={14} /> รายงานทีม <span className="tiny muted">· {list.length} ฉบับ</span></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="seg">
              {([["all", "ทั้งหมด"], ["draft", "ร่าง"], ["submitted", "ส่งแล้ว"], ["approved", "อนุมัติ"]] as const).map(([k, label]) => (
                <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={13} /> สร้างรายงาน</button>
          </div>
        </div>
        <div className="card-body">
          <div className="drive-status">
            <span className={cls("pill", drive?.configured && !drive?.needsUserConnect ? "ok" : "warn")}>
              <CloudUpload size={10} /> Google Drive · {drive?.configured && !drive?.needsUserConnect ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อม"}
            </span>
            <span className="tiny muted">{drive?.hint ?? "ตรวจสอบสถานะการเชื่อมต่อ Google Drive"}</span>
            {drive?.needsUserConnect && (
              <a className="link-btn" href="/api/auth/google?mode=drive">
                <CloudUpload size={10} /> เชื่อม Drive ของฉัน (Gmail)
              </a>
            )}
            {drive?.mode === "user" && drive?.folderUrl && (
              <a className="link-btn" href={drive.folderUrl} target="_blank" rel="noreferrer">เปิดโฟลเดอร์กลาง</a>
            )}
          </div>

          {loading && <div className="row muted" style={{ gap: 8, padding: 10 }}><Loader2 size={14} className="spin" /> กำลังโหลดรายงาน…</div>}

          {!loading && shown.length === 0 && (
            <div className="empty"><FileText size={26} /><p>ยังไม่มีรายงานในหมวดนี้ — กด “สร้างรายงาน” เพื่อเริ่ม</p></div>
          )}

          <div className="report-list">
            {shown.map((r) => {
              const author = data?.members.find((m) => m.id === r.authorId);
              const project = data?.projects.find((p) => p.id === r.projectId);
              const meta = STATUS_META[r.status];
              const canEdit = canEditOf(r);
              return (
                <article key={r.id} className="report-card">
                  <div className="rp-top">
                    <span className="code-chip">{r.code}</span>
                    <span className="pill" style={{ background: meta.soft, color: meta.color }}>{meta.label}</span>
                    {project && <span className="chip">{project.code} · {project.name}</span>}
                    <span className="tiny muted" style={{ marginLeft: "auto" }}>อัปเดต {thaiDate(r.updatedAt.slice(0, 10), { short: true })}</span>
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.summary || "— ยังไม่มีสรุป —"}</p>
                  <div className="rp-foot">
                    <span className="tiny muted">โดย {author?.name ?? r.authorName ?? "—"} · งวด {r.period}</span>
                    <div className="row" style={{ gap: 6 }}>
                      {r.attachments.map((a) => (
                        <a key={a.id} className="pill soft-link" href={a.url} target="_blank" rel="noreferrer" title={a.url}>
                          <Paperclip size={9} /> {a.name.length > 26 ? a.name.slice(0, 24) + "…" : a.name}
                        </a>
                      ))}
                      {!canEdit && (
                        <span className="pill" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>อ่านเท่านั้น</span>
                      )}
                      {canEdit && (
                        <>
                          {manager && r.status !== "approved" && (
                            <button className="btn btn-sm btn-mint" onClick={() => void setStatus(r, "approved")} title="อนุมัติ">
                              <CheckCircle2 size={12} /> อนุมัติ
                            </button>
                          )}
                          <button className="btn btn-sm" onClick={() => openEdit(r)}><Pencil size={12} /> แก้ไข</button>
                          <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => setConfirmDel(r)} title="ลบรายงาน">
                            <Trash2 size={12} /> ลบ
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {confirmDel && (
        <Modal
          title="ลบรายงาน"
          subtitle={confirmDel.code}
          icon={<Trash2 size={16} />}
          onClose={() => setConfirmDel(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDel(null)} disabled={busy}>ยกเลิก</button>
              <button
                className="btn"
                style={{ background: "var(--red)", color: "#fff", border: 0, fontWeight: 600 }}
                disabled={busy}
                onClick={() => void remove(confirmDel)}
              >
                {busy ? <><Loader2 size={13} className="spin" /> กำลังลบ…</> : <><Trash2 size={13} /> ลบรายงาน</>}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 12.5, lineHeight: 1.7 }}>
            ต้องการลบรายงาน <b>“{confirmDel.title}”</b> ใช่หรือไม่?<br />
            <span className="tiny muted">การลบไม่สามารถย้อนกลับได้ — ไฟล์ใน Google Drive จะยังอยู่</span>
          </p>
        </Modal>
      )}

      {open && (
        <Modal
          wide
          title={editing ? "แก้ไขรายงาน" : "สร้างรายงาน"}
          subtitle={editing ? editing.code : "บันทึกเป็นฉบับร่าง แล้วค่อยแนบไฟล์ Drive"}
          icon={<FileBarChart2 size={16} />}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                {busy ? <><Loader2 size={13} className="spin" /> กำลังบันทึก…</> : "บันทึก"}
              </button>
            </>
          }
        >
          <div className="grid-2" style={{ gap: 10 }}>
            <label className="field" style={{ gridColumn: "span 2" }}>
              <span className="label">ชื่อรายงาน</span>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="เช่น สรุปงานรายเดือน Playwall" />
            </label>
            <label className="field">
              <span className="label">งวด (เดือน)</span>
              <input className="input" type="month" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">โปรเจกต์</span>
              <select className="select" value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
                <option value="">— ไม่ระบุ —</option>
                {(data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </label>
            <label className="field" style={{ gridColumn: "span 2" }}>
              <span className="label">สรุปเนื้อหา</span>
              <textarea className="textarea" rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="ผลงาน ความคืบหน้า งบประมาณ หรือสิ่งที่ต้องตัดสินใจ" />
            </label>
            <label className="field" style={{ gridColumn: "span 2" }}>
              <span className="label">โฟลเดอร์ Google Drive ของรายงาน</span>
              <input className="input" value={draft.driveUrl} onChange={(e) => setDraft({ ...draft, driveUrl: e.target.value })} placeholder="https://drive.google.com/drive/folders/…" />
            </label>
            <label className="field">
              <span className="label">สถานะ</span>
              <select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ReportStatus })}>
                <option value="draft">ฉบับร่าง</option>
                <option value="submitted">ส่งแล้ว (รออนุมัติ)</option>
                {/* รายงานที่อนุมัติแล้วต้องแสดงค่าจริง ไม่ให้เผลอถอยสถานะกลับ */}
                {(manager || draft.status === "approved") && (
                  <option value="approved" disabled={!manager}>อนุมัติแล้ว</option>
                )}
              </select>
            </label>
          </div>

          <div className="divider" />

          <div className="spread" style={{ marginBottom: 6 }}>
            <b style={{ fontSize: 12 }}><Paperclip size={12} /> ไฟล์แนบ ({draft.attachments.length})</b>
            <span className="tiny muted">{drive?.configured ? "อัปโหลดเข้า Drive ได้ทันที" : "โหมดลิงก์ — แนบลิงก์ไฟล์ Drive"}</span>
          </div>

          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {draft.attachments.map((a) => (
              <span key={a.id} className="chip">
                <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
                <button
                  className="x-btn"
                  onClick={() => setDraft({ ...draft, attachments: draft.attachments.filter((x) => x.id !== a.id) })}
                  aria-label="ลบไฟล์แนบ"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {draft.attachments.length === 0 && <span className="tiny muted">ยังไม่มีไฟล์แนบ</span>}
          </div>

          <div className="row" style={{ gap: 6 }}>
            <span className="login-input" style={{ flex: 1 }}>
              <Link2 size={13} />
              <input
                className="input"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                placeholder="วางลิงก์ Google Drive / Docs แล้วกด Enter"
              />
            </span>
            <button className="btn btn-sm" onClick={addLink}><Link2 size={12} /> แนบลิงก์</button>
            <label className="btn btn-sm" style={{ cursor: "pointer" }}>
              {uploading ? <Loader2 size={12} className="spin" /> : <CloudUpload size={12} />} อัปโหลดไฟล์
              <input
                type="file"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
              />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
