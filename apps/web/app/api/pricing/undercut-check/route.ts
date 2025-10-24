import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const API_BASE = process.env.API_URL || "http://localhost:3000";
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const resp = await fetch(`${API_BASE}/pricing/undercut-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": reqId },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return NextResponse.json(data, {
    status: resp.status,
    headers: { "x-request-id": reqId },
  });
}
