import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@/lib/api-client";

export async function GET(req: NextRequest) {
  try {
    const base = process.env.API_URL || "http://localhost:3000";
    const url = new URL("/admin/users", base);
    const limit = req.nextUrl.searchParams.get("limit");
    const offset = req.nextUrl.searchParams.get("offset");
    if (limit) url.searchParams.set("limit", limit);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetchWithAuth(url.pathname + url.search);
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
