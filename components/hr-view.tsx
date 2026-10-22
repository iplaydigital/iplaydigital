"use client";

import React, { useMemo, useState } from "react";
import {
  Briefcase, CalendarCheck, CalendarPlus, Check, Clock, Coffee, DoorOpen, ExternalLink,
  MapPin, Navigation, Plus, ShieldCheck, Timer, Users, X, XCircle, Plane, Home, MonitorSmartphone,
} from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Empty, Modal } from "./ui";
import { textOn } from "../lib/utils";
import type { LeaveType } from "../lib/types";
import { LEAVE_META, addDays, cls, d2s, pad, thaiDate, thaiShort, thaiTime, relTime } from "../lib/utils";

type Tab = "checkin" | "leave" | "rooms" | "team";

export function HrView() {
  const { data } = useApp();
  const [tab, setTab] = useState<Tab>("checkin");
  if (!data) return null;

  const today = data.today;
  const todayCheckins = data.checkins.filter((c) => c.at.slice(0, 10) === today);
  const pending = data.leaves.filter((l) => l.status === "pending");

  return (
    <div className="page">
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="tabs">
          <button className={tab === "checkin" ? "on" : ""} onClick={() => setTab("checkin")}><MapPin size={13} /> เช็คอิน / ลงเวลา</button>
          <button className={tab === "leave" ? "on" : ""} onClick={() => setTab("leave")}><Plane size={13} /> การลา {!!pending.length && <span className="badge">{pending.length}</span>}</button>
          <button className={tab === "rooms" ? "on" : ""} onClick={() => setTab("rooms")}><DoorOpen size={13} /> จองห้องประชุม</button>
          <button className={tab === "team" ? "on" : ""} onClick={() => setTab("team")}><Users size={13} /> ทีม & เวลาทำงาน</button>
        </div>
        <div className="row tiny muted">
          <Clock size={11} /> เวลาทำงาน {data.settings.workStart}–{data.settings.workEnd} · รัศมีเช็คอินออฟฟิศ {data.settings.office.radius} ม.
        </div>
      </div>

      {tab === "checkin" && <CheckinTab />}
      {tab === "leave" && <LeaveTab />}
      {tab === "rooms" && <RoomsTab />}
      {tab === "team" && <TeamTab />}

      <div className="grid-3">
        <SumCard icon={<MapPin size={14} />} label="เช็คอินวันนี้" value={`${todayCheckins.length}/${data.members.filter((m) => m.kind === "human").length}`} />
        <SumCard icon={<Home size={14} />} label="WFH / นอกสถานที่" value={`${todayCheckins.filter((c) => c.mode !== "office").length} คน`} />
        <SumCard icon={<Plane size={14} />} label="ใบลารออนุมัติ" value={`${pending.length} ใบ`} />
      </div>
    </div>
  );
}

function SumCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(108,92,231,.14)", color: "var(--violet)" }}>{icon}</span>
      <div><b style={{ fontSize: 16 }}>{value}</b><div className="tiny muted">{label}</div></div>
    </div>
  );
}

