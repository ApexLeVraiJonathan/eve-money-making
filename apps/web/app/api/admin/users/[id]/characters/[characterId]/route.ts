import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> },
) {
  const { id, characterId } = await params;
  const reqId = _req.headers.get("x-request-id") || crypto.randomUUID();
  const res = await fetch(
    `${API_BASE}/admin/users/${id}/characters/${characterId}`,
    {
      method: "DELETE",
      cache: "no-store",
      headers: { "x-request-id": reqId },
    },
  );
  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
    headers: { "x-request-id": reqId },
  });
}
