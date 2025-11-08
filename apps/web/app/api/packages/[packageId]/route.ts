import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/api-client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  try {
    const { packageId } = await params;
    const api = await getApiClient();
    const response = await api.get(`/packages/${packageId}`);
    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error("Failed to fetch package details:", error);
    return NextResponse.json(
      { error: "Failed to fetch package details" },
      { status: 500 },
    );
  }
}
