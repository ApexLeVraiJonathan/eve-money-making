export interface WalletTransaction {
  id: string;
  transactionId: bigint;
  characterId: number;
  date: string;
  isBuy: boolean;
  quantity: number;
  typeId: number;
  unitPrice: string;
  clientId: number;
  locationId: number;
  allocated: boolean;
  allocatedToCycleLineId: string | null;
  createdAt: string;
}

export interface WalletJournalEntry {
  id: string;
  journalId: bigint;
  characterId: number;
  date: string;
  refType: string;
  firstPartyId: number | null;
  secondPartyId: number | null;
  amount: string;
  balance: string;
  reason: string | null;
  taxReceiverId: number | null;
  tax: string | null;
  description: string | null;
  createdAt: string;
}