/* ── check-in ─────────────────────────────────────────────── */
function CheckinTab() {
  const { data, act, toast } = useApp();
  const [form, setForm] = useState({ mode: "office" as "office" | "remote" | "onsite", place: "", note: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  const office = data.settings.office;
  const distance = coords
    ? Math.round(
        Math.sqrt(
          ((coords.lat - office.lat) * 111320) ** 2 +
            ((coords.lng - office.lng) * 111320 * Math.cos((office.lat * Math.PI) / 180)) ** 2,
        ),
      )
    : 0;

  const locate = () => {
    if (!navigator.geolocation) return toast("เบราว์เซอร์ไม่รองรับ geolocation", "err");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast("ดึงพิกัดปัจจุบันแล้ว — เลือกสถานที่หรือแนบ Google Maps", "ok");
      },
      () => {
        setCoords({ lat: office.lat, lng: office.lng });
        setLocating(false);
        toast("ไม่ได้รับอนุญาตตำแหน่ง — ใช้พิกัดออฟฟิศแทน", "err");
      },
      { timeout: 8000 },
    );
  };

  const submit = async () => {
    setBusy(true);
    const lat = coords?.lat ?? office.lat;
    const lng = coords?.lng ?? office.lng;
    await act({
      type: "hr.checkin",
      checkin: {
        userId: data.meId,
        mode: form.mode,
        place: form.place || (form.mode === "office" ? office.name : "นอกสถานที่"),
        lat, lng,
        distance: coords ? distance : 0,
        note: form.note,
        mapUrl: `https://maps.google.com/?q=${lat},${lng}`,
      },
    });
    toast("เช็คอินสำเร็จ — บันทึกเวลาและพิกัด Google Maps แล้ว", "ok");
    setForm({ mode: "office", place: "", note: "" });
    setBusy(false);
  };

  const today = data.checkins.filter((c) => c.at.slice(0, 10) === data.today);

  return (
    <div className="grid-2" style={{ gridTemplateColumns: "1fr 1.25fr" }}>
      <div className="card">
        <div className="card-head"><div className="card-title"><MapPin size={14} /> เช็คอิน / ลงเวลา</div><div className="right tiny muted">{thaiDate(data.today, { weekday: true })}</div></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="seg" style={{ width: "100%" }}>
            {([["office", "ที่ออฟฟิศ"], ["remote", "WFH"], ["onsite", "นอกสถานที่"]] as const).map(([k, l]) => (
              <button key={k} className={form.mode === k ? "on" : ""} style={{ flex: 1 }} onClick={() => setForm({ ...form, mode: k })}>{l}</button>
            ))}
          </div>
          <label className="field">
            <span className="label">สถานที่</span>
            <input className="input" placeholder={form.mode === "office" ? office.name : "เช่น Mekong Coffee HQ — อโศก"} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">หมายเหตุ</span>
            <input className="input" placeholder="เช่น พบลูกค้า / สำรวจโลเคชัน" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={locate} disabled={locating}>
              <Navigation size={12} /> {locating ? "กำลังหาพิกัด…" : "ดึงพิกัดปัจจุบัน"}
            </button>
            <span className="tiny muted">{coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "ยังไม่ได้แนบพิกัด"}</span>
          </div>
          <div className="map-card">
            <iframe
              title="map"
              src={`https://maps.google.com/maps?q=${coords?.lat ?? office.lat},${coords?.lng ?? office.lng}&z=15&output=embed`}
              loading="lazy"
            />
          </div>
          <div className="spread tiny muted">
            <span><MapPin size={10} /> ระยะห่างจากออฟฟิศ {coords ? `${distance.toLocaleString()} ม.` : "—"}</span>
            <a className="link-btn" href={`https://maps.google.com/?q=${coords?.lat ?? office.lat},${coords?.lng ?? office.lng}`} target="_blank" rel="noreferrer">
              เปิด Google Maps <ExternalLink size={10} />
            </a>
          </div>
          <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={() => void submit()} disabled={busy}>
            <Check size={14} /> ยืนยันเช็คอิน
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title"><CalendarCheck size={14} /> รายการเช็คอินวันนี้</div><div className="right tiny muted">{today.length} รายการ</div></div>
        <div className="card-body" style={{ maxHeight: 520, overflowY: "auto" }}>
          {today.map((c) => {
            const m = data.members.find((x) => x.id === c.userId);
            return (
              <div key={c.id} className="checkin-row">
                <Avatar member={m} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <b style={{ fontSize: 12 }}>{m?.name}</b>
                    <span className="mode-badge" style={{ background: c.mode === "office" ? "rgba(34,199,147,.16)" : c.mode === "remote" ? "rgba(59,167,255,.16)" : "rgba(255,176,32,.16)", color: c.mode === "office" ? "var(--mint)" : c.mode === "remote" ? "var(--cyan)" : "var(--amber)" }}>
                      {c.mode === "office" ? "ออฟฟิศ" : c.mode === "remote" ? "WFH" : "นอกสถานที่"}
                    </span>
                  </div>
                  <small className="tiny muted">{thaiTime(c.at)} · {c.place}{c.distance ? ` · ${c.distance.toLocaleString()} ม.` : ""}</small>
                  {c.note && <div className="tiny" style={{ color: "var(--text-2)" }}>{c.note}</div>}
                </div>
                <a className="btn btn-sm" href={c.mapUrl} target="_blank" rel="noreferrer"><MapPin size={11} /> แผนที่</a>
              </div>
            );
          })}
          {!today.length && <Empty icon={<MapPin size={22} />} text="ยังไม่มีการเช็คอินวันนี้" />}
        </div>
      </div>
    </div>
  );
}

