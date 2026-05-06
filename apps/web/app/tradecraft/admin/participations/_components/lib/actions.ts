import { toast } from "@eve/ui";
import { formatIsk } from "./formatting";
import type { ParticipationWithCycle } from "./types";

export type SelectedDonation = {
  characterId: number;
  journalId: string;
};

export async function copyToClipboardAndToast(params: {
  text: string;
  label: string;
  setCopiedText: (value: string | null) => void;
}) {
  const { text, label, setCopiedText } = params;

  try {
    await navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`Copied ${label}!`);
    setTimeout(() => setCopiedText(null), 2000);
  } catch {
    toast.error("Failed to copy");
  }
}

export async function matchParticipationPayment(params: {
  selectedParticipation: string | null;
  selectedDonation: SelectedDonation | null;
  validatePayment: (input: {
    participationId: string;
    walletJournal?: { characterId: number; journalId: string };
  }) => Promise<unknown>;
  clearSelection: () => void;
}) {
  const { selectedParticipation, selectedDonation, validatePayment, clearSelection } = params;

  if (!selectedParticipation || !selectedDonation) {
    toast.error("Please select both a participation and a donation");
    return;
  }

  try {
    await validatePayment({
      participationId: selectedParticipation,
      walletJournal: {
        characterId: selectedDonation.characterId,
        journalId: selectedDonation.journalId,
      },
    });
    toast.success("Payment matched successfully!");
    clearSelection();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to match payment";
    toast.error(msg);
  }
}

export async function confirmParticipationPaid(params: {
  selectedParticipation: string | null;
  validatePayment: (input: { participationId: string }) => Promise<unknown>;
  clearSelection: () => void;
}) {
  const { selectedParticipation, validatePayment, clearSelection } = params;

  if (!selectedParticipation) {
    toast.error("Please select a participation");
    return;
  }

  try {
    await validatePayment({ participationId: selectedParticipation });
    toast.success("Participation confirmed (no journal link).");
    clearSelection();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to confirm participation";
    toast.error(msg);
  }
}

export async function markRefundSent(params: {
  participation: ParticipationWithCycle;
  refundParticipation: (input: { participationId: string; amountIsk: string }) => Promise<unknown>;
}) {
  const { participation, refundParticipation } = params;

  const confirmed = window.confirm(
    `Mark ${formatIsk(participation.amountIsk)} ISK refund as sent to ${participation.characterName}?`,
  );
  if (!confirmed) return;

  try {
    const amount = parseFloat(participation.amountIsk).toFixed(2);
    await refundParticipation({
      participationId: participation.id,
      amountIsk: amount,
    });
    toast.success("Refund marked as sent!");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to mark refund";
    toast.error(msg);
  }
}

export async function markParticipationPayoutSent(params: {
  participation: ParticipationWithCycle;
  markPayoutSent: (participationId: string) => Promise<unknown>;
}) {
  const { participation, markPayoutSent } = params;

  const investment = parseFloat(participation.amountIsk);
  const paidOutNow = parseFloat(participation.payoutAmountIsk ?? "0");
  const rolledOver = parseFloat(participation.rolloverDeductedIsk ?? "0");
  const totalResult = paidOutNow + rolledOver;
  const profitShare = totalResult - investment;

  const confirmed = window.confirm(
    `Mark ${formatIsk(paidOutNow.toString())} ISK payout as sent to ${participation.characterName}?\n\nCycle result:\n- Investment: ${formatIsk(investment.toString())} ISK\n- Rolled over: ${formatIsk(rolledOver.toString())} ISK\n- Payout now: ${formatIsk(paidOutNow.toString())} ISK\n- Return: ${formatIsk(profitShare.toString())} ISK`,
  );
  if (!confirmed) return;

  try {
    await markPayoutSent(participation.id);
    toast.success("Payout marked as sent!");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to mark payout";
    toast.error(msg);
  }
}
