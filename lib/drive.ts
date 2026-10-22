// ─────────────────────────────────────────────────────────────
//  Google Drive — อัปโหลดไฟล์รายงานเข้าโฟลเดอร์กลาง
//  รองรับ 3 โหมด
//   1) oauth : GOOGLE_DRIVE_CLIENT_ID + CLIENT_SECRET + REFRESH_TOKEN (+ FOLDER_ID)
//   2) link  : ยังไม่ตั้งค่า → UI ให้แนบ/แนบลิงก์ไฟล์ Drive เอง (โหมดตัวอย่าง)
// ─────────────────────────────────────────────────────────────
export type DriveMode = "oauth" | "link";

export interface DriveStatus {
  mode: DriveMode;
  configured: boolean;
  folderId: string | null;
  folderUrl: string;
  hint: string;
}

export function driveFolderId(): string | null {
  const raw = process.env.GOOGLE_DRIVE_FOLDER_ID || "";
  return raw.trim() || null;
}

export function driveFolderUrl(): string {
  const id = driveFolderId();
  if (id) return `https://drive.google.com/drive/folders/${id}`;
  return process.env.NEXT_PUBLIC_DRIVE_FOLDER || "https://drive.google.com/drive/folders/1iPlayDigitalWorkspace";
}

export function driveStatus(): DriveStatus {
  const oauth = !!(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN);
  const mode: DriveMode = oauth ? "oauth" : "link";
  return {
    mode,
    configured: mode !== "link",
    folderId: driveFolderId(),
    folderUrl: driveFolderUrl(),
    hint:
      mode === "link"
        ? "ยังไม่ได้ตั้งค่า Google Drive API — ระบบเก็บเป็นลิงก์ไฟล์ (แนบลิงก์ Drive เองได้) ตั้งค่า GOOGLE_DRIVE_* เพื่ออัปโหลดจริง"
        : "อัปโหลดเข้า Google Drive ด้วย OAuth refresh token",
  };
}

async function accessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(12000),
    });
    const j = (await res.json()) as { access_token?: string; error_description?: string };
    if (!res.ok || !j.access_token) throw new Error(j.error_description || "ขอ access token จาก Google ไม่สำเร็จ");
    return j.access_token;
  }

  throw new Error("ยังไม่ได้ตั้งค่า Google Drive (ต้องมี GOOGLE_DRIVE_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN)");
}

export interface DriveUploadResult {
  ok: boolean;
  configured: boolean;
  mode: DriveMode;
  file?: { id: string; name: string; url: string; size: string; mime: string };
  error?: string;
  hint?: string;
}

function humanSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** อัปโหลดไฟล์เข้าโฟลเดอร์กลางด้วย multipart upload */
export async function uploadToDrive(file: {
  name: string;
  type: string;
  bytes: ArrayBuffer;
}): Promise<DriveUploadResult> {
  const st = driveStatus();
  if (!st.configured) {
    return {
      ok: false,
      configured: false,
      mode: st.mode,
      error: "ยังไม่ได้เชื่อมต่อ Google Drive API",
      hint: st.hint,
    };
  }

  try {
    const token = await accessToken();
    const boundary = `ipw${Date.now().toString(36)}`;
    const meta: Record<string, unknown> = { name: file.name };
    if (st.folderId) meta.parents = [st.folderId];

    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
      "utf8",
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const body = Buffer.concat([head, Buffer.from(file.bytes), tail]);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": `multipart/related; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(30000),
      },
    );
    const j = (await res.json()) as { id?: string; name?: string; size?: string; webViewLink?: string; error?: { message?: string } };
    if (!res.ok || !j.id) {
      return { ok: false, configured: true, mode: st.mode, error: j.error?.message || `Drive ตอบกลับ ${res.status}`, hint: st.hint };
    }
    return {
      ok: true,
      configured: true,
      mode: st.mode,
      file: {
        id: j.id,
        name: j.name || file.name,
        url: j.webViewLink || `https://drive.google.com/file/d/${j.id}/view`,
        size: humanSize(Number(j.size || file.bytes.byteLength)),
        mime: file.type || "application/octet-stream",
      },
    };
  } catch (err) {
    return { ok: false, configured: true, mode: st.mode, error: (err as Error).message, hint: st.hint };
  }
}
