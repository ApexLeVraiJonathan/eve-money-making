import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterId = url.searchParams.get("characterId");
    const qs = characterId
      ? `?characterId=${encodeURIComponent(characterId)}`
      : "";
    const res = await fetch(`${API_BASE}/wallet-import/transactions${qs}`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch transactions", details: `${err}` },
      { status: 500 }
    );
  }
}
