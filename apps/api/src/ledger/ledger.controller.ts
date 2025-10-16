import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UsePipes,
  Patch,
  Delete,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { z } from 'zod';
import { UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Public } from '../auth/public.decorator';

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
  private readonly logger = new Logger(LedgerController.name);

  constructor(private readonly ledger: LedgerService) {}

  @Post('cycles')
  @UsePipes(new ZodValidationPipe(CreateCycleSchema))
  @Roles('ADMIN')
  async createCycle(@Body() body: CreateCycleRequest) {
    return await this.ledger.createCycle(body);
  }

  @Post('cycles/plan')
  @UsePipes(new ZodValidationPipe(PlanCycleSchema))
  @Roles('ADMIN')
  async planCycle(@Body() body: PlanCycleRequest): Promise<unknown> {
    return await this.ledger.planCycle(body);
  }

  @Public()
  @Get('cycles')
  async listCycles() {
    return await this.ledger.listCycles();
  }

  @Public()
  @Get('cycles/overview')
  async cyclesOverview(): Promise<unknown> {
    return (await this.ledger.getCycleOverview()) as unknown;
  }

  @Post('cycles/:id/close')
  @Roles('ADMIN')
  async closeCycle(@Param('id') id: string): Promise<unknown> {
    return await this.ledger.closeCycle(id, new Date());
  }

  @Post('cycles/:id/open')
  @UsePipes(new ZodValidationPipe(OpenCycleSchema))
  @Roles('ADMIN')
  async openCycle(
    @Param('id') id: string,
    @Body() body: OpenCycleRequest,
  ): Promise<unknown> {
    return await this.ledger.openPlannedCycle({
      cycleId: id,
      startedAt: body.startedAt,
    });
  }

  @Post('entries')
  @UsePipes(new ZodValidationPipe(AppendEntrySchema))
  @Roles('ADMIN')
  async append(@Body() body: AppendEntryRequest): Promise<unknown> {
    return await this.ledger.appendEntry(body);
  }

  @Public()
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
  ): Promise<unknown> {
    return await this.ledger.listEntriesEnriched(
      query.cycleId,
      query.limit,
      query.offset,
    );
  }

  @Public()
  @Get('nav/:cycleId')
  async nav(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.computeNav(cycleId);
  }

  @Public()
  @Get('capital/:cycleId')
  async capital(
    @Param('cycleId') cycleId: string,
    @Query('force') force?: string,
  ): Promise<unknown> {
    const shouldForce = force === 'true' || force === '1' || force === 'yes';
    return await this.ledger.computeCapital(cycleId, { force: shouldForce });
  }

  // Participations
  @Post('cycles/:cycleId/participations')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          characterName: z.string().min(1).optional(),
          amountIsk: z.string().regex(/^\d+\.\d{2}$/),
        })
        .strict(),
    ),
  )
  async createParticipation(
    @Param('cycleId') cycleId: string,
    @Body() body: { characterName?: string; amountIsk: string },
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    // Prefer session identity when characterName not provided
    const characterName = body.characterName ?? user?.name ?? undefined;
    return await this.ledger.createParticipation({
      cycleId,
      characterName,
      amountIsk: body.amountIsk,
      userId: user?.userId ?? undefined, // Link to user if authenticated
    });
  }

  @Get('cycles/:cycleId/participations')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async listParticipations(
    @Param('cycleId') cycleId: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    return await this.ledger.listParticipations(cycleId, status);
  }

  @Get('cycles/:cycleId/participations/me')
  async myParticipation(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    const uid = user?.userId ?? null;
    this.logger.log(
      `[GET /participations/me] cycleId=${cycleId}, userId=${uid}, user=${JSON.stringify(user)}`,
    );
    if (!uid) {
      this.logger.warn('[GET /participations/me] No userId, returning null');
      return null;
    }
    const result = await this.ledger.getMyParticipation(cycleId, uid);
    this.logger.log(
      `[GET /participations/me] Found participation: ${result ? `id=${result.id}, status=${result.status}` : 'null'}`,
    );
    return result as unknown;
  }

  @Get('participations/all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async allParticipations(): Promise<unknown> {
    return await this.ledger.getAllParticipations();
  }

  @Get('participations/unmatched-donations')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async unmatchedDonations(): Promise<unknown> {
    return await this.ledger.getUnmatchedDonations();
  }

  @Post('participations/:id/mark-payout-sent')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async markPayoutSent(@Param('id') id: string): Promise<unknown> {
    return await this.ledger.markPayoutAsSent(id);
  }

  @Post('participations/:id/opt-out')
  async optOut(@Param('id') id: string): Promise<unknown> {
    return await this.ledger.optOutParticipation(id);
  }

  @Post('participations/match')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async matchPayments(@Query('cycleId') cycleId?: string): Promise<unknown> {
    return await this.ledger.matchParticipationPayments(cycleId);
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
  ): Promise<unknown> {
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
  async refund(
    @Param('id') id: string,
    @Body() body: { amountIsk: string },
  ): Promise<unknown> {
    return await this.ledger.adminMarkRefund({
      participationId: id,
      amountIsk: body.amountIsk,
    });
  }

  // Payouts
  @Get('cycles/:cycleId/payouts/suggest')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async suggestPayouts(
    @Param('cycleId') cycleId: string,
    @Query('profitSharePct') pct?: string,
  ): Promise<unknown> {
    const p = pct ? Math.max(0, Math.min(1, Number(pct))) : 0.5;
    return await this.ledger.computePayouts(cycleId, p);
  }

  @Get('commits/summary')
  @UsePipes(
    new ZodValidationPipe(z.object({ cycleId: z.string().uuid() }).strict()),
  )
  async commitSummaries(@Query('cycleId') cycleId: string): Promise<unknown> {
    return (await this.ledger.getCommitSummaries(cycleId)) as unknown;
  }

  @Post('cycles/:cycleId/payouts/finalize')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
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
  ): Promise<unknown> {
    return await this.ledger.finalizePayouts(
      cycleId,
      body.profitSharePct ?? 0.5,
    );
  }

  // ===== Cycle Lines (Buy Commits) =====

  @Post('cycles/:cycleId/lines')
  @Roles('ADMIN')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          typeId: z.number().int(),
          destinationStationId: z.number().int(),
          plannedUnits: z.number().int().min(1),
        })
        .strict(),
    ),
  )
  async createCycleLine(
    @Param('cycleId') cycleId: string,
    @Body()
    body: {
      typeId: number;
      destinationStationId: number;
      plannedUnits: number;
    },
  ): Promise<unknown> {
    return await this.ledger.createCycleLine({
      cycleId,
      ...body,
    });
  }

  @Get('cycles/:cycleId/lines')
  async listCycleLines(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.listCycleLines(cycleId);
  }

  @Patch('lines/:lineId')
  @Roles('ADMIN')
  @UsePipes(
    new ZodValidationPipe(
      z.object({ plannedUnits: z.number().int().min(1).optional() }).strict(),
    ),
  )
  async updateCycleLine(
    @Param('lineId') lineId: string,
    @Body() body: { plannedUnits?: number },
  ): Promise<unknown> {
    return await this.ledger.updateCycleLine(lineId, body);
  }

  @Delete('lines/:lineId')
  @Roles('ADMIN')
  async deleteCycleLine(@Param('lineId') lineId: string): Promise<unknown> {
    return await this.ledger.deleteCycleLine(lineId);
  }

  // ===== Fees =====

  @Post('lines/:lineId/broker-fee')
  @Roles('ADMIN')
  @UsePipes(
    new ZodValidationPipe(
      z.object({ amountIsk: z.string().regex(/^\d+\.\d{2}$/) }).strict(),
    ),
  )
  async addBrokerFee(
    @Param('lineId') lineId: string,
    @Body() body: { amountIsk: string },
  ): Promise<unknown> {
    return await this.ledger.addBrokerFee({ lineId, ...body });
  }

  @Post('lines/:lineId/relist-fee')
  @Roles('ADMIN')
  @UsePipes(
    new ZodValidationPipe(
      z.object({ amountIsk: z.string().regex(/^\d+\.\d{2}$/) }).strict(),
    ),
  )
  async addRelistFee(
    @Param('lineId') lineId: string,
    @Body() body: { amountIsk: string },
  ): Promise<unknown> {
    return await this.ledger.addRelistFee({ lineId, ...body });
  }

  @Post('cycles/:cycleId/transport-fee')
  @Roles('ADMIN')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          amountIsk: z.string().regex(/^\d+\.\d{2}$/),
          memo: z.string().optional(),
        })
        .strict(),
    ),
  )
  async addTransportFee(
    @Param('cycleId') cycleId: string,
    @Body() body: { amountIsk: string; memo?: string },
  ): Promise<unknown> {
    return await this.ledger.addTransportFee({ cycleId, ...body });
  }

  @Get('cycles/:cycleId/transport-fees')
  @Roles('ADMIN')
  async listTransportFees(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.listTransportFees(cycleId);
  }

  // ===== Cycle Profit & Snapshots =====

  @Get('cycles/:cycleId/profit')
  async getCycleProfit(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.computeCycleProfit(cycleId);
  }

  @Post('cycles/:cycleId/snapshot')
  @Roles('ADMIN')
  async createSnapshot(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.createCycleSnapshot(cycleId);
  }

  @Public()
  @Get('cycles/:cycleId/snapshots')
  async getSnapshots(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.getCycleSnapshots(cycleId);
  }
}
