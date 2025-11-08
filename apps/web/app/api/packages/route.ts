import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/api-client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cycleId = searchParams.get("cycleId");
    const status = searchParams.get("status");

    if (!cycleId) {
      return NextResponse.json(
        { error: "cycleId query parameter is required" },
        { status: 400 },
      );
    }

    const api = await getApiClient();
    const params = new URLSearchParams({ cycleId });
    if (status) {
      params.set("status", status);
    }

    const response = await api.get(`/packages?${params.toString()}`);
    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error("Failed to fetch packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 },
    );
  }
}
