import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    const returnUrl =
      req.nextUrl.searchParams.get("returnUrl") || "/account-settings";

    // Call NestJS /auth/link-character/start; backend will authenticate
    // using the session cookie forwarded via the `cookie` header.
    const target = new URL(`${API_URL}/auth/link-character/start`);
    target.searchParams.set("returnUrl", returnUrl);

    console.log(
      "[link-character/start] API_URL =",
      API_URL,
      "target =",
      target.toString(),
    );

    const response = await fetch(target.toString(), {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
      },
      redirect: "manual", // Don't follow redirects automatically
      credentials: "include",
    });

    const text = await response.text();
    const location = response.headers.get("location");

    console.log(
      "[link-character/start] API response",
      "status =",
      response.status,
      "location =",
      location,
      "body =",
      text,
    );

    if (location) {
      return NextResponse.redirect(location);
    }

    // If no redirect, surface error
    return NextResponse.json(
      { error: "Failed to initiate character linking" },
      { status: 500 },
    );
  } catch (error) {
    console.error(
      "[link-character/start] Error starting character link:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
