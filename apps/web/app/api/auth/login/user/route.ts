import { type NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  const returnUrl = req.nextUrl.searchParams.get("returnUrl") ?? undefined;

  const url = new URL(`${API_URL}/auth/login/user`);
  if (returnUrl) {
    url.searchParams.set("returnUrl", returnUrl);
  }

  return NextResponse.redirect(url.toString());
}
