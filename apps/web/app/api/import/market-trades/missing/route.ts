import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const res = await fetch(`${API_BASE}/import/market-trades/missing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to backfill missing trades", details: `${err}` },
      { status: 500 }
    );
  }
}
