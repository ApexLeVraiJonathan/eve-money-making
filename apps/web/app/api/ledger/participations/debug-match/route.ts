import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Participation = {
  id: string;
  characterName: string;
  amountIsk: string;
  memo?: string | null;
  cycleId: string;
  status: string;
};

type Donation = {
  journalId: string;
  characterId: string;
  characterName: string;
  amount: number;
  description: string;
  date: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get participations
    const partRes = await fetch(
      `${process.env.API_URL || "http://localhost:3000"}/ledger/participations/all`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );

    if (!partRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch participations" },
        { status: partRes.status },
      );
    }

    const participations = await partRes.json();

    // Get unmatched donations
    const donRes = await fetch(
      `${process.env.API_URL || "http://localhost:3000"}/ledger/participations/unmatched-donations`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );

    if (!donRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch donations" },
        { status: donRes.status },
      );
    }

    const donations = await donRes.json();

    // Filter for AWAITING_INVESTMENT
    const awaitingPayment = (participations as Participation[]).filter(
      (p) => p.status === "AWAITING_INVESTMENT",
    );

    return NextResponse.json({
      awaitingPayment: awaitingPayment.map((p) => ({
        id: p.id,
        characterName: p.characterName,
        amountIsk: p.amountIsk,
        memo: p.memo,
        cycleId: p.cycleId,
      })),
      unmatchedDonations: (donations as Donation[]).map((d) => ({
        journalId: d.journalId,
        characterId: d.characterId,
        characterName: d.characterName,
        amount: d.amount,
        description: d.description,
        date: d.date,
      })),
    });
  } catch (error) {
    console.error("Debug match error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
