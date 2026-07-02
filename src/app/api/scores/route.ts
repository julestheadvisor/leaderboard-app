import { NextResponse } from "next/server";
import { addScore } from "@/lib/leaderboard-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { groupId?: unknown; score?: unknown };
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    const score = typeof body.score === "string" ? body.score : "";
    return NextResponse.json(await addScore(groupId, score), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add score." },
      { status: 400 },
    );
  }
}
