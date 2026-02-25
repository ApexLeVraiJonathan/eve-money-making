import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { Readable } from 'node:stream';
import { createReadStream, promises as fsp } from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as unzipper from 'unzipper';

import { PrismaService } from '../../prisma/prisma.service';
import { DataImportService } from '@shared/data-import';
import { EsiService } from '../../esi/esi.service';
import { AppConfig } from '@api/common/config';
import type {
  ImportMissingMarketTradesResponse,
  ImportMarketTradesDayResult,
} from '@eve/api-contracts';

@Injectable()
export class ImportService {
  private readonly BASE_URL_ADAM4EVE = 'https://static.adam4eve.eu/';
  private readonly PG_INT_MAX = 2147483647;
  private readonly sdeFreshnessWindowMs = AppConfig.sdeImport().freshnessWindowMs;
  private sdeEnsurePromise: Promise<{ sdeDir: string; basePath: string }> | null =
    null;
  private readonly sdeZipUrl =
    'https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip';

  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly dataImportService: DataImportService,
    private readonly esi: EsiService,
  ) {}

  private async streamJsonLines(
    filePath: string,
    onRow: (row: unknown) => Promise<void> | void,
  ): Promise<void> {
    const input = createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input,
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const obj = JSON.parse(trimmed) as unknown;
      await onRow(obj);
    }
  }

  private getDefaultSdeDir(): string {
    // Store SDE under the API app folder (dist at runtime).
    // __dirname is apps/api/dist at runtime, so ../sde-jsonl => apps/api/sde-jsonl
    return path.resolve(__dirname, '../sde-jsonl');
  }

  private async resolveActiveSdeBasePath(
    sdeDir: string,
  ): Promise<{ sdeDir: string; basePath: string }> {
    // Prefer nested eve-online-static-data-*-jsonl folder when present,
    // otherwise fall back to sdeDir itself.
    const entries = await fsp.readdir(sdeDir, { withFileTypes: true });
    const candidateDir = entries.find(
      (e) =>
        e.isDirectory() &&
        e.name.startsWith('eve-online-static-data-') &&
        e.name.endsWith('-jsonl'),
    );
    const basePath = candidateDir ? path.resolve(sdeDir, candidateDir.name) : sdeDir;
    return { sdeDir, basePath };
  }

  private async downloadLatestSdeJsonl(): Promise<{
    sdeDir: string;
    basePath: string;
  }> {
    const context = ImportService.name;
    const sdeDir = this.getDefaultSdeDir();
    this.logger.log(
      `Downloading latest SDE JSONL from ${this.sdeZipUrl} into ${sdeDir}`,
      context,
    );
    await fsp.mkdir(sdeDir, { recursive: true });
    try {
      const res = await axios.get<Readable>(this.sdeZipUrl, {
        responseType: 'stream',
      });
      await new Promise<void>((resolve, reject) => {
        const stream = (res.data as unknown as Readable)
          .pipe(unzipper.Extract({ path: sdeDir }))
          .on('error', (err: unknown) => reject(err))
          .on('close', () => resolve());
        stream.on('finish', () => resolve());
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to download or extract latest SDE JSONL from ${this.sdeZipUrl}`,
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed to download or extract latest SDE JSONL from ${this.sdeZipUrl}: ${String(
            error,
          )}`,
          undefined,
          context,
        );
      }
      throw error;
    }
    return await this.resolveActiveSdeBasePath(sdeDir);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async getSdeReferenceMtimeMs(params: {
    sdeDir: string;
    basePath: string;
  }): Promise<number | null> {
    const candidates = [
      path.resolve(params.basePath, '_sde.jsonl'),
      path.resolve(params.sdeDir, '_sde.jsonl'),
      path.resolve(params.basePath, 'types.jsonl'),
      path.resolve(params.sdeDir, 'types.jsonl'),
    ];
    for (const candidate of candidates) {
      try {
        const stat = await fsp.stat(candidate);
        if (stat.isFile()) return stat.mtimeMs;
      } catch {
        // Continue to next candidate.
      }
    }
    return null;
  }

  private async getReusableLocalSdeWithinWindow(): Promise<{
    sdeDir: string;
    basePath: string;
    ageMs: number;
  } | null> {
    if (this.sdeFreshnessWindowMs <= 0) return null;
    try {
      const resolved = await this.resolveActiveSdeBasePath(this.getDefaultSdeDir());
      const requiredFiles = [
        'types.jsonl',
        'mapRegions.jsonl',
        'mapSolarSystems.jsonl',
        'npcStations.jsonl',
      ];
      for (const file of requiredFiles) {
        const exists = await this.fileExists(path.resolve(resolved.basePath, file));
        if (!exists) return null;
      }
      const refMtimeMs = await this.getSdeReferenceMtimeMs(resolved);
      if (!refMtimeMs) return null;
      const ageMs = Math.max(0, Date.now() - refMtimeMs);
      if (ageMs <= this.sdeFreshnessWindowMs) {
        return { ...resolved, ageMs };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async ensureLatestSdeDownloaded(): Promise<{
    sdeDir: string;
    basePath: string;
  }> {
    if (!this.sdeEnsurePromise) {
      this.sdeEnsurePromise = (async () => {
        const reusable = await this.getReusableLocalSdeWithinWindow();
        if (reusable) {
          const ageMinutes = Math.round(reusable.ageMs / 60_000);
          const windowMinutes = Math.round(this.sdeFreshnessWindowMs / 60_000);
          this.logger.log(
            `Using local SDE snapshot from ${reusable.basePath} (age=${ageMinutes}m <= freshnessWindow=${windowMinutes}m)`,
            ImportService.name,
          );
          return { sdeDir: reusable.sdeDir, basePath: reusable.basePath };
        }
        return await this.downloadLatestSdeJsonl();
      })().finally(() => {
        this.sdeEnsurePromise = null;
      });
    }
    return await this.sdeEnsurePromise;
  }

  private getSdeNameEn(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (value && typeof value === 'object') {
      const maybeEn = (value as { en?: unknown }).en;
      if (typeof maybeEn === 'string') {
        const trimmed = maybeEn.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
    }
    return null;
  }

  async importTypeIds(batchSize = 5000, ensureLatestSde = true) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of type IDs from SDE (types.jsonl, batchSize=${batchSize})`,
      context,
    );

    let upserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const basePath = ensureLatestSde
        ? (await this.ensureLatestSdeDownloaded()).basePath
        : (await this.resolveActiveSdeBasePath(this.getDefaultSdeDir())).basePath;
      const typesPath = path.resolve(basePath, 'types.jsonl');

      const batcher = this.dataImportService.createBatcher<{
        id: number;
        published: boolean;
        name: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          // Upsert the batch inside an interactive transaction so we can
          // extend the timeout beyond Prisma's 5s default. This endpoint
          // is admin-only, so a longer timeout is acceptable.
          await this.prisma.$transaction(
            async (tx) => {
              for (const item of items) {
                await tx.typeId.upsert({
                  where: { id: item.id },
                  create: {
                    id: item.id,
                    published: item.published,
                    name: item.name,
                  },
                  update: { name: item.name, published: item.published },
                });
              }
            },
            {
              // Allow up to 20s for a batch to complete and 5s to wait
              // for a connection in the pool.
              timeout: 20_000,
              maxWait: 5_000,
            },
          );
          upserted += items.length;
          this.logger.log(`Upserted ${items.length} type_ids`, context);
        },
      });

      await this.streamJsonLines(typesPath, async (row) => {
        totalRows++;
        const rec = row as {
          _key?: unknown;
          published?: unknown;
          name?: unknown;
        };
        const idRaw = rec._key;
        const id =
          typeof idRaw === 'number'
            ? idRaw
            : typeof idRaw === 'string'
              ? Number(idRaw)
              : NaN;
        if (!Number.isInteger(id)) {
          skipped++;
          return;
        }

        const name = this.getSdeNameEn(rec.name) ?? `Unknown Type ${id}`;
        const published = rec.published === true;
        await batcher.push({ id, published, name });
      });

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of type IDs from SDE types.jsonl',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of type IDs from SDE types.jsonl: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:type_ids in ${durationMs}ms (upserted=${upserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { upserted, skipped, totalRows, batchSize };
  }

  async importRegionIds(batchSize = 5000, ensureLatestSde = true) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of region IDs from SDE (mapRegions.jsonl, batchSize=${batchSize})`,
      context,
    );

    let inserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const basePath = ensureLatestSde
        ? (await this.ensureLatestSdeDownloaded()).basePath
        : (await this.resolveActiveSdeBasePath(this.getDefaultSdeDir())).basePath;
      const regionsPath = path.resolve(basePath, 'mapRegions.jsonl');

      const batcher = this.dataImportService.createBatcher<{
        id: number;
        name: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          await this.prisma.$transaction(
            items.map((item) =>
              this.prisma.regionId.upsert({
                where: { id: item.id },
                create: item,
                update: { name: item.name },
              }),
            ),
          );
          inserted += items.length;
          this.logger.log(`Upserted ${items.length} regions`, context);
        },
      });

      await this.streamJsonLines(regionsPath, async (row) => {
        totalRows++;
        const rec = row as { _key?: unknown; name?: unknown };
        const idRaw = rec._key;
        const id =
          typeof idRaw === 'number'
            ? idRaw
            : typeof idRaw === 'string'
              ? Number(idRaw)
              : NaN;
        const name = this.getSdeNameEn(rec.name);
        if (!Number.isInteger(id) || !name) {
          skipped++;
          return;
        }
        await batcher.push({ id, name });
      });

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of region IDs from SDE mapRegions.jsonl',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of region IDs from SDE mapRegions.jsonl: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:region_ids in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, totalRows, batchSize };
  }

  async importSolarSystemIds(batchSize = 5000, ensureLatestSde = true) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of solar system IDs from SDE (mapSolarSystems.jsonl, batchSize=${batchSize})`,
      context,
    );

    let inserted = 0,
      skipped = 0,
      totalRows = 0;

    try {
      const basePath = ensureLatestSde
        ? (await this.ensureLatestSdeDownloaded()).basePath
        : (await this.resolveActiveSdeBasePath(this.getDefaultSdeDir())).basePath;
      const systemsPath = path.resolve(basePath, 'mapSolarSystems.jsonl');

      const batcher = this.dataImportService.createBatcher<{
        id: number;
        regionId: number;
        name: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          await this.prisma.$transaction(
            items.map((item) =>
              this.prisma.solarSystemId.upsert({
                where: { id: item.id },
                create: item,
                update: { regionId: item.regionId, name: item.name },
              }),
            ),
          );
          inserted += items.length;
          this.logger.log(`Upserted ${items.length} solar systems`, context);
        },
      });

      await this.streamJsonLines(systemsPath, async (row) => {
        totalRows++;
        const rec = row as {
          _key?: unknown;
          regionID?: unknown;
          name?: unknown;
        };
        const idRaw = rec._key;
        const regionRaw = rec.regionID;
        const id =
          typeof idRaw === 'number'
            ? idRaw
            : typeof idRaw === 'string'
              ? Number(idRaw)
              : NaN;
        const regionId =
          typeof regionRaw === 'number'
            ? regionRaw
            : typeof regionRaw === 'string'
              ? Number(regionRaw)
              : NaN;
        const name = this.getSdeNameEn(rec.name);
        if (!Number.isInteger(id) || !Number.isInteger(regionId) || !name) {
          skipped++;
          return;
        }
        await batcher.push({ id, regionId, name });
      });

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of solar system IDs from SDE mapSolarSystems.jsonl',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of solar system IDs from SDE mapSolarSystems.jsonl: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:solarSystem_ids in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, totalRows, batchSize };
  }

  async importNpcStationIds(batchSize = 5000, ensureLatestSde = true) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of NPC station IDs from SDE (npcStations.jsonl, batchSize=${batchSize})`,
      context,
    );

    let upserted = 0,
      skipped = 0,
      totalRows = 0,
      nameLookups = 0;

    try {
      const basePath = ensureLatestSde
        ? (await this.ensureLatestSdeDownloaded()).basePath
        : (await this.resolveActiveSdeBasePath(this.getDefaultSdeDir())).basePath;
      const stationsPath = path.resolve(basePath, 'npcStations.jsonl');
      const stations = new Map<number, { id: number; solarSystemId: number }>();

      await this.streamJsonLines(stationsPath, async (row) => {
        totalRows++;
        const rec = row as { _key?: unknown; solarSystemID?: unknown };
        const idRaw = rec._key;
        const solarRaw = rec.solarSystemID;
        const id =
          typeof idRaw === 'number'
            ? idRaw
            : typeof idRaw === 'string'
              ? Number(idRaw)
              : NaN;
        const solarSystemId =
          typeof solarRaw === 'number'
            ? solarRaw
            : typeof solarRaw === 'string'
              ? Number(solarRaw)
              : NaN;
        if (!Number.isInteger(id) || !Number.isInteger(solarSystemId)) {
          skipped++;
          return;
        }
        stations.set(id, { id, solarSystemId });
      });

      const stationIds = Array.from(stations.keys());
      const existingStations = await this.prisma.stationId.findMany({
        where: { id: { in: stationIds } },
        select: { id: true, name: true },
      });
      const existingNameById = new Map(
        existingStations.map((station) => [station.id, station.name]),
      );
      const unresolved = stationIds.filter((id) => !existingNameById.has(id));

      const resolvedNameById = new Map<number, string>();
      await this.esi.withMaxConcurrency(20, async () => {
        let idx = 0;
        const worker = async () => {
          for (;;) {
            const i = idx++;
            if (i >= unresolved.length) break;
            const stationId = unresolved[i];
            try {
              const { data } = await this.esi.fetchJson<{ name?: string }>(
                `/latest/universe/stations/${stationId}/`,
              );
              const name = data.name?.trim();
              if (name) {
                resolvedNameById.set(stationId, name);
                nameLookups++;
                continue;
              }
              this.logger.warn(
                `Skipping station ${stationId}: ESI returned no name`,
                context,
              );
            } catch (error) {
              const msg =
                error instanceof Error ? error.message : String(error);
              this.logger.warn(
                `Skipping station ${stationId}: failed ESI name lookup (${msg})`,
                context,
              );
            }
          }
        };
        await Promise.all(Array.from({ length: 20 }, () => worker()));
      });

      const batcher = this.dataImportService.createBatcher<{
        id: number;
        solarSystemId: number;
        name: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          await this.prisma.$transaction(
            items.map((item) =>
              this.prisma.stationId.upsert({
                where: { id: item.id },
                create: item,
                update: { solarSystemId: item.solarSystemId, name: item.name },
              }),
            ),
          );
          upserted += items.length;
          this.logger.log(`Upserted ${items.length} stations`, context);
        },
      });

      for (const [stationId, station] of stations.entries()) {
        const name =
          existingNameById.get(stationId) ?? resolvedNameById.get(stationId);
        if (!name) {
          skipped++;
          continue;
        }
        await batcher.push({
          id: station.id,
          solarSystemId: station.solarSystemId,
          name,
        });
      }
      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import of NPC station IDs from SDE npcStations.jsonl',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of NPC station IDs from SDE npcStations.jsonl: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:npcStation_ids in ${durationMs}ms (upserted=${upserted}, skipped=${skipped}, lookedUpNames=${nameLookups}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { upserted, skipped, nameLookups, totalRows, batchSize };
  }

  /**
   * Import skill definitions from a locally downloaded EVE SDE JSONL folder.
   *
   * This currently identifies all type IDs that belong to the Skills category
   * (categoryID=16) and stores them in the SkillDefinition table.
   *
   * Later we can extend this to also pull rank and primary/secondary attributes
   * from typeDogma.jsonl and dogmaAttributes.jsonl.
   */
  async importSkillDefinitionsFromSde(basePath?: string, batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    const effectiveBase =
      basePath && basePath.trim().length > 0
        ? basePath
        : this.getDefaultSdeDir();
    const typesPath = path.resolve(effectiveBase, 'types.jsonl');
    const groupsPath = path.resolve(effectiveBase, 'groups.jsonl');
    const typeDogmaPath = path.resolve(effectiveBase, 'typeDogma.jsonl');

    this.logger.log(
      `Starting import of skill definitions from SDE at ${effectiveBase} (batchSize=${batchSize})`,
      context,
    );

    let upserted = 0;
    let skippedTypes = 0;
    let totalTypeRows = 0;

    const typeBatcher = this.dataImportService.createBatcher<{
      typeId: number;
      groupId: number;
      nameEn: string | null;
      descriptionEn: string | null;
    }>({
      size: batchSize,
      flush: async (items) => {
        if (!items.length) return;
        await this.prisma.$transaction(
          items.map((item) =>
            this.prisma.skillDefinition.upsert({
              where: { typeId: item.typeId },
              create: {
                typeId: item.typeId,
                groupId: item.groupId,
                nameEn: item.nameEn ?? undefined,
                descriptionEn: item.descriptionEn ?? undefined,
              },
              update: {
                groupId: item.groupId,
                nameEn: item.nameEn ?? undefined,
                descriptionEn: item.descriptionEn ?? undefined,
              },
            }),
          ),
        );
        upserted += items.length;
        this.logger.log(
          `Upserted ${items.length} skill definitions (types.jsonl)`,
          context,
        );
      },
    });

    try {
      // First pass: identify all skill groups (categoryID === 16) from groups.jsonl,
      // then find all types that belong to those groups from types.jsonl.
      const skillGroupIds = new Set<number>();

      await this.streamJsonLines(groupsPath, async (row) => {
        const rec = row as { _key?: unknown; categoryID?: unknown };
        const groupIdRaw = rec._key;
        const categoryIdRaw = rec.categoryID;

        const groupId =
          typeof groupIdRaw === 'number'
            ? groupIdRaw
            : typeof groupIdRaw === 'string'
              ? Number(groupIdRaw)
              : NaN;
        const categoryId =
          typeof categoryIdRaw === 'number'
            ? categoryIdRaw
            : typeof categoryIdRaw === 'string'
              ? Number(categoryIdRaw)
              : NaN;

        if (!Number.isFinite(groupId) || !Number.isFinite(categoryId)) {
          return;
        }

        if (categoryId === 16) {
          skillGroupIds.add(groupId);
        }
      });

      this.logger.log(
        `Identified ${skillGroupIds.size} skill groups (categoryID=16) from groups.jsonl`,
        context,
      );

      // Now stream types.jsonl and keep only types whose groupID is one of the
      // identified skill groups.
      await this.streamJsonLines(typesPath, async (row) => {
        totalTypeRows++;
        const rec = row as {
          _key?: unknown;
          groupID?: unknown;
          name?: unknown;
          description?: unknown;
        };
        const typeIdRaw = rec._key;
        const groupIdRaw = rec.groupID;
        const nameRaw = rec.name as string | { en?: unknown } | undefined;
        const descRaw = rec.description as
          | string
          | { en?: unknown }
          | undefined;

        const typeId =
          typeof typeIdRaw === 'number'
            ? typeIdRaw
            : typeof typeIdRaw === 'string'
              ? Number(typeIdRaw)
              : NaN;
        const groupId =
          typeof groupIdRaw === 'number'
            ? groupIdRaw
            : typeof groupIdRaw === 'string'
              ? Number(groupIdRaw)
              : NaN;

        let nameEn: string | null = null;
        if (typeof nameRaw === 'string') {
          nameEn = nameRaw;
        } else if (
          nameRaw &&
          typeof nameRaw === 'object' &&
          'en' in nameRaw &&
          typeof (nameRaw as { en?: unknown }).en === 'string'
        ) {
          // We know .en is a string here, so assert non-optional
          nameEn = (nameRaw as { en: string }).en ?? null;
        }

        let descriptionEn: string | null = null;
        if (typeof descRaw === 'string') {
          descriptionEn = descRaw;
        } else if (
          descRaw &&
          typeof descRaw === 'object' &&
          'en' in descRaw &&
          typeof (descRaw as { en?: unknown }).en === 'string'
        ) {
          // We know .en is a string here, so assert non-optional
          descriptionEn = (descRaw as { en: string }).en ?? null;
        }

        if (
          !Number.isFinite(typeId) ||
          !Number.isFinite(groupId) ||
          !skillGroupIds.has(groupId)
        ) {
          skippedTypes++;
          return;
        }

        await typeBatcher.push({
          typeId,
          groupId,
          nameEn,
          descriptionEn,
        });
      });

      await typeBatcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed during import of skill definitions (groups/types jsonl) at ${effectiveBase}`,
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of skill definitions (groups/types jsonl) at ${effectiveBase}: ${String(
            error,
          )}`,
          undefined,
          context,
        );
      }
      throw error;
    }

    // Second pass: enrich skill definitions with rank and primary/secondary attributes from typeDogma.jsonl
    const skillTypes = await this.prisma.skillDefinition.findMany({
      select: { typeId: true },
    });
    const skillTypeIds = new Set(skillTypes.map((s) => s.typeId));

    let updatedMeta = 0;
    let skippedDogma = 0;
    let totalDogmaRows = 0;

    const dogmaBatcher = this.dataImportService.createBatcher<{
      typeId: number;
      rank: number;
      primaryAttribute: string;
      secondaryAttribute: string;
      prerequisite1Id?: number;
      prerequisite1Level?: number;
      prerequisite2Id?: number;
      prerequisite2Level?: number;
      prerequisite3Id?: number;
      prerequisite3Level?: number;
    }>({
      size: batchSize,
      flush: async (items) => {
        if (!items.length) return;
        await this.prisma.$transaction(
          items.map((item) =>
            this.prisma.skillDefinition.update({
              where: { typeId: item.typeId },
              data: {
                rank: item.rank,
                primaryAttribute: item.primaryAttribute,
                secondaryAttribute: item.secondaryAttribute,
                prerequisite1Id: item.prerequisite1Id ?? null,
                prerequisite1Level: item.prerequisite1Level ?? null,
                prerequisite2Id: item.prerequisite2Id ?? null,
                prerequisite2Level: item.prerequisite2Level ?? null,
                prerequisite3Id: item.prerequisite3Id ?? null,
                prerequisite3Level: item.prerequisite3Level ?? null,
              },
            }),
          ),
        );
        updatedMeta += items.length;
        this.logger.log(
          `Updated ${items.length} skill definitions with rank/attributes/prerequisites (typeDogma.jsonl)`,
          context,
        );
      },
    });

    const mapAttributeCodeToName = (code: number): string | null => {
      // Modern JSONL SDE uses dogma attribute IDs 164–168 for character
      // attributes; some older formats used 1–5. Support both.
      switch (code) {
        case 165:
        case 1:
          return 'intelligence';
        case 164:
        case 2:
          return 'charisma';
        case 167:
        case 3:
          return 'perception';
        case 166:
        case 4:
          return 'memory';
        case 168:
        case 5:
          return 'willpower';
        default:
          return null;
      }
    };

    try {
      await this.streamJsonLines(typeDogmaPath, async (row) => {
        totalDogmaRows++;
        const rec = row as {
          _key?: unknown;
          dogmaAttributes?: Array<{ attributeID: number; value: number }>;
        };
        const typeIdRaw = rec._key;
        const typeId =
          typeof typeIdRaw === 'number'
            ? typeIdRaw
            : typeof typeIdRaw === 'string'
              ? Number(typeIdRaw)
              : NaN;
        if (!Number.isFinite(typeId) || !skillTypeIds.has(typeId)) {
          return;
        }

        const attrs = rec.dogmaAttributes ?? [];
        const timeConstAttr = attrs.find((a) => a.attributeID === 275);
        const primaryAttr = attrs.find((a) => a.attributeID === 180);
        const secondaryAttr = attrs.find((a) => a.attributeID === 181);

        // Prerequisite attributes
        const prereq1SkillAttr = attrs.find((a) => a.attributeID === 182);
        const prereq1LevelAttr = attrs.find((a) => a.attributeID === 277);
        const prereq2SkillAttr = attrs.find((a) => a.attributeID === 183);
        const prereq2LevelAttr = attrs.find((a) => a.attributeID === 278);
        const prereq3SkillAttr = attrs.find((a) => a.attributeID === 184);
        const prereq3LevelAttr = attrs.find((a) => a.attributeID === 279);

        if (
          !timeConstAttr ||
          typeof timeConstAttr.value !== 'number' ||
          !primaryAttr ||
          !secondaryAttr
        ) {
          skippedDogma++;
          return;
        }

        // In the JSONL SDE, skillTimeConstant (attr 275) is the skill rank
        // expressed as a small integer (1,2,3,4,5,...).
        const rank = Math.round(timeConstAttr.value);
        const primaryName = mapAttributeCodeToName(primaryAttr.value);
        const secondaryName = mapAttributeCodeToName(secondaryAttr.value);

        if (!rank || !primaryName || !secondaryName) {
          skippedDogma++;
          return;
        }

        await dogmaBatcher.push({
          typeId,
          rank,
          primaryAttribute: primaryName,
          secondaryAttribute: secondaryName,
          prerequisite1Id: prereq1SkillAttr
            ? Math.round(prereq1SkillAttr.value)
            : undefined,
          prerequisite1Level: prereq1LevelAttr
            ? Math.round(prereq1LevelAttr.value)
            : undefined,
          prerequisite2Id: prereq2SkillAttr
            ? Math.round(prereq2SkillAttr.value)
            : undefined,
          prerequisite2Level: prereq2LevelAttr
            ? Math.round(prereq2LevelAttr.value)
            : undefined,
          prerequisite3Id: prereq3SkillAttr
            ? Math.round(prereq3SkillAttr.value)
            : undefined,
          prerequisite3Level: prereq3LevelAttr
            ? Math.round(prereq3LevelAttr.value)
            : undefined,
        });
      });

      await dogmaBatcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed during enrichment of skill definitions from typeDogma.jsonl at ${typeDogmaPath}`,
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during enrichment of skill definitions from typeDogma.jsonl at ${typeDogmaPath}: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import:skill_definitions from SDE in ${durationMs}ms (skills upserted=${upserted}, typesSkipped=${skippedTypes}, typeRows=${totalTypeRows}, metaUpdated=${updatedMeta}, dogmaSkipped=${skippedDogma}, dogmaRows=${totalDogmaRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return {
      upserted,
      skippedTypes,
      totalTypeRows,
      updatedMeta,
      skippedDogma,
      totalDogmaRows,
      batchSize,
      basePath: effectiveBase,
    };
  }

  /**
   * Download the latest SDE JSONL zip from CCP, extract it under the API app
   * folder, and import skill definitions from it.
   *
   * Uses the shorthand URL documented at:
   * https://developers.eveonline.com/docs/services/static-data/
   */
  async downloadLatestSdeAndImportSkills(batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    const { sdeDir, basePath } = await this.downloadLatestSdeJsonl();
    this.logger.log(
      `Using extracted SDE folder ${basePath} for skill import`,
      context,
    );

    const result = await this.importSkillDefinitionsFromSde(
      basePath,
      batchSize,
    );

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `Finished download+import of SDE skill definitions in ${durationMs}ms`,
      context,
    );

    // result already contains basePath; just attach sdeDir alongside it
    return { sdeDir, ...result };
  }

  async importAll(batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import: all datasets (batchSize=${batchSize})`,
      context,
    );

    const results: Record<string, unknown> = {};
    try {
      await this.ensureLatestSdeDownloaded();
      const [typeIdsResult, regionIdsResult] = await Promise.all([
        this.importTypeIds(batchSize, false),
        this.importRegionIds(batchSize, false),
      ]);
      results.typeIds = typeIdsResult;
      results.regionIds = regionIdsResult;

      const solarSystemsResult = await this.importSolarSystemIds(batchSize, false);
      results.solarSystems = solarSystemsResult;

      const stationsResult = await this.importNpcStationIds(batchSize, false);
      const volumesResult = await this.importTypeVolumes();
      results.stations = stationsResult;
      results.typeVolumes = volumesResult;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          'Failed during import: all datasets',
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import: all datasets: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import: all datasets in ${durationMs}ms`,
        context,
      );
    }

    return results;
  }

  async importTypeVolumes() {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(`Starting import of type volumes (ESI)`, context);

    let updated = 0;
    let checked = 0;
    const concurrency = 50;
    const pageSize = 5000;
    let lastId: number | undefined;

    // Process all published types in ascending id pages
    for (;;) {
      const types = await this.prisma.typeId.findMany({
        where: {
          published: true,
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: pageSize,
      });
      if (types.length === 0) break;

      let idx = 0;
      const worker = async () => {
        for (;;) {
          const i = idx++;
          if (i >= types.length) break;
          const typeId = types[i].id;
          try {
            const { data } = await this.esi.fetchJson<{ volume?: number }>(
              `/latest/universe/types/${typeId}/`,
            );
            checked++;
            if (typeof data.volume === 'number') {
              await this.prisma.typeId.update({
                where: { id: typeId },
                data: { volume: data.volume.toString() },
              });
              updated++;
            }
          } catch {
            this.logger.warn(`Failed to fetch volume for type ${typeId}`);
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      lastId = types[types.length - 1].id;
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `Finished import:type_volumes in ${durationMs}ms (updated=${updated}, checked=${checked})`,
      context,
    );
    return { updated, checked };
  }

  async importMarketOrderTradesByDate(date: string, batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of marketOrderTrades_daily_${date}.csv (batchSize=${batchSize})`,
      context,
    );

    // Collect tracked station IDs to filter rows
    const tracked = await this.prisma.trackedStation.findMany({
      select: { stationId: true },
    });
    const trackedSet = new Set(tracked.map((t) => t.stationId));
    // Ensure we always import the configured source station for planner buy pricing
    trackedSet.add(AppConfig.arbitrage().sourceStationId);

    let inserted = 0,
      skipped = 0,
      totalRows = 0,
      clamped = 0;

    try {
      const yyyy = date.slice(0, 4);
      const url = `${this.BASE_URL_ADAM4EVE}/MarketOrdersTrades/${yyyy}/marketOrderTrades_daily_${date}.csv`;
      const res = await axios.get(url, { responseType: 'stream' });
      const input = res.data as Readable;

      const batcher = this.dataImportService.createBatcher<{
        scanDate: Date;
        locationId: number;
        typeId: number;
        isBuyOrder: boolean;
        regionId: number;
        hasGone: boolean;
        amount: number;
        high: string;
        low: string;
        avg: string;
        orderNum: number;
        iskValue: string;
      }>({
        size: batchSize,
        flush: async (items) => {
          try {
            const { count } =
              await this.prisma.marketOrderTradeDaily.createMany({
                data: items,
                skipDuplicates: true,
              });
            inserted += count;
          } catch (error) {
            const code = (error as { code?: string })?.code;
            // Prisma P2003: Foreign key constraint failed
            if (code === 'P2003') {
              // Diagnose missing type_ids for a clearer error message
              try {
                const uniqueTypeIds = Array.from(
                  new Set(items.map((i) => i.typeId)),
                );
                const existing = await this.prisma.typeId.findMany({
                  where: { id: { in: uniqueTypeIds } },
                  select: { id: true },
                });
                const existingSet = new Set(existing.map((e) => e.id));
                const missing = uniqueTypeIds.filter(
                  (id) => !existingSet.has(id),
                );
                if (missing.length > 0) {
                  const sample = missing.slice(0, 10).join(', ');
                  const message =
                    `Foreign key violation: ${missing.length} missing type_ids (e.g., ${sample}). ` +
                    'Import reference data first (POST /import/type-ids or /import/all), then retry the market trades import.';
                  this.logger.error(message, undefined, ImportService.name);
                  throw new Error(message);
                }
              } catch (error) {
                // If diagnostics fail for any reason, rethrow original error
                this.logger.error(
                  `Failed to diagnose missing type_ids: ${String(error)}`,
                  undefined,
                  ImportService.name,
                );
                throw error;
              }
            }
            throw error;
          }
        },
      });

      const scanDate = new Date(`${date}T00:00:00.000Z`);
      await this.dataImportService.streamCsv<Record<string, string>>(
        input,
        async (row) => {
          totalRows++;
          const locationId = Number(row.location_id);
          if (!trackedSet.has(locationId)) {
            skipped++;
            return;
          }
          const regionId = Number(row.region_id);
          const typeId = Number(row.type_id);
          const isBuyOrder = row.is_buy_order === '1';
          const hasGone = row.has_gone === '1';
          let amount = Number(row.amount);
          const high = row.high;
          const low = row.low;
          const avg = row.avg;
          let orderNum = Number(row.orderNum);
          const iskValue = row.iskValue;
          if (
            !Number.isInteger(locationId) ||
            !Number.isInteger(regionId) ||
            !Number.isInteger(typeId) ||
            !Number.isInteger(amount) ||
            !Number.isInteger(orderNum)
          ) {
            skipped++;
            return;
          }

          // Postgres int4 guard: Adam4EVE can exceed 2.1B units/day for ultra-liquid items (e.g. Tritanium in Jita)
          if (amount > this.PG_INT_MAX) {
            amount = this.PG_INT_MAX;
            clamped++;
          }
          if (orderNum > this.PG_INT_MAX) {
            orderNum = this.PG_INT_MAX;
            clamped++;
          }
          await batcher.push({
            scanDate,
            locationId,
            typeId,
            isBuyOrder,
            regionId,
            hasGone,
            amount,
            high,
            low,
            avg,
            orderNum,
            iskValue,
          });
        },
      );

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed during import of marketOrderTrades_daily_${date}.csv`,
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during import of marketOrderTrades_daily_${date}.csv: ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished import: marketOrderTrades_daily_${date} in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, clamped=${clamped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, clamped, totalRows, batchSize };
  }

  async importMarketOrderTradesWeeklyByUrl(url: string, batchSize = 5000) {
    const context = ImportService.name;
    const startedAt = Date.now();
    this.logger.log(
      `Starting import of weekly market trades from URL (batchSize=${batchSize})`,
      context,
    );

    // Collect tracked station IDs to filter rows
    const tracked = await this.prisma.trackedStation.findMany({
      select: { stationId: true },
    });
    const trackedSet = new Set(tracked.map((t) => t.stationId));
    // Ensure we always import the configured source station for planner buy pricing
    trackedSet.add(AppConfig.arbitrage().sourceStationId);

    let inserted = 0,
      skipped = 0,
      totalRows = 0,
      clamped = 0;

    const batcher = this.dataImportService.createBatcher<{
      scanDate: Date;
      locationId: number;
      typeId: number;
      isBuyOrder: boolean;
      regionId: number;
      hasGone: boolean;
      amount: number;
      high: string;
      low: string;
      avg: string;
      orderNum: number;
      iskValue: string;
    }>({
      size: batchSize,
      flush: async (items) => {
        const { count } = await this.prisma.marketOrderTradeDaily.createMany({
          data: items,
          skipDuplicates: true,
        });
        inserted += count;
      },
    });

    try {
      const res = await axios.get(url, { responseType: 'stream' });
      const input = res.data as Readable;

      await this.dataImportService.streamCsv<Record<string, string>>(
        input,
        async (row) => {
          totalRows++;
          const locationId = Number(row.location_id);
          if (!trackedSet.has(locationId)) {
            skipped++;
            return;
          }

          const scanDateStr = row.scanDate ?? row.scan_date;
          if (!scanDateStr) {
            skipped++;
            return;
          }
          const scanDate = new Date(`${scanDateStr}T00:00:00.000Z`);
          if (Number.isNaN(scanDate.getTime())) {
            skipped++;
            return;
          }

          const regionId = Number(row.region_id);
          const typeId = Number(row.type_id);
          const isBuyOrder = row.is_buy_order === '1';
          const hasGone = row.has_gone === '1';
          let amount = Number(row.amount);
          const high = row.high;
          const low = row.low;
          const avg = row.avg;
          let orderNum = Number(row.orderNum);
          const iskValue = row.iskValue;
          if (
            !Number.isInteger(locationId) ||
            !Number.isInteger(regionId) ||
            !Number.isInteger(typeId) ||
            !Number.isInteger(amount) ||
            !Number.isInteger(orderNum)
          ) {
            skipped++;
            return;
          }

          // Postgres int4 guard: weekly backfills include Jita + ultra-liquid items that can exceed 2.1B units/day
          if (amount > this.PG_INT_MAX) {
            amount = this.PG_INT_MAX;
            clamped++;
          }
          if (orderNum > this.PG_INT_MAX) {
            orderNum = this.PG_INT_MAX;
            clamped++;
          }

          await batcher.push({
            scanDate,
            locationId,
            typeId,
            isBuyOrder,
            regionId,
            hasGone,
            amount,
            high,
            low,
            avg,
            orderNum,
            iskValue,
          });
        },
      );

      await batcher.finish();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed during weekly market trades import from URL: ${url}`,
          error.stack,
          context,
        );
      } else {
        this.logger.error(
          `Failed during weekly market trades import from URL: ${url} - ${String(error)}`,
          undefined,
          context,
        );
      }
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Finished weekly market trades import in ${durationMs}ms (inserted=${inserted}, skipped=${skipped}, clamped=${clamped}, totalRows=${totalRows}, batchSize=${batchSize})`,
        context,
      );
    }

    return { inserted, skipped, clamped, totalRows, batchSize, url };
  }

  async getMissingMarketOrderTradeDates(daysBack = 15) {
    const dates = this.dataImportService.getLastNDates(daysBack);
    const missing: string[] = [];
    // Consider a day "missing" if the daily aggregate is incomplete for our
    // expected stations (tracked stations + arbitrage source station).
    //
    // This matters because partial imports (e.g. only Jita) will otherwise make
    // `count(scanDate)= > 0` and the backfill job will skip the day entirely.
    const tracked = await this.prisma.trackedStation.findMany({
      select: { stationId: true },
    });
    const expectedStations = new Set(tracked.map((t) => t.stationId));
    expectedStations.add(AppConfig.arbitrage().sourceStationId);
    const expectedStationIds = Array.from(expectedStations);

    for (const date of dates) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const present = await this.prisma.marketOrderTradeDaily.findMany({
        where: {
          scanDate: dayStart,
          locationId: { in: expectedStationIds },
          // Use conservative mode to determine completeness.
          hasGone: false,
        },
        distinct: ['locationId'],
        select: { locationId: true },
      });

      // Mark missing if the day has no data at all for the expected stations,
      // OR if it is only partially imported for a subset of them.
      if (present.length < expectedStationIds.length) {
        missing.push(date);
      }
    }
    return missing;
  }

  async importMissingMarketOrderTrades(
    daysBack = 15,
    batchSize = 5000,
  ): Promise<ImportMissingMarketTradesResponse> {
    const context = ImportService.name;
    await this.ensureLatestSdeDownloaded();
    const missing = await this.getMissingMarketOrderTradeDates(daysBack);
    const results: ImportMissingMarketTradesResponse['results'] = {};

    // Avoid running the (potentially heavy) type ID import more than once per
    // "missing days" run. If multiple days hit the missing-type-ids error we
    // import once, then retry each affected day.
    let typeIdsImported = false;

    for (const date of missing) {
      try {
        results[date] = {
          ok: true,
          ...(await this.importMarketOrderTradesByDate(date, batchSize)),
        };
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : String(error ?? 'Unknown error');
        const isMissingTypeIds = msg.includes('missing type_ids');

        if (isMissingTypeIds) {
          this.logger.warn(
            `Detected missing type_ids while importing market trades for ${date}. ` +
              'Running type ID import and retrying this date.',
            context,
          );

          try {
            if (!typeIdsImported) {
              await this.importTypeIds(batchSize, false);
              typeIdsImported = true;
            }

            const retryResult = await this.importMarketOrderTradesByDate(
              date,
              batchSize,
            );
            results[date] = { ok: true, ...retryResult };
            continue;
          } catch (retryError) {
            const retryMsg =
              retryError instanceof Error
                ? retryError.message
                : String(retryError ?? 'Unknown retry error');
            this.logger.error(
              `Retry after type ID import still failed for ${date}: ${retryMsg}`,
              undefined,
              context,
            );
            results[date] = {
              ok: false,
              error: retryMsg,
              stage: 'retryAfterTypeIds',
            };
            continue;
          }
        }

        // For all other errors (e.g., missing external CSV for one day),
        // record the failure but continue with remaining dates instead of
        // aborting the whole operation.
        this.logger.warn(
          `Import of market trades for ${date} failed; skipping and continuing. Error: ${msg}`,
          context,
        );
        const errorResult: ImportMarketTradesDayResult = {
          ok: false,
          error: msg,
          stage: 'initial',
        };
        results[date] = errorResult;
      }
    }

    return { missing, results };
  }

  async getSummary() {
    const [typeIds, regionIds, solarSystemIds, npcStationIds] =
      await Promise.all([
        this.prisma.typeId.count(),
        this.prisma.regionId.count(),
        this.prisma.solarSystemId.count(),
        this.prisma.stationId.count(),
      ]);

    return {
      typeIds,
      regionIds,
      solarSystemIds,
      npcStationIds,
    };
  }
}
