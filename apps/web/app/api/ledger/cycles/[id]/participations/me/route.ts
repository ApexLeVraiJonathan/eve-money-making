import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const { id } = await context.params;

  if (!session?.accessToken) {
    return NextResponse.json(null);
  }

  const res = await fetch(`${API_URL}/ledger/cycles/${id}/participations/me`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(null);
  }

  // Handle empty response or null
  const text = await res.text();
  if (!text || text === "null") {
    return NextResponse.json(null);
  }

  try {
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null);
  }
}
