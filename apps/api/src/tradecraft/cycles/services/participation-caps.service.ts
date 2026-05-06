import { Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';

export type TradecraftCaps = {
  principalCapIsk: number;
  maximumCapIsk: number;
};

export type EffectiveTradecraftCaps = TradecraftCaps & {
  effectivePrincipalCapIsk: number;
};

@Injectable()
export class ParticipationCapsService {
  static readonly DEFAULT_PRINCIPAL_CAP_ISK = 10_000_000_000;
  static readonly DEFAULT_MAXIMUM_CAP_ISK = 20_000_000_000;

  constructor(private readonly prisma: PrismaService) {}

  defaults(): TradecraftCaps {
    return {
      principalCapIsk: ParticipationCapsService.DEFAULT_PRINCIPAL_CAP_ISK,
      maximumCapIsk: ParticipationCapsService.DEFAULT_MAXIMUM_CAP_ISK,
    };
  }

  async getUserTradecraftCaps(userId: string): Promise<TradecraftCaps> {
    const rec = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tradecraftPrincipalCapIsk: true,
        tradecraftMaximumCapIsk: true,
      },
    });

    const principalCapIsk =
      rec?.tradecraftPrincipalCapIsk == null
        ? NaN
        : Number(rec.tradecraftPrincipalCapIsk);
    const maximumCapIsk =
      rec?.tradecraftMaximumCapIsk == null
        ? NaN
        : Number(rec.tradecraftMaximumCapIsk);

    return {
      principalCapIsk: Number.isFinite(principalCapIsk)
        ? principalCapIsk
        : ParticipationCapsService.DEFAULT_PRINCIPAL_CAP_ISK,
      maximumCapIsk: Number.isFinite(maximumCapIsk)
        ? maximumCapIsk
        : ParticipationCapsService.DEFAULT_MAXIMUM_CAP_ISK,
    };
  }

  async getEffectivePrincipalCapForUser(
    userId: string,
    principalCapIsk: number,
  ): Promise<number> {
    // Active admin-funded JingleYield principal consumes user-funded headroom.
    const activeJyPrograms = await this.prisma.jingleYieldProgram.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        lockedPrincipalIsk: true,
      },
    });

    if (activeJyPrograms.length === 0) return principalCapIsk;

    const totalJyPrincipal = activeJyPrograms.reduce(
      (sum, program) => sum + Number(program.lockedPrincipalIsk),
      0,
    );
    return Math.max(0, principalCapIsk - totalJyPrincipal);
  }

  async getTradecraftCapsForUser(
    userId?: string,
  ): Promise<EffectiveTradecraftCaps> {
    if (!userId) {
      return {
        ...this.defaults(),
        effectivePrincipalCapIsk:
          ParticipationCapsService.DEFAULT_PRINCIPAL_CAP_ISK,
      };
    }

    const caps = await this.getUserTradecraftCaps(userId);
    const effectivePrincipalCapIsk =
      await this.getEffectivePrincipalCapForUser(
        userId,
        caps.principalCapIsk,
      );
    return { ...caps, effectivePrincipalCapIsk };
  }
}
