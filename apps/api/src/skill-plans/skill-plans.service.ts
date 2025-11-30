import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  suggestAttributesForPlan,
  estimateTrainingTimeSeconds,
  type AttributeSet,
  type PlanStepForOptimization,
  type SkillPrimaryAttribute,
} from '@eve/shared/skills';
import { getSkillSubgroupForSkill } from './skill-subgroups.config';
import type {
  CharacterAttributesResponse,
  CharacterSkillsResponse,
  SkillPrerequisite,
  SkillPlanImportFormat,
} from '@eve/api-contracts';
import { EsiCharactersService } from '../esi/esi-characters.service';
import { CharacterManagementService } from '../character-management/character-management.service';
import { previewImportEveFormat } from './domain/skill-plan-parser';

@Injectable()
export class SkillPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esiChars: EsiCharactersService,
    private readonly characterManagement: CharacterManagementService,
  ) {}

  async listPlansForUser(userId: string) {
    const plans = await this.prisma.skillPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        totalEstimatedTimeSeconds: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { steps: true } },
      },
    });

    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      totalEstimatedTimeSeconds: p.totalEstimatedTimeSeconds,
      stepsCount: p._count.steps,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async previewImportSkillPlan(
    _userId: string,
    input: { text: string; format: SkillPlanImportFormat; nameHint?: string },
  ) {
    const trimmed = input.text.trim();
    if (!trimmed) {
      throw new BadRequestException('Import text is empty');
    }

    if (input.format === 'eve') {
      return await previewImportEveFormat(this.prisma, trimmed, input.nameHint);
    }

    // App format will be added in a follow-up iteration.
    throw new BadRequestException(
      'App format import is not yet supported; use EVE format for now.',
    );
  }

  async importPlanFromTextForUser(
    userId: string,
    planId: string,
    input: { text: string; format: SkillPlanImportFormat; nameHint?: string },
  ) {
    const preview = await this.previewImportSkillPlan(userId, input);

    // Persist the parsed steps into the existing plan, replacing current steps.
    return await this.prisma.$transaction(async (tx) => {
      const plan = await tx.skillPlan.findFirst({
        where: { id: planId, userId },
        select: { id: true, name: true, description: true },
      });

      if (!plan) {
        throw new NotFoundException('Skill plan not found');
      }

      // Replace all steps
      await tx.skillPlanStep.deleteMany({ where: { planId } });

      if (preview.plan.steps.length > 0) {
        await tx.skillPlanStep.createMany({
          data: preview.plan.steps.map((s, idx) => ({
            planId,
            skillId: s.skillId,
            targetLevel: s.targetLevel,
            order: s.order ?? idx,
            notes: s.notes ?? null,
          })),
        });
      }

      const full = await tx.skillPlan.findUnique({
        where: { id: planId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });

      if (!full) {
        throw new NotFoundException('Skill plan not found after import');
      }

      return {
        id: full.id,
        name: full.name,
        description: full.description,
        totalEstimatedTimeSeconds: full.totalEstimatedTimeSeconds,
        createdAt: full.createdAt.toISOString(),
        updatedAt: full.updatedAt.toISOString(),
        steps: full.steps.map((s) => ({
          id: s.id,
          skillId: s.skillId,
          targetLevel: s.targetLevel,
          order: s.order,
          notes: s.notes,
        })),
        issues: preview.issues,
      };
    });
  }

  async searchSkillCatalog(query: string, limit: number) {
    const rows = await this.prisma.skillDefinition.findMany({
      where: {
        type: {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
      },
      select: {
        typeId: true,
        groupId: true,
        rank: true,
        primaryAttribute: true,
        secondaryAttribute: true,
        type: { select: { name: true } },
      },
      take: limit,
      orderBy: {
        type: { name: 'asc' },
      },
    });

    return rows.map((r) => ({
      typeId: r.typeId,
      name: r.type.name,
      groupId: r.groupId,
      rank: r.rank ?? null,
      primaryAttribute: r.primaryAttribute ?? null,
      secondaryAttribute: r.secondaryAttribute ?? null,
    }));
  }

  /**
   * Parse prerequisites for a skill from typeDogma data
   * Returns array of {skillId, requiredLevel} tuples
   */
  private async getSkillPrerequisites(
    typeId: number,
    typeDogmaPath: string,
  ): Promise<Array<{ skillId: number; requiredLevel: number }>> {
    // For performance, we'd ideally cache this or load all at once
    // For now, we'll return empty since full parsing would be slow
    return [];
  }

  /**
   * Get full skill encyclopedia with all skills organized by category/group.
   * Prerequisites are loaded from SDE typeDogma data.
   */
  async getSkillEncyclopedia() {
    const skills = await this.prisma.skillDefinition.findMany({
      where: {
        type: { published: true },
      },
      select: {
        typeId: true,
        groupId: true,
        nameEn: true,
        descriptionEn: true,
        rank: true,
        primaryAttribute: true,
        secondaryAttribute: true,
        prerequisite1Id: true,
        prerequisite1Level: true,
        prerequisite2Id: true,
        prerequisite2Level: true,
        prerequisite3Id: true,
        prerequisite3Level: true,
        type: {
          select: {
            name: true,
            published: true,
          },
        },
      },
      orderBy: [{ groupId: 'asc' }, { type: { name: 'asc' } }],
    });

    // Build a lookup map for skill names (for prerequisites)
    const skillNameMap = new Map<number, string>();
    for (const skill of skills) {
      skillNameMap.set(skill.typeId, skill.nameEn || skill.type.name);
    }

    // Group skills by groupId
    const groupMap = new Map<
      number,
      Array<{
        skillId: number;
        name: string;
        description: string;
        primaryAttribute: string;
        secondaryAttribute: string;
        trainingMultiplier: number;
        spLevel1: number;
        spLevel2: number;
        spLevel3: number;
        spLevel4: number;
        spLevel5: number;
        prerequisites: SkillPrerequisite[];
        requiredBy: SkillPrerequisite[];
        categoryId: number;
        categoryName: string;
        groupId: number;
        groupName: string;
        subGroupKey?: string | null;
        subGroupLabel?: string | null;
        published: boolean;
      }>
    >();

    // Process each published skill into encyclopedia entries
    for (const skill of skills) {
      const rank = skill.rank ?? 1;

      const { subGroupKey, subGroupLabel } = getSkillSubgroupForSkill(
        skill.groupId,
        skill.typeId,
      );

      // Compute cumulative SP thresholds for each level using the standard EVE formula:
      // SP(level) = 250 * rank * 2^(2.5 * (level - 1))
      const spLevel1 = Math.floor(250 * rank * Math.pow(2, 2.5 * 0)); // 250 * rank
      const spLevel2 = Math.floor(250 * rank * Math.pow(2, 2.5 * 1)); // ~1,414 * rank
      const spLevel3 = Math.floor(250 * rank * Math.pow(2, 2.5 * 2)); // 8,000 * rank
      const spLevel4 = Math.floor(250 * rank * Math.pow(2, 2.5 * 3)); // ~45,255 * rank
      const spLevel5 = Math.floor(250 * rank * Math.pow(2, 2.5 * 4)); // 256,000 * rank

      // Build prerequisites array
      const prerequisites: SkillPrerequisite[] = [];

      if (skill.prerequisite1Id && skill.prerequisite1Level) {
        prerequisites.push({
          skillId: skill.prerequisite1Id,
          skillName:
            skillNameMap.get(skill.prerequisite1Id) ||
            `Skill ${skill.prerequisite1Id}`,
          requiredLevel: skill.prerequisite1Level,
        });
      }

      if (skill.prerequisite2Id && skill.prerequisite2Level) {
        prerequisites.push({
          skillId: skill.prerequisite2Id,
          skillName:
            skillNameMap.get(skill.prerequisite2Id) ||
            `Skill ${skill.prerequisite2Id}`,
          requiredLevel: skill.prerequisite2Level,
        });
      }

      if (skill.prerequisite3Id && skill.prerequisite3Level) {
        prerequisites.push({
          skillId: skill.prerequisite3Id,
          skillName:
            skillNameMap.get(skill.prerequisite3Id) ||
            `Skill ${skill.prerequisite3Id}`,
          requiredLevel: skill.prerequisite3Level,
        });
      }

      const skillEntry = {
        skillId: skill.typeId,
        name: skill.nameEn || skill.type.name,
        description: skill.descriptionEn || '',
        primaryAttribute: skill.primaryAttribute || 'intelligence',
        secondaryAttribute: skill.secondaryAttribute || 'memory',
        trainingMultiplier: rank,
        spLevel1,
        spLevel2,
        spLevel3,
        spLevel4,
        spLevel5,
        prerequisites,
        requiredBy: [],
        categoryId: 16, // Skills category
        categoryName: 'Skills',
        groupId: skill.groupId,
        groupName: this.getGroupName(skill.groupId),
        subGroupKey,
        subGroupLabel,
        published: skill.type.published,
      };

      if (!groupMap.has(skill.groupId)) {
        groupMap.set(skill.groupId, []);
      }
      groupMap.get(skill.groupId)!.push(skillEntry);
    }

    // Build reverse prerequisite (required-by) map
    const requiredByMap = new Map<number, SkillPrerequisite[]>();
    for (const groupSkills of groupMap.values()) {
      for (const skill of groupSkills) {
        for (const prereq of skill.prerequisites) {
          const existing = requiredByMap.get(prereq.skillId) ?? [];
          existing.push({
            skillId: skill.skillId,
            skillName: skill.name,
            requiredLevel: prereq.requiredLevel,
          });
          requiredByMap.set(prereq.skillId, existing);
        }
      }
    }

    // Attach required-by lists to each skill entry
    for (const groupSkills of groupMap.values()) {
      for (const skill of groupSkills) {
        skill.requiredBy = requiredByMap.get(skill.skillId) ?? [];
      }
    }

    // Build category summary
    const categories = [
      {
        categoryId: 16,
        categoryName: 'Skills',
        groups: Array.from(groupMap.entries()).map(
          ([groupId, groupSkills]) => ({
            groupId,
            groupName: this.getGroupName(groupId),
            skillCount: groupSkills.length,
          }),
        ),
        totalSkillCount: skills.length,
      },
    ];

    // Flatten all skills
    const allSkills = Array.from(groupMap.values()).flat();

    return {
      categories,
      skills: allSkills,
    };
  }

  /**
   * Map groupId to group name (hardcoded for now, TODO: load from SDE or database)
   */
  private getGroupName(groupId: number): string {
    const groupNames: Record<number, string> = {
      255: 'Gunnery',
      256: 'Missiles',
      257: 'Spaceship Command',
      // 258 is the Fleet Support leadership skills (armored / information /
      // siege warfare links, etc.).
      258: 'Fleet Support',
      // 266: Corporation Management (corp roles, empire control, etc.)
      266: 'Corporation Management',
      // 268: Production / Industry (Industry, Mass Production, ship
      // construction, etc.)
      268: 'Production',
      // 269: Rigging (rig skills)
      269: 'Rigging',
      // 270: Science (research, datacores, etc.)
      270: 'Science',
      // 272: Electronic Systems (Hacking, Electronic Upgrades, etc.)
      272: 'Electronic Systems',
      // 273: Drones
      273: 'Drones',
      // 274: Trade (market skills: Trade, Accounting, Broker Relations, etc.)
      274: 'Trade',
      // 275: Navigation (afterburner, warp drive operation, etc.)
      275: 'Navigation',
      // 278: Social (connections, diplomacy, etc.)
      278: 'Social',
      // 505: Fake / test skills (unpublished) – keep label but these should
      // not normally appear because we filter by published=true.
      505: 'Fake Skills',
      // 508 is not a skill group (module group), but keep a label for safety.
      508: 'Missile Launcher Torpedo',
      // 1209: Shields
      1209: 'Shields',
      // 1210: Armor (Mechanics, Hull Upgrades, armor comps, etc.)
      1210: 'Armor',
      // 1213: Targeting (signature analysis, long range targeting, etc.)
      1213: 'Targeting',
      // 1216: Engineering (capacitor, power grid, etc.)
      1216: 'Engineering',
      // 1217: Scanning (Astrometrics, Hacking in exploration context, etc.)
      1217: 'Scanning',
      // 1218: Resource Processing (ore / ice / gas processing)
      1218: 'Resource Processing',
      // 1220: Neural Enhancement (implants, biology, etc.)
      1220: 'Neural Enhancement',
      // 1240: Subsystems (for T3 cruisers)
      1240: 'Subsystems',
      // 1241: Planet Management (PI)
      1241: 'Planet Management',
      // 1545: Structure Management (citadel management)
      1545: 'Structure Management',
      4734: 'Sequencing',
    };

    return groupNames[groupId] || `Group ${groupId}`;
  }

  async getPlanForUser(userId: string, planId: string) {
    const plan = await this.prisma.skillPlan.findFirst({
      where: { id: planId, userId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Skill plan not found');
    }

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      totalEstimatedTimeSeconds: plan.totalEstimatedTimeSeconds,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      steps: plan.steps.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        targetLevel: s.targetLevel,
        order: s.order,
        notes: s.notes,
      })),
    };
  }

  async createPlanForUser(
    userId: string,
    input: { name: string; description?: string | null },
  ) {
    const created = await this.prisma.skillPlan.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? null,
      },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      totalEstimatedTimeSeconds: created.totalEstimatedTimeSeconds,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updatePlanForUser(
    userId: string,
    planId: string,
    input: {
      name?: string;
      description?: string;
      steps?: Array<{
        skillId: number;
        targetLevel: number;
        order: number;
        notes?: string;
      }>;
    },
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const plan = await tx.skillPlan.findFirst({
        where: { id: planId, userId },
        select: { id: true },
      });

      if (!plan) {
        throw new NotFoundException('Skill plan not found');
      }

      if (input.name !== undefined || input.description !== undefined) {
        await tx.skillPlan.update({
          where: { id: planId },
          data: {
            name: input.name ?? undefined,
            description: input.description ?? undefined,
          },
        });
      }

      if (input.steps) {
        await tx.skillPlanStep.deleteMany({ where: { planId } });
        if (input.steps.length > 0) {
          await tx.skillPlanStep.createMany({
            data: input.steps.map((s, idx) => ({
              planId,
              skillId: s.skillId,
              targetLevel: s.targetLevel,
              order: s.order ?? idx,
              notes: s.notes ?? null,
            })),
          });
        }
      }

      const full = await tx.skillPlan.findUnique({
        where: { id: planId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });

      if (!full) {
        throw new NotFoundException('Skill plan not found after update');
      }

      return {
        id: full.id,
        name: full.name,
        description: full.description,
        totalEstimatedTimeSeconds: full.totalEstimatedTimeSeconds,
        createdAt: full.createdAt.toISOString(),
        updatedAt: full.updatedAt.toISOString(),
        steps: full.steps.map((s) => ({
          id: s.id,
          skillId: s.skillId,
          targetLevel: s.targetLevel,
          order: s.order,
          notes: s.notes,
        })),
      };
    });
  }

  async deletePlanForUser(userId: string, planId: string) {
    const plan = await this.prisma.skillPlan.findFirst({
      where: { id: planId, userId },
      select: { id: true },
    });

    if (!plan) {
      throw new NotFoundException('Skill plan not found');
    }

    await this.prisma.skillPlan.delete({
      where: { id: planId },
    });

    return { ok: true as const };
  }

  async exportPlanText(
    userId: string,
    planId: string,
  ): Promise<{ text: string }> {
    const plan = await this.prisma.skillPlan.findFirst({
      where: { id: planId, userId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Skill plan not found');
    }

    if (plan.steps.length === 0) {
      return {
        text: `[Skill Plan] ${plan.name}\n\n(no steps)`,
      };
    }

    const skillIds = Array.from(new Set(plan.steps.map((s) => s.skillId)));
    const typeRows = await this.prisma.typeId.findMany({
      where: { id: { in: skillIds } },
      select: { id: true, name: true },
    });
    const typeNameById = new Map<number, string>();
    for (const row of typeRows) {
      typeNameById.set(row.id, row.name);
    }

    const roman = ['I', 'II', 'III', 'IV', 'V'];

    const lines: string[] = [];
    lines.push(`[Skill Plan] ${plan.name}`);
    lines.push('');

    for (const step of plan.steps) {
      const typeName = typeNameById.get(step.skillId);
      const skillName = typeName ?? `Type ${step.skillId}`;
      const lvl = Math.max(1, Math.min(5, step.targetLevel));
      const lvlLabel = roman[lvl - 1] ?? String(lvl);
      lines.push(`${skillName} ${lvlLabel}`);
    }

    return { text: lines.join('\n') };
  }

  private ensureOwnedCharacter(
    userId: string,
    characterId: number,
  ): Promise<{ id: number }> {
    return this.prisma.eveCharacter
      .findFirstOrThrow({
        where: { id: characterId, userId },
        select: { id: true },
      })
      .catch(() => {
        throw new ForbiddenException(
          'Character does not belong to current user',
        );
      });
  }

  private toAttributeSet(attrs: CharacterAttributesResponse): AttributeSet {
    return {
      intelligence: attrs.intelligence,
      memory: attrs.memory,
      perception: attrs.perception,
      willpower: attrs.willpower,
      charisma: attrs.charisma,
    };
  }

  private async buildPlanStepsForOptimization(
    steps: Array<{ skillId: number; targetLevel: number }>,
    currentLevels?: Map<number, number>,
  ): Promise<PlanStepForOptimization[]> {
    const skillIds = Array.from(
      new Set(steps.filter((s) => s.targetLevel > 0).map((s) => s.skillId)),
    );
    if (skillIds.length === 0) return [];

    // Look up skill metadata from SkillDefinition (SDE-backed). We require
    // rank and primary/secondary attributes to be present; otherwise we treat
    // this as a configuration error that should surface loudly.
    return this.prisma.skillDefinition
      .findMany({
        where: { typeId: { in: skillIds } },
        select: {
          typeId: true,
          rank: true,
          primaryAttribute: true,
          secondaryAttribute: true,
        },
      })
      .then((defs) => {
        const byId = new Map<
          number,
          {
            rank: number;
            primaryAttribute: SkillPrimaryAttribute;
            secondaryAttribute: SkillPrimaryAttribute;
          }
        >();
        for (const d of defs) {
          if (d.rank == null || !d.primaryAttribute || !d.secondaryAttribute) {
            // Skip incomplete entries; we'll error when we actually need them.
            continue;
          }
          byId.set(d.typeId, {
            rank: d.rank,
            primaryAttribute: d.primaryAttribute as SkillPrimaryAttribute,
            secondaryAttribute: d.secondaryAttribute as SkillPrimaryAttribute,
          });
        }

        const result: PlanStepForOptimization[] = [];
        for (const s of steps) {
          if (s.targetLevel <= 0) continue;
          const meta = byId.get(s.skillId);
          if (!meta) {
            throw new InternalServerErrorException(
              `Missing skill metadata for type ${s.skillId}. Ensure SDE skill definitions have been imported.`,
            );
          }
          const currentLevel = currentLevels?.get(s.skillId) ?? 0;
          result.push({
            skillId: s.skillId,
            rank: meta.rank,
            currentLevel,
            targetLevel: Math.min(5, s.targetLevel),
            primaryAttribute: meta.primaryAttribute,
            secondaryAttribute: meta.secondaryAttribute,
          });
        }
        return result;
      });
  }

  private estimateTotalTrainingSecondsForPlan(
    steps: PlanStepForOptimization[],
    attrs: AttributeSet,
  ): number {
    let total = 0;
    for (const step of steps) {
      const seconds = estimateTrainingTimeSeconds({
        currentLevel: step.currentLevel,
        targetLevel: step.targetLevel,
        rank: step.rank,
        attrs,
        primary: step.primaryAttribute,
        secondary: step.secondaryAttribute,
      });
      total += seconds;
    }
    return total;
  }

  async suggestAttributesForPlan(
    userId: string,
    planId: string,
    options: { characterId?: number },
  ) {
    const plan = await this.prisma.skillPlan.findFirst({
      where: { id: planId, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!plan) {
      throw new NotFoundException('Skill plan not found');
    }

    const planSteps = await this.buildPlanStepsForOptimization(
      plan.steps.map((s) => ({
        skillId: s.skillId,
        targetLevel: s.targetLevel,
      })),
    );

    if (planSteps.length === 0) {
      return {
        recommendedAttributes: null,
        reasoning: 'Plan has no steps; nothing to optimise.',
        estimatedTrainingSecondsCurrent: null,
        estimatedTrainingSecondsRecommended: null,
      };
    }

    let currentAttrs: AttributeSet | null = null;
    let currentAttrsResponse: CharacterAttributesResponse | null = null;

    if (options.characterId) {
      await this.ensureOwnedCharacter(userId, options.characterId);
      const attrsRaw = await this.esiChars.getAttributes(options.characterId);
      currentAttrsResponse = {
        characterId: options.characterId,
        intelligence: attrsRaw.intelligence,
        memory: attrsRaw.memory,
        charisma: attrsRaw.charisma,
        perception: attrsRaw.perception,
        willpower: attrsRaw.willpower,
        bonusRemaps: attrsRaw.bonus_remaps ?? null,
        lastRemapDate: attrsRaw.last_remap_date ?? null,
        accruedRemapCooldownDate: attrsRaw.accrued_remap_cooldown_date ?? null,
      };
      currentAttrs = this.toAttributeSet(currentAttrsResponse);
    }

    const baseAttrs: AttributeSet =
      currentAttrs ??
      ({
        intelligence: 20,
        memory: 20,
        perception: 20,
        willpower: 20,
        charisma: 20,
      } satisfies AttributeSet);

    const suggestion = suggestAttributesForPlan(planSteps, {
      baseAttributes: baseAttrs,
    });

    let estCurrent: number | null = null;
    let estRecommended: number | null = null;

    if (currentAttrs) {
      estCurrent = this.estimateTotalTrainingSecondsForPlan(
        planSteps,
        currentAttrs,
      );
    }

    estRecommended = this.estimateTotalTrainingSecondsForPlan(
      planSteps,
      suggestion.recommended,
    );

    return {
      recommendedAttributes: suggestion.recommended,
      reasoning: suggestion.reasoning,
      estimatedTrainingSecondsCurrent: estCurrent,
      estimatedTrainingSecondsRecommended: estRecommended,
    };
  }

  async previewOptimizationForPlan(
    userId: string,
    planId: string,
    options: {
      mode?: 'FULL' | 'RESPECT_ORDER';
      maxRemaps?: number;
      characterId?: number;
      implantBonus?: number;
      boosterBonus?: number;
    },
  ) {
    const plan = await this.prisma.skillPlan.findFirst({
      where: { id: planId, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!plan) {
      throw new NotFoundException('Skill plan not found');
    }

    const planSteps = await this.buildPlanStepsForOptimization(
      plan.steps.map((s) => ({
        skillId: s.skillId,
        targetLevel: s.targetLevel,
      })),
    );

    if (planSteps.length === 0) {
      const nowIso = new Date().toISOString();
      return {
        originalTotalSeconds: 0,
        optimizedTotalSeconds: 0,
        remapWindows: [],
        steps: [],
        generatedAt: nowIso,
      };
    }

    let baseAttrs: AttributeSet | null = null;

    if (options.characterId) {
      await this.ensureOwnedCharacter(userId, options.characterId);
      const attrsRaw = await this.esiChars.getAttributes(options.characterId);
      baseAttrs = this.toAttributeSet({
        characterId: options.characterId,
        intelligence: attrsRaw.intelligence,
        memory: attrsRaw.memory,
        charisma: attrsRaw.charisma,
        perception: attrsRaw.perception,
        willpower: attrsRaw.willpower,
        bonusRemaps: attrsRaw.bonus_remaps ?? null,
        lastRemapDate: attrsRaw.last_remap_date ?? null,
        accruedRemapCooldownDate: attrsRaw.accrued_remap_cooldown_date ?? null,
      });
    }

    if (!baseAttrs) {
      baseAttrs = {
        intelligence: 20,
        memory: 20,
        perception: 20,
        willpower: 20,
        charisma: 20,
      };
    }

    const suggestion = suggestAttributesForPlan(planSteps, {
      baseAttributes: baseAttrs,
    });

    const originalTotalSeconds = this.estimateTotalTrainingSecondsForPlan(
      planSteps,
      baseAttrs,
    );
    const optimizedTotalSeconds = this.estimateTotalTrainingSecondsForPlan(
      planSteps,
      suggestion.recommended,
    );

    const nowIso = new Date().toISOString();

    return {
      originalTotalSeconds,
      optimizedTotalSeconds,
      remapWindows: [
        {
          index: 0,
          attributes: suggestion.recommended,
          implantBonus: options.implantBonus ?? 0,
          boosterBonus: options.boosterBonus ?? 0,
        },
      ],
      steps: plan.steps.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        targetLevel: s.targetLevel,
        order: s.order,
        notes: s.notes,
        remapWindowIndex: 0,
      })),
      generatedAt: nowIso,
    };
  }

  async applyOptimizationForPlan(
    userId: string,
    planId: string,
    options: {
      mode?: 'FULL' | 'RESPECT_ORDER';
      maxRemaps?: number;
      characterId?: number;
      implantBonus?: number;
      boosterBonus?: number;
    },
  ) {
    const preview = await this.previewOptimizationForPlan(
      userId,
      planId,
      options,
    );

    await this.prisma.skillPlan.update({
      where: { id: planId, userId },
      data: {
        config: {
          optimization: {
            mode: options.mode ?? 'RESPECT_ORDER',
            maxRemaps: options.maxRemaps ?? 1,
            implantBonus: options.implantBonus ?? 0,
            boosterBonus: options.boosterBonus ?? 0,
            recommendedAttributes: preview.remapWindows[0]?.attributes ?? null,
            lastUpdatedAt: preview.generatedAt,
          },
        },
      },
    });

    return preview;
  }

  async assignPlanToCharacter(
    userId: string,
    planId: string,
    characterId: number,
  ) {
    await this.ensureOwnedCharacter(userId, characterId);

    const plan = await this.prisma.skillPlan.findFirst({
      where: { id: planId, userId },
      select: { id: true, name: true },
    });

    if (!plan) {
      throw new NotFoundException('Skill plan not found');
    }

    const character = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true, name: true },
    });

    if (!character) {
      throw new ForbiddenException('Character does not belong to current user');
    }

    const assignment = await this.prisma.skillPlanAssignment.upsert({
      where: {
        // No natural unique, so emulate via composite lookup then create/update.
        // We rely on (planId, characterId) uniqueness at the app layer.
        id:
          (
            await this.prisma.skillPlanAssignment.findFirst({
              where: { skillPlanId: planId, characterId },
              select: { id: true },
            })
          )?.id ?? '',
      },
      create: {
        skillPlanId: planId,
        characterId,
        settings: {},
      },
      update: {},
    });

    return {
      id: assignment.id,
      planId,
      characterId: assignment.characterId,
      characterName: character.name,
      settings: assignment.settings ?? undefined,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    };
  }

  async unassignPlanFromCharacter(
    userId: string,
    planId: string,
    characterId: number,
  ) {
    await this.ensureOwnedCharacter(userId, characterId);

    const assignment = await this.prisma.skillPlanAssignment.findFirst({
      where: { skillPlanId: planId, characterId },
      select: { id: true },
    });

    if (!assignment) {
      return { ok: true as const };
    }

    await this.prisma.skillPlanAssignment.delete({
      where: { id: assignment.id },
    });

    return { ok: true as const };
  }

  async getPlanProgressForCharacter(
    userId: string,
    planId: string,
    characterId: number,
  ) {
    await this.ensureOwnedCharacter(userId, characterId);

    const plan = await this.prisma.skillPlan.findFirst({
      where: { id: planId, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!plan) {
      throw new NotFoundException('Skill plan not found');
    }

    if (plan.steps.length === 0) {
      const nowIso = new Date().toISOString();
      return {
        planId,
        characterId,
        completionPercent: 100,
        totalPlanSp: 0,
        trainedPlanSp: 0,
        remainingSeconds: 0,
        skills: [],
        queueStatus: 'MATCHED',
        queueDifferences: {
          missingSkills: [],
          underTrainedSkills: [],
          extraSkills: [],
          orderMismatches: [],
        },
        lastUpdated: nowIso,
      };
    }

    const [skillsSnapshot, queue, attrs] = await Promise.all([
      this.characterManagement.getCharacterSkills(userId, characterId),
      this.characterManagement.getCharacterTrainingQueue(userId, characterId),
      this.characterManagement.getCharacterAttributes(userId, characterId),
    ]);

    const trainedLevelBySkill = new Map<number, number>();
    for (const s of skillsSnapshot.skills) {
      trainedLevelBySkill.set(s.skillId, s.trainedSkillLevel);
    }

    const currentLevelsMap = new Map<number, number>();
    for (const step of plan.steps) {
      currentLevelsMap.set(
        step.skillId,
        trainedLevelBySkill.get(step.skillId) ?? 0,
      );
    }

    const planStepsForTime = await this.buildPlanStepsForOptimization(
      plan.steps.map((s) => ({
        skillId: s.skillId,
        targetLevel: s.targetLevel,
      })),
      currentLevelsMap,
    );

    const attrSet = this.toAttributeSet(attrs);
    const remainingSeconds = this.estimateTotalTrainingSecondsForPlan(
      planStepsForTime,
      attrSet,
    );

    // Level-based progress approximation
    let totalWeight = 0;
    let progressSum = 0;
    const skillProgress = plan.steps.map((step) => {
      const trainedLevel = trainedLevelBySkill.get(step.skillId) ?? 0;
      let status: 'complete' | 'in_progress' | 'not_started' = 'not_started';

      if (trainedLevel >= step.targetLevel) {
        status = 'complete';
      } else if (
        queue.entries?.some(
          (e) =>
            e.skillId === step.skillId && (e.levelEnd ?? 0) >= step.targetLevel,
        )
      ) {
        status = 'in_progress';
      }

      const ratio = Math.min(1, trainedLevel / step.targetLevel);
      totalWeight += 1;
      progressSum += ratio;

      return {
        skillId: step.skillId,
        targetLevel: step.targetLevel,
        trainedLevel,
        status,
      };
    });

    const completionPercent =
      totalWeight > 0 ? (progressSum / totalWeight) * 100 : 0;

    // SP-like weighting using levels as a proxy
    let totalPlanSp = 0;
    let trainedPlanSp = 0;
    for (const sp of skillProgress) {
      totalPlanSp += sp.targetLevel;
      trainedPlanSp += Math.min(sp.trainedLevel, sp.targetLevel);
    }

    // Queue comparison
    const planSkillMaxLevel = new Map<number, number>();
    plan.steps.forEach((s, idx) => {
      const existing = planSkillMaxLevel.get(s.skillId) ?? 0;
      planSkillMaxLevel.set(s.skillId, Math.max(existing, s.targetLevel));
    });

    const queueBySkill = new Map<
      number,
      { maxLevel: number; firstIndex: number }
    >();
    queue.entries
      .slice()
      .sort((a, b) => a.queuePosition - b.queuePosition)
      .forEach((e, idx) => {
        const prev = queueBySkill.get(e.skillId);
        const levelEnd = e.levelEnd ?? 0;
        if (!prev) {
          queueBySkill.set(e.skillId, { maxLevel: levelEnd, firstIndex: idx });
        } else {
          queueBySkill.set(e.skillId, {
            maxLevel: Math.max(prev.maxLevel, levelEnd),
            firstIndex: prev.firstIndex,
          });
        }
      });

    const missingSkills: number[] = [];
    const underTrainedSkills: number[] = [];
    const orderMismatches: Array<{
      skillId: number;
      expectedPosition: number;
      actualPosition: number;
    }> = [];

    const planOrderIndex = new Map<number, number>();
    plan.steps.forEach((s, idx) => {
      if (!planOrderIndex.has(s.skillId)) {
        planOrderIndex.set(s.skillId, idx);
      }
    });

    for (const [skillId, targetLevel] of planSkillMaxLevel.entries()) {
      const queueInfo = queueBySkill.get(skillId);
      if (!queueInfo) {
        missingSkills.push(skillId);
        continue;
      }
      if (queueInfo.maxLevel < targetLevel) {
        underTrainedSkills.push(skillId);
      }
      const expected = planOrderIndex.get(skillId) ?? 0;
      const actual = queueInfo.firstIndex;
      if (Math.abs(expected - actual) > 0) {
        orderMismatches.push({
          skillId,
          expectedPosition: expected,
          actualPosition: actual,
        });
      }
    }

    const extraSkills: number[] = [];
    for (const skillId of queueBySkill.keys()) {
      if (!planSkillMaxLevel.has(skillId)) {
        extraSkills.push(skillId);
      }
    }

    let queueStatus: 'MATCHED' | 'PARTIAL' | 'MISMATCHED' = 'MATCHED';
    if (
      missingSkills.length === planSkillMaxLevel.size ||
      planSkillMaxLevel.size === 0
    ) {
      queueStatus = 'MISMATCHED';
    } else if (
      missingSkills.length > 0 ||
      underTrainedSkills.length > 0 ||
      orderMismatches.length > 0
    ) {
      queueStatus = 'PARTIAL';
    }

    const nowIso = new Date().toISOString();

    return {
      planId,
      characterId,
      completionPercent,
      totalPlanSp,
      trainedPlanSp,
      remainingSeconds,
      skills: skillProgress,
      queueStatus,
      queueDifferences: {
        missingSkills,
        underTrainedSkills,
        extraSkills,
        orderMismatches,
      },
      lastUpdated: nowIso,
    };
  }
}
