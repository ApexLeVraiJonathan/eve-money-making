import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const backend = new URL(
      `${API_BASE}/ledger/cycles/${id}/participations/me`,
    );
    if (userId) backend.searchParams.set("userId", userId);
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
      { error: "Failed to load my participation", details: `${err}` },
      { status: 500 },
    );
  }
}
