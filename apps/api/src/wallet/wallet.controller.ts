import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { WalletService } from './wallet.service';

@Controller('wallet-import')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('character')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async importCharacter(@Query('characterId') characterId: string) {
    const id = Number(characterId);
    return await this.wallet.importForCharacter(id);
  }

  @Get('transactions')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          characterId: z.coerce.number().int().positive().optional(),
          sinceDays: z.coerce.number().int().min(1).max(90).optional(),
          limit: z.coerce.number().int().min(1).max(1000).optional(),
          offset: z.coerce.number().int().min(0).optional(),
        })
        .strict(),
    ),
  )
  async listTransactions(
    @Query()
    query: {
      characterId?: number;
      sinceDays?: number;
      limit?: number;
      offset?: number;
    },
  ) {
    const id = query.characterId;
    const since = new Date(
      Date.now() - (query.sinceDays ?? 14) * 24 * 3600 * 1000,
    );
    return await this.wallet.listTransactions(
      id,
      since,
      query.limit,
      query.offset,
    );
  }

  @Get('journal')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          characterId: z.coerce.number().int().positive().optional(),
          sinceDays: z.coerce.number().int().min(1).max(90).optional(),
          limit: z.coerce.number().int().min(1).max(1000).optional(),
          offset: z.coerce.number().int().min(0).optional(),
        })
        .strict(),
    ),
  )
  async listJournal(
    @Query()
    query: {
      characterId?: number;
      sinceDays?: number;
      limit?: number;
      offset?: number;
    },
  ) {
    const id = query.characterId;
    const since = new Date(
      Date.now() - (query.sinceDays ?? 14) * 24 * 3600 * 1000,
    );
    return await this.wallet.listJournal(id, since, query.limit, query.offset);
  }

  @Get('all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async importAll() {
    return await this.wallet.importAllLinked();
  }
}
