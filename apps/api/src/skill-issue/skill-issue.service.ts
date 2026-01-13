import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import { CharacterManagementService } from '../character-management/character-management.service';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { parseEftFit } from './domain/eft-fit-parser';
import {
  categorizeDogmaAttributeName,
  sortCategories,
  type SkillIssueInfluenceCategory,
} from './domain/dogma-attribute-categories';

type SkillIssueSkillRequirementStatus = 'met' | 'missing' | 'unknown';

type SkillIssueSkillRequirement = {
  skillId: number;
  skillName: string | null;
  requiredLevel: number;
  trainedLevel: number | null;
  status: SkillIssueSkillRequirementStatus;
  requiredByTypeIds: number[];
};

type SkillIssueInfluencingSkill = {
  skillId: number;
  skillName: string | null;
  modifiedAttributeIds: number[];
  categories: SkillIssueInfluenceCategory[];
};

type SkillIssueAnalyzeResponse = {
  fit: {
    shipName: string | null;
    shipTypeId: number | null;
    extractedTypeNames: string[];
    unresolvedTypeNames: string[];
    fitTypeIds: number[];
  };
  requiredSkills: SkillIssueSkillRequirement[];
  influencingSkills: SkillIssueInfluencingSkill[];
};

type DogmaAttr = { attributeID: number; value: number };
type DogmaEffectRef = { effectID: number; isDefault?: boolean };

type TypeDogmaRow = {
  typeId: number;
  dogmaAttributes: DogmaAttr[];
  dogmaEffects: DogmaEffectRef[];
};

type EffectModifierInfo = {
  domain?: string;
  func?: string;
  groupID?: number;
  modifiedAttributeID?: number;
  modifyingAttributeID?: number;
  operation?: number;
  skillTypeID?: number;
  // other fields exist, but MVP-A does not need them yet
};

const REQUIRED_SKILL_ATTR_IDS = [182, 183, 184, 1285, 1289, 1290] as const;
const REQUIRED_SKILL_LEVEL_ATTR_IDS = [
  277, 278, 279, 1286, 1287, 1288,
] as const;

// Some ship attributes are only relevant if the fit includes a module group that consumes them.
// Example: ships have `scanSpeed` (79), but it only matters if you actually fit ship/cargo scanners.
const SHIP_ATTR_REQUIRES_FIT_GROUP: Record<number, number[]> = {
  // scanSpeed → Cargo Scanner (47), Ship Scanner (48), System Scanner (472)
  79: [47, 48, 472],
};

// Manual overrides for dogma "RequiredSkill" applicability that is too broad for in-game behavior.
// Example: MWDs require the Afterburner skill, but the Afterburner / Fuel Conservation skills do
// NOT actually apply to Microwarpdrives in-game.
const SKILL_REQUIRES_FIT_NAME_TOKEN: Record<number, string[]> = {
  // Afterburner
  3450: ['afterburner'],
  // Fuel Conservation (afterburner capacitor use)
  3451: ['afterburner'],
};

@Injectable()
export class SkillIssueService {
  private skillImpactIndex: Map<
    number,
    {
      alwaysShip: Set<number>;
      alwaysItem: Set<number>;
      requiredSkill: Set<number>;
      byGroup: Map<number, Set<number>>;
    }
  > | null = null;
  private skillImpactIndexPromise: Promise<
    Map<
      number,
      {
        alwaysShip: Set<number>;
        alwaysItem: Set<number>;
        requiredSkill: Set<number>;
        byGroup: Map<number, Set<number>>;
      }
    >
  > | null = null;

  private attributeCategoryById: Map<
    number,
    SkillIssueInfluenceCategory
  > | null = null;
  private attributeCategoryByIdPromise: Promise<
    Map<number, SkillIssueInfluenceCategory>
  > | null = null;

