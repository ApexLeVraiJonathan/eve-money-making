import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/api-client";

export async function POST(
  request: NextRequest,
  { params }: { params: { packageId: string } },
) {
  try {
    const body = await request.json();
    const api = await getApiClient();
    const response = await api.post(
      `/packages/${params.packageId}/mark-failed`,
      body,
    );
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Failed to mark package as failed:", error);
    return NextResponse.json(
      {
        error:
          error.response?.data?.message || "Failed to mark package as failed",
      },
      { status: error.response?.status || 500 },
    );
  }
}
