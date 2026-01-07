import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(take: number, skip: number) {
    return await this.prisma.user.findMany({
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        email: true,
        primaryCharacterId: true,
        characters: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async listTradecraftUsers(take: number, skip: number) {
    // Collect distinct user IDs that have interacted with Tradecraft.
    const ids = new Set<string>();

    const participationIds = await this.prisma.cycleParticipation.findMany({
      where: { userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    });
    for (const r of participationIds) {
      if (typeof r.userId === 'string' && r.userId.length > 0)
        ids.add(r.userId);
    }

    const settingsIds = await this.prisma.autoRolloverSettings.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });
    for (const r of settingsIds) {
      if (typeof r.userId === 'string' && r.userId.length > 0)
        ids.add(r.userId);
    }

    const jyIds = await this.prisma.jingleYieldProgram.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });
    for (const r of jyIds) {
      if (typeof r.userId === 'string' && r.userId.length > 0)
        ids.add(r.userId);
    }

    const allIds = [...ids];
    if (allIds.length === 0) return [];

    // Participation stats (count + last participation timestamp)
    const stats = await this.prisma.cycleParticipation.groupBy({
      by: ['userId'],
      where: { userId: { in: allIds } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const statsByUserId = new Map<
      string,
      { participationCount: number; lastParticipationAt: Date | null }
    >();
    for (const s of stats) {
      const uid = s.userId;
      if (uid) {
        statsByUserId.set(uid, {
          participationCount: s._count._all,
          lastParticipationAt: s._max.createdAt ?? null,
        });
      }
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: allIds } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        tradecraftPrincipalCapIsk: true,
        tradecraftMaximumCapIsk: true,
        primaryCharacter: { select: { id: true, name: true } },
      },
    });

    return users.map((u) => {
      const s = statsByUserId.get(u.id) ?? {
        participationCount: 0,
        lastParticipationAt: null,
      };
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        primaryCharacter: u.primaryCharacter,
        participationCount: s.participationCount,
        lastParticipationAt: s.lastParticipationAt?.toISOString() ?? null,
        tradecraftPrincipalCapIsk: u.tradecraftPrincipalCapIsk
          ? String(u.tradecraftPrincipalCapIsk)
          : null,
        tradecraftMaximumCapIsk: u.tradecraftMaximumCapIsk
          ? String(u.tradecraftMaximumCapIsk)
          : null,
        createdAt: u.createdAt.toISOString(),
      };
    });
  }

  async updateTradecraftCaps(
    userId: string,
    input: { principalCapIsk: string | null; maximumCapIsk: string | null },
  ) {
    const parse = (label: string, v: string | null) => {
      if (v == null) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException(`Invalid ${label}`);
      }
      return n;
    };

    const principal = parse('principalCapIsk', input.principalCapIsk);
    const maximum = parse('maximumCapIsk', input.maximumCapIsk);

    if (principal != null && maximum != null && principal > maximum) {
      throw new BadRequestException(
        'principalCapIsk cannot exceed maximumCapIsk',
      );
    }

    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        tradecraftPrincipalCapIsk:
          principal == null ? null : principal.toFixed(2),
        tradecraftMaximumCapIsk: maximum == null ? null : maximum.toFixed(2),
      },
      select: {
        id: true,
        tradecraftPrincipalCapIsk: true,
        tradecraftMaximumCapIsk: true,
      },
    });
  }

  // Back-compat for the older API name: treated as maximum cap.
  async updateTradecraftMaxParticipation(
    userId: string,
    maxIsk: string | null,
  ) {
    return await this.updateTradecraftCaps(userId, {
      principalCapIsk: null,
      maximumCapIsk: maxIsk,
    });
  }

  async clearTradecraftMaxParticipationDeprecated(userId: string) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { tradecraftMaximumCapIsk: null },
      select: { id: true, tradecraftMaximumCapIsk: true },
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
