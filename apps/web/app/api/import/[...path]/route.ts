import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    console.log("[POST /api/import] Starting request...");
    const session = await getServerSession(authOptions);

    console.log("[POST /api/import] Session check:", {
      hasSession: !!session,
      hasAccessToken: !!session?.accessToken,
      sessionKeys: session ? Object.keys(session) : [],
      accessTokenPreview: session?.accessToken
        ? session.accessToken.substring(0, 20) + "..."
        : "none",
    });

    if (!session?.accessToken) {
      console.log(
        "[POST /api/import] No session or accessToken - returning 401",
      );
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { path } = await params;
    const endpoint = path.join("/");
    console.log("[POST /api/import] Endpoint:", endpoint);
    const body = await req.json().catch(() => ({}));
    console.log("[POST /api/import] Body:", body);

    const apiUrl = process.env.API_URL || "http://localhost:3000";
    const response = await fetch(`${apiUrl}/import/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    console.log("[POST /api/import] Success, returning data");
    return NextResponse.json(data);
  } catch (error) {
    console.error("[POST /api/import] Error caught:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
