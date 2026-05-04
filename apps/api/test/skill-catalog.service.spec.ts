import { SkillCatalogService } from '../src/game-data/services/skill-catalog.service';

describe('SkillCatalogService', () => {
  it('serves catalog search results from SkillDefinition data', async () => {
    const prisma = {
      skillDefinition: {
        findMany: jest.fn(async () => [
          {
            typeId: 3300,
            groupId: 255,
            rank: 1,
            primaryAttribute: 'perception',
            secondaryAttribute: 'willpower',
            type: { name: 'Gunnery' },
          },
        ]),
      },
    };
    const service = new SkillCatalogService(prisma as any);

    await expect(service.searchSkillCatalog('gun', 20)).resolves.toEqual([
      {
        typeId: 3300,
        name: 'Gunnery',
        groupId: 255,
        rank: 1,
        primaryAttribute: 'perception',
        secondaryAttribute: 'willpower',
      },
    ]);
  });

  it('builds encyclopedia prerequisites and required-by links', async () => {
    const prisma = {
      skillDefinition: {
        findMany: jest.fn(async () => [
          {
            typeId: 3300,
            groupId: 255,
            nameEn: 'Gunnery',
            descriptionEn: 'Basic turret operation',
            rank: 1,
            primaryAttribute: 'perception',
            secondaryAttribute: 'willpower',
            prerequisite1Id: null,
            prerequisite1Level: null,
            prerequisite2Id: null,
            prerequisite2Level: null,
            prerequisite3Id: null,
            prerequisite3Level: null,
            type: { name: 'Gunnery', published: true },
          },
          {
            typeId: 3310,
            groupId: 255,
            nameEn: 'Rapid Firing',
            descriptionEn: 'Faster turret cycling',
            rank: 2,
            primaryAttribute: 'perception',
            secondaryAttribute: 'willpower',
            prerequisite1Id: 3300,
            prerequisite1Level: 2,
            prerequisite2Id: null,
            prerequisite2Level: null,
            prerequisite3Id: null,
            prerequisite3Level: null,
            type: { name: 'Rapid Firing', published: true },
          },
        ]),
      },
    };
    const service = new SkillCatalogService(prisma as any);

    const result = await service.getSkillEncyclopedia();

    expect(result.categories[0]).toEqual(
      expect.objectContaining({
        categoryId: 16,
        categoryName: 'Skills',
        totalSkillCount: 2,
      }),
    );
    expect(result.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 3300,
          requiredBy: [
            { skillId: 3310, skillName: 'Rapid Firing', requiredLevel: 2 },
          ],
        }),
        expect.objectContaining({
          skillId: 3310,
          prerequisites: [
            { skillId: 3300, skillName: 'Gunnery', requiredLevel: 2 },
          ],
        }),
      ]),
    );
  });
});
