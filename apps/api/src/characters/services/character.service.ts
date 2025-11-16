import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EsiCharactersService } from '../../esi/esi-characters.service';
import type {
  CharacterRole,
  CharacterFunction,
  CharacterLocation,
} from '@eve/prisma';

/**
 * CharacterService provides centralized access to character data.
 * This includes character lookups, filtering by role/function/location, and character metadata.
 *
 * Domain: Characters (eveCharacter, user, characterToken tables)
 */
@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
  ) {}

  /**
   * Get tracked SELLER character IDs (have tokens, in specific hubs)
   */
  async getTrackedSellerIds(
    locations?: CharacterLocation[],
  ): Promise<number[]> {
    const whereClause: any = {
      function: 'SELLER',
      token: { isNot: null },
    };

    if (locations && locations.length > 0) {
      whereClause.location = { in: locations };
    } else {
      // Default to main trading hubs
      whereClause.location = { in: ['DODIXIE', 'HEK', 'RENS', 'AMARR'] };
    }

    const rows = await this.prisma.eveCharacter.findMany({
      where: whereClause,
      select: { id: true },
    });

    return rows.map((r) => r.id);
  }

  /**
   * Get all LOGISTICS character IDs
   */
  async getLogisticsCharacterIds(): Promise<number[]> {
    const rows = await this.prisma.eveCharacter.findMany({
      where: { role: 'LOGISTICS' },
      select: { id: true },
    });

    return rows.map((r) => r.id);
  }

  /**
   * Get SELLER characters (with full details)
   */
  async getSellerCharacters(locations?: CharacterLocation[]): Promise<
    Array<{
      id: number;
      name: string;
      function: string | null;
      location: string | null;
    }>
  > {
    const whereClause: any = {
      function: 'SELLER',
      token: { isNot: null },
    };

    if (locations && locations.length > 0) {
      whereClause.location = { in: locations };
    }

    return await this.prisma.eveCharacter.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        function: true,
        location: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get character name by ID
   */
  async getCharacterName(characterId: number): Promise<string | null> {
    const char = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
      select: { name: true },
    });

    return char?.name ?? null;
  }

  /**
   * Get any character name (fallback to most recently updated)
   */
  async getAnyCharacterName(): Promise<string | null> {
    const anyChar = await this.prisma.eveCharacter.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { name: true },
    });

    return anyChar?.name ?? null;
  }

  /**
   * Get characters by function
   */
  async getCharactersByFunction(func: CharacterFunction): Promise<
    Array<{
      id: number;
      name: string;
      location: string | null;
    }>
  > {
    return await this.prisma.eveCharacter.findMany({
      where: { function: func },
      select: {
        id: true,
        name: true,
        location: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Check if character has a token
   */
  async hasToken(characterId: number): Promise<boolean> {
    const count = await this.prisma.characterToken.count({
      where: { characterId },
    });

    return count > 0;
  }

  /**
   * Get characters by role (ADMIN, USER, LOGISTICS)
   */
  async getCharactersByRole(role: CharacterRole): Promise<
    Array<{
      id: number;
      name: string;
    }>
  > {
    return await this.prisma.eveCharacter.findMany({
      where: { role },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get LOGISTICS characters with details
   */
  async getLogisticsCharacters(): Promise<
    Array<{
      id: number;
      name: string;
    }>
  > {
    return await this.getCharactersByRole('LOGISTICS');
  }

  /**
   * Get SYSTEM-managed characters
   */
  async getSystemManagedCharacters(): Promise<
    Array<{
      id: number;
      name: string;
    }>
  > {
    return await this.prisma.eveCharacter.findMany({
      where: { managedBy: 'SYSTEM' },
      select: { id: true, name: true },
    });
  }

  /**
   * Get character orders from ESI
   * Returns all orders for a character including volume_total (original listed amount)
   * Handles ESI token refresh automatically
   *
   * @throws NotFoundException if character doesn't exist
   */
  async getCharacterOrders(
    characterId: number,
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
    // Verify character exists
    const character = await this.prisma.eveCharacter.findUnique({
      where: { id: characterId },
      select: { id: true, name: true },
    });

    if (!character) {
      throw new NotFoundException(
        `Character with ID ${characterId} not found`,
      );
    }

    // Fetch orders from ESI (handles token refresh automatically)
    return await this.esiChars.getOrders(characterId);
  }
}
