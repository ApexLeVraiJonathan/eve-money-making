import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const API_BASE =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3000";
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  const resp = await fetch(`${API_BASE}/pricing/commit/${id}/remaining-lines`, {
    method: "GET",
    headers: { "x-request-id": reqId },
  });
  const data = await resp.json();
  return NextResponse.json(data, {
    status: resp.status,
    headers: { "x-request-id": reqId },
  });
}
