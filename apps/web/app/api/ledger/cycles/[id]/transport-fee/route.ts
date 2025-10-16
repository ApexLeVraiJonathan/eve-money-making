import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE = process.env.API_URL || "http://localhost:3000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const resp = await fetch(`${API_BASE}/ledger/cycles/${id}/transport-fee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(error, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to add transport fee",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