/* ── leave ────────────────────────────────────────────────── */
function LeaveTab() {
  const { data, act, toast } = useApp();
  const [form, setForm] = useState({ type: "annual" as LeaveType, from: d2s(new Date()), to: d2s(new Date()), reason: "" });
  const [open, setOpen] = useState(false);
  if (!data) return null;

  const days = Math.max(1, Math.round((new Date(form.to).getTime() - new Date(form.from).getTime()) / 86400000) + 1);
  const pending = data.leaves.filter((l) => l.status === "pending");
  const others = data.leaves.filter((l) => l.status !== "pending");

  return (
    <>
      <div className="spread">
        <div className="card-title" style={{ fontSize: 13.5 }}><Plane size={14} /> ระบบขอลา & อนุมัติ</div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={13} /> ยื่นใบลา</button>
      </div>
      <div className="grid-2" style={{ gridTemplateColumns: "1.1fr .9fr" }}>
        <div className="card">
          <div className="card-head"><div className="card-title"><Timer size={14} /> รออนุมัติ</div><div className="right"><span className="pill" style={{ background: "rgba(255,176,32,.16)", color: "var(--amber)" }}>{pending.length} ใบ</span></div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((l) => {
              const m = data.members.find((x) => x.id === l.userId);
              return (
                <div key={l.id} className="room-card">
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar member={m} />
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 12 }}>{m?.name} · {LEAVE_META[l.type].label}</b>
                      <div className="tiny muted">{thaiShort(l.from)} – {thaiShort(l.to)} · {l.days} วัน · ยื่น {relTime(l.createdAt)}</div>
                    </div>
                  </div>
                  <p className="tiny" style={{ color: "var(--text-2)" }}>{l.reason}</p>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn btn-sm btn-mint"
                      onClick={async () => {
                        await act({ type: "hr.leave.decide", id: l.id, status: "approved", approverId: data.meId });
                        toast(`อนุมัติใบลาของ ${m?.nickname} แล้ว — เพิ่มลงปฏิทินทีม`, "ok");
                      }}
                    >
                      <Check size={12} /> อนุมัติ
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        await act({ type: "hr.leave.decide", id: l.id, status: "rejected", approverId: data.meId });
                        toast("ปฏิเสธใบลาแล้ว", "info");
                      }}
                    >
                      <XCircle size={12} /> ปฏิเสธ
                    </button>
                  </div>
                </div>
              );
            })}
            {!pending.length && <Empty icon={<Check size={22} />} text="ไม่มีใบลารออนุมัติ" />}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title"><Briefcase size={14} /> ประวัติการลา</div></div>
          <div className="card-body" style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {others.map((l) => {
              const m = data.members.find((x) => x.id === l.userId);
              return (
                <div key={l.id} className="list-row">
                  <Avatar member={m} size="sm" />
                  <span className="lr-main">
                    <b>{m?.nickname} · {LEAVE_META[l.type].label}</b>
                    <small>{thaiShort(l.from)} – {thaiShort(l.to)} · {l.days} วัน</small>
                  </span>
                  <span className="pill" style={{ background: l.status === "approved" ? "rgba(34,199,147,.16)" : "rgba(255,92,122,.16)", color: l.status === "approved" ? "var(--mint)" : "var(--red)" }}>
                    {l.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {open && (
        <Modal
          title="ยื่นใบลา"
          subtitle={`${form.type === "annual" ? "ลาพักร้อน" : LEAVE_META[form.type].label} · ${days} วัน`}
          icon={<Plane size={16} />}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await act({ type: "hr.leave", leave: { userId: data.meId, type: form.type, from: form.from, to: form.to, days, reason: form.reason } });
                  toast("ยื่นใบลาแล้ว — รอหัวหน้าอนุมัติ", "ok");
                  setOpen(false);
                }}
              >
                <Check size={14} /> ส่งคำขอ
              </button>
            </>
          }
        >
          <div className="grid-2">
            <label className="field">
              <span className="label">ประเภทการลา</span>
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LeaveType })}>
                {Object.entries(LEAVE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">จำนวนวัน</span>
              <input className="input" value={`${days} วัน`} readOnly />
            </label>
            <label className="field">
              <span className="label">ตั้งแต่วันที่</span>
              <input className="input" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: e.target.value > form.to ? e.target.value : form.to })} />
            </label>
            <label className="field">
              <span className="label">ถึงวันที่</span>
              <input className="input" type="date" value={form.to} min={form.from} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span className="label">เหตุผล</span>
            <textarea className="textarea" placeholder="ระบุเหตุผล / แนบใบแพทย์กรณีลาป่วย" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          <div className="side-card" style={{ fontSize: 11 }}>
            <b><CalendarPlus size={12} /> เชื่อมกับปฏิทินทีม</b>
            เมื่ออนุมัติแล้ว ระบบจะแสดงวันลาเป็นอีเวนต์สีชมพูในปฏิทิน และแจ้ง AI ให้ปรับแผนงานอัตโนมัติ
          </div>
        </Modal>
      )}
    </>
  );
}

