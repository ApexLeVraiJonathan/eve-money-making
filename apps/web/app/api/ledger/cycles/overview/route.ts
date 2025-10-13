import { NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:3000";

export async function GET() {
  try {
    // This endpoint is public - no authentication required
    const res = await fetch(`${API_BASE}/ledger/cycles/overview`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load cycles overview", details: `${err}` },
      { status: 500 },
    );
  }
}
