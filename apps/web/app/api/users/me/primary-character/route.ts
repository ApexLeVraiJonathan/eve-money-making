import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/api-client";

export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();
    const res = await fetchWithAuth("/users/me/primary-character", {
      method: "PATCH",
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
