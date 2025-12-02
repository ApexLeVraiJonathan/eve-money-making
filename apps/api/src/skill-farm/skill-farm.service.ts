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

const NON_EXTRACTABLE_SP = 5_500_000;
const EXTRACTOR_CHUNK_SP = 500_000;

@Injectable()
export class SkillFarmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characterManagement: CharacterManagementService,
    private readonly skillPlans: SkillPlansService,
  ) {}

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
    const [user, configs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          characters: {
            select: {
              id: true,
              name: true,
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

    const result: SkillFarmCharacterStatus[] = [];

    for (const c of user.characters) {
      // Load live skill data for this character
      const [skills, attrs] = await Promise.all([
        this.characterManagement.getCharacterSkills(userId, c.id),
        this.characterManagement.getCharacterAttributes(userId, c.id),
      ]);

      const totalSp = skills.totalSp ?? 0;
      const nonExtractableSp = Math.min(totalSp, NON_EXTRACTABLE_SP);

      const biology = this.findSkillLevel(skills, 'Biology');
      const cybernetics = this.findSkillLevel(skills, 'Cybernetics');

      const minSpReq = this.toRequirement(
        'minSp',
        'Minimum 5.5M SP',
        totalSp >= NON_EXTRACTABLE_SP,
        `Total SP: ${totalSp.toLocaleString()} (non-extractable floor: ${NON_EXTRACTABLE_SP.toLocaleString()})`,
      );

      const biologyReq = this.toRequirement(
        'biology',
        'Biology V',
        biology >= 5,
        `Current level: ${biology}`,
      );

      const cyberneticsReq = this.toRequirement(
        'cybernetics',
        'Cybernetics V',
        cybernetics >= 5,
        `Current level: ${cybernetics}`,
      );

      const remapReq = this.toRequirement(
        'remap',
        'At least one remap available',
        (attrs.bonusRemaps ?? 0) > 0,
        `Bonus remaps: ${attrs.bonusRemaps ?? 0}`,
      );

      // Training capability: for V1 mark as pass if they have any skills and a non-empty queue
      const queue = await this.characterManagement.getCharacterTrainingQueue(
        userId,
        c.id,
      );
      const canTrain = !queue.isQueueEmpty;
      const trainingReq = this.toRequirement(
        'training',
        'Character can train skills (Omega/MCT & queue)',
        canTrain,
        canTrain
          ? 'Training queue active'
          : 'Training queue empty or character not training',
      );

      // Implants: V1 placeholder until cloning/implant data is wired
      const implantsReq: SkillFarmRequirementEntry = {
        key: 'implants',
        label: '+5 training pod & Biology implant',
        status: 'warning',
        details:
          'Implant data not yet wired; treat this as a manual checklist item for now.',
      };

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

  private findSkillLevel(
    skills: CharacterSkillsResponse,
    skillNameContains: string,
  ): number {
    // We do not yet have names on CharacterSkillsResponse; treat as unknown for now.
    // Placeholder: just return 0 so the requirement shows as missing.
    return 0;
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
