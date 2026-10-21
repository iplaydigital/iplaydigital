import { NextResponse } from "next/server";
import { getBootstrap } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getBootstrap();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[bootstrap]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
