import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(
      `${API_BASE}/ledger/cycles/${id}/participations${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { cache: "no-store", headers: { "x-request-id": reqId } },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: { "x-request-id": reqId } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load participations", details: `${err}` }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await req.json();
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(`${API_BASE}/ledger/cycles/${id}/participations`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": reqId },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: { "x-request-id": reqId } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create participation", details: `${err}` }, { status: 500 });
  }
}


