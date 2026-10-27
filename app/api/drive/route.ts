import { NextResponse } from "next/server";
import { getBootstrap } from "../../../lib/store";
import { driveKind } from "../../../lib/utils";
import { requireModule } from "../../../lib/auth";

export const dynamic = "force-dynamic";

/**
 * Google Drive bridge
 * - ถ้าตั้ง GOOGLE_MCP_URL (เช่น npx @modelcontextprotocol/server-gdrive → SSE/HTTP)
 *   ระบบจะ proxy ไปยัง MCP server ให้ทันที
 * - ถ้าไม่ตั้ง จะคืนไฟล์ที่แชร์ใน Workspace (จาก DB)
 */
export async function GET(req: Request) {
  const { error } = await requireModule("chat");
  if (error) return error;
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").toLowerCase();
  const mcp = process.env.GOOGLE_MCP_URL;

  if (mcp) {
    try {
      const res = await fetch(`${mcp.replace(/\/$/, "")}/files?q=${encodeURIComponent(q)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return NextResponse.json({ source: "mcp", files: await res.json() });
    } catch (err) {
      console.warn("[drive] mcp unavailable", (err as Error).message);
    }
  }

  const data = await getBootstrap();
  const files = data.files
    .filter((f) => !q || f.name.toLowerCase().includes(q))
    .map((f) => ({ ...f, kind: f.type || driveKind(f.url) }));
  return NextResponse.json({ source: "workspace", folder: data.settings.driveFolder, files });
}

export async function POST(req: Request) {
  const { error } = await requireModule("chat");
  if (error) return error;
  // บันทึกไฟล์ที่แชร์จาก Drive picker เข้า workspace
  const body = (await req.json()) as { name?: string; url?: string; size?: string };
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  return NextResponse.json({
    ok: true,
    file: {
      name: body.name || "Shared from Drive",
      url: body.url,
      type: driveKind(body.url),
      size: body.size || "Drive",
    },
    mcp: Boolean(process.env.GOOGLE_MCP_URL),
  });
}
