import { NextResponse } from "next/server";
import { applyAction, getBootstrap } from "@/lib/store";
import type { Action } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const action = (await req.json()) as Action;
    if (!action?.type) return NextResponse.json({ error: "missing action type" }, { status: 400 });
    await applyAction(action);
    const data = await getBootstrap();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const dbError = (err as { dbError?: unknown }).dbError ?? null;
    console.error("[action]", err);
    return NextResponse.json(
      { error: (err as Error).message, dbError },
      { status: dbError ? 503 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
