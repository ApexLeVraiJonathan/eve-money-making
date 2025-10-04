import { NextResponse } from "next/server";

export async function GET() {
  const apiBase =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3000";
  const resp = await fetch(`${apiBase}/tracked-stations`, { method: "GET" });
  const data = await resp.json();
  return NextResponse.json(data, { status: resp.status });
}
