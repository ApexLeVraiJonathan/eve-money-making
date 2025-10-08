import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(`${API_BASE}/arbitrage/commits`);
    const limit = req.nextUrl.searchParams.get("limit");
    const offset = req.nextUrl.searchParams.get("offset");
    if (limit) url.searchParams.set("limit", limit);
    if (offset) url.searchParams.set("offset", offset);
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "x-request-id": reqId },
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "x-request-id": reqId },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch commits", details: `${err}` },
      { status: 500 },
    );
  }
}
