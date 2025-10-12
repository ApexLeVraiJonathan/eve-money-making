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
    const pct = url.searchParams.get("profitSharePct");
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(
      `${API_BASE}/ledger/cycles/${id}/payouts/suggest${pct ? `?profitSharePct=${encodeURIComponent(pct)}` : ""}`,
      { cache: "no-store", headers: { "x-request-id": reqId } },
    );
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "x-request-id": reqId },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to compute payouts", details: `${err}` },
      { status: 500 },
    );
  }
}
