import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  const current = new URL(req.url);
  const qpReturn = current.searchParams.get("returnUrl");
  const referer = req.headers.get("referer");
  const fallback = new URL("/", req.url).toString();
  const returnUrl = qpReturn || referer || fallback;
  const url = new URL(`${API_BASE}/auth/login`);
  url.searchParams.set("returnUrl", returnUrl);
  return NextResponse.redirect(url);
}
