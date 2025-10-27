import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/api-client";

export async function GET(
  request: NextRequest,
  { params }: { params: { packageId: string } },
) {
  try {
    const api = await getApiClient();
    const response = await api.get(`/packages/${params.packageId}`);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Failed to fetch package details:", error);
    return NextResponse.json(
      {
        error:
          error.response?.data?.message || "Failed to fetch package details",
      },
      { status: error.response?.status || 500 },
    );
  }
}
