import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export async function GET(req: NextRequest) {
  const API_BASE =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3000";
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const resp = await fetch(`${API_BASE}/tracked-stations`, {
    method: "GET",
    headers: { "x-request-id": reqId },
  });
  const data = await resp.json();
  return NextResponse.json(data, {
    status: resp.status,
    headers: { "x-request-id": reqId },
  });
}
