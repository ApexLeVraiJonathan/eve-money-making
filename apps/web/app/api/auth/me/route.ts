import { NextResponse } from "next/server";
import { fetchWithAuthJson } from "@/lib/api-client";

export async function GET() {
  try {
    const data = await fetchWithAuthJson("/auth/me");
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch identity", details: message },
      { status: 500 },
    );
  }
}
