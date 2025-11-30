import { type NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  const url = new URL(`${API_URL}/auth/logout`);

  await fetch(url.toString(), {
    method: "GET",
    headers: {
      // Forward cookies so the API can clear the session cookie
      cookie: req.headers.get("cookie") ?? "",
    },
    credentials: "include",
  }).catch(() => null);

  // Ignore API response; always send user back to home
  const redirectTo = new URL("/", req.url);
  return NextResponse.redirect(redirectTo);
}
