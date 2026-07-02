import { NextResponse } from "next/server";
import { addGroup, editGroup, removeGroup } from "@/lib/leaderboard-store";

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

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { groupId?: unknown; name?: unknown };
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    const name = typeof body.name === "string" ? body.name : "";
    return NextResponse.json(await editGroup(groupId, name));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to edit group." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { groupId?: unknown };
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    return NextResponse.json(await removeGroup(groupId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove group." },
      { status: 400 },
    );
  }
}
