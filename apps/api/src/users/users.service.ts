import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(take: number, skip: number) {
    return await this.prisma.user.findMany({
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        primaryCharacterId: true,
        characters: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async setRole(userId: string, role: 'ADMIN' | 'USER') {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    });
  }

  async forceLink(userId: string, characterId: number) {
    await this.prisma.eveCharacter.update({
      where: { id: characterId },
      data: { userId },
    });
    return { ok: true } as const;
  }

  async listMyCharacters(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        primaryCharacterId: true,
        characters: { select: { id: true, name: true } },
      },
    });
    return (
      u?.characters?.map((c) => ({
        id: c.id,
        name: c.name,
        isPrimary: c.id === (u?.primaryCharacterId ?? 0),
      })) ?? []
    );
  }

  async setPrimaryCharacter(userId: string, characterId: number) {
    // Ensure the character belongs to the user
    const ch = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });
    if (!ch) throw new Error('Character not linked to user');
    await this.prisma.user.update({
      where: { id: userId },
      data: { primaryCharacterId: characterId },
    });
    return { ok: true } as const;
  }

  async unlinkCharacter(userId: string, characterId: number) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCharacterId: true },
    });
    if (!u) throw new Error('User not found');
    if (u.primaryCharacterId === characterId)
      throw new Error('Cannot unlink primary character');
    // Ensure belongs to user
    const ch = await this.prisma.eveCharacter.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });
    if (!ch) throw new Error('Character not linked to user');
    await this.prisma.eveCharacter.update({
      where: { id: characterId },
      data: { userId: null },
    });
    return { ok: true } as const;
  }
}
