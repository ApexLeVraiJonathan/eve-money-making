import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eve/ui";
import { ArrowLeftRight, DollarSign, Link as LinkIcon, Loader2 } from "lucide-react";
import { formatIsk } from "../lib/formatting";
import type { ParticipationWithCycle } from "../lib/types";

type Donation = {
  characterId: number;
  journalId: string;
  characterName?: string | null;
  amount: string;
  description?: string | null;
  date: string;
};

export function ManualMatchingCard({
  awaitingPayment,
  unmatchedDonations,
  selectedParticipation,
  setSelectedParticipation,
  selectedDonation,
  setSelectedDonation,
  onManualMatch,
  onManualConfirmPaid,
  isPending,
}: {
  awaitingPayment: ParticipationWithCycle[];
  unmatchedDonations: Donation[];
  selectedParticipation: string | null;
  setSelectedParticipation: (value: string | null) => void;
  selectedDonation: { characterId: number; journalId: string } | null;
  setSelectedDonation: (value: { characterId: number; journalId: string } | null) => void;
  onManualMatch: () => void;
  onManualConfirmPaid: () => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          Manual Payment Matching
        </CardTitle>
        <CardDescription>
          Select a participation and a donation to manually link them
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Awaiting Payment</h3>
              <Badge variant="secondary" className="text-xs">
                {awaitingPayment.length}
              </Badge>
            </div>
            <div className="rounded-lg border max-h-[400px] overflow-y-auto bg-muted/20">
              {awaitingPayment.length === 0 ? (
                <div className="p-8 text-center">
                  <LinkIcon className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No participations awaiting payment
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {awaitingPayment.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedParticipation(p.id)}
                      className={`p-3 cursor-pointer transition-all ${
                        selectedParticipation === p.id
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{p.characterName}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatIsk(p.amountIsk)} ISK
                      </div>
                      <div className="text-xs font-mono text-muted-foreground mt-1 truncate">
                        {p.memo}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Unmatched Donations</h3>
              <Badge variant="secondary" className="text-xs">
                {unmatchedDonations.length}
              </Badge>
            </div>
            <div className="rounded-lg border max-h-[400px] overflow-y-auto bg-muted/20">
              {unmatchedDonations.length === 0 ? (
                <div className="p-8 text-center">
                  <DollarSign className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No unmatched donations</p>
                </div>
              ) : (
                <div className="divide-y">
                  {unmatchedDonations.map((d, idx) => (
                    <div
                      key={`${d.characterId}-${d.journalId}-${idx}`}
                      onClick={() =>
                        setSelectedDonation({
                          characterId: d.characterId,
                          journalId: d.journalId,
                        })
                      }
                      className={`p-3 cursor-pointer transition-all ${
                        selectedDonation?.journalId === d.journalId
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {d.characterName || `Character ${d.characterId}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatIsk(d.amount)} ISK
                      </div>
                      <div className="text-xs font-mono text-muted-foreground mt-1 truncate">
                        {d.description || "(no memo)"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(d.date).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <Button
              onClick={onManualMatch}
              disabled={!selectedParticipation || !selectedDonation || isPending}
              size="lg"
              className="gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4" />
                  Link Selected Payment
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onManualConfirmPaid}
              disabled={!selectedParticipation || isPending}
              size="lg"
            >
              Mark Selected as Paid (no link)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
