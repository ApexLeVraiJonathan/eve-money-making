import { NextResponse } from "next/server";
import { fetchWithAuthJson } from "@/lib/api-client";

export async function GET() {
  try {
    const characters = await fetchWithAuthJson("/auth/admin/characters");
    return NextResponse.json(characters);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch characters", details: message },
      { status: 500 },
    );
  }
}
