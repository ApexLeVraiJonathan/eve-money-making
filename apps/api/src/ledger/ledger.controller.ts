import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

const CreateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  startedAt: z.coerce.date(),
  // Optional in DB for back-compat; clients should provide going forward
  initialInjectionIsk: z
    .string()
    .regex(/^\d+\.\d{2}$/)
    .optional(),
});
type CreateCycleRequest = z.infer<typeof CreateCycleSchema>;

const PlanCycleSchema = z.object({
  name: z.string().min(1).optional(),
  startedAt: z.coerce.date(), // should be future
  initialInjectionIsk: z
    .string()
    .regex(/^\d+\.\d{2}$/)
    .optional(),
});
type PlanCycleRequest = z.infer<typeof PlanCycleSchema>;

const OpenCycleSchema = z.object({
  startedAt: z.coerce.date().optional(),
});
type OpenCycleRequest = z.infer<typeof OpenCycleSchema>;

const AppendEntrySchema = z.object({
  cycleId: z.string().uuid(),
  entryType: z.enum(['deposit', 'withdrawal', 'fee', 'execution']),
  amountIsk: z.string().regex(/^\d+\.\d{2}$/),
  occurredAt: z.coerce.date().optional(),
  memo: z.string().optional(),
  planCommitId: z.string().uuid().optional(),
});
type AppendEntryRequest = z.infer<typeof AppendEntrySchema>;

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Post('cycles')
  @UsePipes(new ZodValidationPipe(CreateCycleSchema))
  async createCycle(@Body() body: CreateCycleRequest) {
    return await this.ledger.createCycle(body);
  }

  @Post('cycles/plan')
  @UsePipes(new ZodValidationPipe(PlanCycleSchema))
  async planCycle(@Body() body: PlanCycleRequest) {
    return await this.ledger.planCycle(body);
  }

  @Get('cycles')
  async listCycles() {
    return await this.ledger.listCycles();
  }

  @Post('cycles/:id/close')
  async closeCycle(@Param('id') id: string) {
    return await this.ledger.closeCycle(id, new Date());
  }

  @Post('cycles/:id/open')
  @UsePipes(new ZodValidationPipe(OpenCycleSchema))
  async openCycle(@Param('id') id: string, @Body() body: OpenCycleRequest) {
    return await this.ledger.openPlannedCycle({
      cycleId: id,
      startedAt: body.startedAt,
    });
  }

  @Post('entries')
  @UsePipes(new ZodValidationPipe(AppendEntrySchema))
  async append(@Body() body: AppendEntryRequest) {
    return await this.ledger.appendEntry(body);
  }

  @Get('entries')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          cycleId: z.string().uuid(),
          limit: z.coerce.number().int().min(1).max(1000).optional(),
          offset: z.coerce.number().int().min(0).optional(),
        })
        .strict(),
    ),
  )
  async list(
    @Query()
    query: {
      cycleId: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return await this.ledger.listEntriesEnriched(
      query.cycleId,
      query.limit,
      query.offset,
    );
  }

  @Get('nav/:cycleId')
  async nav(@Param('cycleId') cycleId: string) {
    return await this.ledger.computeNav(cycleId);
  }

  @Get('capital/:cycleId')
  async capital(
    @Param('cycleId') cycleId: string,
    @Query('force') force?: string,
  ) {
    const shouldForce = force === 'true' || force === '1' || force === 'yes';
    return await this.ledger.computeCapital(cycleId, { force: shouldForce });
  }

  // Participations
  @Post('cycles/:cycleId/participations')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          characterName: z.string().min(1),
          amountIsk: z.string().regex(/^\d+\.\d{2}$/),
        })
        .strict(),
    ),
  )
  async createParticipation(
    @Param('cycleId') cycleId: string,
    @Body() body: { characterName: string; amountIsk: string },
  ) {
    return await this.ledger.createParticipation({
      cycleId,
      characterName: body.characterName,
      amountIsk: body.amountIsk,
    });
  }

  @Get('cycles/:cycleId/participations')
  async listParticipations(
    @Param('cycleId') cycleId: string,
    @Query('status') status?: string,
  ) {
    return await this.ledger.listParticipations(cycleId, status);
  }

  @Post('participations/:id/opt-out')
  async optOut(@Param('id') id: string) {
    return await this.ledger.optOutParticipation(id);
  }

  @Post('participations/:id/validate')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          walletJournal: z
            .object({
              characterId: z.number().int(),
              journalId: z.coerce.bigint(),
            })
            .optional(),
        })
        .strict(),
    ),
  )
  async validatePayment(
    @Param('id') id: string,
    @Body()
    body: { walletJournal?: { characterId: number; journalId: bigint } },
  ) {
    return await this.ledger.adminValidatePayment({
      participationId: id,
      walletJournal: body.walletJournal ?? null,
    });
  }

  @Post('participations/:id/refund')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(
    new ZodValidationPipe(
      z.object({ amountIsk: z.string().regex(/^\d+\.\d{2}$/) }).strict(),
    ),
  )
  async refund(@Param('id') id: string, @Body() body: { amountIsk: string }) {
    return await this.ledger.adminMarkRefund({
      participationId: id,
      amountIsk: body.amountIsk,
    });
  }

  // Payouts
  @Get('cycles/:cycleId/payouts/suggest')
  async suggestPayouts(
    @Param('cycleId') cycleId: string,
    @Query('profitSharePct') pct?: string,
  ) {
    const p = pct ? Math.max(0, Math.min(1, Number(pct))) : 0.5;
    return await this.ledger.computePayouts(cycleId, p);
  }

  @Post('cycles/:cycleId/payouts/finalize')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({ profitSharePct: z.number().min(0).max(1).optional() })
        .strict(),
    ),
  )
  async finalizePayouts(
    @Param('cycleId') cycleId: string,
    @Body() body: { profitSharePct?: number },
  ) {
    return await this.ledger.finalizePayouts(
      cycleId,
      body.profitSharePct ?? 0.5,
    );
  }
}
