"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, Expand, Flag, Layers,
  MapPin, Maximize2, Minimize2, Plus, Rows3, Sparkles, Users, X,
} from "lucide-react";
import { useApp } from "./providers";
import type { CalendarEvent, EventCat } from "../lib/types";
import {
  CAT_META, CAT_ORDER, addDays, addMonths, cls, d2s, pad, relDay, s2d,
  startOfWeek, thaiDate, thaiFull, thaiShort, thaiTime, BE, TH_DOW, TH_MONTHS,
} from "../lib/utils";

type CalView = "month" | "week" | "day" | "agenda";
const START_H = 7;
const END_H = 21;
const ROW_H = 52;

export function CalendarView() {
  const { data, act, openEvent, openTask, toast, now } = useApp();
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [miniCursor, setMiniCursor] = useState<Date>(new Date());
  const [cats, setCats] = useState<Set<EventCat>>(new Set(CAT_ORDER));
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const allEvents = useMemo<CalendarEvent[]>(() => {
    if (!data) return [];
    const linked = new Set(data.events.map((e) => e.taskId).filter(Boolean));
    const derived: CalendarEvent[] = data.tasks
      .filter((t) => t.due && !linked.has(t.id))
      .map((t) => ({
        id: `derived_${t.id}`,
        title: `เดดไลน์: ${t.title}`,
        date: t.due,
        cat: "work",
        projectId: t.projectId,
        taskId: t.id,
        important: t.priority === "urgent",
      }));
    return [...data.events, ...derived];
  }, [data]);

  const evs = useMemo(
    () => allEvents.filter((e) => cats.has(e.cat)),
    [allEvents, cats],
  );
  const onDate = (ds: string) => evs.filter((e) => e.date === ds).sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

  const move = async (id: string, date: string, time?: string) => {
    if (id.startsWith("derived_")) {
      await act({ type: "task.update", id: id.replace("derived_", ""), patch: { due: date } });
    } else {
      await act({ type: "event.move", id, date, time });
    }
    toast(`ย้ายอีเวนต์ไป ${thaiDate(date, { short: true })}${time ? ` ${time}` : ""}`, "ok");
  };

  const openEv = (e: CalendarEvent) => {
    if (e.id.startsWith("derived_") && e.taskId) openTask(e.taskId);
    else openEvent({ event: e });
  };

  const toggleCat = (c: EventCat) => {
    setCats((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next.size ? next : new Set(CAT_ORDER);
    });
  };

  const fullscreen = async () => {
    if (!wrapRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapRef.current.requestFullscreen();
        setIsFs(true);
      } else {
        await document.exitFullscreen();
        setIsFs(false);
      }
    } catch {
      toast("เบราว์เซอร์ไม่อนุญาตให้เต็มจอ", "err");
    }
  };

  if (!data) return null;

  const title =
    view === "day"
      ? thaiFull(cursor)
      : `${TH_MONTHS[cursor.getMonth()]} ${BE(cursor.getFullYear())}`;

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayStr = d2s(now);

  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const go = (dir: number) => {
    if (view === "month" || view === "agenda") setCursor((c) => addMonths(c, dir));
    else if (view === "week") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => addDays(c, dir));
  };

  return (
    <div className="cal-page" ref={wrapRef} style={{ background: "var(--bg)", height: "100%" }}>
      <div className="cal-main">
        <div className="cal-toolbar">
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" onClick={() => go(-1)} aria-label="ก่อนหน้า"><ChevronLeft size={16} /></button>
            <button className="icon-btn" onClick={() => go(1)} aria-label="ถัดไป"><ChevronRight size={16} /></button>
          </div>
          <div className="cal-title">
            {title}
            <small>{view === "month" ? `${TH_MONTHS[cursor.getMonth()]} พ.ศ. ${BE(cursor.getFullYear())}` : thaiDate(cursor, { short: true })} · {evs.length} รายการที่แสดง</small>
          </div>
          <button className="btn btn-sm" onClick={() => { setCursor(new Date()); setMiniCursor(new Date()); }}>วันนี้</button>
          <div className="seg">
            {([["month", "เดือน"], ["week", "สัปดาห์"], ["day", "วัน"], ["agenda", "กำหนดการ"]] as [CalView, string][]).map(([k, l]) => (
              <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto" }} className="row">
            <button className="btn btn-sm" onClick={() => openEvent({ date: d2s(cursor) })}><Plus size={12} /> เพิ่มอีเวนต์</button>
            <button className="icon-btn" onClick={() => void fullscreen()} title="เต็มจอ (Fullscreen API)">
              {isFs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>

        <div className="cal-scroll">
          {view === "month" && (
            <>
              <div className="cal-dow-row">
                {TH_DOW.map((d, i) => <div key={d} className={cls("cal-dow", (i === 0 || i === 6) && "weekend")}>{d}</div>)}
              </div>
              <div className="cal-grid">
                {cells.map((d) => {
                  const ds = d2s(d);
                  const list = onDate(ds);
                  const isToday = ds === todayStr;
                  return (
                    <DropCell over={over} setOver={setOver} dragId={dragId} move={move}
                      key={ds}
                      date={ds}
                      className={cls("cal-cell", d.getMonth() !== cursor.getMonth() && "out", (d.getDay() === 0 || d.getDay() === 6) && "weekend", isToday && "today")}
                    >
                      <div className="spread" style={{ alignItems: "flex-start" }}>
                        <span className="cal-num">{d.getDate()}</span>
                        <button className="add-hint" onClick={(e) => { e.stopPropagation(); openEvent({ date: ds }); }}><Plus size={11} /></button>
                      </div>
                      <div className="ev-list">
                        {list.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className={cls("cal-ev", dragId === e.id && "dragging")}
                            draggable
                            onDragStart={(ev) => { setDragId(e.id); ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDragId(null); setOver(null); }}
                            onClick={(ev) => { ev.stopPropagation(); openEv(e); }}
                            style={{
                              borderLeftColor: CAT_META[e.cat].color,
                              background: CAT_META[e.cat].soft,
                              color: CAT_META[e.cat].color,
                              boxShadow: e.important ? `inset 0 0 0 1px ${CAT_META[e.cat].color}66` : undefined,
                            }}
                            title={`${e.title}${e.time ? " · " + e.time : ""}`}
                          >
                            {e.important && <Flag size={8} />}
                            {e.time && <span className="t">{e.time}</span>}
                            <span>{e.title}</span>
                          </div>
                        ))}
                        {list.length > 3 && <span className="cal-more">+{list.length - 3} รายการ</span>}
                      </div>
                    </DropCell>
                  );
                })}
              </div>
            </>
          )}

          {view === "week" && (
            <div className="week-wrap">
              <div className="week-head">
                <div className="wh" />
                {weekDays.map((d) => {
                  const ds = d2s(d);
                  return (
                    <div key={ds} className={cls("wh", ds === todayStr && "today")}>
                      {TH_DOW[d.getDay()]}<b>{d.getDate()}</b>
                    </div>
                  );
                })}
              </div>
              <div className="all-day-row">
                <div className="wh tiny muted" style={{ display: "grid", placeItems: "center", fontSize: 9 }}>ทั้งวัน</div>
                {weekDays.map((d) => {
                  const ds = d2s(d);
                  const allDay = onDate(ds).filter((e) => !e.time);
                  return (
                    <DropCell over={over} setOver={setOver} dragId={dragId} move={move} key={ds} date={ds} className="ad-cell">
                      {allDay.map((e) => (
                        <div
                          key={e.id}
                          className="cal-ev"
                          draggable
                          onDragStart={(ev) => { setDragId(e.id); ev.dataTransfer.setData("text/plain", e.id); }}
                          onClick={() => openEv(e)}
                          style={{ background: CAT_META[e.cat].soft, color: CAT_META[e.cat].color, borderLeftColor: CAT_META[e.cat].color }}
                          title={e.title}
                        >
                          <span>{e.title}</span>
                        </div>
                      ))}
                    </DropCell>
                  );
                })}
              </div>
              <div className="week-body">
                <div className="hours-col">
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <div key={i} className="hour-label">{pad(START_H + i)}:00</div>
                  ))}
                </div>
                {weekDays.map((d) => {
                  const ds = d2s(d);
                  return (
                    <div key={ds} className="week-col">
                      {Array.from({ length: END_H - START_H }, (_, i) => {
                        const hh = START_H + i;
                        const time = `${pad(hh)}:00`;
                        const timed = onDate(ds).filter((e) => e.time && Number(e.time.slice(0, 2)) === hh);
                        return (
                          <DropCell over={over} setOver={setOver} dragId={dragId} move={move} key={time} date={ds} time={time} className={cls("week-slot", ds === todayStr && "today")}>
                            {timed.map((e) => {
                              const startMin = Number(e.time!.slice(0, 2)) * 60 + Number(e.time!.slice(3, 5));
                              const endMin = e.endTime ? Number(e.endTime.slice(0, 2)) * 60 + Number(e.endTime.slice(3, 5)) : startMin + 60;
                              const top = ((startMin - hh * 60) / 60) * ROW_H;
                              const height = Math.max(22, ((endMin - startMin) / 60) * ROW_H - 3);
                              return (
                                <div
                                  key={e.id}
                                  className="week-ev"
                                  draggable
                                  onDragStart={(ev) => { setDragId(e.id); ev.dataTransfer.setData("text/plain", e.id); }}
                                  onClick={(ev) => { ev.stopPropagation(); openEv(e); }}
                                  style={{
                                    top: top + 1, height,
                                    background: CAT_META[e.cat].soft,
                                    borderLeftColor: CAT_META[e.cat].color,
                                    color: CAT_META[e.cat].color,
                                  }}
                                  title={`${e.time}–${e.endTime ?? ""} ${e.title}`}
                                >
                                  <b>{e.title}</b>
                                  <small>{e.time}{e.endTime ? `–${e.endTime}` : ""}</small>
                                </div>
                              );
                            })}
                          </DropCell>
                        );
                      })}
                      {ds === todayStr && now.getHours() >= START_H && now.getHours() < END_H && (
                        <div className="now-line" style={{ top: ((now.getHours() * 60 + now.getMinutes() - START_H * 60) / 60) * ROW_H }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "day" && (
            <div className="week-wrap">
              <div className="week-head" style={{ gridTemplateColumns: "58px 1fr" }}>
                <div className="wh" />
                <div className={cls("wh", d2s(cursor) === todayStr && "today")}>
                  {thaiFull(cursor)}
                  <b style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{onDate(d2s(cursor)).length} รายการ</b>
                </div>
              </div>
              <div className="all-day-row" style={{ gridTemplateColumns: "58px 1fr" }}>
                <div className="tiny muted" style={{ display: "grid", placeItems: "center", fontSize: 9 }}>ทั้งวัน</div>
                <DropCell over={over} setOver={setOver} dragId={dragId} move={move} date={d2s(cursor)} className="ad-cell">
                  {onDate(d2s(cursor)).filter((e) => !e.time).map((e) => (
                    <div key={e.id} className="cal-ev" draggable onDragStart={(ev) => { setDragId(e.id); ev.dataTransfer.setData("text/plain", e.id); }} onClick={() => openEv(e)}
                      style={{ background: CAT_META[e.cat].soft, color: CAT_META[e.cat].color, borderLeftColor: CAT_META[e.cat].color }}>
                      <span>{e.title}</span>
                    </div>
                  ))}
                </DropCell>
              </div>
              <div className="week-body" style={{ gridTemplateColumns: "58px 1fr" }}>
                <div className="hours-col">
                  {Array.from({ length: END_H - START_H }, (_, i) => <div key={i} className="hour-label">{pad(START_H + i)}:00</div>)}
                </div>
                <div className="week-col">
                  {Array.from({ length: END_H - START_H }, (_, i) => {
                    const hh = START_H + i;
                    const time = `${pad(hh)}:00`;
                    const timed = onDate(d2s(cursor)).filter((e) => e.time && Number(e.time.slice(0, 2)) === hh);
                    return (
                      <DropCell over={over} setOver={setOver} dragId={dragId} move={move} key={time} date={d2s(cursor)} time={time} className="week-slot" style={{ height: ROW_H }}>
                        {timed.map((e) => {
                          const startMin = Number(e.time!.slice(0, 2)) * 60 + Number(e.time!.slice(3, 5));
                          const endMin = e.endTime ? Number(e.endTime.slice(0, 2)) * 60 + Number(e.endTime.slice(3, 5)) : startMin + 60;
                          const top = ((startMin - hh * 60) / 60) * ROW_H;
                          const height = Math.max(24, ((endMin - startMin) / 60) * ROW_H - 3);
                          return (
                            <div key={e.id} className="week-ev" draggable onDragStart={(ev) => { setDragId(e.id); ev.dataTransfer.setData("text/plain", e.id); }}
                              onClick={(ev) => { ev.stopPropagation(); openEv(e); }}
                              style={{ top: top + 1, height, background: CAT_META[e.cat].soft, borderLeftColor: CAT_META[e.cat].color, color: CAT_META[e.cat].color, left: 8, right: 8 }}>
                              <b style={{ fontSize: 12 }}>{e.title}</b>
                              <small>{e.time}{e.endTime ? `–${e.endTime}` : ""}{e.location ? ` · ${e.location}` : ""}</small>
                            </div>
                          );
                        })}
                      </DropCell>
                    );
                  })}
                  {d2s(cursor) === todayStr && now.getHours() >= START_H && now.getHours() < END_H && (
                    <div className="now-line" style={{ top: ((now.getHours() * 60 + now.getMinutes() - START_H * 60) / 60) * ROW_H }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {view === "agenda" && <Agenda events={evs} cursor={cursor} today={todayStr} onOpen={openEv} onDrag={setDragId} onMove={move} />}
        </div>
      </div>

      {/* ── sidebar ─────────────────────────────────────── */}
      <aside className="cal-side">
        <div className="mini-cal card">
          <div className="mini-cal-head">
            <b>{TH_MONTHS[miniCursor.getMonth()]} {BE(miniCursor.getFullYear())}</b>
            <div className="row" style={{ gap: 2 }}>
              <button className="msg-act" onClick={() => setMiniCursor(addMonths(miniCursor, -1))}><ChevronLeft size={12} /></button>
              <button className="msg-act" onClick={() => setMiniCursor(addMonths(miniCursor, 1))}><ChevronRight size={12} /></button>
            </div>
          </div>
          <div className="mini-grid">
            {TH_DOW.map((d) => <div key={d} className="dow">{d}</div>)}
            {Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(new Date(miniCursor.getFullYear(), miniCursor.getMonth(), 1)), i)).map((d) => {
              const ds = d2s(d);
              return (
                <button
                  key={ds}
                  className={cls("mini-d", d.getMonth() !== miniCursor.getMonth() && "out", ds === todayStr && "today", ds === d2s(cursor) && "sel")}
                  onClick={() => { setCursor(d); setMiniCursor(new Date(d)); }}
                >
                  {d.getDate()}
                  {onDate(ds).length > 0 && <i className="d" />}
                </button>
              );
            })}
          </div>
          <button className="btn btn-sm" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={() => { setCursor(new Date()); setMiniCursor(new Date()); }}>
            กลับไปวันนี้
          </button>
        </div>

        <div>
          <div className="side-h"><Layers size={11} /> หมวดอีเวนต์</div>
          <div className="cat-filter">
            {CAT_ORDER.map((c) => (
              <button key={c} className={cls("cat-pill", !cats.has(c) && "off")} onClick={() => toggleCat(c)}>
                <span className="dot" style={{ background: CAT_META[c].color }} /> {CAT_META[c].label}
                <span className="tiny muted">{allEvents.filter((e) => e.cat === c).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="side-h"><Clock size={11} /> กำลังจะมาถึง</div>
          {evs
            .filter((e) => e.date >= todayStr)
            .sort((a, b) => (a.date + (a.time || "00")).localeCompare(b.date + (b.time || "00")))
            .slice(0, 7)
            .map((e) => (
              <button key={e.id} className="up-item" style={{ textAlign: "left", width: "100%" }} onClick={() => openEv(e)}>
                <div className="up-date"><b>{Number(e.date.slice(8))}</b><small>{TH_DOW[s2d(e.date).getDay()]}</small></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: CAT_META[e.cat].color }}>{e.title}</p>
                  <small>{e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ""}` : "ทั้งวัน"} · {relDay(e.date)}</small>
                </div>
              </button>
            ))}
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ gap: 7, marginBottom: 6 }}>
            <span style={{ color: "var(--violet)" }}><Sparkles size={13} /></span>
            <b style={{ fontSize: 11.5 }}>AI ช่วยจัดตาราง</b>
          </div>
          <p className="tiny muted" style={{ lineHeight: 1.5 }}>ลากอีเวนต์ข้ามวันได้ทันที เดดไลน์งานทุกชิ้นขึ้นปฏิทินอัตโนมัติ และ AI เตือนงานที่ชนกันให้</p>
          <button className="btn btn-sm" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={() => void fullscreen()}>
            <Expand size={12} /> ขยายเต็มจอ
          </button>
        </div>
      </aside>
    </div>
  );
}

function Agenda({
  events, cursor, today, onOpen, onDrag, onMove,
}: {
  events: CalendarEvent[]; cursor: Date; today: string;
  onOpen: (e: CalendarEvent) => void; onDrag: (id: string) => void; onMove: (id: string, date: string) => void;
}) {
  const days = Array.from({ length: 21 }, (_, i) => d2s(addDays(new Date(cursor.getFullYear(), cursor.getMonth(), 1), i)));
  const grouped = days
    .map((ds) => ({ ds, list: events.filter((e) => e.date === ds).sort((a, b) => (a.time || "00").localeCompare(b.time || "00")) }))
    .filter((g) => g.list.length || g.ds === today);
  return (
    <div className="agenda">
      {grouped.map((g) => (
        <div key={g.ds} className={cls("agenda-day", g.ds === today && "agenda-today")}>
          <div className="ad-date">
            <b style={{ color: g.ds === today ? "var(--violet)" : undefined }}>{s2d(g.ds).getDate()}</b>
            <small>{TH_DOW[s2d(g.ds).getDay()]} · {thaiShort(g.ds)}</small>
            {g.ds === today && <span className="pill" style={{ background: "rgba(108,92,231,.16)", color: "var(--violet)", marginTop: 3 }}>วันนี้</span>}
          </div>
          <div>
            {g.list.length ? g.list.map((e) => (
              <div
                key={e.id}
                className="agenda-ev"
                draggable
                onDragStart={(ev) => { onDrag(e.id); ev.dataTransfer.setData("text/plain", e.id); }}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={(ev) => { ev.preventDefault(); onMove(e.id, g.ds); }}
                onClick={() => onOpen(e)}
                style={{ borderLeftColor: CAT_META[e.cat].color, background: CAT_META[e.cat].soft }}
              >
                <span style={{ width: 62, fontVariantNumeric: "tabular-nums", fontSize: 10.5, color: CAT_META[e.cat].color, fontWeight: 700 }}>
                  {e.time ?? "ทั้งวัน"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{e.title}</b>
                  <small>
                    {CAT_META[e.cat].label}
                    {e.location ? <> · <MapPin size={8} /> {e.location}</> : null}
                    {e.taskId ? " · จากงาน" : ""}
                  </small>
                </div>
                {e.important && <Flag size={11} style={{ color: "var(--red)" }} />}
              </div>
            )) : <p className="tiny muted" style={{ padding: "8px 0" }}>ไม่มีรายการ</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function DropCell({
  date, time, className, style, children, over, setOver, dragId, move,
}: {
  date: string; time?: string; className?: string; style?: React.CSSProperties;
  children: React.ReactNode; over: string | null;
  setOver: (v: string | null) => void; dragId: string | null;
  move: (id: string, date: string, time?: string) => Promise<void>;
}) {
  const key = date + (time ?? "");
  return (
    <div
      className={cls(className, over === key && "drop")}
      style={style}
      onDragOver={(e) => { e.preventDefault(); if (over !== key) setOver(key); }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(null);
        const id = dragId || e.dataTransfer.getData("text/plain");
        if (id) void move(id, date, time);
      }}
      onClick={() => { /* cell click handled by children */ }}
    >
      {children}
    </div>
  );
}
