import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(`${API_BASE}/arbitrage/commit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": reqId },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "x-request-id": reqId },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to commit plan", details: `${err}` },
      { status: 500 },
    );
  }
}
