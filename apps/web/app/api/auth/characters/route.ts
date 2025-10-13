import { NextResponse } from "next/server";
import { fetchWithAuthJson } from "@/lib/api-client";

export async function GET() {
  try {
    const characters = await fetchWithAuthJson("/users/me/characters");
    return NextResponse.json({ characters });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Not authenticated") ||
      message.includes("Unauthorized")
    ) {
      return NextResponse.json({ characters: [] }, { status: 200 });
    }
    return NextResponse.json(
      { error: "Failed to fetch characters", details: message },
      { status: 500 },
    );
  }
}
