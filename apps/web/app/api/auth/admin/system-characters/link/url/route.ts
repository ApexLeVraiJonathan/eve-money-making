import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Server-side proxy to backend API, avoiding hardcoded localhost in client
const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const notes = req.nextUrl.searchParams.get("notes") ?? undefined;
  const returnUrl = req.nextUrl.searchParams.get("returnUrl") ?? undefined;

  const url = new URL(`${API_URL}/auth/admin/system-characters/link/url`);
  if (notes) url.searchParams.set("notes", notes);
  if (returnUrl) url.searchParams.set("returnUrl", returnUrl);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: text || "Upstream error" },
      { status: res.status },
    );
  }
}
