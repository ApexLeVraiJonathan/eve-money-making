import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CharacterAttributesResponse,
  CharacterSkillsResponse,
  SkillFarmCharacterStatus,
  SkillFarmMathInputs,
  SkillFarmMathResult,
  SkillFarmRequirementEntry,
  SkillFarmSettings,
  SkillFarmTrackingSnapshot,
  SkillFarmTrackingEntry,
} from '@eve/api-contracts';
import { CharacterManagementService } from '../character-management/character-management.service';
import { SkillPlansService } from '../skill-plans/skill-plans.service';
import {
  estimateTrainingTimeSeconds,
  type AttributeSet,
  type SkillPrimaryAttribute,
} from '@eve/shared/skills';

const NON_EXTRACTABLE_SP = 5_500_000;
const EXTRACTOR_CHUNK_SP = 500_000;
const MIN_START_FARM_SP = 5_000_000;

// Skill type IDs (EVE type_id) for prerequisite skills.
// Sources: SDE / ESI ecosystems (e.g. everef).
const SKILL_ID_BIOLOGY = 3405;
const SKILL_ID_CYBERNETICS = 3411;

// Implant type IDs (EVE type_id) for the recommended training pod.
// We accept "+5 or better" by whitelisting known variants.
const IMPLANTS_PERCEPTION_AT_LEAST_5 = new Set<number>([
  10217, // Ocular Filter - Improved (+5)
  10218, // Ocular Filter - Advanced (+6)
  10219, // Ocular Filter - Elite (+7 / rare/unobtainable in some eras)
]);
const IMPLANTS_WILLPOWER_AT_LEAST_5 = new Set<number>([
  10213, // Neural Boost - Improved (+5)
  10214, // Neural Boost - Advanced (+6)
  10215, // Neural Boost - Elite (+7 / rare/unobtainable in some eras)
]);
const IMPLANT_BIOLOGY_BY_810 = 27148; // Eifyr and Co. 'Alchemist' Biology BY-810

