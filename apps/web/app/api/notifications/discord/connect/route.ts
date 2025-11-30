import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

export async function GET(req: NextRequest) {
  const returnUrl = req.nextUrl.searchParams.get("returnUrl") ?? undefined;

  const url = new URL(`${API_URL}/notifications/discord/connect`);
  if (returnUrl) url.searchParams.set("returnUrl", returnUrl);

  const res = await fetch(url.toString(), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
    redirect: "manual",
  });

  const location = res.headers.get("location");
  if (location) {
    return NextResponse.redirect(location, { status: 302 });
  }

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
