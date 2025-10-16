import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE = process.env.API_URL || "http://localhost:3000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const resp = await fetch(`${API_BASE}/ledger/cycles/${id}/snapshots`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
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
        error: "Failed to fetch snapshots",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