@Injectable()
export class SkillFarmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characterManagement: CharacterManagementService,
    private readonly skillPlans: SkillPlansService,
  ) {}

  private buildClassicRemap(
    primary: SkillPrimaryAttribute,
    secondary: SkillPrimaryAttribute,
  ): AttributeSet {
    // Classic 27/21/17/17/17 pattern (base 17 + 10 + 4)
    const base: AttributeSet = {
      intelligence: 17,
      memory: 17,
      perception: 17,
      willpower: 17,
      charisma: 17,
    };
    base[primary] = 27;
    base[secondary] = 21;
    return base;
  }

  private countPrereqs(row: {
    prerequisite1Id: number | null;
    prerequisite2Id: number | null;
    prerequisite3Id: number | null;
  }): number {
    return (
      (row.prerequisite1Id ? 1 : 0) +
      (row.prerequisite2Id ? 1 : 0) +
      (row.prerequisite3Id ? 1 : 0)
    );
  }

  async previewFarmPlan(
    _userId: string,
    input: {
      primaryAttribute?:
        | 'intelligence'
        | 'memory'
        | 'perception'
        | 'willpower'
        | 'charisma';
      secondaryAttribute?:
        | 'intelligence'
        | 'memory'
        | 'perception'
        | 'willpower'
        | 'charisma';
      planDays?: number;
      minSkillDays?: number;
      maxPrerequisites?: number;
      maxSkills?: number;
      excludeNameContains?: string[];
    },
  ) {
    const primary = (input.primaryAttribute ??
      'intelligence') as SkillPrimaryAttribute;
    const secondary = (input.secondaryAttribute ??
      'memory') as SkillPrimaryAttribute;
    const planDays = Math.min(Math.max(input.planDays ?? 90, 30), 365);
    const minSkillDays = Math.min(Math.max(input.minSkillDays ?? 8, 1), 60);
    const maxPrereqs = Math.min(Math.max(input.maxPrerequisites ?? 1, 0), 3);
    const maxSkills = Math.min(Math.max(input.maxSkills ?? 12, 1), 50);
    const excludeNeedles = (input.excludeNameContains ?? [])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const attrs = this.buildClassicRemap(primary, secondary);
    const minSeconds = minSkillDays * 24 * 3600;
    const targetSeconds = planDays * 24 * 3600;

    const rows = await this.prisma.skillDefinition.findMany({
      where: {
        type: { published: true },
        rank: { not: null },
        primaryAttribute: primary,
        secondaryAttribute: secondary,
      },
      select: {
        typeId: true,
        rank: true,
        primaryAttribute: true,
        secondaryAttribute: true,
        prerequisite1Id: true,
        prerequisite1Level: true,
        prerequisite2Id: true,
        prerequisite2Level: true,
        prerequisite3Id: true,
        prerequisite3Level: true,
        type: { select: { name: true } },
      },
      orderBy: { type: { name: 'asc' } },
    });

    const candidates = rows
      .map((r) => {
        const rank = r.rank ?? 1;
        const prereqCount = this.countPrereqs({
          prerequisite1Id: r.prerequisite1Id ?? null,
          prerequisite2Id: r.prerequisite2Id ?? null,
          prerequisite3Id: r.prerequisite3Id ?? null,
        });
        const estSeconds = estimateTrainingTimeSeconds({
          currentLevel: 0,
          targetLevel: 5,
          rank,
          attrs,
          primary,
          secondary,
        });
        return {
          skillId: r.typeId,
          name: r.type.name,
          rank,
          primaryAttribute: r.primaryAttribute,
          secondaryAttribute: r.secondaryAttribute,
          prerequisites: [
            r.prerequisite1Id
              ? {
                  skillId: r.prerequisite1Id,
                  level: r.prerequisite1Level ?? 1,
                }
              : null,
            r.prerequisite2Id
              ? {
                  skillId: r.prerequisite2Id,
                  level: r.prerequisite2Level ?? 1,
                }
              : null,
            r.prerequisite3Id
              ? {
                  skillId: r.prerequisite3Id,
                  level: r.prerequisite3Level ?? 1,
                }
              : null,
          ].filter((x): x is { skillId: number; level: number } => !!x),
          prereqCount,
          estimatedSecondsToV: estSeconds,
        };
      })
      .filter((c) => c.prereqCount <= maxPrereqs)
      .filter((c) => c.estimatedSecondsToV >= minSeconds)
      .filter((c) => {
        if (excludeNeedles.length === 0) return true;
        const name = c.name.toLowerCase();
        return !excludeNeedles.some((needle) => name.includes(needle));
      })
      .sort((a, b) => b.estimatedSecondsToV - a.estimatedSecondsToV);

    const picked: typeof candidates = [];
    let total = 0;
    for (const c of candidates) {
      if (picked.length >= maxSkills) break;
      picked.push(c);
      total += c.estimatedSecondsToV;
      if (total >= targetSeconds) break;
    }

    const roman = ['I', 'II', 'III', 'IV', 'V'];
    const planName = `Skill Farm - ${primary}/${secondary} Crop (${planDays}d)`;
    const textLines: string[] = [];
    textLines.push(`[Skill Plan] ${planName}`);
    textLines.push('');
    for (const step of picked) {
      textLines.push(`${step.name} ${roman[4]}`);
    }

    return {
      planName,
      recommendedAttributes: attrs,
      assumptions: {
        primary,
        secondary,
        minSkillDays,
        planDays,
        maxPrereqs,
        maxSkills,
      },
      totalEstimatedSeconds: total,
      steps: picked.map((s, idx) => ({
        order: idx,
        skillId: s.skillId,
        name: s.name,
        targetLevel: 5,
        rank: s.rank,
        estimatedSecondsToV: s.estimatedSecondsToV,
        prerequisites: s.prerequisites,
      })),
      eveImportText: textLines.join('\n'),
      notes: [
        'This is a crop-skill list only (prereq skills are not included in the text). Ensure each character can inject these skills first.',
        'For “cheap books”, verify skillbook prices in-market before committing; SDE does not encode book cost.',
      ],
    };
  }

  private toRequirement(
    key: string,
    label: string,
    ok: boolean,
    details?: string,
  ): SkillFarmRequirementEntry {
    return {
      key,
      label,
      status: ok ? 'pass' : 'fail',
      details: details ?? null,
    };
  }

  private getTrainedSkillLevel(
    skills: CharacterSkillsResponse,
    skillId: number,
  ): number {
    const row = skills.skills.find((s) => s.skillId === skillId);
    return row?.trainedSkillLevel ?? 0;
  }

  private errorToReason(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    return 'Unknown error';
  }

  async getSettingsForUser(userId: string): Promise<SkillFarmSettings> {
    const row = await this.prisma.skillFarmSettings.findFirst({
      where: { userId },
    });

    if (!row) {
      const nowIso = new Date().toISOString();
      return {
        plexPriceIsk: null,
        plexPerOmega: null,
        plexPerMct: null,
        extractorPriceIsk: null,
        injectorPriceIsk: null,
        boosterCostPerCycleIsk: null,
        salesTaxPercent: null,
        brokerFeePercent: null,
        soldViaContracts: false,
        cycleDays: null,
        managementMinutesPerCycle: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    return {
      plexPriceIsk: row.plexPriceIsk ? Number(row.plexPriceIsk) : null,
      plexPerOmega: row.plexPerOmega,
      plexPerMct: row.plexPerMct,
      extractorPriceIsk: row.extractorPriceIsk
        ? Number(row.extractorPriceIsk)
        : null,
      injectorPriceIsk: row.injectorPriceIsk
        ? Number(row.injectorPriceIsk)
        : null,
      boosterCostPerCycleIsk: row.boosterCostPerCycleIsk
        ? Number(row.boosterCostPerCycleIsk)
        : null,
      salesTaxPercent: row.salesTaxPercent ? Number(row.salesTaxPercent) : null,
      brokerFeePercent: row.brokerFeePercent
        ? Number(row.brokerFeePercent)
        : null,
      soldViaContracts: row.soldViaContracts,
      cycleDays: row.cycleDays,
      managementMinutesPerCycle: row.managementMinutesPerCycle,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateSettingsForUser(
    userId: string,
    input: Partial<SkillFarmSettings>,
  ): Promise<SkillFarmSettings> {
    const existing = await this.prisma.skillFarmSettings.findFirst({
      where: { userId },
      select: { id: true },
    });

    const data: any = {
      plexPriceIsk: input.plexPriceIsk ?? null,
      plexPerOmega: input.plexPerOmega ?? null,
      plexPerMct: input.plexPerMct ?? null,
      extractorPriceIsk: input.extractorPriceIsk ?? null,
      injectorPriceIsk: input.injectorPriceIsk ?? null,
      boosterCostPerCycleIsk: input.boosterCostPerCycleIsk ?? null,
      salesTaxPercent: input.salesTaxPercent ?? null,
      brokerFeePercent: input.brokerFeePercent ?? null,
      soldViaContracts:
        input.soldViaContracts !== undefined
          ? input.soldViaContracts
          : undefined,
      cycleDays: input.cycleDays ?? null,
      managementMinutesPerCycle: input.managementMinutesPerCycle ?? null,
    };

    const row = existing
      ? await this.prisma.skillFarmSettings.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.skillFarmSettings.create({
          data: { userId, ...data },
        });

    return this.getSettingsForUser(userId);
  }

  private async ensureOwnedCharacter(userId: string, characterId: number) {
    const owned = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });
    if (!owned) {
      throw new ForbiddenException('Character does not belong to current user');
    }
  }

  async listCharactersWithStatus(
    userId: string,
  ): Promise<SkillFarmCharacterStatus[]> {
    const now = new Date();

    const [user, configs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          characters: {
            select: {
              id: true,
              name: true,
              eveAccountId: true,
            },
            orderBy: { name: 'asc' },
          },
        },
      }),
      this.prisma.skillFarmCharacterConfig.findMany({
        where: { userId },
      }),
    ]);

    if (!user) return [];

    const configByChar = new Map<number, (typeof configs)[number]>();
    for (const cfg of configs) {
      configByChar.set(cfg.characterId, cfg);
    }

    const accountIds = Array.from(
      new Set(
        user.characters
          .map((c) => c.eveAccountId)
          .filter((x): x is string => !!x),
      ),
    );

    const subs =
      accountIds.length > 0
        ? await this.prisma.eveAccountSubscription.findMany({
            where: {
              eveAccountId: { in: accountIds },
              isActive: true,
              expiresAt: { gt: now },
              type: { in: ['PLEX'] },
            },
            select: { eveAccountId: true, type: true },
          })
        : [];

    const isPlexedByAccount = new Map<string, boolean>();
    for (const accountId of accountIds) {
      isPlexedByAccount.set(accountId, false);
    }
    for (const s of subs) {
      if (!s.eveAccountId) continue;
      if (s.type === 'PLEX') {
        isPlexedByAccount.set(s.eveAccountId, true);
      }
    }

    const result: SkillFarmCharacterStatus[] = [];

    const fetched = new Map<
      number,
      {
        skills:
          | { ok: true; value: CharacterSkillsResponse }
          | { ok: false; reason: string };
        attrs:
          | { ok: true; value: CharacterAttributesResponse }
          | { ok: false; reason: string };
        clones:
          | {
              ok: true;
              value: Awaited<
                ReturnType<CharacterManagementService['getCharacterClones']>
              >;
            }
          | { ok: false; reason: string };
        activeImplants:
          | { ok: true; value: number[] }
          | { ok: false; reason: string };
      }
    >();

    // Fetch ESI-backed snapshots per character. Keep this sequential per character
    // to be gentle on ESI rate limits while still parallelising within a character.
    for (const c of user.characters) {
      const [skillsRes, attrsRes, clonesRes, activeImplantsRes] =
        await Promise.allSettled([
          this.characterManagement.getCharacterSkills(userId, c.id),
          this.characterManagement.getCharacterAttributes(userId, c.id),
          this.characterManagement.getCharacterClones(userId, c.id),
          this.characterManagement
            .getCharacterImplants(userId, c.id)
            .then((x) => x.implants),
        ]);

      const skills =
        skillsRes.status === 'fulfilled'
          ? ({ ok: true, value: skillsRes.value } as const)
          : ({
              ok: false,
              reason: this.errorToReason(skillsRes.reason),
            } as const);
      const attrs =
        attrsRes.status === 'fulfilled'
          ? ({ ok: true, value: attrsRes.value } as const)
          : ({
              ok: false,
              reason: this.errorToReason(attrsRes.reason),
            } as const);
      const clones =
        clonesRes.status === 'fulfilled'
          ? ({ ok: true, value: clonesRes.value } as const)
          : ({
              ok: false,
              reason: this.errorToReason(clonesRes.reason),
            } as const);
      const activeImplants =
        activeImplantsRes.status === 'fulfilled'
          ? ({ ok: true, value: activeImplantsRes.value } as const)
          : ({
              ok: false,
              reason: this.errorToReason(activeImplantsRes.reason),
            } as const);

      fetched.set(c.id, { skills, attrs, clones, activeImplants });
    }

    for (const c of user.characters) {
      const snapshot = fetched.get(c.id);
      if (!snapshot) continue;

      const totalSp = snapshot.skills.ok
        ? (snapshot.skills.value.totalSp ?? 0)
        : 0;
      const nonExtractableSp = Math.min(totalSp, NON_EXTRACTABLE_SP);

      const biology = snapshot.skills.ok
        ? this.getTrainedSkillLevel(snapshot.skills.value, SKILL_ID_BIOLOGY)
        : 0;
      const cybernetics = snapshot.skills.ok
        ? this.getTrainedSkillLevel(snapshot.skills.value, SKILL_ID_CYBERNETICS)
        : 0;

      const minSpReq = snapshot.skills.ok
        ? this.toRequirement(
            'minSp',
            'Minimum 5.0M SP',
            totalSp >= MIN_START_FARM_SP,
            `Total SP: ${totalSp.toLocaleString()} (target: ${MIN_START_FARM_SP.toLocaleString()})`,
          )
        : ({
            key: 'minSp',
            label: 'Minimum 5.0M SP',
            status: 'warning',
            details: `Could not load skills: ${snapshot.skills.reason}`,
          } satisfies SkillFarmRequirementEntry);

      const biologyReq = snapshot.skills.ok
        ? this.toRequirement(
            'biology',
            'Biology V',
            biology >= 5,
            `Current level: ${biology}`,
          )
        : ({
            key: 'biology',
            label: 'Biology V',
            status: 'warning',
            details: `Could not load skills: ${snapshot.skills.reason}`,
          } satisfies SkillFarmRequirementEntry);

      const cyberneticsReq = snapshot.skills.ok
        ? this.toRequirement(
            'cybernetics',
            'Cybernetics V',
            cybernetics >= 5,
            `Current level: ${cybernetics}`,
          )
        : ({
            key: 'cybernetics',
            label: 'Cybernetics V',
            status: 'warning',
            details: `Could not load skills: ${snapshot.skills.reason}`,
          } satisfies SkillFarmRequirementEntry);

      const remapReq = snapshot.attrs.ok
        ? (() => {
            const attrs = snapshot.attrs.value;
            const bonusRemaps = attrs.bonusRemaps ?? 0;
            const cooldownIso = attrs.accruedRemapCooldownDate;
            const cooldownDate = cooldownIso ? new Date(cooldownIso) : null;
            const cooldownPassed = cooldownDate ? cooldownDate <= now : true;
            const remapAvailable = bonusRemaps > 0 || cooldownPassed;
            return this.toRequirement(
              'remap',
              'At least one remap available',
              remapAvailable,
              cooldownIso
                ? `Bonus remaps: ${bonusRemaps}. Cooldown: ${cooldownIso}`
                : `Bonus remaps: ${bonusRemaps}. Cooldown: none`,
            );
          })()
        : ({
            key: 'remap',
            label: 'At least one remap available',
            status: 'warning',
            details: `Could not load attributes: ${snapshot.attrs.reason}`,
          } satisfies SkillFarmRequirementEntry);

      const accountId = c.eveAccountId ?? null;
      let trainingReq: SkillFarmRequirementEntry;
      if (!accountId) {
        trainingReq = {
          key: 'training',
          label: 'Account is Omega (PLEX period active)',
          status: 'warning',
          details:
            'Character is not assigned to an account; assign it in /characters/accounts so Omega status can be computed.',
        };
      } else {
        const isPlexed = isPlexedByAccount.get(accountId) ?? false;
        trainingReq = this.toRequirement(
          'training',
          'Account is Omega (PLEX period active)',
          isPlexed,
          isPlexed
            ? 'Active PLEX period found for the assigned account.'
            : 'No active PLEX period found for the assigned account.',
        );
      }

      const implantsReq =
        snapshot.activeImplants.ok || snapshot.clones.ok
          ? (() => {
              const active = snapshot.activeImplants.ok
                ? snapshot.activeImplants.value
                : [];
              const jumpClones = snapshot.clones.ok
                ? snapshot.clones.value.jumpClones
                : [];

              const cloneSets: Array<{
                label: string;
                implantIds: number[];
              }> = [];

              cloneSets.push({
                label: 'Active clone',
                implantIds: active,
              });

              for (const jc of jumpClones) {
                cloneSets.push({
                  label: jc.name
                    ? `Jump clone: ${jc.name}`
                    : `Jump clone: ${jc.jumpCloneId}`,
                  implantIds: jc.implantIds ?? [],
                });
              }

              const matches = (implantIds: number[]) => {
                const hasPerception = implantIds.some((id) =>
                  IMPLANTS_PERCEPTION_AT_LEAST_5.has(id),
                );
                const hasWillpower = implantIds.some((id) =>
                  IMPLANTS_WILLPOWER_AT_LEAST_5.has(id),
                );
                const hasBy810 = implantIds.includes(IMPLANT_BIOLOGY_BY_810);
                return { hasPerception, hasWillpower, hasBy810 };
              };

              const matchSet = cloneSets.find((set) => {
                const m = matches(set.implantIds);
                return m.hasPerception && m.hasWillpower && m.hasBy810;
              });

              if (matchSet) {
                return this.toRequirement(
                  'implants',
                  '+5 training pod & Biology implant',
                  true,
                  `Found in: ${matchSet.label}`,
                );
              }

              // Not present together in any single clone
              const combined = Array.from(
                new Set<number>(cloneSets.flatMap((s) => s.implantIds)),
              );
              const combinedMatch = matches(combined);

              const missing: string[] = [];
              if (!combinedMatch.hasPerception)
                missing.push('+5 (or better) Perception implant');
              if (!combinedMatch.hasWillpower)
                missing.push('+5 (or better) Willpower implant');
              if (!combinedMatch.hasBy810)
                missing.push("Eifyr and Co. 'Alchemist' Biology BY-810");

              const hasAllSomewhere =
                combinedMatch.hasPerception &&
                combinedMatch.hasWillpower &&
                combinedMatch.hasBy810;

              return this.toRequirement(
                'implants',
                '+5 training pod & Biology implant',
                false,
                hasAllSomewhere
                  ? 'Implants exist across clones, but not together in a single clone.'
                  : `Missing: ${missing.join(', ')}`,
              );
            })()
          : ({
              key: 'implants',
              label: '+5 training pod & Biology implant',
              status: 'warning',
              details: `Could not load clone implants: active=${
                snapshot.activeImplants.ok
                  ? 'ok'
                  : snapshot.activeImplants.reason
              }, clones=${snapshot.clones.ok ? 'ok' : snapshot.clones.reason}`,
            } satisfies SkillFarmRequirementEntry);

      const cfg = configByChar.get(c.id);

      result.push({
        characterId: c.id,
        name: c.name,
        portraitUrl: null,
        totalSp,
        nonExtractableSp,
        requirements: {
          minSp: minSpReq,
          biology: biologyReq,
          cybernetics: cyberneticsReq,
          remap: remapReq,
          training: trainingReq,
          implants: implantsReq,
        },
        config: {
          characterId: c.id,
          name: c.name,
          implantSet: null,
          trainingPlanName: null,
          isActive: cfg?.isActiveFarm ?? false,
          isCandidate: cfg?.isCandidate ?? false,
          farmPlanId: cfg?.farmPlanId ?? null,
          farmPlanName: null,
          includeInNotifications: cfg?.includeInNotifications ?? true,
        },
      });
    }

    return result;
  }

  async updateCharacterConfig(
    userId: string,
    characterId: number,
    input: {
      isCandidate?: boolean;
      isActiveFarm?: boolean;
      farmPlanId?: string | null;
      includeInNotifications?: boolean;
    },
  ) {
    await this.ensureOwnedCharacter(userId, characterId);

    const existing = await this.prisma.skillFarmCharacterConfig.findFirst({
      where: { userId, characterId },
      select: { id: true },
    });

    const data: any = {
      isCandidate: input.isCandidate ?? undefined,
      isActiveFarm: input.isActiveFarm ?? undefined,
      farmPlanId: input.farmPlanId !== undefined ? input.farmPlanId : undefined,
      includeInNotifications:
        input.includeInNotifications !== undefined
          ? input.includeInNotifications
          : undefined,
    };

    if (existing) {
      await this.prisma.skillFarmCharacterConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.skillFarmCharacterConfig.create({
        data: {
          userId,
          characterId,
          isCandidate: input.isCandidate ?? false,
          isActiveFarm: input.isActiveFarm ?? false,
          farmPlanId: input.farmPlanId ?? null,
          includeInNotifications: input.includeInNotifications ?? true,
        },
      });
    }

    // Return fresh list so the client can refresh
    return this.listCharactersWithStatus(userId);
  }

  async getTrackingSnapshot(
    userId: string,
  ): Promise<SkillFarmTrackingSnapshot> {
    const configs = await this.prisma.skillFarmCharacterConfig.findMany({
      where: { userId, isActiveFarm: true },
      include: {
        character: {
          select: { id: true, name: true },
        },
        farmPlan: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const characters: SkillFarmTrackingEntry[] = [];

    for (const cfg of configs) {
      const characterId = cfg.characterId;
      const [skills, queue] = await Promise.all([
        this.characterManagement.getCharacterSkills(userId, characterId),
        this.characterManagement.getCharacterTrainingQueue(userId, characterId),
      ]);

      const totalSp = skills.totalSp ?? 0;
      const nonExtractableSp = Math.min(totalSp, NON_EXTRACTABLE_SP);

      // For V1, treat all SP above the floor as farm-plan SP.
      const farmPlanSp = Math.max(0, totalSp - nonExtractableSp);

      const { extractableSp, fullExtractors, remainder } =
        this.computeExtractable(totalSp, farmPlanSp);

      const spPerSecond = this.estimateSpPerSecondFromQueue(queue, skills);
      let etaSeconds: number | null = null;
      if (spPerSecond > 0) {
        const missingForNext =
          EXTRACTOR_CHUNK_SP - (remainder % EXTRACTOR_CHUNK_SP);
        etaSeconds =
          missingForNext > 0 ? Math.floor(missingForNext / spPerSecond) : 0;
      }

      const queueSecondsRemaining = queue.totalRemainingSeconds ?? 0;
      let queueStatus: 'OK' | 'WARNING' | 'URGENT' | 'EMPTY' = 'OK';
      if (queue.isQueueEmpty || queueSecondsRemaining <= 0) {
        queueStatus = 'EMPTY';
      } else if (queueSecondsRemaining <= 24 * 3600) {
        queueStatus = 'URGENT';
      } else if (queueSecondsRemaining <= 3 * 24 * 3600) {
        queueStatus = 'WARNING';
      }

      characters.push({
        characterId,
        name: cfg.character.name,
        farmPlanId: cfg.farmPlanId,
        farmPlanName: cfg.farmPlan?.name ?? null,
        totalSp,
        nonExtractableSp,
        farmPlanSp,
        extractableSp,
        fullExtractorsReady: fullExtractors,
        remainderSp: remainder,
        etaToNextExtractorSeconds: etaSeconds,
        queueStatus,
        queueSecondsRemaining,
      });
    }

    return {
      characters,
      generatedAt: new Date().toISOString(),
    };
  }

  computeMath(inputs: SkillFarmMathInputs): SkillFarmMathResult {
    const cycleDays = inputs.settings.cycleDays ?? 30;
    const cycleSeconds = cycleDays * 24 * 3600;
    const spPerDay =
      inputs.spPerDayPerCharacter && inputs.spPerDayPerCharacter > 0
        ? inputs.spPerDayPerCharacter
        : 0;
    const spPerCycle = spPerDay * cycleDays;
    const extractorsPerCycle = Math.max(
      0,
      Math.floor(spPerCycle / EXTRACTOR_CHUNK_SP),
    );
    const injectorsPerCycle = extractorsPerCycle;

    const plexPrice = inputs.settings.plexPriceIsk ?? 0;
    const plexPerOmega = inputs.settings.plexPerOmega ?? 0;
    const plexPerMct = inputs.settings.plexPerMct ?? 0;
    const extractorPrice = inputs.settings.extractorPriceIsk ?? 0;
    const injectorPrice = inputs.settings.injectorPriceIsk ?? 0;
    const boosterCost = inputs.settings.boosterCostPerCycleIsk ?? 0;
    const salesTaxPct = (inputs.settings.salesTaxPercent ?? 0) / 100;
    const brokerPct = (inputs.settings.brokerFeePercent ?? 0) / 100;

    const accounts = inputs.accounts || 0;
    const charsPerAccount = inputs.farmCharactersPerAccount || 0;
    const totalCharacters = accounts * charsPerAccount;

    const perCharacterCosts =
      (plexPerOmega > 0 ? plexPerOmega * plexPrice : 0) +
      boosterCost +
      extractorPrice * extractorsPerCycle;

    const grossRevenue = injectorPrice * injectorsPerCycle;
    const feeMultiplier = inputs.settings.soldViaContracts
      ? 1
      : 1 - salesTaxPct - brokerPct;
    const netRevenue = grossRevenue * feeMultiplier;

    const perCharNet = netRevenue - perCharacterCosts;

    const perCharacter: any = {
      spPerDay,
      spPerCycle,
      extractorsPerCycle,
      injectorsPerCycle,
      totalCostsIsk: perCharacterCosts,
      grossRevenueIsk: grossRevenue,
      netProfitIsk: perCharNet,
    };

    const perAccount: any[] = [];
    for (let i = 0; i < accounts; i++) {
      perAccount.push({
        ...perCharacter,
        netProfitIsk: perCharNet * charsPerAccount,
        totalCostsIsk: perCharacterCosts * charsPerAccount,
        grossRevenueIsk: grossRevenue * charsPerAccount,
      });
    }

    const total: any = {
      ...perCharacter,
      netProfitIsk: perCharNet * totalCharacters,
      totalCostsIsk: perCharacterCosts * totalCharacters,
      grossRevenueIsk: grossRevenue * totalCharacters,
    };

    const managementMinutes = inputs.settings.managementMinutesPerCycle ?? 0;
    const hours =
      managementMinutes > 0 ? managementMinutes / 60 : cycleSeconds / 3600;
    const iskPerHour = hours > 0 ? total.netProfitIsk / hours : 0;

    return {
      inputs,
      perCharacter,
      perAccount,
      total,
      iskPerHour,
    };
  }

  private computeExtractable(totalSp: number, farmPlanSp: number) {
    const availableAboveFloor = Math.max(0, totalSp - NON_EXTRACTABLE_SP);
    const usableSp = Math.min(availableAboveFloor, farmPlanSp);
    const fullExtractors = Math.floor(usableSp / EXTRACTOR_CHUNK_SP);
    const remainder = usableSp - fullExtractors * EXTRACTOR_CHUNK_SP;
    return {
      extractableSp: usableSp,
      fullExtractors,
      remainder,
    };
  }

  private estimateSpPerSecondFromQueue(
    queue: CharacterAttributesResponse | any,
    _skills: CharacterSkillsResponse,
  ): number {
    // V1: we do not yet compute exact SP/hour; return 0 so ETA is null.
    return 0;
  }
}
