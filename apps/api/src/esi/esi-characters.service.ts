import { Injectable } from '@nestjs/common';
import { EsiService } from './esi.service';

@Injectable()
export class EsiCharactersService {
  constructor(private readonly esi: EsiService) {}

  /**
   * Basic public character metadata from ESI.
   *
   * Uses the unauthenticated public character endpoint and returns a
   * lightweight shape that is safe to expose to the frontend.
   */
  async getCharacterMetadata(
    characterId: number,
    reqId?: string,
  ): Promise<{
    corporation_id?: number;
    alliance_id?: number;
    security_status?: number;
  }> {
    const { data } = await this.esi.fetchJson<{
      corporation_id?: number;
      alliance_id?: number;
      security_status?: number;
    }>(`/latest/characters/${characterId}/`, {
      reqId,
    });
    return data ?? {};
  }

  async getCorporationInfo(
    corporationId: number,
    reqId?: string,
  ): Promise<{ name?: string; ticker?: string }> {
    const { data } = await this.esi.fetchJson<{
      name?: string;
      ticker?: string;
    }>(`/latest/corporations/${corporationId}/`, {
      reqId,
    });
    return data ?? {};
  }

  async getAllianceInfo(
    allianceId: number,
    reqId?: string,
  ): Promise<{ name?: string; ticker?: string }> {
    const { data } = await this.esi.fetchJson<{
      name?: string;
      ticker?: string;
    }>(`/latest/alliances/${allianceId}/`, {
      reqId,
    });
    return data ?? {};
  }

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
      duration?: number;
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
        duration?: number;
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
      duration?: number;
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
      duration?: number;
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
        duration?: number;
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
          duration?: number;
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

  /**
   * Character training queue (authenticated).
   *
   * Wraps ESI `/latest/characters/{character_id}/skillqueue/`.
   */
  async getSkillQueue(
    characterId: number,
    reqId?: string,
  ): Promise<
    Array<{
      skill_id: number;
      queue_position: number;
      finish_date?: string;
      start_date?: string;
      // ESI fields – see:
      // https://esi.evetech.net/ui/#/Skills/get_characters_character_id_skillqueue
      training_start_sp?: number;
      // Not always present in live responses, but keep for forward-compat.
      training_end_sp?: number;
      // ESI uses level_start_sp / level_end_sp + finished_level. There is
      // no numeric "level_start" / "level_end" field.
      level_start_sp?: number;
      level_end_sp?: number;
      finished_level?: number;
    }>
  > {
    const { data } = await this.esi.fetchJson<
      Array<{
        skill_id: number;
        queue_position: number;
        finish_date?: string;
        start_date?: string;
        training_start_sp?: number;
        training_end_sp?: number;
        level_start_sp?: number;
        level_end_sp?: number;
        finished_level?: number;
      }>
    >(`/latest/characters/${characterId}/skillqueue/`, {
      characterId,
      reqId,
    });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Character skills snapshot (authenticated).
   *
   * Wraps ESI `/latest/characters/{character_id}/skills/`.
   */
  async getSkills(
    characterId: number,
    reqId?: string,
  ): Promise<{
    total_sp?: number;
    unallocated_sp?: number;
    skills: Array<{
      skill_id: number;
      skillpoints_in_skill?: number;
      trained_skill_level?: number;
      active_skill_level?: number;
    }>;
  }> {
    const { data } = await this.esi.fetchJson<{
      total_sp?: number;
      unallocated_sp?: number;
      skills?: Array<{
        skill_id: number;
        skillpoints_in_skill?: number;
        trained_skill_level?: number;
        active_skill_level?: number;
      }>;
    }>(`/latest/characters/${characterId}/skills/`, {
      characterId,
      reqId,
    });
    return {
      total_sp: data?.total_sp,
      unallocated_sp: data?.unallocated_sp,
      skills: Array.isArray(data?.skills) ? data.skills : [],
    };
  }

  /**
   * Character attributes & remap info (authenticated).
   *
   * Wraps ESI `/latest/characters/{character_id}/attributes/`.
   */
  async getAttributes(
    characterId: number,
    reqId?: string,
  ): Promise<{
    charisma: number;
    intelligence: number;
    memory: number;
    perception: number;
    willpower: number;
    bonus_remaps?: number;
    last_remap_date?: string;
    accrued_remap_cooldown_date?: string;
  }> {
    const { data } = await this.esi.fetchJson<{
      charisma: number;
      intelligence: number;
      memory: number;
      perception: number;
      willpower: number;
      bonus_remaps?: number;
      last_remap_date?: string;
      accrued_remap_cooldown_date?: string;
    }>(`/latest/characters/${characterId}/attributes/`, {
      characterId,
      reqId,
    });
    return data;
  }
}
