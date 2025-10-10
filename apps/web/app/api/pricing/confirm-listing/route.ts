import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const API_BASE =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3000";
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const resp = await fetch(`${API_BASE}/pricing/confirm-listing`, {
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
