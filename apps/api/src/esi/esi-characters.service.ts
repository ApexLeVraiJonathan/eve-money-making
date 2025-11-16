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
      volume_total: number;
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
        volume_total: number;
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

  async getOrdersAll(
    characterId: number,
    reqId?: string,
  ): Promise<
    Array<{
      order_id: number;
      type_id: number;
      is_buy_order: boolean;
      price: number;
      volume_remain: number;
      volume_total: number;
      location_id: number;
      issued?: string;
      state?: string;
      region_id?: number;
    }>
  > {
    const all: Array<{
      order_id: number;
      type_id: number;
      is_buy_order: boolean;
      price: number;
      volume_remain: number;
      volume_total: number;
      location_id: number;
      issued?: string;
      state?: string;
      region_id?: number;
    }> = [];
    // First page, prefer headers to get X-Pages
    const first = await this.esi.fetchJson<
      Array<{
        order_id: number;
        type_id: number;
        is_buy_order: boolean;
        price: number;
        volume_remain: number;
        volume_total: number;
        location_id: number;
        issued?: string;
        state?: string;
        region_id?: number;
      }>
    >(`/latest/characters/${characterId}/orders/`, {
      characterId,
      reqId,
      preferHeaders: true,
    });
    if (Array.isArray(first.data)) all.push(...first.data);
    const totalPagesStr = first.meta.headers?.['x-pages'];
    const totalPages = totalPagesStr ? Number(totalPagesStr) : 1;
    for (
      let page = 2;
      page <= (Number.isFinite(totalPages) ? totalPages : 1);
      page++
    ) {
      const { data } = await this.esi.fetchJson<
        Array<{
          order_id: number;
          type_id: number;
          is_buy_order: boolean;
          price: number;
          volume_remain: number;
          volume_total: number;
          location_id: number;
          issued?: string;
          state?: string;
          region_id?: number;
        }>
      >(`/latest/characters/${characterId}/orders/`, {
        characterId,
        reqId,
        query: { page },
      });
      if (Array.isArray(data)) all.push(...data);
    }
    return all;
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

  async getAssetsAll(
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
    const all: Array<{
      item_id: number;
      type_id: number;
      location_id: number;
      location_flag: string;
      quantity: number;
      is_singleton?: boolean;
    }> = [];
    const first = await this.esi.fetchJson<
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
      preferHeaders: true,
    });
    if (Array.isArray(first.data)) all.push(...first.data);
    const totalPagesStr = first.meta.headers?.['x-pages'];
    const totalPages = totalPagesStr ? Number(totalPagesStr) : 1;
    for (
      let page = 2;
      page <= (Number.isFinite(totalPages) ? totalPages : 1);
      page++
    ) {
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
        query: { page },
      });
      if (Array.isArray(data)) all.push(...data);
    }
    return all;
  }

  async getWalletTransactions(
    characterId: number,
    fromId?: number,
    reqId?: string,
  ): Promise<
    Array<{
      transaction_id: number;
      date: string;
      is_buy: boolean;
      location_id: number;
      type_id: number;
      client_id?: number;
      quantity: number;
      unit_price: number;
      journal_ref_id?: number;
    }>
  > {
    const query: Record<string, number> = {};
    if (fromId) query['from_id'] = fromId;
    const { data } = await this.esi.fetchJson<
      Array<{
        transaction_id: number;
        date: string;
        is_buy: boolean;
        location_id: number;
        type_id: number;
        client_id?: number;
        quantity: number;
        unit_price: number;
        journal_ref_id?: number;
      }>
    >(`/latest/characters/${characterId}/wallet/transactions/`, {
      characterId,
      query,
      reqId,
    });
    return Array.isArray(data) ? data : [];
  }

  async getWalletJournal(
    characterId: number,
    page?: number,
    reqId?: string,
  ): Promise<
    Array<{
      id: number;
      date: string;
      ref_type: string;
      amount: number;
      balance?: number;
      context_id?: number;
      context_id_type?: string;
      description?: string;
      first_party_id?: number;
      second_party_id?: number;
      tax?: number;
      tax_receiver_id?: number;
    }>
  > {
    const query: Record<string, number> = {};
    if (page) query['page'] = page;
    try {
      const { data } = await this.esi.fetchJson<
        Array<{
          id: number;
          date: string;
          ref_type: string;
          amount: number;
          balance?: number;
          context_id?: number;
          context_id_type?: string;
          description?: string;
          first_party_id?: number;
          second_party_id?: number;
          tax?: number;
          tax_receiver_id?: number;
        }>
      >(`/latest/characters/${characterId}/wallet/journal/`, {
        characterId,
        query,
        reqId,
        preferHeaders: true,
      });
      return Array.isArray(data) ? data : [];
    } catch (err: unknown) {
      // Treat out-of-range pages as empty (ESI returns 404)
      const status =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 404) return [];
      throw err;
    }
  }

  // Returns one page and optional total pages (from X-Pages header when available)
  async getWalletJournalPage(
    characterId: number,
    page?: number,
    reqId?: string,
  ): Promise<{
    rows: Array<{
      id: number;
      date: string;
      ref_type: string;
      amount: number;
      balance?: number;
      context_id?: number;
      context_id_type?: string;
      description?: string;
      reason?: string;
      first_party_id?: number;
      second_party_id?: number;
      tax?: number;
      tax_receiver_id?: number;
    }>;
    totalPages?: number;
  }> {
    const query: Record<string, number> = {};
    if (page) query['page'] = page;
    try {
      const { data, meta } = await this.esi.fetchJson<
        Array<{
          id: number;
          date: string;
          ref_type: string;
          amount: number;
          balance?: number;
          context_id?: number;
          context_id_type?: string;
          description?: string;
          reason?: string;
          first_party_id?: number;
          second_party_id?: number;
          tax?: number;
          tax_receiver_id?: number;
        }>
      >(`/latest/characters/${characterId}/wallet/journal/`, {
        characterId,
        query,
        reqId,
        preferHeaders: true,
      });
      let totalPages: number | undefined;
      const xp = meta?.headers?.['x-pages'];
      if (xp && !Number.isNaN(Number(xp))) totalPages = Number(xp);
      return { rows: Array.isArray(data) ? data : [], totalPages };
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 404) return { rows: [], totalPages: undefined };
      throw err;
    }
  }
}
