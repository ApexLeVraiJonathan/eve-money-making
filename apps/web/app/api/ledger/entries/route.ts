import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cycleId = url.searchParams.get("cycleId");
    if (!cycleId)
      return NextResponse.json({ error: "cycleId required" }, { status: 400 });
    const res = await fetch(
      `${API_BASE}/ledger/entries?cycleId=${encodeURIComponent(cycleId)}`,
      {
        cache: "no-store",
        headers: {
          "x-request-id":
            req.headers.get("x-request-id") || crypto.randomUUID(),
        },
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch ledger entries", details: `${err}` },
      { status: 500 }
    );
  }
}