  private shipBonusAttributeIds: Set<number> | null = null;
  private shipBonusAttrToDownstreamModifiedAttrIds: Map<
    number,
    Set<number>
  > | null = null;
  private proxyModifyingAttrToEffectModifiedAttrIds = new Map<
    number,
    Map<number, Set<number>>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly characterManagement: CharacterManagementService,
  ) {}

  private getDefaultSdeDir(): string {
    // __dirname is apps/api/dist/... at runtime, so ../sde-jsonl => apps/api/sde-jsonl
    return path.resolve(__dirname, '../sde-jsonl');
  }

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

  /**
   * Builds (and caches) an index of:
   *   effectID -> modifiedAttributeIDs
   * for a specific modifyingAttributeID.
   *
   * Used to correctly categorize "proxy" attributes like rig `drawback` (1138),
   * which affect real ship stats via other effects present on the fit.
   */
  private async getEffectToModifiedAttrsForModifyingAttr(
    modifyingAttrId: number,
  ): Promise<Map<number, Set<number>>> {
    const cached =
      this.proxyModifyingAttrToEffectModifiedAttrIds.get(modifyingAttrId);
    if (cached) return cached;

    const sdeDir = this.getDefaultSdeDir();
    const dogmaEffectsPath = path.resolve(sdeDir, 'dogmaEffects.jsonl');

    const map = new Map<number, Set<number>>();
    await this.streamJsonLines(dogmaEffectsPath, (row) => {
      const rec = row as {
        _key?: unknown;
        modifierInfo?: EffectModifierInfo[];
      };
      const rawId = rec._key;
      const effectId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string'
            ? Number(rawId)
            : NaN;
      if (!Number.isFinite(effectId)) return;

      const mods = Array.isArray(rec.modifierInfo) ? rec.modifierInfo : [];
      for (const m of mods) {
        const modAttr = m?.modifyingAttributeID;
        if (modAttr !== modifyingAttrId) continue;
        const a = m?.modifiedAttributeID;
        if (typeof a !== 'number' || !Number.isFinite(a)) continue;
        const set = map.get(effectId) ?? new Set<number>();
        set.add(a);
        map.set(effectId, set);
      }
    });

    this.proxyModifyingAttrToEffectModifiedAttrIds.set(modifyingAttrId, map);
    return map;
  }

  private async resolveTypeIdsByNamesInsensitive(names: string[]) {
    const unique = Array.from(
      new Set(names.map((n) => n.trim()).filter(Boolean)),
    );
    if (unique.length === 0) {
      return {
        typeIdByName: new Map<string, number>(),
        unresolved: [] as string[],
      };
    }

    // Prisma doesn't support case-insensitive "in" lists, so we OR equals.
    // Chunk to avoid overly large OR arrays.
    const typeIdByLower = new Map<string, number>();
    const chunkSize = 75;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const rows = await this.prisma.typeId.findMany({
        where: {
          OR: chunk.map((name) => ({
            name: { equals: name, mode: 'insensitive' as const },
          })),
        },
        select: { id: true, name: true },
      });
      for (const r of rows) {
        typeIdByLower.set(r.name.toLowerCase(), r.id);
      }
    }

    // Build best-effort mapping for original extracted names
    const typeIdByName = new Map<string, number>();
    const unresolved: string[] = [];
    for (const name of unique) {
      const id = typeIdByLower.get(name.toLowerCase());
      if (id) typeIdByName.set(name, id);
      else unresolved.push(name);
    }

    return { typeIdByName, unresolved };
  }

  private async loadTypeDogmaSubset(
    typeIds: Set<number>,
  ): Promise<Map<number, TypeDogmaRow>> {
    const sdeDir = this.getDefaultSdeDir();
    const typeDogmaPath = path.resolve(sdeDir, 'typeDogma.jsonl');
    const found = new Map<number, TypeDogmaRow>();
    if (typeIds.size === 0) return found;

    await this.streamJsonLines(typeDogmaPath, (row) => {
      const rec = row as {
        _key?: unknown;
        dogmaAttributes?: Array<{ attributeID: number; value: number }>;
        dogmaEffects?: Array<{ effectID: number; isDefault?: boolean }>;
      };
      const rawId = rec._key;
      const typeId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string'
            ? Number(rawId)
            : NaN;
      if (!Number.isFinite(typeId) || !typeIds.has(typeId)) return;

      found.set(typeId, {
        typeId,
        dogmaAttributes: Array.isArray(rec.dogmaAttributes)
          ? rec.dogmaAttributes
          : [],
        dogmaEffects: Array.isArray(rec.dogmaEffects) ? rec.dogmaEffects : [],
      });
    });

    return found;
  }

  private async loadTypeGroupIdSubset(
    typeIds: Set<number>,
  ): Promise<Map<number, number>> {
    const sdeDir = this.getDefaultSdeDir();
    const typesPath = path.resolve(sdeDir, 'types.jsonl');
    const out = new Map<number, number>();
    if (typeIds.size === 0) return out;

    await this.streamJsonLines(typesPath, (row) => {
      const rec = row as { _key?: unknown; groupID?: unknown };
      const rawId = rec._key;
      const typeId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string'
            ? Number(rawId)
            : NaN;
      if (!Number.isFinite(typeId) || !typeIds.has(typeId)) return;
      const groupId = typeof rec.groupID === 'number' ? rec.groupID : null;
      if (groupId != null && Number.isFinite(groupId)) out.set(typeId, groupId);
    });

    return out;
  }

  private extractRequiredSkillsFromTypeDogma(params: {
    typeId: number;
    dogmaAttributes: DogmaAttr[];
  }): Array<{
    skillId: number;
    requiredLevel: number;
    requiredByTypeId: number;
  }> {
    const attrById = new Map<number, number>();
    for (const a of params.dogmaAttributes) {
      if (typeof a.attributeID === 'number' && typeof a.value === 'number') {
        attrById.set(a.attributeID, a.value);
      }
    }

    const out: Array<{
      skillId: number;
      requiredLevel: number;
      requiredByTypeId: number;
    }> = [];
    for (let i = 0; i < REQUIRED_SKILL_ATTR_IDS.length; i++) {
      const skillAttrId = REQUIRED_SKILL_ATTR_IDS[i];
      const levelAttrId = REQUIRED_SKILL_LEVEL_ATTR_IDS[i];
      const skillVal = attrById.get(skillAttrId);
      if (skillVal == null) continue;
      const skillId = Math.round(skillVal);
      if (!Number.isFinite(skillId) || skillId <= 0) continue;

      const levelVal = attrById.get(levelAttrId);
      const requiredLevel =
        levelVal == null ? 0 : Math.max(0, Math.min(5, Math.round(levelVal)));
      if (requiredLevel <= 0) continue;

      out.push({
        skillId,
        requiredLevel,
        requiredByTypeId: params.typeId,
      });
    }
    return out;
  }

  private async buildSkillImpactIndex(): Promise<
    Map<
      number,
      {
        alwaysShip: Set<number>;
        alwaysItem: Set<number>;
        requiredSkill: Set<number>;
        byGroup: Map<number, Set<number>>;
      }
    >
  > {
    if (this.skillImpactIndex) return this.skillImpactIndex;
    if (this.skillImpactIndexPromise) return this.skillImpactIndexPromise;

    this.skillImpactIndexPromise = (async () => {
      const sdeDir = this.getDefaultSdeDir();
      const dogmaEffectsPath = path.resolve(sdeDir, 'dogmaEffects.jsonl');
      const typeDogmaPath = path.resolve(sdeDir, 'typeDogma.jsonl');

      // 1) Build effectId -> modifiedAttributeIDs index (strictly-scoped buckets)
      const effectToModifiedAttrs = new Map<
        number,
        {
          alwaysShip: number[];
          alwaysItem: number[];
          requiredSkill: number[];
          byGroup: Array<[number, number]>;
        }
      >();
      const shipBonusAttrToDownstream = new Map<number, Set<number>>();
      await this.streamJsonLines(dogmaEffectsPath, (row) => {
        const rec = row as {
          _key?: unknown;
          modifierInfo?: EffectModifierInfo[];
        };
        const rawId = rec._key;
        const effectId =
          typeof rawId === 'number'
            ? rawId
            : typeof rawId === 'string'
              ? Number(rawId)
              : NaN;
        if (!Number.isFinite(effectId)) return;
        const mods = Array.isArray(rec.modifierInfo) ? rec.modifierInfo : [];
        const alwaysShip: number[] = [];
        const alwaysItem: number[] = [];
        const requiredSkill: number[] = [];
        const byGroup: Array<[number, number]> = [];
        for (const m of mods) {
          const a = m?.modifiedAttributeID;
          if (typeof a !== 'number' || !Number.isFinite(a)) continue;

          // Build "ship bonus attribute -> downstream modified attributes" index.
          // Example: Amarr Cruiser drives shipBonusAC* attributes, which then feed other
          // effects that modify real fit stats (damage, resists, etc.).
          const modAttr = m?.modifyingAttributeID;
          const op = m?.operation;
          if (
            typeof modAttr === 'number' &&
            Number.isFinite(modAttr) &&
            modAttr !== 280 && // 280 is skill level; ignore level->bonus wiring
            typeof op === 'number' &&
            op === 6 // postPercent is the common ship bonus op
          ) {
            const set = shipBonusAttrToDownstream.get(modAttr) ?? new Set();
            set.add(a);
            shipBonusAttrToDownstream.set(modAttr, set);
          }

          // Many ship role/racial bonuses are encoded as RequiredSkill modifiers.
          // These should only be considered relevant if the affected item actually
          // requires the skillTypeID. (Fixes false-positives like Doomsday skills
          // showing up for non-Titan fits.)
          const func = typeof m?.func === 'string' ? m.func : '';
          const hasRequiredSkill =
            func.toLowerCase().includes('requiredskill') &&
            typeof m?.skillTypeID === 'number' &&
            Number.isFinite(m.skillTypeID);

          if (hasRequiredSkill) {
            requiredSkill.push(a);
            continue;
          }

          // Strict: respect group scoping when present
          if (typeof m?.groupID === 'number' && Number.isFinite(m.groupID)) {
            byGroup.push([m.groupID, a]);
            continue;
          }

          // Otherwise treat as unconditional only for ship/item domains,
          // but preserve the domain so we can intersect against the correct
          // attribute set (ship vs non-ship). This fixes cases like Survey
          // where `scanSpeed` exists on scanner modules but not on the ship.
          const domain = typeof m?.domain === 'string' ? m.domain : '';
          if (domain === 'shipID') alwaysShip.push(a);
          if (domain === 'itemID') alwaysItem.push(a);
        }
        if (
          alwaysShip.length ||
          alwaysItem.length ||
          requiredSkill.length ||
          byGroup.length
        ) {
          effectToModifiedAttrs.set(effectId, {
            alwaysShip,
            alwaysItem,
            requiredSkill,
            byGroup,
          });
        }
      });

      // 2) Identify all skill type IDs (SkillDefinition table)
      const skillDefs = await this.prisma.skillDefinition.findMany({
        select: { typeId: true },
      });
      const skillTypeIds = new Set(skillDefs.map((s) => s.typeId));

      // 3) Stream typeDogma and, for skill rows, union all modifiedAttributeIDs referenced by their effects
      const impact = new Map<
        number,
        {
          alwaysShip: Set<number>;
          alwaysItem: Set<number>;
          requiredSkill: Set<number>;
          byGroup: Map<number, Set<number>>;
        }
      >();
      await this.streamJsonLines(typeDogmaPath, (row) => {
        const rec = row as {
          _key?: unknown;
          dogmaEffects?: Array<{ effectID: number }>;
        };
        const rawId = rec._key;
        const typeId =
          typeof rawId === 'number'
            ? rawId
            : typeof rawId === 'string'
              ? Number(rawId)
              : NaN;
        if (!Number.isFinite(typeId) || !skillTypeIds.has(typeId)) return;

        const effects = Array.isArray(rec.dogmaEffects) ? rec.dogmaEffects : [];
        if (!effects.length) return;

        const existing = impact.get(typeId) ?? {
          alwaysShip: new Set<number>(),
          alwaysItem: new Set<number>(),
          requiredSkill: new Set<number>(),
          byGroup: new Map<number, Set<number>>(),
        };
        for (const e of effects) {
          const ids = effectToModifiedAttrs.get(e.effectID);
          if (!ids) continue;
          for (const a of ids.alwaysShip) existing.alwaysShip.add(a);
          for (const a of ids.alwaysItem) existing.alwaysItem.add(a);
          for (const a of ids.requiredSkill) existing.requiredSkill.add(a);
          for (const [groupId, attrId] of ids.byGroup) {
            const set = existing.byGroup.get(groupId) ?? new Set<number>();
            set.add(attrId);
            existing.byGroup.set(groupId, set);
          }
        }
        if (
          existing.alwaysShip.size ||
          existing.alwaysItem.size ||
          existing.requiredSkill.size ||
          existing.byGroup.size
        ) {
          impact.set(typeId, existing);
        }
      });

      this.skillImpactIndex = impact;
      this.shipBonusAttrToDownstreamModifiedAttrIds = shipBonusAttrToDownstream;
      return impact;
    })();

    return this.skillImpactIndexPromise;
  }

  private async buildAttributeCategoryIndex(): Promise<
    Map<number, SkillIssueInfluenceCategory>
  > {
    if (this.attributeCategoryById) return this.attributeCategoryById;
    if (this.attributeCategoryByIdPromise)
      return this.attributeCategoryByIdPromise;

    this.attributeCategoryByIdPromise = (async () => {
      const sdeDir = this.getDefaultSdeDir();
      const dogmaAttributesPath = path.resolve(sdeDir, 'dogmaAttributes.jsonl');

      const map = new Map<number, SkillIssueInfluenceCategory>();
      const shipBonusIds = new Set<number>();
      await this.streamJsonLines(dogmaAttributesPath, (row) => {
        const rec = row as { _key?: unknown; name?: unknown };
        const rawId = rec._key;
        const id =
          typeof rawId === 'number'
            ? rawId
            : typeof rawId === 'string'
              ? Number(rawId)
              : NaN;
        if (!Number.isFinite(id)) return;
        const name = typeof rec.name === 'string' ? rec.name : null;
        if (!name) return;
        const nl = name.toLowerCase();
        if (nl.startsWith('shipbonus') || nl.startsWith('elitebonus')) {
          shipBonusIds.add(id);
        }
        const cat = categorizeDogmaAttributeName(name);
        if (cat) map.set(id, cat);
      });

      this.attributeCategoryById = map;
      this.shipBonusAttributeIds = shipBonusIds;
      return map;
    })();

    return this.attributeCategoryByIdPromise;
  }

  async analyzeForUser(
    userId: string,
    input: { characterId: number; eft: string },
  ): Promise<SkillIssueAnalyzeResponse> {
    const trimmed = input.eft.trim();
    if (!trimmed) throw new BadRequestException('EFT text is empty');

    // Ownership + skills snapshot (for "missing required skills")
    const skillsSnapshot = await this.characterManagement.getCharacterSkills(
      userId,
      input.characterId,
    );
    const trainedLevelBySkillId = new Map<number, number>();
    for (const s of skillsSnapshot.skills) {
      trainedLevelBySkillId.set(s.skillId, s.trainedSkillLevel);
    }

    // 1) Parse EFT and resolve types
    const parsed = parseEftFit(trimmed);
    const { typeIdByName, unresolved } =
      await this.resolveTypeIdsByNamesInsensitive(parsed.extractedTypeNames);
    const extractedTypeNamesLower = parsed.extractedTypeNames.map((n) =>
      n.toLowerCase(),
    );

    const shipTypeId = parsed.shipName
      ? (typeIdByName.get(parsed.shipName) ?? null)
      : null;
    const fitTypeIds = Array.from(new Set(Array.from(typeIdByName.values())));
    const fitGroupIds = new Set<number>();
    const typeGroupIds = await this.loadTypeGroupIdSubset(new Set(fitTypeIds));
    for (const g of typeGroupIds.values()) fitGroupIds.add(g);

    // 2) Load dogma for fit types
    const dogmaByTypeId = await this.loadTypeDogmaSubset(new Set(fitTypeIds));
    const fitEffectIds = new Set<number>();
    for (const row of dogmaByTypeId.values()) {
      for (const e of row.dogmaEffects) {
        if (typeof e.effectID === 'number' && Number.isFinite(e.effectID)) {
          fitEffectIds.add(e.effectID);
        }
      }
    }

    const shipAttributeIds = new Set<number>();
    const nonShipAttributeIds = new Set<number>();
    const requiredSkillIdsInFit = new Set<number>();
    for (const row of dogmaByTypeId.values()) {
      for (const a of row.dogmaAttributes) {
        if (
          typeof a.attributeID === 'number' &&
          Number.isFinite(a.attributeID)
        ) {
          if (shipTypeId != null && row.typeId === shipTypeId) {
            shipAttributeIds.add(a.attributeID);
          } else {
            nonShipAttributeIds.add(a.attributeID);
          }
        }
      }

      // Also collect "requiredSkillN" ids from the fit items so we can gate
      // RequiredSkill-based modifiers.
      for (const req of this.extractRequiredSkillsFromTypeDogma({
        typeId: row.typeId,
        dogmaAttributes: row.dogmaAttributes,
      })) {
        requiredSkillIdsInFit.add(req.skillId);
      }
    }

    // 3) Required skills
    const reqAgg = new Map<
      number,
      { requiredLevel: number; requiredByTypeIds: Set<number> }
    >();
    for (const row of dogmaByTypeId.values()) {
      const reqs = this.extractRequiredSkillsFromTypeDogma({
        typeId: row.typeId,
        dogmaAttributes: row.dogmaAttributes,
      });
      for (const r of reqs) {
        const existing = reqAgg.get(r.skillId);
        if (!existing) {
          reqAgg.set(r.skillId, {
            requiredLevel: r.requiredLevel,
            requiredByTypeIds: new Set([r.requiredByTypeId]),
          });
        } else {
          existing.requiredLevel = Math.max(
            existing.requiredLevel,
            r.requiredLevel,
          );
          existing.requiredByTypeIds.add(r.requiredByTypeId);
        }
      }
    }

    const requiredSkillIds = Array.from(reqAgg.keys());
    const requiredSkillTypeRows =
      requiredSkillIds.length === 0
        ? []
        : await this.prisma.typeId.findMany({
            where: { id: { in: requiredSkillIds } },
            select: { id: true, name: true },
          });
    const skillNameById = new Map<number, string>();
    for (const r of requiredSkillTypeRows) skillNameById.set(r.id, r.name);

    const requiredSkills: SkillIssueSkillRequirement[] = requiredSkillIds
      .sort((a, b) => a - b)
      .map((skillId) => {
        const req = reqAgg.get(skillId)!;
        const trained = trainedLevelBySkillId.get(skillId);
        const trainedLevel = trained == null ? null : trained;
        const status =
          trainedLevel == null
            ? 'unknown'
            : trainedLevel >= req.requiredLevel
              ? 'met'
              : 'missing';
        return {
          skillId,
          skillName: skillNameById.get(skillId) ?? null,
          requiredLevel: req.requiredLevel,
          trainedLevel,
          status,
          requiredByTypeIds: Array.from(req.requiredByTypeIds).sort(
            (a, b) => a - b,
          ),
        };
      });

    // 4) Influencing skills (MVP-A: conservative superset based on attribute intersection)
    const impactIndex = await this.buildSkillImpactIndex();
    const attributeCategoryById = await this.buildAttributeCategoryIndex();

    // Apply "conditional ship attributes" rules (strict mode).
    for (const [shipAttrId, requiredGroups] of Object.entries(
      SHIP_ATTR_REQUIRES_FIT_GROUP,
    )) {
      const attrId = Number(shipAttrId);
      if (!shipAttributeIds.has(attrId)) continue;
      const ok = requiredGroups.some((g) => fitGroupIds.has(g));
      if (!ok) shipAttributeIds.delete(attrId);
    }

    const fitAttributeIds = new Set<number>([
      ...shipAttributeIds.values(),
      ...nonShipAttributeIds.values(),
    ]);

    const categoryForAttrId = (
      attrId: number,
    ): SkillIssueInfluenceCategory | null => {
      // Context-aware overrides for ambiguous dogma attrs.
      // Example: `maxVelocity` is used for both ship max velocity and missile max velocity.
      // If it appears on non-ship types (ammo/missiles/modules), treat as Offense (range/projection).
      if (nonShipAttributeIds.has(attrId)) {
        if (attrId === 37 /* maxVelocity */) return 'Offense';
        if (attrId === 281 /* explosionDelay (missile flight time) */)
          return 'Offense';
      }
      return attributeCategoryById.get(attrId) ?? null;
    };

    const influencingIds: Array<{ skillId: number; intersect: number[] }> = [];
    for (const [skillId, modified] of impactIndex) {
      const requiredToken = SKILL_REQUIRES_FIT_NAME_TOKEN[skillId];
      if (
        requiredToken &&
        !requiredToken.some((t) =>
          extractedTypeNamesLower.some((name) => name.includes(t)),
        )
      ) {
        continue;
      }

      const intersect: number[] = [];
      // Unconditional modifiers (domain-aware)
      for (const a of modified.alwaysShip) {
        if (shipAttributeIds.has(a)) intersect.push(a);
      }
      for (const a of modified.alwaysItem) {
        if (nonShipAttributeIds.has(a)) intersect.push(a);
      }
      // RequiredSkill-gated modifiers: only relevant if something in the fit requires this skill
      if (requiredSkillIdsInFit.has(skillId)) {
        for (const a of modified.requiredSkill) {
          if (nonShipAttributeIds.has(a)) intersect.push(a);
        }
      }
      // Group-scoped modifiers: only relevant if the fit contains at least one type in that group
      for (const [groupId, attrs] of modified.byGroup) {
        if (!fitGroupIds.has(groupId)) continue;
        for (const a of attrs) {
          if (nonShipAttributeIds.has(a)) intersect.push(a);
        }
      }
      if (intersect.length) {
        // De-dupe per-skill
        const uniq = Array.from(new Set(intersect));
        influencingIds.push({ skillId, intersect: uniq });
      }
    }

    const influencingSkillIds = influencingIds.map((x) => x.skillId);
    const influencingSkillRows =
      influencingSkillIds.length === 0
        ? []
        : await this.prisma.typeId.findMany({
            where: { id: { in: influencingSkillIds } },
            select: { id: true, name: true },
          });
    const influencingNameById = new Map<number, string>();
    for (const r of influencingSkillRows) influencingNameById.set(r.id, r.name);

    const influencingSkills: SkillIssueInfluencingSkill[] = [];
    const influencingSorted = influencingIds.sort(
      (a, b) => a.skillId - b.skillId,
    );
    for (const x of influencingSorted) {
      const modifiedAttributeIds = x.intersect.sort((a, b) => a - b);
      const cats = new Set<SkillIssueInfluenceCategory>();
      for (const attrId of modifiedAttributeIds) {
        const c = categoryForAttrId(attrId);
        if (c) cats.add(c);
      }

      // Ship skill bonuses often modify shipBonus* attributes (e.g., shipBonusAC),
      // which then drive downstream effects that modify real fit stats.
      // If the direct attrs don't categorize well, enrich categories by following
      // shipBonus -> downstream modifiedAttributeID and checking what's actually present in this fit.
      const shipBonusIds = this.shipBonusAttributeIds;
      const shipBonusDownstream = this.shipBonusAttrToDownstreamModifiedAttrIds;
      if (shipBonusIds && shipBonusDownstream) {
        for (const attrId of modifiedAttributeIds) {
          if (!shipBonusIds.has(attrId)) continue;
          const downstream = shipBonusDownstream.get(attrId);
          if (!downstream) continue;
          for (const downAttrId of downstream) {
            if (!fitAttributeIds.has(downAttrId)) continue;
            const c = categoryForAttrId(downAttrId);
            if (c) cats.add(c);
          }
        }
      }

      // Proxy attributes (e.g., rig `drawback`) should be categorized based on the
      // effects actually present on this fit that consume the proxy and modify real stats.
      if (fitEffectIds.size) {
        for (const attrId of modifiedAttributeIds) {
          if (categoryForAttrId(attrId)) continue;
          const effectToModified =
            await this.getEffectToModifiedAttrsForModifyingAttr(attrId);
          if (!effectToModified.size) continue;
          for (const effectId of fitEffectIds) {
            const downstream = effectToModified.get(effectId);
            if (!downstream) continue;
            for (const downAttrId of downstream) {
              if (!fitAttributeIds.has(downAttrId)) continue;
              const c = categoryForAttrId(downAttrId);
              if (c) cats.add(c);
            }
          }
        }
      }

      const categories = sortCategories(cats);
      influencingSkills.push({
        skillId: x.skillId,
        skillName: influencingNameById.get(x.skillId) ?? null,
        modifiedAttributeIds,
        categories: categories.length ? categories : (['Other'] as const),
      });
    }

    return {
      fit: {
        shipName: parsed.shipName,
        shipTypeId,
        extractedTypeNames: parsed.extractedTypeNames,
        unresolvedTypeNames: unresolved,
        fitTypeIds,
      },
      requiredSkills,
      influencingSkills,
    };
  }
}
