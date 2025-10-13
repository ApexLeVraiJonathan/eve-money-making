import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/api-client";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ characterId: string }> },
) {
  try {
    const { characterId } = await params;
    const res = await fetchWithAuth(`/users/me/characters/${characterId}`, {
      method: "DELETE",
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
