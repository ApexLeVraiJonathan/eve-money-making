import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(
      `${API_BASE}/ledger/capital/${id}${force ? `?force=true` : ""}`,
      {
        cache: "no-store",
        headers: { "x-request-id": reqId },
      }
    );
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "x-request-id": reqId },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch capital", details: `${err}` },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const { id } = await params;
    const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
    const res = await fetch(
      `${API_BASE}/ledger/capital/${id}${force ? `?force=true` : ""}`,
      { cache: "no-store", headers: { "x-request-id": reqId } }
    );
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "x-request-id": reqId },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to recompute capital", details: `${err}` },
      { status: 500 }
    );
  }
}
