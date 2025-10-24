import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE = process.env.API_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cycleId = url.searchParams.get("cycleId");
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const backend = new URL(`${API_BASE}/ledger/commits/summary`);
    if (cycleId) backend.searchParams.set("cycleId", cycleId);
    const res = await fetch(backend, {
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
      { error: "Failed to load commit summaries", details: `${err}` },
      { status: 500 },
    );
  }
}
