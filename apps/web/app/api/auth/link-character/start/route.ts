import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  const returnUrl =
    req.nextUrl.searchParams.get("returnUrl") || "/account-settings";

  // Redirect the browser directly to the API. This ensures the API
  // receives its own session cookie from the user's browser instead
  // of relying on the Next.js server to forward cookies.
  const target = new URL(`${API_URL}/auth/link-character/start`);
  target.searchParams.set("returnUrl", returnUrl);

  return NextResponse.redirect(target.toString());
}
