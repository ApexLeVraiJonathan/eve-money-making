import { PrismaClient } from '@eve/prisma';

export class TestFactories {
  constructor(private readonly prisma: PrismaClient) {}

  async createCharacter(overrides?: Partial<{ id: number; name: string }>) {
    const id = overrides?.id ?? Math.floor(100000 + Math.random() * 900000);
    const name = overrides?.name ?? `TestChar_${id}`;
    return await this.prisma.eveCharacter.create({
      data: { id, name, ownerHash: `owner_${id}` },
    });
  }
}
