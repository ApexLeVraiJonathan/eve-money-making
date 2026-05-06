export interface SellAppraiseItem {
  itemName: string;
  quantity: number;
  destinationStationId: number;
  lowestSell: number | null;
  suggestedSellPriceTicked: number | null;
}

export interface SellAppraiseByCommitItem {
  itemName: string;
  typeId: number;
  quantityRemaining: number;
  destinationStationId: number;
  lowestSell: number | null;
  suggestedSellPriceTicked: number | null;
}

export type SellAppraiseResponse = SellAppraiseItem[];
export type SellAppraiseByCommitResponse = SellAppraiseByCommitItem[];

export interface UndercutUpdate {
  orderId: number;
  typeId: number;
  itemName: string;
  remaining: number;
  currentPrice: number;
  competitorLowest: number;
  suggestedNewPriceTicked: number;
  expiresAt?: string;
  expiresInHours?: number;
  isExpiringSoon?: boolean;
  reasons?: Array<"undercut" | "expiry" | "ladder">;
  estimatedMarginPercentAfter?: number;
  estimatedProfitIskAfter?: number;
  wouldBeLossAfter?: boolean;
}

export interface UndercutCheckGroup {
  characterId: number;
  characterName: string;
  stationId: number;
  stationName: string;
  updates: UndercutUpdate[];
}

export type UndercutCheckResponse = UndercutCheckGroup[];
