import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * GameDataService provides centralized access to EVE static game data.
 * This includes type names, station/system/region mappings, and other reference data.
 *
 * Domain: Static EVE game data (typeId, stationId, solarSystemId, regionId tables)
 */
@Injectable()
export class GameDataService {
  private readonly logger = new Logger(GameDataService.name);
  private readonly jitaStationId = 60003760;
  private jitaRegionIdCache: number | null = null;
  private readonly typeWithVolumeCache = new Map<
    number,
    { id: number; name: string; volume: number | null }
  >();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Jita's region ID (cached for performance)
   */
  async getJitaRegionId(): Promise<number | null> {
    if (this.jitaRegionIdCache !== null) {
      return this.jitaRegionIdCache;
    }

    const jitaStation = await this.prisma.stationId.findUnique({
      where: { id: this.jitaStationId },
      select: { solarSystemId: true },
    });

    if (!jitaStation) return null;

    const sys = await this.prisma.solarSystemId.findUnique({
      where: { id: jitaStation.solarSystemId },
      select: { regionId: true },
    });

    this.jitaRegionIdCache = sys?.regionId ?? null;
    return this.jitaRegionIdCache;
  }

  /**
   * Get region ID for a given station
   */
  async getStationRegion(stationId: number): Promise<number | null> {
    const station = await this.prisma.stationId.findUnique({
      where: { id: stationId },
      select: { solarSystemId: true },
    });

    if (!station) return null;

    const system = await this.prisma.solarSystemId.findUnique({
      where: { id: station.solarSystemId },
      select: { regionId: true },
    });

    return system?.regionId ?? null;
  }

  /**
   * Get station with its region ID
   */
  async getStationWithRegion(stationId: number): Promise<{
    station: { id: number; name: string; solarSystemId: number };
    regionId: number | null;
  } | null> {
    const station = await this.prisma.stationId.findUnique({
      where: { id: stationId },
      select: { id: true, name: true, solarSystemId: true },
    });

    if (!station) return null;

    const system = await this.prisma.solarSystemId.findUnique({
      where: { id: station.solarSystemId },
      select: { regionId: true },
    });

    return {
      station,
      regionId: system?.regionId ?? null,
    };
  }

  /**
   * Bulk fetch stations with their regions
   */
  async getStationsWithRegions(stationIds: number[]): Promise<
    Map<
      number,
      {
        id: number;
        name: string;
        solarSystemId: number;
        regionId: number | null;
      }
    >
  > {
    const stations = await this.prisma.stationId.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true, solarSystemId: true },
    });

    const systemIds = Array.from(new Set(stations.map((s) => s.solarSystemId)));
    const systems = await this.prisma.solarSystemId.findMany({
      where: { id: { in: systemIds } },
      select: { id: true, regionId: true },
    });

    const systemRegionMap = new Map(systems.map((s) => [s.id, s.regionId]));

    const result = new Map();
    for (const station of stations) {
      result.set(station.id, {
        ...station,
        regionId: systemRegionMap.get(station.solarSystemId) ?? null,
      });
    }

    return result;
  }

  /**
   * Bulk fetch type names
   */
  async getTypeNames(typeIds: number[]): Promise<Map<number, string>> {
    const types = await this.prisma.typeId.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true },
    });

    return new Map(types.map((t) => [t.id, t.name]));
  }

  /**
   * Bulk fetch type details with volumes
   */
  async getTypesWithVolumes(typeIds: number[]): Promise<
    Map<
      number,
      {
        id: number;
        name: string;
        volume: number | null;
      }
    >
  > {
    const result = new Map<
      number,
      { id: number; name: string; volume: number | null }
    >();

    const unique = Array.from(new Set(typeIds)).filter((x) =>
      Number.isFinite(x),
    );
    if (unique.length === 0) return result;

    const missing: number[] = [];
    for (const id of unique) {
      const cached = this.typeWithVolumeCache.get(id);
      if (cached) result.set(id, cached);
      else missing.push(id);
    }

    if (missing.length === 0) return result;

    // Chunk to avoid pathological giant IN (...) queries in hot paths (Strategy Lab batches)
    const chunkSize = 1000;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      const types = await this.prisma.typeId.findMany({
        where: { id: { in: chunk } },
        select: { id: true, name: true, volume: true },
      });

      for (const t of types) {
        const row = {
          id: t.id,
          name: t.name,
          volume: t.volume ? Number(t.volume) : null,
        };
        this.typeWithVolumeCache.set(t.id, row);
        result.set(t.id, row);
      }
    }

    return result;
  }

  /**
   * Get type by ID
   */
  async getType(typeId: number): Promise<{
    id: number;
    name: string;
    volume: number | null;
  } | null> {
    const type = await this.prisma.typeId.findUnique({
      where: { id: typeId },
      select: { id: true, name: true, volume: true },
    });

    if (!type) return null;

    return {
      id: type.id,
      name: type.name,
      volume: type.volume ? Number(type.volume) : null,
    };
  }

  /**
   * Get type name by ID (with fallback)
   */
  async getTypeName(typeId: number): Promise<string | null> {
    const type = await this.prisma.typeId.findFirst({
      where: { id: typeId },
      select: { name: true },
    });

    return type?.name ?? null;
  }

  /**
   * Bulk fetch station names
   */
  async getStationNames(stationIds: number[]): Promise<Map<number, string>> {
    const stations = await this.prisma.stationId.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true },
    });

    return new Map(stations.map((s) => [s.id, s.name]));
  }

  /**
   * Get station by ID
   */
  async getStation(stationId: number): Promise<{
    id: number;
    name: string;
    solarSystemId: number;
  } | null> {
    return await this.prisma.stationId.findUnique({
      where: { id: stationId },
      select: { id: true, name: true, solarSystemId: true },
    });
  }

  /**
   * Get station by name
   */
  async getStationByName(name: string): Promise<{
    id: number;
    name: string;
    solarSystemId: number;
  } | null> {
    return await this.prisma.stationId.findFirst({
      where: { name },
      select: { id: true, name: true, solarSystemId: true },
    });
  }

  /**
   * Resolve type IDs from names (case-insensitive)
   */
  async resolveTypeIdsByNames(names: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!names.length) return map;

    // First, try exact matches in a single query
    const rows = await this.prisma.typeId.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    for (const r of rows) map.set(r.name, r.id);

    // For any names not found, try case-insensitive lookup one by one
    const missing = names.filter((n) => !map.has(n));
    for (const n of missing) {
      const r = await this.prisma.typeId.findFirst({
        where: { name: { equals: n, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (r) map.set(n, r.id);
    }

    return map;
  }
}
