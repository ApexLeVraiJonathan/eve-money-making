import { Injectable } from '@nestjs/common';
import { EsiService } from '@api/esi/esi.service';
import { PrismaService } from '@api/prisma/prisma.service';
import { AppConfig } from '@api/common/config';

export type StructureMarketOrder = {
  is_buy_order: boolean;
  type_id: number;
  price: number;
  volume_remain: number;
};

@Injectable()
export class StructureMarketPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esi: EsiService,
  ) {}

  getSelfMarketStructureId(): bigint | null {
    return AppConfig.marketSelfGather().structureId ?? null;
  }

  bigintToSafeNumber(v: bigint): number | null {
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(v);
  }

  async getBestSellByType(): Promise<Map<number, number> | null> {
    const structureOrders = await this.getStructureOrdersWithSnapshotFallback();
    if (!structureOrders) return null;
    return this.computeBestSellByTypeFromStructureOrders(structureOrders);
  }

  async getSellOrdersByType(): Promise<
    Map<number, Array<{ price: number; volume: number }>>
  > {
    const structureOrders =
      (await this.getStructureOrdersWithSnapshotFallback()) ?? [];
    return this.buildSellsByTypeFromStructureOrders(structureOrders);
  }

  private async getCnStructureMarketCharacterId(): Promise<number | null> {
    // Prefer the SELLER character assigned to C-N in the DB (location=CN),
    // and only if it has a token + structure market scope.
    const requiredScope = 'esi-markets.structure_markets.v1';
    const row = await this.prisma.eveCharacter.findFirst({
      where: {
        function: 'SELLER',
        location: 'CN',
        token: { is: { scopes: { contains: requiredScope } } },
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (row?.id) return row.id;

    // Fallback: use env-configured collector character if it has the required scope.
    const cfgChar = AppConfig.marketSelfGather().characterId ?? null;
    if (!cfgChar) return null;
    const token = await this.prisma.characterToken.findUnique({
      where: { characterId: cfgChar },
      select: { scopes: true },
    });
    const scopes = (token?.scopes ?? '')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!scopes.includes(requiredScope)) return null;
    return cfgChar;
  }

  private async getStructureOrdersWithSnapshotFallback(): Promise<
    StructureMarketOrder[] | null
  > {
    const structureId = this.getSelfMarketStructureId();
    if (structureId === null) return null;

    try {
      const characterId = await this.getCnStructureMarketCharacterId();
      if (characterId) {
        return await this.fetchStructureOrders({ structureId, characterId });
      }
    } catch {
      // Fall back to DB snapshot below.
    }

    const snap = await this.prisma.selfMarketSnapshotLatest.findUnique({
      where: { locationId: structureId },
      select: { orders: true },
    });
    const rawOrders = (snap?.orders ?? []) as unknown as StructureMarketOrder[];
    return Array.isArray(rawOrders) ? rawOrders : [];
  }

  private async fetchStructureOrders(params: {
    structureId: bigint;
    characterId: number;
    forceRefresh?: boolean;
    reqId?: string;
  }): Promise<StructureMarketOrder[]> {
    const path = `/latest/markets/structures/${params.structureId.toString()}/`;
    const first = await this.esi.fetchPaged<StructureMarketOrder[]>(path, {
      characterId: params.characterId,
      forceRefresh: params.forceRefresh,
      reqId: params.reqId,
      page: 1,
    });
    const out: StructureMarketOrder[] = Array.isArray(first.data)
      ? [...first.data]
      : [];
    const totalPages = first.totalPages ?? 1;
    for (let page = 2; page <= totalPages; page++) {
      const { data } = await this.esi.fetchJson<StructureMarketOrder[]>(path, {
        characterId: params.characterId,
        forceRefresh: params.forceRefresh,
        reqId: params.reqId,
        query: { page },
      });
      if (Array.isArray(data) && data.length) out.push(...data);
    }
    return out;
  }

  private computeBestSellByTypeFromStructureOrders(
    orders: StructureMarketOrder[],
  ): Map<number, number> {
    const bestSellByType = new Map<number, number>();
    for (const o of orders) {
      if (!o || o.is_buy_order) continue;
      if (!Number.isFinite(o.type_id) || !Number.isFinite(o.price)) continue;
      if (Number(o.volume_remain) <= 0) continue;
      const prev = bestSellByType.get(o.type_id);
      bestSellByType.set(
        o.type_id,
        prev === undefined ? o.price : Math.min(prev, o.price),
      );
    }
    return bestSellByType;
  }

  private buildSellsByTypeFromStructureOrders(
    orders: StructureMarketOrder[],
  ): Map<number, Array<{ price: number; volume: number }>> {
    const out = new Map<number, Array<{ price: number; volume: number }>>();
    for (const o of orders) {
      if (!o || o.is_buy_order) continue;
      if (!Number.isFinite(o.type_id) || !Number.isFinite(o.price)) continue;
      const vol = Number(o.volume_remain);
      if (!Number.isFinite(vol) || vol <= 0) continue;
      const list = out.get(o.type_id) ?? [];
      list.push({ price: o.price, volume: vol });
      out.set(o.type_id, list);
    }
    for (const [typeId, list] of out.entries()) {
      list.sort((a, b) => a.price - b.price);
      out.set(typeId, list);
    }
    return out;
  }
}
