import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const res = await fetch(
      `${API_BASE}/ledger/cycles/${id}/profit/portfolio`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch portfolio value",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
