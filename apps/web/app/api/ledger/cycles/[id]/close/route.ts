import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(`${API_BASE}/ledger/cycles/${params.id}/close`, {
      method: "POST",
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to close cycle", details: `${err}` },
      { status: 500 }
    );
  }
}
