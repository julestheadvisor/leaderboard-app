import { NextResponse } from "next/server";
import { addGroup } from "@/lib/leaderboard-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name : "";
    return NextResponse.json(await addGroup(name), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add group." },
      { status: 400 },
    );
  }
}
