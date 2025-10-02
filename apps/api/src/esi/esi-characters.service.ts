import { Injectable } from '@nestjs/common';
import { EsiService } from './esi.service';

@Injectable()
export class EsiCharactersService {
  constructor(private readonly esi: EsiService) {}

  async getWallet(characterId: number, reqId?: string): Promise<number> {
    const { data } = await this.esi.fetchJson<number>(
      `/latest/characters/${characterId}/wallet`,
      { characterId, reqId },
    );
    return Number(data);
  }

  async getOrders(
    characterId: number,
    reqId?: string,
  ): Promise<
    Array<{
      order_id: number;
      type_id: number;
      is_buy_order: boolean;
      price: number;
      volume_remain: number;
      location_id: number;
      issued?: string;
      state?: string;
      region_id?: number;
    }>
  > {
    const { data } = await this.esi.fetchJson<
      Array<{
        order_id: number;
        type_id: number;
        is_buy_order: boolean;
        price: number;
        volume_remain: number;
        location_id: number;
        issued?: string;
        state?: string;
        region_id?: number;
      }>
    >(`/latest/characters/${characterId}/orders/`, {
      characterId,
      reqId,
    });
    return Array.isArray(data) ? data : [];
  }

  async getAssets(
    characterId: number,
    reqId?: string,
  ): Promise<
    Array<{
      item_id: number;
      type_id: number;
      location_id: number;
      location_flag: string;
      quantity: number;
      is_singleton?: boolean;
    }>
  > {
    const { data } = await this.esi.fetchJson<
      Array<{
        item_id: number;
        type_id: number;
        location_id: number;
        location_flag: string;
        quantity: number;
        is_singleton?: boolean;
      }>
    >(`/latest/characters/${characterId}/assets/`, {
      characterId,
      reqId,
    });
    return Array.isArray(data) ? data : [];
  }
}
