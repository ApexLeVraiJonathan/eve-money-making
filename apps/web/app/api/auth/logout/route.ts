import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE = process.env.API_URL || "http://localhost:3000";

export async function GET(_req: NextRequest) {
  const reqId = _req.headers.get("x-request-id") || crypto.randomUUID();
  const res = await fetch(`${API_BASE}/auth/logout`, {
    cache: "no-store",
    headers: { "x-request-id": reqId },
  });
  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
    headers: { "x-request-id": reqId },
  });
}
