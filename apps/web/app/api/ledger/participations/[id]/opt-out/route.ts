import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(`${API_BASE}/ledger/participations/${id}/opt-out`, {
      method: "POST",
      headers: { "x-request-id": reqId },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: { "x-request-id": reqId } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to opt-out", details: `${err}` }, { status: 500 });
  }
}


