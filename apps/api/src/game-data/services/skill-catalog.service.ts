import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { SkillPrerequisite } from '@eve/shared/skill-contracts';

const SKILL_GROUP_NAMES: Record<number, string> = {
  255: 'Gunnery',
  256: 'Missiles',
  257: 'Spaceship Command',
  258: 'Fleet Support',
  266: 'Corporation Management',
  268: 'Production',
  269: 'Rigging',
  270: 'Science',
  272: 'Electronic Systems',
  273: 'Drones',
  274: 'Trade',
  275: 'Navigation',
  278: 'Social',
  505: 'Fake Skills',
  508: 'Missile Launcher Torpedo',
  1209: 'Shields',
  1210: 'Armor',
  1213: 'Targeting',
  1216: 'Engineering',
  1217: 'Scanning',
  1218: 'Resource Processing',
  1220: 'Neural Enhancement',
  1240: 'Subsystems',
  1241: 'Planet Management',
  1545: 'Structure Management',
  4734: 'Sequencing',
};

@Injectable()
export class SkillCatalogService {
  constructor(private readonly prisma: PrismaService) {}

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

    return rows.map((row) => ({
      typeId: row.typeId,
      name: row.type.name,
      groupId: row.groupId,
      rank: row.rank ?? null,
      primaryAttribute: row.primaryAttribute ?? null,
      secondaryAttribute: row.secondaryAttribute ?? null,
    }));
  }

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

    const skillNameById = new Map<number, string>();
    for (const skill of skills) {
      skillNameById.set(skill.typeId, skill.nameEn || skill.type.name);
    }

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
        subGroupKey: string | null;
        subGroupLabel: string | null;
        published: boolean;
      }>
    >();

    for (const skill of skills) {
      const rank = skill.rank ?? 1;
      const prerequisites = this.buildPrerequisites(skill, skillNameById);
      const groupName = this.getGroupName(skill.groupId);

      const skillEntry = {
        skillId: skill.typeId,
        name: skill.nameEn || skill.type.name,
        description: skill.descriptionEn || '',
        primaryAttribute: skill.primaryAttribute || 'intelligence',
        secondaryAttribute: skill.secondaryAttribute || 'memory',
        trainingMultiplier: rank,
        spLevel1: this.skillPointsForLevel(rank, 1),
        spLevel2: this.skillPointsForLevel(rank, 2),
        spLevel3: this.skillPointsForLevel(rank, 3),
        spLevel4: this.skillPointsForLevel(rank, 4),
        spLevel5: this.skillPointsForLevel(rank, 5),
        prerequisites,
        requiredBy: [],
        categoryId: 16,
        categoryName: 'Skills',
        groupId: skill.groupId,
        groupName,
        subGroupKey: null,
        subGroupLabel: null,
        published: skill.type.published,
      };

      const groupSkills = groupMap.get(skill.groupId) ?? [];
      groupSkills.push(skillEntry);
      groupMap.set(skill.groupId, groupSkills);
    }

    const requiredByMap = new Map<number, SkillPrerequisite[]>();
    for (const groupSkills of groupMap.values()) {
      for (const skill of groupSkills) {
        for (const prerequisite of skill.prerequisites) {
          const existing = requiredByMap.get(prerequisite.skillId) ?? [];
          existing.push({
            skillId: skill.skillId,
            skillName: skill.name,
            requiredLevel: prerequisite.requiredLevel,
          });
          requiredByMap.set(prerequisite.skillId, existing);
        }
      }
    }

    for (const groupSkills of groupMap.values()) {
      for (const skill of groupSkills) {
        skill.requiredBy = requiredByMap.get(skill.skillId) ?? [];
      }
    }

    return {
      categories: [
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
      ],
      skills: Array.from(groupMap.values()).flat(),
    };
  }

  private buildPrerequisites(
    skill: {
      prerequisite1Id: number | null;
      prerequisite1Level: number | null;
      prerequisite2Id: number | null;
      prerequisite2Level: number | null;
      prerequisite3Id: number | null;
      prerequisite3Level: number | null;
    },
    skillNameById: Map<number, string>,
  ): SkillPrerequisite[] {
    const pairs = [
      [skill.prerequisite1Id, skill.prerequisite1Level],
      [skill.prerequisite2Id, skill.prerequisite2Level],
      [skill.prerequisite3Id, skill.prerequisite3Level],
    ] as const;

    return pairs.flatMap(([skillId, requiredLevel]) => {
      if (!skillId || !requiredLevel) return [];
      return [
        {
          skillId,
          skillName: skillNameById.get(skillId) || `Skill ${skillId}`,
          requiredLevel,
        },
      ];
    });
  }

  private skillPointsForLevel(rank: number, level: number): number {
    return Math.floor(250 * rank * Math.pow(2, 2.5 * (level - 1)));
  }

  private getGroupName(groupId: number): string {
    return SKILL_GROUP_NAMES[groupId] || `Group ${groupId}`;
  }
}
