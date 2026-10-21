import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    storage: process.env.DB_HOST ? "mariadb" : "demo",
    time: new Date().toISOString(),
  });
}
