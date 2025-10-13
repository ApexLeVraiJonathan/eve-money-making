import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/api-client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await req.json();
    const res = await fetchWithAuth(`/admin/users/${id}/link-character`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: message.includes("Not authenticated") ? 401 : 500 },
    );
  }
}
