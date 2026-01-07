import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';
import type { RolloverType } from '@eve/prisma';

export type AutoRolloverSettingsDto = {
  enabled: boolean;
  defaultRolloverType: 'FULL_PAYOUT' | 'INITIAL_ONLY';
};

@Injectable()
export class AutoRolloverSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeType(
    type: RolloverType | 'FULL_PAYOUT' | 'INITIAL_ONLY' | undefined,
  ): 'FULL_PAYOUT' | 'INITIAL_ONLY' {
    if (!type) return 'INITIAL_ONLY';
    if (type === 'FULL_PAYOUT' || type === 'INITIAL_ONLY') return type;
    throw new BadRequestException(
      'Automatic rollover only supports FULL_PAYOUT or INITIAL_ONLY',
    );
  }

  async getForUser(userId: string): Promise<AutoRolloverSettingsDto> {
    const row = await this.prisma.autoRolloverSettings.findUnique({
      where: { userId },
      select: {
        enabled: true,
        defaultRolloverType: true,
      },
    });

    return {
      enabled: row?.enabled ?? false,
      defaultRolloverType: this.normalizeType(row?.defaultRolloverType),
    };
  }

  async upsertForUser(
    userId: string,
    input: { enabled: boolean; defaultRolloverType?: RolloverType },
  ): Promise<AutoRolloverSettingsDto> {
    const normalizedType = this.normalizeType(input.defaultRolloverType);

    // If enabling, type must be explicitly valid (normalizeType enforces)
    if (input.enabled && !normalizedType) {
      throw new BadRequestException(
        'defaultRolloverType is required when enabling automatic rollover',
      );
    }

    const row = await this.prisma.autoRolloverSettings.upsert({
      where: { userId },
      create: {
        userId,
        enabled: input.enabled,
        defaultRolloverType: normalizedType,
      },
      update: {
        enabled: input.enabled,
        defaultRolloverType: normalizedType,
      },
      select: {
        enabled: true,
        defaultRolloverType: true,
      },
    });

    return {
      enabled: row.enabled,
      defaultRolloverType: this.normalizeType(row.defaultRolloverType),
    };
  }
}
