import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Delete all wallet journal entries to allow fresh re-import with new fields
 * USE WITH CAUTION - This is for dev/testing only
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${process.env.API_URL || "http://localhost:3000"}/jobs/wallet/cleanup`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Wallet cleanup failed:", errorText);
      return NextResponse.json(
        { error: "Failed to cleanup wallet journals" },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Wallet cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
