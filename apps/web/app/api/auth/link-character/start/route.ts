import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../[...nextauth]/route";

const API_URL = process.env.API_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    // Get the current session to ensure user is authenticated
    const session = await getServerSession(authOptions);

    if (!session || !(session as any).accessToken) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const accessToken = (session as any).accessToken;
    const returnUrl =
      req.nextUrl.searchParams.get("returnUrl") || "/account-settings";

    // Call NestJS /auth/link-character/start with Bearer token
    // NestJS will store state in DB and redirect to EVE SSO (App 2)
    const url = new URL(`${API_URL}/auth/link-character/start`);
    url.searchParams.set("returnUrl", returnUrl);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      redirect: "manual", // Don't follow redirects automatically
    });

    // Get the redirect location (EVE SSO URL)
    const location = response.headers.get("location");

    if (location) {
      // Redirect browser to EVE SSO
      return NextResponse.redirect(location);
    }

    // If no redirect, something went wrong
    return NextResponse.json(
      { error: "Failed to initiate character linking" },
      { status: 500 },
    );
  } catch (error) {
    console.error("Error starting character link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