/* ── rooms ────────────────────────────────────────────────── */
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);

function RoomsTab() {
  const { data, act, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ roomId: data?.rooms[0]?.id ?? "", title: "", date: data?.today ?? d2s(new Date()), start: "14:00", end: "15:00", attendees: 4 });
  if (!data) return null;

  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  return (
    <>
      <div className="spread">
        <div className="card-title" style={{ fontSize: 13.5 }}><DoorOpen size={14} /> ตารางห้องประชุมวันนี้</div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={13} /> จองห้อง</button>
      </div>
      <div className="grid-2" style={{ gridTemplateColumns: "1.35fr .65fr" }}>
        <div className="card">
          <div className="card-head"><div className="card-title"><Clock size={14} /> {thaiDate(data.today, { weekday: true })}</div><div className="right tiny muted">08:00–20:00</div></div>
          <div className="card-body room-timeline">
            {data.rooms.map((r) => (
              <div key={r.id} className="rt-row">
                <div className="rt-name">
                  <span style={{ width: 8, height: 8, borderRadius: 9, background: r.color }} /> {r.name}
                  <span className="tiny muted">· {r.capacity}</span>
                </div>
                <div className="rt-track">
                  {HOURS.map((h) => <span key={h} className="h" style={{ left: `${((h - 8) / 12) * 100}%` }} />)}
                  {data.bookings.filter((b) => b.roomId === r.id && b.date === data.today).map((b) => {
                    const left = ((toMin(b.start) - 480) / 720) * 100;
                    const width = ((toMin(b.end) - toMin(b.start)) / 720) * 100;
                    return (
                      <button
                        key={b.id}
                        className="rt-book"
                        style={{ left: `${left}%`, width: `${width}%`, background: r.color, opacity: b.status === "pending" ? 0.65 : 1 }}
                        title={`${b.title} ${b.start}-${b.end} · ${data.members.find((m) => m.id === b.ownerId)?.name}`}
                        onClick={() => toast(`${b.title} · ${b.start}–${b.end} · จองโดย ${data.members.find((m) => m.id === b.ownerId)?.name}`, "info")}
                      >
                        {b.title} {b.start}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="row tiny muted" style={{ justifyContent: "space-between", marginTop: 4, paddingLeft: 158 }}>
              {[8, 10, 12, 14, 16, 18, 20].map((h) => <span key={h}>{pad(h)}:00</span>)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title"><CalendarCheck size={14} /> การจองของฉัน / ทั้งหมด</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
            {data.bookings.slice(0, 8).map((b) => {
              const room = data.rooms.find((r) => r.id === b.roomId);
              return (
                <div key={b.id} className="list-row">
                  <span className="lr-ico" style={{ background: room?.color, borderRadius: 8, color: "#fff" }}><DoorOpen size={12} /></span>
                  <span className="lr-main">
                    <b>{b.title}</b>
                    <small>{thaiShort(b.date)} · {b.start}–{b.end} · {room?.name}</small>
                  </span>
                  <button className="msg-act" title="ยกเลิกการจอง" onClick={() => void act({ type: "hr.booking.cancel", id: b.id })}><X size={12} /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {data.rooms.map((r) => (
          <div key={r.id} className="room-card">
            <div className="rc-top">
              <span className="room-ico" style={{ background: r.color, color: textOn(r.color) }}><DoorOpen size={15} /></span>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 12 }}>{r.name}</b>
                <div className="tiny muted">{r.floor} · {r.capacity} ที่นั่ง</div>
              </div>
              {r.screen && <MonitorSmartphone size={13} style={{ color: "var(--muted)" }} />}
            </div>
            <div className="amen">{r.amenities.map((a) => <span key={a}>{a}</span>)}</div>
            <button className="btn btn-sm" style={{ justifyContent: "center" }} onClick={() => { setForm({ ...form, roomId: r.id }); setOpen(true); }}>
              <Plus size={12} /> จองห้องนี้
            </button>
          </div>
        ))}
      </div>

      {open && (
        <Modal
          title="จองห้องประชุม"
          subtitle="เพิ่มลงปฏิทินทีมอัตโนมัติ"
          icon={<DoorOpen size={16} />}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await act({ type: "hr.booking", booking: { ...form, ownerId: data.meId } });
                  toast(`จอง ${data.rooms.find((r) => r.id === form.roomId)?.name} ${form.start}–${form.end} แล้ว`, "ok");
                  setOpen(false);
                }}
              >
                <Check size={14} /> ยืนยันการจอง
              </button>
            </>
          }
        >
          <div className="grid-2">
            <label className="field">
              <span className="label">ห้อง</span>
              <select className="select" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                {data.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.capacity} ที่นั่ง</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">จำนวนผู้เข้าร่วม</span>
              <input className="input" type="number" min={1} value={form.attendees} onChange={(e) => setForm({ ...form, attendees: Number(e.target.value) })} />
            </label>
          </div>
          <label className="field">
            <span className="label">หัวข้อประชุม</span>
            <input className="input" placeholder="เช่น รีวิว Key visual LED" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <div className="grid-3">
            <label className="field"><span className="label">วันที่</span><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field"><span className="label">เริ่ม</span><input className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
            <label className="field"><span className="label">สิ้นสุด</span><input className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ── team ─────────────────────────────────────────────────── */
function TeamTab() {
  const { data } = useApp();
  if (!data) return null;
  const humans = data.members.filter((m) => m.kind === "human");
  const today = data.checkins.filter((c) => c.at.slice(0, 10) === data.today);
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-head"><div className="card-title"><Users size={14} /> ภาระงาน & การเข้างาน</div></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {humans.map((m) => {
            const ci = today.find((c) => c.userId === m.id);
            const openTasks = data.tasks.filter((t) => t.assigneeId === m.id && t.status !== "done");
            return (
              <div key={m.id} className="row" style={{ gap: 9 }}>
                <Avatar member={m} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="spread">
                    <b style={{ fontSize: 12 }}>{m.name}</b>
                    <span className="tiny" style={{ color: ci ? (ci.mode === "office" ? "var(--mint)" : "var(--cyan)") : "var(--muted)" }}>
                      {ci ? `${ci.mode === "office" ? "เข้างาน" : ci.mode === "remote" ? "WFH" : "นอกสถานที่"} ${thaiTime(ci.at)}` : "ยังไม่เช็คอิน"}
                    </span>
                  </div>
                  <div className="meter" style={{ marginTop: 4 }}>
                    <i style={{ width: `${Math.min(100, m.load ?? 0)}%`, background: (m.load ?? 0) > 90 ? "var(--red)" : (m.load ?? 0) > 75 ? "var(--amber)" : "var(--mint)" }} />
                  </div>
                  <div className="tiny muted" style={{ marginTop: 3 }}>{openTasks.length} งานในมือ · ภาระงาน {m.load}% · {m.role}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title"><Coffee size={14} /> สรุปการเข้างานสัปดาห์นี้</div></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = d2s(addDays(new Date(), i - 3));
              const count = data.checkins.filter((c) => c.at.slice(0, 10) === d && c.mode === "office").length;
              return (
                <div key={d} style={{ textAlign: "center", background: "var(--tint-1)", borderRadius: 9, padding: "8px 4px" }}>
                  <div className="tiny muted">{thaiShort(d)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: d === data.today ? "var(--violet)" : undefined }}>{count}</div>
                  <div className="tiny muted">คน</div>
                </div>
              );
            })}
          </div>
          <div className="divider" style={{ margin: "14px 0" }} />
          <div className="side-h"><ShieldCheck size={11} /> นโยบาย</div>
          <p className="tiny muted" style={{ lineHeight: 1.6 }}>
            เช็คอินออฟฟิศภายในรัศมี {data.settings.office.radius} ม. จาก Park Silom · WFH ต้องได้รับการอนุมัติ ·
            นอกสถานที่ต้องแนบพิกัด Google Maps · AI สรุปการเข้างานเข้าแชท #all-hands ทุกเช้า 09:30
          </p>
          <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: "wrap" }}>
            <span className="chip"><Home size={11} /> WFH อนุมัติล่วงหน้า</span>
            <span className="chip"><MapPin size={11} /> แนบพิกัดทุกครั้ง</span>
            <span className="chip"><Clock size={11} /> สายเกิน 15 นาที แจ้งหัวหน้า</span>
          </div>
        </div>
      </div>
    </div>
  );
}
