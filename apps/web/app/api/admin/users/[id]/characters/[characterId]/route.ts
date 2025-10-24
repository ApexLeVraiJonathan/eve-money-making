import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, characterId } = await params;
  const res = await fetch(
    `${API_URL}/admin/users/${id}/characters/${characterId}`,
    {
      method: "DELETE",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    return NextResponse.json(error, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
