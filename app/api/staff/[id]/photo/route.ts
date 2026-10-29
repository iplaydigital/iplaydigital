import { NextResponse } from "next/server";
import { requestMeta, requireUser } from "../../../../../lib/auth";
import { writeAudit } from "../../../../../lib/audit";
import { getUserById, updateUser } from "../../../../../lib/users";
import { roleScope } from "../../../../../lib/rbac";
import { imageUrlAsDataUrl } from "../../../../../lib/line";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

const MAX = 900 * 1024; // ~900KB หลังย่อฝั่ง client แล้ว

/**
 * จัดการรูปพนักงาน (ใช้ในผังองค์กร / ทะเบียนพนักงาน)
 *   POST multipart { file }            → อัปโหลดรูปเอง (เก็บเป็น data URL)
 *   POST json { source: "line" }       → ดึงรูปจากบัญชี LINE ที่ผูกไว้
 *   POST json { source: "clear" }      → ลบรูป
 *   POST json { managerId }            → ตั้งหัวหน้าโดยตรง (สำหรับผังองค์กร)
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const { user, error } = await requireUser();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const canEditSelf = user.id === id;
  if (!roleScope(user.role).manageStaff && !canEditSelf) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์แก้ไขรูปของพนักงานคนนี้" }, { status: 403 });
  }

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";
  const meta = { actor: { id: user.id, name: user.name }, ip: requestMeta(req).ip };

  // ── อัปโหลดไฟล์ ──
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "ต้องแนบไฟล์รูป" }, { status: 400 });
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์รูปภาพ (png, jpg, webp)" }, { status: 415 });
    }
    if (file.size > MAX) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 900 KB — ลองย่อรูปก่อน" }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
    const updated = await updateUser(id, { avatar: dataUrl, avatarSource: "upload" }, meta);
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "user", targetId: id,
      targetName: `${target.name} (${target.email})`, action: "update", note: "อัปโหลดรูปโปรไฟล์ใหม่", ip: meta.ip,
    });
    return NextResponse.json({ ok: true, avatar: updated?.avatar ?? dataUrl, source: "upload" });
  }

  const body = (await req.json().catch(() => ({}))) as { source?: string; managerId?: string | null };

  // ── ตั้งหัวหน้า (ผังองค์กร) ──
  if (body.managerId !== undefined) {
    if (!roleScope(user.role).manageStaff) {
      return NextResponse.json({ error: "เฉพาะ Admin/Support/Manager เท่านั้นที่กำหนดสายบังคับบัญชาได้" }, { status: 403 });
    }
    if (body.managerId === id) return NextResponse.json({ error: "ตั้งตัวเองเป็นหัวหน้าไม่ได้" }, { status: 400 });
    const updated = await updateUser(id, { managerId: body.managerId || null }, meta);
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "user", targetId: id,
      targetName: `${target.name} (${target.email})`, action: "update",
      note: body.managerId ? `กำหนดหัวหน้า: ${body.managerId}` : "ยกเลิกหัวหน้าโดยตรง", ip: meta.ip,
    });
    return NextResponse.json({ ok: true, managerId: updated?.managerId ?? null });
  }

  // ── ลบรูป ──
  if (body.source === "clear") {
    await updateUser(id, { avatar: null, avatarSource: null }, meta);
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "user", targetId: id,
      targetName: `${target.name} (${target.email})`, action: "update", note: "ลบรูปโปรไฟล์", ip: meta.ip,
    });
    return NextResponse.json({ ok: true, avatar: null });
  }

  // ── ดึงรูปจาก LINE ──
  if (body.source === "line") {
    const picture = target.linePicture || target.avatar?.startsWith("https://") ? target.linePicture : null;
    if (!picture) {
      return NextResponse.json(
        { error: "ยังไม่มีรูปจาก LINE — ให้พนักงานผูก LINE ที่หน้าโปรไฟล์ก่อน", hint: "โปรไฟล์ของฉัน → เชื่อมต่อ LINE" },
        { status: 400 },
      );
    }
    const dataUrl = await fetchAsDataUrl(picture);
    if (!dataUrl) return NextResponse.json({ error: "ดึงรูปจาก LINE ไม่สำเร็จ (ลิงก์อาจหมดอายุ)" }, { status: 502 });
    const updated = await updateUser(id, { avatar: dataUrl, avatarSource: "line" }, meta);
    await writeAudit({
      actorId: user.id, actorName: user.name, targetType: "user", targetId: id,
      targetName: `${target.name} (${target.email})`, action: "update", note: "ดึงรูปโปรไฟล์จาก LINE", ip: meta.ip,
    });
    return NextResponse.json({ ok: true, avatar: updated?.avatar ?? dataUrl, source: "line" });
  }

  return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  return imageUrlAsDataUrl(url);
}
