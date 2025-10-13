import { NextResponse } from "next/server";
import { fetchWithAuthJson } from "@/lib/api-client";

export async function GET() {
  try {
    const data = await fetchWithAuthJson("/users/me/characters");
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Not authenticated")) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json(
      { error: "Failed to fetch characters", details: message },
      { status: 500 },
    );
  }
}
