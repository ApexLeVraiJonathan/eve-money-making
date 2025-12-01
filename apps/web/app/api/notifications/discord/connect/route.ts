import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

/**
 * Proxy endpoint that simply redirects the browser to the API's
 * `/notifications/discord/connect` route.
 *
 * IMPORTANT:
 * We intentionally do NOT `fetch` the API from the server here, because that
 * would not include the API's `session` cookie when the API is on a different
 * domain (e.g. `eveapi.apexapps.gg` vs `eve.apexapps.gg`), which causes a 401
 * "Authentication required" error from the CompositeAuthGuard.
 *
 * By issuing a 302 redirect to the API instead, the browser follows the
 * redirect and automatically sends the correct `session` cookie to the API
 * domain, allowing the user to be authenticated and the Discord OAuth flow to
 * proceed.
 */
export async function GET(req: NextRequest) {
  const returnUrl = req.nextUrl.searchParams.get("returnUrl") ?? undefined;

  const url = new URL("/notifications/discord/connect", API_URL);
  if (returnUrl) {
    url.searchParams.set("returnUrl", returnUrl);
  }

  // Just redirect the browser directly to the API; cookies for the API
  // domain will be attached by the browser automatically.
  return NextResponse.redirect(url.toString(), { status: 302 });
}
