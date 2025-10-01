import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  const returnUrl = new URL("/characters", req.url)
    .toString()
    .replace("/auth/login", "");
  const url = new URL(`${API_BASE}/auth/login`);
  url.searchParams.set("returnUrl", returnUrl);
  return NextResponse.redirect(url);
}
