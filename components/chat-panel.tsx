"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign, Bot, ChevronRight, Cloud, FolderOpen, Hash, Link2, MessageSquare,
  Paperclip, Pause, Pin, PinOff, Play, Plus, Search, Send, Smile, Sparkles,
  Users, X, Zap, FileText, ExternalLink,
} from "lucide-react";
import { useApp, useAiChat } from "./providers";
import { Avatar, Empty, FileBadge, Modal } from "./ui";
import type { Channel, DriveFile, Message } from "../lib/types";
import { cls, driveKind, relTime, thaiTime } from "../lib/utils";
import { agentStatusText } from "../lib/ai";

const EMOJIS = ["👍", "🔥", "🎉", "🙌", "👀", "✅"];

function useMembers() {
  const { data } = useApp();
  return useMemo(() => {
    const map = new Map((data?.members ?? []).map((m) => [m.id, m]));
    return { map, list: data?.members ?? [] };
  }, [data]);
}

export function ChannelList({ compact = false }: { compact?: boolean }) {
  const { data, activeChannel, setActiveChannel, act, toast } = useApp();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  if (!data) return null;
  const channels = data.channels.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const groups = channels.filter((c) => c.type === "group");
  const dms = channels.filter((c) => c.type !== "group");

  const lastOf = (ch: Channel) => {
    const list = data.messages.filter((m) => m.channelId === ch.id);
    return list[list.length - 1];
  };

  return (
    <div className="cp-list" style={compact ? { borderRight: 0, maxHeight: 196, flex: "0 0 auto" } : undefined}>
      <div style={{ padding: "10px 10px 4px", display: "flex", gap: 6, alignItems: "center" }}>
        <div className="searchbox" style={{ height: 32, width: "auto", flex: 1 }}>
          <Search size={13} />
          <input placeholder="ค้นหาแชท…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="icon-btn" style={{ width: 32, height: 32 }} title="สร้างกลุ่มใหม่" onClick={() => setCreating(true)}>
          <Plus size={15} />
        </button>
      </div>
      <div className="ch-list">
        <div className="side-label" style={{ padding: "6px 8px 2px" }}>กลุ่มงาน</div>
        {groups.map((ch) => {
          const last = lastOf(ch);
          return (
            <button key={ch.id} className={cls("ch-row", activeChannel === ch.id && "on")} onClick={() => setActiveChannel(ch.id)}>
              <span className="ch-emoji">{ch.emoji}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b>#{ch.name}</b>
                <small>{last ? `${last.authorId === data.meId ? "คุณ" : data.members.find((m) => m.id === last.authorId)?.nickname ?? ""}: ${last.text.slice(0, 34) || "ไฟล์แนบ"}` : ch.topic ?? "ยังไม่มีข้อความ"}</small>
              </span>
              {!!ch.unread && <span className="unread">{ch.unread}</span>}
            </button>
          );
        })}
        <div className="side-label" style={{ padding: "8px 8px 2px" }}>ข้อความส่วนตัว + AI</div>
        {dms.map((ch) => {
          const other = ch.type === "ai" ? data.members.find((m) => m.kind === "ai" && ch.members.includes(m.id)) : data.members.find((m) => ch.members.includes(m.id) && m.id !== data.meId);
          const last = lastOf(ch);
          return (
            <button key={ch.id} className={cls("ch-row", activeChannel === ch.id && "on")} onClick={() => setActiveChannel(ch.id)}>
              <Avatar member={other} size="sm" />
              <span style={{ minWidth: 0, flex: 1 }}>
                <b>{ch.type === "ai" ? `${ch.emoji} ${ch.name}` : ch.name}</b>
                <small>{last ? (last.authorId === data.meId ? "คุณ: " : "") + (last.text.slice(0, 36) || "ไฟล์แนบ") : "เริ่มบทสนทนา"}</small>
              </span>
              {ch.type === "ai" ? <span className="ai-dot" /> : !!ch.unread && <span className="unread">{ch.unread}</span>}
            </button>
          );
        })}
      </div>
      {creating && <NewChannelModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export function NewChannelModal({ onClose }: { onClose: () => void }) {
  const { data, act, toast } = useApp();
  const [name, setName] = useState("");
  if (!data) return null;
  return (
    <Modal
      title="สร้างกลุ่มแชทใหม่"
      subtitle="แชร์งาน ไฟล์ Google Drive และเรียก AI เข้ากลุ่มได้ทันที"
      icon={<Users size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={async () => {
              await act({ type: "chat.channel", name, members: data.members.map((m) => m.id) });
              toast(`สร้างกลุ่ม #${name.replace(/^#/, "")} แล้ว`);
              onClose();
            }}
          >
            <Plus size={14} /> สร้างกลุ่ม
          </button>
        </>
      }
    >
      <label className="field">
        <span className="label">ชื่อกลุ่ม</span>
        <input className="input" autoFocus placeholder="เช่น park-silom-launch" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field">
        <span className="label">สมาชิก ({data.members.length})</span>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {data.members.map((m) => (
            <span key={m.id} className="chip on"><Avatar member={m} size="sm" /> {m.nickname}</span>
          ))}
        </div>
      </div>
      <div className="side-card" style={{ fontSize: 11 }}>
        <b><Sparkles size={12} /> AI เข้ากลุ่มอัตโนมัติ</b>
        NOVA / BYTE / PIXEL / ECHO จะช่วยสรุปและตอบงานในกลุ่มนี้ — พิมพ์ @nova เมื่อต้องการเรียก
      </div>
    </Modal>
  );
}

export function ChannelStrip() {
  const { data, activeChannel, setActiveChannel } = useApp();
  const [creating, setCreating] = useState(false);
  if (!data) return null;
  return (
    <>
      <div style={{ display: "flex", gap: 5, overflowX: "auto", padding: "7px 10px", borderBottom: "1px solid var(--stroke)", flex: "0 0 auto" }}>
        {data.channels.map((ch) => (
          <button
            key={ch.id}
            className={cls("chip", activeChannel === ch.id && "on")}
            style={{ padding: "4px 8px", fontSize: 10.5, flex: "0 0 auto" }}
            onClick={() => setActiveChannel(ch.id)}
            title={ch.topic ?? ch.name}
          >
            <span>{ch.emoji}</span>
            {ch.type === "group" ? ch.name : ch.name}
            {ch.type === "ai" ? <span className="ai-dot" /> : !!ch.unread ? <span style={{ background: "var(--violet)", color: "#fff", borderRadius: 20, padding: "0 4px", fontSize: 8.5 }}>{ch.unread}</span> : null}
          </button>
        ))}
        <button className="chip" style={{ flex: "0 0 auto", padding: "4px 7px" }} onClick={() => setCreating(true)} title="สร้างกลุ่มใหม่"><Plus size={11} /></button>
      </div>
      {creating && <NewChannelModal onClose={() => setCreating(false)} />}
    </>
  );
}

export function ChatCore({ compact = false }: { compact?: boolean }) {
  const { data, act, activeChannel, toast, go } = useApp();
  const { ask, typing } = useAiChat();
  const [text, setText] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { map } = useMembers();
  const me = data?.members.find((m) => m.id === data?.meId);

  const channel = data?.channels.find((c) => c.id === activeChannel);
  const msgs = useMemo(
    () => (data?.messages ?? []).filter((m) => m.channelId === activeChannel),
    [data, activeChannel],
  );
  const pins = msgs.filter((m) => m.pinned);
  const pinnedTop = pins[pins.length - 1];

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, typing, activeChannel]);

  useEffect(() => {
    if (channel?.unread) void act({ type: "chat.read", channelId: channel.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  if (!data || !channel) return <div className="empty">เลือกห้องแชท</div>;

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setText("");
    setSending(true);
    await act({ type: "chat.send", channelId: channel.id, authorId: data.meId, text: value });
    setSending(false);
    const needsAi = channel.type === "ai" || /@(nova|byte|pixel|echo|orbit|ai)\b/i.test(value);
    if (needsAi) await ask(value, channel.id);
  };

  const shareFile = async (file: DriveFile) => {
    await act({ type: "chat.send", channelId: channel.id, authorId: data.meId, text: "", file });
    toast(`แชร์ ${file.name} เข้า #${channel.name}`, "ok");
  };

  return (
    <div className="chat-pane">
      <div className="chat-head">
        <span style={{ fontSize: 16 }}>{channel.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{channel.type === "group" ? `#${channel.name}` : channel.name}</b>
          <small className="row" style={{ gap: 4 }}>
            {channel.type === "ai" ? (
              <><span className="pulse" /> AI agent · พร้อมรับงานทันที</>
            ) : (
              <><Users size={9} /> {channel.members.length} สมาชิก {channel.topic ? `· ${channel.topic}` : ""}</>
            )}
          </small>
        </div>
        <button className="icon-btn" style={{ width: 30, height: 30, position: "relative" }} title="ข้อความปักหมุด" onClick={() => setShowPins(true)}>
          <Pin size={14} />
          {!!pins.length && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "var(--amber)", color: "#211600", fontSize: 8.5, fontWeight: 800, borderRadius: 20, padding: "0 4px" }}>{pins.length}</span>
          )}
        </button>
        <button className="icon-btn" style={{ width: 30, height: 30 }} title="โฟลเดอร์ Google Drive ของกลุ่ม" onClick={() => window.open(data.settings.driveFolder, "_blank")}>
          <Cloud size={14} />
        </button>
        {compact && (
          <button className="icon-btn" style={{ width: 30, height: 30 }} title="เปิดหน้าแชทเต็ม" onClick={() => go("chat")}>
            <ExternalLink size={13} />
          </button>
        )}
      </div>

      {pinnedTop && (
        <div className="pinned-bar" onClick={() => setShowPins(true)}>
          <Pin size={11} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {pinnedTop.text || pinnedTop.file?.name}
          </span>
          <ChevronRight size={11} />
        </div>
      )}

      <div className="chat-body" ref={bodyRef}>
        <div className="msg system"><div className="bubble">เริ่มต้นการสนทนาใน #{channel.name} · ไฟล์ทั้งหมดเก็บใน Google Drive ของทีม</div></div>
        {msgs.map((m) => (
          <MessageItem key={m.id} msg={m} compact={compact} />
        ))}
        {typing && (
          <div className="msg ai">
            <Avatar member={map.get(typing)} size="sm" />
            <div className="body">
              <div className="who"><b>{map.get(typing)?.name}</b><span className="ai-tag">AI</span><small>กำลังพิมพ์…</small></div>
              <div className="bubble"><span className="typing"><i /><i /><i /></span></div>
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        <div className="composer-row">
          <button className="msg-act" title="แนบไฟล์จาก Google Drive" onClick={() => setShareOpen(true)} style={{ padding: 5 }}>
            <Paperclip size={15} />
          </button>
          <textarea
            rows={1}
            placeholder={channel.type === "ai" ? "สั่งงาน AI เช่น “สรุปงานด่วนวันนี้”" : `ข้อความถึง #${channel.name}…`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(90, e.target.scrollHeight)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="send-btn" disabled={!text.trim() || sending} onClick={() => void send()} aria-label="ส่ง">
            <Send size={14} />
          </button>
        </div>
        <div className="composer-hint">
          <AtSign size={10} /> พิมพ์ @nova @byte @pixel เพื่อเรียก AI · Enter ส่ง / Shift+Enter ขึ้นบรรทัด
        </div>
      </div>

      {showPins && <PinModal pins={pins} onClose={() => setShowPins(false)} />}
      {shareOpen && (
        <ShareDriveModal
          onClose={() => setShareOpen(false)}
          onShare={async (f) => { await shareFile(f); setShareOpen(false); }}
        />
      )}
    </div>
  );
}

function MessageItem({ msg, compact }: { msg: Message; compact: boolean }) {
  const { data, act } = useApp();
  const { map } = useMembers();
  const author = map.get(msg.authorId);
  const mine = msg.authorId === data?.meId;
  if (!data) return null;
  if (msg.kind === "system") return <div className="msg system"><div className="bubble">{msg.text}</div></div>;
  return (
    <div className={cls("msg", mine && "mine", author?.kind === "ai" && "ai")}>
      <Avatar member={author} size="sm" />
      <div className="body" style={{ flex: 1 }}>
        <div className="who">
          <b>{author?.kind === "ai" ? author.name : mine ? "คุณ" : author?.name}</b>
          {author?.kind === "ai" && <span className="ai-tag">AI</span>}
          <small>{thaiTime(msg.at)}</small>
          {msg.pinned && <span className="pin-flag"><Pin size={8} /> ปักหมุด</span>}
        </div>
        {msg.text && <div className="bubble">{msg.text}</div>}
        {msg.file && (
          <a className="file-card" href={msg.file.url} target="_blank" rel="noreferrer" style={{ marginTop: 5, display: "flex" }}>
            <FileBadge type={msg.file.type} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <b>{msg.file.name}</b>
              <small>{msg.file.size} · Google Drive <ExternalLink size={8} /></small>
            </span>
          </a>
        )}
        <div className="msg-actions">
          {EMOJIS.slice(0, 4).map((e) => (
            <button key={e} className="msg-act" onClick={() => void act({ type: "chat.react", id: msg.id, emoji: e, userId: data.meId })}>{e}</button>
          ))}
          <button className="msg-act" onClick={() => void act({ type: "chat.pin", id: msg.id, pinned: !msg.pinned })}>
            {msg.pinned ? <><PinOff size={9} /> เลิกปักหมุด</> : <><Pin size={9} /> ปักหมุด</>}
          </button>
          {msg.file && (
            <a className="msg-act" href={msg.file.url} target="_blank" rel="noreferrer">เปิด Drive</a>
          )}
        </div>
        {!!msg.reactions?.length && (
          <div className="reactions">
            {msg.reactions.map((r) => (
              <button
                key={r.emoji}
                className={cls("reaction", r.users.includes(data.meId) && "mine")}
                onClick={() => void act({ type: "chat.react", id: msg.id, emoji: r.emoji, userId: data.meId })}
                title={r.users.map((u) => map.get(u)?.name).join(", ")}
              >
                {r.emoji} {r.users.length}
              </button>
            ))}
          </div>
        )}
        {!compact && null}
      </div>
    </div>
  );
}

function PinModal({ pins, onClose }: { pins: Message[]; onClose: () => void }) {
  const { data } = useApp();
  const { map } = useMembers();
  return (
    <Modal title="ข้อความที่ปักหมุด" subtitle="เก็บเรื่องสำคัญของทีมไว้บนสุดของห้องแชท" icon={<Pin size={16} />} onClose={onClose}>
      {pins.length ? (
        pins.slice().reverse().map((p) => (
          <div key={p.id} className="list-row" style={{ alignItems: "flex-start", background: "rgba(255,255,255,.03)" }}>
            <Avatar member={map.get(p.authorId)} size="sm" />
            <div className="lr-main">
              <b style={{ whiteSpace: "normal", fontWeight: 500 }}>{p.text || p.file?.name}</b>
              <small>{map.get(p.authorId)?.name} · {relTime(p.at)}</small>
            </div>
          </div>
        ))
      ) : (
        <Empty icon={<Pin size={24} />} text="ยังไม่มีข้อความที่ปักหมุด — กด “ปักหมุด” ใต้ข้อความที่ต้องการ" />
      )}
      {!data && null}
    </Modal>
  );
}

export function ShareDriveModal({
  onClose, onShare,
}: { onClose: () => void; onShare: (f: DriveFile) => Promise<void> }) {
  const { data, toast } = useApp();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const files = data?.files ?? [];

  const doShare = async () => {
    if (!data) return;
    let finalUrl = url.trim();
    const finalName = name.trim() || finalUrl.split("/").pop()?.split("?")[0] || "ไฟล์จาก Drive";
    if (!finalUrl && !name) return toast("วางลิงก์ Google Drive ก่อนนะครับ", "err");
    if (!finalUrl) finalUrl = data.settings.driveFolder;
    setBusy(true);
    await onShare({
      id: `f_${Date.now().toString(36)}`,
      name: finalName,
      type: driveKind(finalUrl),
      url: finalUrl,
      size: "Drive",
      ownerId: data.meId,
      sharedAt: new Date().toISOString(),
    });
    setBusy(false);
  };

  return (
    <Modal
      title="แชร์ไฟล์จาก Google Drive"
      subtitle="วางลิงก์ไฟล์/โฟลเดอร์ หรือเลือกจากไฟล์ที่ทีมแชร์ไว้"
      icon={<Cloud size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void doShare()} disabled={busy}>
            <Paperclip size={13} /> แชร์เข้าแชท
          </button>
        </>
      }
    >
      <div className="side-card" style={{ fontSize: 11 }}>
        <b><Sparkles size={12} /> Google Drive + MCP</b>
        ลิงก์ที่แชร์จะถูกบันทึกเป็นไฟล์ของ Workspace และ AI อ่าน/สรุปเอกสารได้ผ่าน MCP server
        <div style={{ marginTop: 6 }}>
          <button className="link-btn" onClick={() => window.open(data?.settings.driveFolder, "_blank")}>
            <FolderOpen size={11} /> เปิดโฟลเดอร์กลางทีม
          </button>
        </div>
      </div>
      <div className="grid-2">
        <label className="field">
          <span className="label">ชื่อไฟล์</span>
          <input className="input" placeholder="เช่น PRD v3" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">ลิงก์ Google Drive</span>
          <input className="input" placeholder="https://docs.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span className="label">ไฟล์ล่าสุดใน Workspace</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflow: "auto" }}>
          {files.map((f) => (
            <button key={f.id} className="list-row" style={{ background: "rgba(255,255,255,.03)" }} onClick={() => void onShare(f)}>
              <FileBadge type={f.type} />
              <span className="lr-main"><b>{f.name}</b><small>{f.size} · Drive</small></span>
              <Paperclip size={13} style={{ opacity: 0.6 }} />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function FilesPane() {
  const { data } = useApp();
  const [q, setQ] = useState("");
  if (!data) return null;
  const files = data.files.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ padding: 10 }}>
        <div className="side-card" style={{ marginBottom: 8 }}>
          <b><Cloud size={12} /> Google Drive เชื่อมต่อแล้ว</b>
          MCP bridge พร้อมใช้งาน · AI อ่านเอกสารในโฟลเดอร์กลางได้
          <div style={{ marginTop: 7, display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={() => window.open(data.settings.driveFolder, "_blank")}><FolderOpen size={12} /> เปิดโฟลเดอร์</button>
            <button className="btn btn-sm" onClick={() => void fetch("/api/drive").then(() => {})}><Zap size={12} /> ซิงก์</button>
          </div>
        </div>
        <div className="searchbox" style={{ width: "auto" }}>
          <Search size={13} />
          <input placeholder="ค้นหาไฟล์…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div style={{ overflowY: "auto", padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
        {files.map((f) => (
          <a key={f.id} className="file-card" href={f.url} target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,.03)", borderColor: "var(--stroke)" }}>
            <FileBadge type={f.type} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <b>{f.name}</b>
              <small>{f.size} · {relTime(f.sharedAt)}</small>
            </span>
            <ExternalLink size={11} style={{ opacity: 0.5 }} />
          </a>
        ))}
        {!files.length && <Empty icon={<FileText size={22} />} text="ไม่พบไฟล์" />}
      </div>
    </div>
  );
}

export function AiPane() {
  const { data, act, setActiveChannel, toast, go } = useApp();
  if (!data) return null;
  const agents = data.members.filter((m) => m.kind === "ai");
  const quick = ["สรุปงานด่วนวันนี้", "จองห้องประชุม 14:00", "หาไฟล์ PRD ล่าสุด", "งานไหนเลยกำหนดแล้วบ้าง"];
  return (
    <div style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="side-card">
        <b><Bot size={12} /> AI ทำงานคู่กับทีม</b>
        สั่งงานผ่านแชทแล้ว AI จะเริ่มทำงานทันที — ทุก run บันทึกใน AI Console
        <button className="btn btn-sm btn-primary" style={{ marginTop: 8, width: "100%" }} onClick={() => go("ai")}>
          <Sparkles size={12} /> เปิด AI Workforce
        </button>
      </div>
      <div className="side-label" style={{ padding: "4px 2px" }}>AI agents</div>
      {agents.map((a) => (
        <div key={a.id} className="list-row" style={{ background: "rgba(255,255,255,.026)" }}>
          <Avatar member={a} size="sm" />
          <div className="lr-main">
            <b>{a.name}</b>
            <small style={{ color: a.paused ? "var(--amber)" : "var(--mint)" }}>{agentStatusText(data, a)}</small>
          </div>
          <button
            className="icon-btn"
            style={{ width: 26, height: 26 }}
            title={a.paused ? "ปลุก AI" : "พัก AI"}
            onClick={() => void act({ type: "agent.toggle", id: a.id, paused: !a.paused })}
          >
            {a.paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
        </div>
      ))}
      <div className="side-label" style={{ padding: "4px 2px" }}>สั่งงานด่วน</div>
      {quick.map((q) => (
        <button key={q} className="chip" style={{ justifyContent: "flex-start" }} onClick={() => { setActiveChannel("dm_nova"); go("chat"); toast(`ส่งคำสั่งถึง NOVA: ${q}`, "ai"); }}>
          <Zap size={11} /> {q}
        </button>
      ))}
    </div>
  );
}

export function ChatDock() {
  const { dockOpen, setDockOpen, activeChannel } = useApp();
  const [tab, setTab] = useState<"chat" | "files" | "ai">("chat");
  const { map } = useMembers();
  const { data } = useApp();
  const channel = data?.channels.find((c) => c.id === activeChannel);
  const other = channel?.type !== "group" ? data?.members.find((m) => channel?.members.includes(m.id) && m.id !== data?.meId) : null;
  if (!dockOpen) {
    return (
      <aside className="dock collapsed">
        <div className="dock-collapsed-inner">
          <button className="icon-btn" onClick={() => setDockOpen(true)} title="เปิดแชท"><MessageSquare size={16} /></button>
          <button className="icon-btn" onClick={() => { setDockOpen(true); setTab("ai"); }} title="AI"><Bot size={16} /></button>
          <button className="icon-btn" onClick={() => { setDockOpen(true); setTab("files"); }} title="ไฟล์"><Cloud size={16} /></button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="dock">
      <div className="dock-head">
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          {other ? <Avatar member={other} size="sm" /> : <span style={{ fontSize: 15 }}>💬</span>}
          <div>
            <b style={{ fontSize: 12.5 }}>{tab === "chat" ? (other ? other.name : "แชททีม") : tab === "files" ? "Drive & ไฟล์" : "AI Assistant"}</b>
            <small className="tiny muted" style={{ display: "block" }}>{tab === "chat" ? "บอร์ดแชททีม · ปักหมุด · แชร์ไฟล์" : tab === "files" ? "Google Drive ผ่าน MCP" : "AI ทำงานแทนได้จริง"}</small>
          </div>
        </div>
        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setDockOpen(false)} title="ย่อ"><ChevronRight size={14} /></button>
      </div>
      <div className="dock-tabs">
        <button className={cls("dock-tab", tab === "chat" && "on")} onClick={() => setTab("chat")}><MessageSquare size={12} /> แชท</button>
        <button className={cls("dock-tab", tab === "files" && "on")} onClick={() => setTab("files")}><Cloud size={12} /> ไฟล์</button>
        <button className={cls("dock-tab", tab === "ai" && "on")} onClick={() => setTab("ai")}><Bot size={12} /> AI</button>
      </div>
      {tab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <ChannelStrip />
          <ChatCore compact />
        </div>
      )}
      {tab === "files" && <FilesPane />}
      {tab === "ai" && <AiPane />}
      {!map.size && null}
    </aside>
  );
}

export function ChatWorkspace() {
  const { data, activeChannel } = useApp();
  const [tab, setTab] = useState<"pins" | "files" | "members">("pins");
  const msgs = data?.messages.filter((m) => m.channelId === activeChannel) ?? [];
  const pins = msgs.filter((m) => m.pinned);
  if (!data) return null;
  return (
    <div className="chat-page" style={{ flex: 1, minHeight: 0 }}>
      <ChannelList />
      <div className="cp-main">
        <ChatCore />
      </div>
      <aside className="cp-side">
        <div className="cp-sec">
          <div className="tabs" style={{ width: "100%" }}>
            {(["pins", "files", "members"] as const).map((t) => (
              <button key={t} className={tab === t ? "on" : ""} style={{ flex: 1, padding: "5px 6px", fontSize: 11 }} onClick={() => setTab(t)}>
                {t === "pins" ? "ปักหมุด" : t === "files" ? "ไฟล์" : "สมาชิก"}
              </button>
            ))}
          </div>
        </div>
        {tab === "pins" && (
          <div className="cp-sec">
            <h4><Pin size={11} /> ข้อความสำคัญ</h4>
            {pins.length ? pins.slice().reverse().map((p) => (
              <div key={p.id} style={{ marginBottom: 9, paddingBottom: 9, borderBottom: "1px dashed rgba(255,255,255,.07)" }}>
                <p style={{ fontSize: 11.5, lineHeight: 1.5 }}>{p.text || p.file?.name}</p>
                <small className="tiny muted">{data.members.find((m) => m.id === p.authorId)?.name} · {relTime(p.at)}</small>
              </div>
            )) : <p className="tiny muted">ยังไม่มีข้อความปักหมุด</p>}
          </div>
        )}
        {tab === "files" && (
          <div className="cp-sec">
            <h4><Cloud size={11} /> ไฟล์ล่าสุด</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.files.slice(0, 6).map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="list-row" style={{ padding: "5px 2px" }}>
                  <FileBadge type={f.type} />
                  <span className="lr-main"><b style={{ fontSize: 11 }}>{f.name}</b><small>{f.size}</small></span>
                </a>
              ))}
            </div>
            <a className="btn btn-sm" style={{ marginTop: 8, width: "100%", justifyContent: "center" }} href={data.settings.driveFolder} target="_blank" rel="noreferrer">
              <FolderOpen size={12} /> เปิดโฟลเดอร์กลาง
            </a>
          </div>
        )}
        {tab === "members" && (
          <div className="cp-sec">
            <h4><Users size={11} /> สมาชิกใน workspace</h4>
            {data.members.map((m) => (
              <div key={m.id} className="list-row" style={{ padding: "5px 0" }}>
                <Avatar member={m} size="sm" />
                <span className="lr-main"><b style={{ fontSize: 11.5 }}>{m.name}</b><small>{m.role}</small></span>
                {m.kind === "ai" && <span className="pill" style={{ background: "rgba(53,224,161,.14)", color: "var(--mint)" }}>AI</span>}
              </div>
            ))}
          </div>
        )}
        <div className="cp-sec" style={{ marginTop: "auto" }}>
          <div className="side-card">
            <b><Link2 size={12} /> MCP · Google Drive</b>
            AI อ่าน/สรุปเอกสารในโฟลเดอร์กลางได้โดยตรง
            <div className="tiny muted" style={{ marginTop: 5, wordBreak: "break-all" }}>{data.settings.driveFolder}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
