import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/api-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  try {
    const { packageId } = await params;
    const body = await request.json();
    const api = await getApiClient();
    const response = await api.post(`/packages/${packageId}/mark-failed`, body);
    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error("Failed to mark package as failed:", error);
    return NextResponse.json(
      { error: "Failed to mark package as failed" },
      { status: 500 },
    );
  }
}
